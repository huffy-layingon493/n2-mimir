// Cascading Recall — architecture.md section 8-3
// When a topic is given, recall relevant experiences through multiple search paths
import type { MimirDatabase } from '../store/database.js';
import type { RecallResult, ExperienceEntry, Insight, RankedExperience, TagFrequency } from '../types.js';
import { classify, extractSearchTerms } from './classifier.js';

/**
 * Cascading Recall: the core of Mímir's "experience just comes to you" mechanism.
 *
 * When the user mentions a topic:
 * 1. Classify → determine domains
 * 2. FTS5 search → full-text keyword match
 * 3. Tag search → hierarchical tag chain recall
 * 4. Category filter → direct category match on insights
 * 5. Merge & deduplicate
 *
 * All in ~10ms thanks to SQLite indexes.
 */
export function recall(
  db: MimirDatabase,
  topic: string,
  project?: string,
  agent?: string,
  limit = 20,
): RecallResult {
  const categories = classify(topic);
  const searchTerms = extractSearchTerms(topic);

  // Path 1: FTS5 full-text search on experiences
  const ftsQuery = searchTerms.join(' OR ');
  const ftsResults: RankedExperience[] = ftsQuery
    ? db.searchExperiences(ftsQuery, limit)
    : [];

  // Path 2: Tag-based cascading recall
  const tagFrequencies: TagFrequency[] = db.getTagFrequencies(searchTerms, limit);
  const tagExperiences: ExperienceEntry[] = db.findExperiencesByTags(searchTerms, limit);

  // Path 3: Category-based insight retrieval
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

  // Path 4: Project-scoped experience filter
  const projectExperiences = project
    ? db.queryExperiences({ project, limit })
    : [];

  // Merge & deduplicate experiences
  const experienceMap = new Map<string, ExperienceEntry>();
  for (const r of ftsResults) experienceMap.set(r.experience.id, r.experience);
  for (const e of tagExperiences) experienceMap.set(e.id, e);
  for (const e of projectExperiences) experienceMap.set(e.id, e);

  // Deduplicate insights
  const insightMap = new Map<string, Insight>();
  for (const i of insights) insightMap.set(i.id, i);

  return {
    experiences: [...experienceMap.values()],
    tagChain: tagFrequencies,
    insights: [...insightMap.values()],
    ftsResults,
  };
}
