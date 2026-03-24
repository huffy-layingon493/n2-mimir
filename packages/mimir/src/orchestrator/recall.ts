// Cascading Recall — architecture.md section 8-3 + 8-8 (intersection) + 8-9 (question sequence)
// When a topic is given, recall relevant experiences through multiple search paths
import type { MimirDatabase } from '../store/database.js';
import type { RecallResult, ExperienceEntry, Insight, RankedExperience, TagFrequency } from '../types.js';
import { classify, extractSearchTerms, decomposeQuery } from './classifier.js';
import type { Embedder } from '../semantic/embedder.js';
import { cosineSimilarity } from '../utils/math.js';

/** Recall confidence level — drives question sequence behavior (§8-9) */
export type RecallConfidence = 'none' | 'ambiguous' | 'clear';

/** Extended recall result with confidence metadata for question sequence */
export interface RecallResultWithConfidence extends RecallResult {
  readonly confidence: RecallConfidence;
  readonly dominantPattern?: string;
  readonly patternCounts?: ReadonlyArray<{ pattern: string; count: number }>;
}

/**
 * Cascading Recall: the core of Mímir's "experience just comes to you" mechanism.
 *
 * When the user mentions a topic:
 * 1. Classify → determine domains
 * 2. Decompose → split composite query into layers (§8-8)
 * 3. Intersection search → multi-layer AND (if composite)
 * 4. FTS5 search → full-text keyword match
 * 5. Tag search → hierarchical tag chain recall
 * 6. Category filter → direct category match on insights
 * 7. Merge & deduplicate
 * 8. Assess confidence → drive question sequence (§8-9)
 *
 * All in ~10ms thanks to SQLite indexes.
 */
export function recall(
  db: MimirDatabase,
  topic: string,
  project?: string,
  agent?: string,
  limit = 20,
  embedder?: Embedder,
): RecallResultWithConfidence {
  const categories = classify(topic);
  const searchTerms = extractSearchTerms(topic);
  const layers = decomposeQuery(topic);

  // Path 1: Layer intersection search (§8-8 — composite query)
  let intersectionExperiences: ExperienceEntry[] = [];
  if (layers.length > 1) {
    // Expand layers with similar tags (auto-confirmed only, confidence >= 0.9)
    const expandedLayers = layers.map((layer) => {
      const expanded = [...layer];
      for (const tag of layer) {
        const similar = db.findSimilarTags(tag, true); // autoOnly=true
        expanded.push(...similar.map((s) => s.tag));
      }
      return expanded;
    });
    intersectionExperiences = db.findExperiencesByTagsIntersection(expandedLayers, limit);
  }

  // Path 2: FTS5 full-text search on experiences
  const ftsQuery = searchTerms.join(' OR ');
  const ftsResults: RankedExperience[] = ftsQuery
    ? db.searchExperiences(ftsQuery, limit)
    : [];

  // Path 3: Tag-based cascading recall
  const tagFrequencies: TagFrequency[] = db.getTagFrequencies(searchTerms, limit);
  const tagExperiences: ExperienceEntry[] = db.findExperiencesByTags(searchTerms, limit);

  // Path 4: Category-based insight retrieval
  const insights: Insight[] = [];
  for (const category of categories) {
    const categoryInsights = db.queryInsights({
      category,
      status: 'active',
      agent: agent,
      limit: Math.ceil(limit / categories.length),
    });
    insights.push(...categoryInsights);
  }

  // Also get graduated insights (highest priority)
  const graduated = db.queryInsights({ status: 'graduated', limit: 10 });
  insights.push(...graduated);

  // Path 5: Project-scoped experience filter
  const projectExperiences = project
    ? db.queryExperiences({ project, limit })
    : [];

  // Merge & deduplicate experiences (intersection results first — highest priority)
  // We only set if not present to preserve the insertion order and semantic ranking.
  const experienceMap = new Map<string, ExperienceEntry>();
  const addExperience = (e: ExperienceEntry) => {
    if (!experienceMap.has(e.id)) {
      experienceMap.set(e.id, e);
    }
  };

  for (const e of intersectionExperiences) addExperience(e);
  for (const r of ftsResults) addExperience(r.experience);
  for (const e of tagExperiences) addExperience(e);

  // Path 6: Semantic search (Tier 2 — if Embedder is available AND embeddings exist)
  if (embedder?.isAvailable()) {
    const queryEmbedding = embedder.embedSync(topic);
    if (queryEmbedding) {
      // Only scan when fallback store has embeddings (Rust mode returns [] for now)
      const allEmbeddings = db.getAllEmbeddings();
      if (allEmbeddings.length > 0) {
        const scored: Array<{ id: string; score: number }> = [];
        for (const stored of allEmbeddings) {
          const score = cosineSimilarity(
            queryEmbedding.vector as number[],
            stored.vector as number[],
          );
          if (score > 0.7) {
            scored.push({ id: stored.sourceId, score });
          }
        }
        scored.sort((a, b) => b.score - a.score);
        for (const s of scored.slice(0, limit)) {
          const exp = db.getExperience(s.id);
          if (exp) addExperience(exp);
        }
      }
    }
  }

  // Path 7: Project-scoped experience filter (widest catch-all, lowest priority)
  for (const e of projectExperiences) addExperience(e);

  // Deduplicate insights
  const insightMap = new Map<string, Insight>();
  for (const i of insights) insightMap.set(i.id, i);

  // Assess confidence for question sequence (§8-9)
  const allExperiences = [...experienceMap.values()];
  const allInsights = [...insightMap.values()];
  const { confidence, dominantPattern, patternCounts } = assessConfidence(db, allExperiences);

  return {
    experiences: allExperiences,
    tagChain: tagFrequencies,
    insights: allInsights,
    ftsResults,
    confidence,
    dominantPattern,
    patternCounts,
  };
}

