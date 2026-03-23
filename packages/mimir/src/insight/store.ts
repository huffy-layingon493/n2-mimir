// Insight store — insight lifecycle management
import type { MimirDatabase } from '../store/database.js';
import type { Insight, InsightFilter } from '../types.js';

/** Graduation threshold */
const GRADUATION_IMPORTANCE = 5;
const GRADUATION_EFFECT_SCORE = 0.8;

/**
 * Check and graduate eligible insights.
 * Graduated insights have been repeatedly validated and should be
 * converted to enforced rules (Ark/Clotho).
 */
export function checkGraduation(db: MimirDatabase): Insight[] {
  const candidates = db.queryInsights({
    status: 'active',
    minImportance: GRADUATION_IMPORTANCE,
  });

  const graduated: Insight[] = [];

  for (const insight of candidates) {
    if (insight.effectScore >= GRADUATION_EFFECT_SCORE) {
      graduated.push(insight);
    }
  }

  return graduated;
}

/** Get active insights for a given filter */
export function getActiveInsights(db: MimirDatabase, filter: InsightFilter): Insight[] {
  return db.queryInsights({ ...filter, status: 'active' });
}

/** Get graduated insights (ready for rule conversion) */
export function getGraduatedInsights(db: MimirDatabase): Insight[] {
  return db.queryInsights({ status: 'graduated' });
}

/** Retire dormant insights (importance dropped to 0) */
export function retireDormantInsights(db: MimirDatabase): number {
  const dormant = db.queryInsights({ status: 'active', limit: 100 });
  let retired = 0;

  for (const insight of dormant) {
    if (insight.importance <= 0) {
      db.downvoteInsight(insight.id); // This triggers retirement in database.ts
      retired++;
    }
  }

  return retired;
}
