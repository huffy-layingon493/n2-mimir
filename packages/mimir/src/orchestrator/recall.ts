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
  const experienceMap = new Map<string, ExperienceEntry>();
  for (const e of intersectionExperiences) experienceMap.set(e.id, e);
  for (const r of ftsResults) experienceMap.set(r.experience.id, r.experience);
  for (const e of tagExperiences) experienceMap.set(e.id, e);
  for (const e of projectExperiences) experienceMap.set(e.id, e);

  // Path 6: Semantic search (Tier 2 — if Embedder is available)
  if (embedder?.isAvailable()) {
    const allEmbeddings = db.getAllEmbeddings();
    if (allEmbeddings.length > 0) {
      // Try sync lookup from cache (populated during digest/addExperience)
      const queryEmbedding = embedder.embedSync(topic);
      if (queryEmbedding) {
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
        // Sort by similarity, take top results
        scored.sort((a, b) => b.score - a.score);
        const topIds = scored.slice(0, limit).map((s) => s.id);
        for (const id of topIds) {
          const exp = db.getExperience(id);
          if (exp) experienceMap.set(exp.id, exp);
        }
      }
    }
  }

  // Deduplicate insights
  const insightMap = new Map<string, Insight>();
  for (const i of insights) insightMap.set(i.id, i);

  // Assess confidence for question sequence (§8-9)
  const allExperiences = [...experienceMap.values()];
  const allInsights = [...insightMap.values()];
  const { confidence, dominantPattern, patternCounts } = assessConfidence(allExperiences);

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
  experiences: ReadonlyArray<ExperienceEntry>,
): {
  confidence: RecallConfidence;
  dominantPattern?: string;
  patternCounts?: Array<{ pattern: string; count: number }>;
} {
  if (experiences.length === 0) {
    return { confidence: 'none' };
  }

  // Count action patterns to determine clarity
  const actionCounts = new Map<string, number>();
  for (const exp of experiences) {
    // Normalize action to first 50 chars for grouping
    const key = exp.action.slice(0, 50).toLowerCase();
    actionCounts.set(key, (actionCounts.get(key) ?? 0) + 1);
  }

  const sorted = [...actionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([pattern, count]) => ({ pattern, count }));

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