/**
 * Assess recall confidence based on experience count and pattern clarity.
 * Drives the question sequence behavior (architecture.md §8-9).
 */
function assessConfidence(
  db: MimirDatabase,
  experiences: ReadonlyArray<ExperienceEntry>,
): {
  confidence: RecallConfidence;
  dominantPattern?: string;
  patternCounts?: Array<{ pattern: string; count: number }>;
} {
  if (experiences.length === 0) {
    return { confidence: 'none' };
  }

  // Dual-mode clustering: Semantic vs Jaccard Textual
  const clusters: Array<{
    pattern: string;
    count: number;
    vector?: readonly number[];
    tokens: Set<string>;
  }> = [];

  for (const exp of experiences) {
    const vectorData = db.getEmbedding('experience', exp.id);
    const vector = vectorData?.vector;
    
    // Fallback tokenizer (lowercase words, Unicode-aware for Korean/multilingual)
    const tokens = new Set(exp.action.toLowerCase().match(/[\w\u3131-\u318E\uAC00-\uD7A3]+/g) ?? []);
    
    let matchedCluster = false;
    
    for (const cluster of clusters) {
      if (vector && cluster.vector) {
        // Semantic mode
        const sim = cosineSimilarity(vector as number[], cluster.vector as number[]);
        if (sim >= 0.85) {
          cluster.count++;
          matchedCluster = true;
          break;
        }
      } else {
        // Textual fallback mode (Jaccard distance)
        let intersection = 0;
        for (const t of tokens) if (cluster.tokens.has(t)) intersection++;
        const union = tokens.size + cluster.tokens.size - intersection;
        const jaccard = union === 0 ? 1 : intersection / union;
        
        if (jaccard >= 0.7) {
          cluster.count++;
          matchedCluster = true;
          break;
        }
      }
    }
    
    if (!matchedCluster) {
      clusters.push({
        pattern: exp.action,
        count: 1,
        vector,
        tokens,
      });
    }
  }

  const sorted = clusters
    .sort((a, b) => b.count - a.count)
    .map((c) => ({ pattern: c.pattern, count: c.count }));

  if (sorted.length === 0) {
    return { confidence: 'none' };
  }

  // Clear pattern: dominant action has > 50% of experiences, or only 1 pattern
  const total = experiences.length;
  const topRatio = sorted[0].count / total;

  if (sorted.length === 1 || topRatio >= 0.5) {
    return {
      confidence: 'clear',
      dominantPattern: sorted[0].pattern,
      patternCounts: sorted,
    };
  }

  return {
    confidence: 'ambiguous',
    patternCounts: sorted,
  };
}
