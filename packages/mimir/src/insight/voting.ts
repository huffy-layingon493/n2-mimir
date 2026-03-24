// Insight voting — UPVOTE/DOWNVOTE management
import type { MimirDatabase } from '../store/database.js';
import type { InsightOperation } from '../types.js';

/**
 * Apply insight operations to the database.
 * Handles ADD, EDIT, UPVOTE, DOWNVOTE operations from insight generation.
 */
export function applyOperations(
  db: MimirDatabase,
  operations: ReadonlyArray<InsightOperation>,
): { applied: number; skipped: number } {
  let applied = 0;
  let skipped = 0;

  for (const op of operations) {
    try {
      switch (op.op) {
        case 'ADD':
          db.insertInsight(op.insight);
          applied++;
          break;
        case 'UPVOTE':
          db.upvoteInsight(op.insightId);
          applied++;
          break;
        case 'DOWNVOTE':
          db.downvoteInsight(op.insightId);
          applied++;
          break;
      }
    } catch {
      skipped++;
    }
  }

  return { applied, skipped };
}

/**
 * Find duplicate insights by checking category + similar description.
 * Returns the ID of existing insight for UPVOTE instead of ADD.
 */
export function findDuplicateInsight(
  db: MimirDatabase,
  category: string,
  description: string,
): string | null {
  const existing = db.queryInsights({
    category,
    status: 'active',
    limit: 20,
  });

  // Simple similarity check — same category + significant word overlap
  const newWords = new Set(description.toLowerCase().split(/\s+/).filter((w) => w.length > 3));

  for (const insight of existing) {
    const existingWords = new Set(insight.description.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
    const overlap = [...newWords].filter((w) => existingWords.has(w)).length;
    const similarity = overlap / Math.max(newWords.size, 1);

    if (similarity > 0.5) {
      return insight.id;
    }
  }

  return null;
}

/**
 * Deduplicate insight operations — convert ADDs to UPVOTEs when similar exists.
 */
export function deduplicateOperations(
  db: MimirDatabase,
  operations: ReadonlyArray<InsightOperation>,
): InsightOperation[] {
  return operations.map((op) => {
    if (op.op !== 'ADD') return op;

    const existingId = findDuplicateInsight(db, op.insight.category, op.insight.description);
    if (existingId) {
      return { op: 'UPVOTE', insightId: existingId } as const;
    }

    return op;
  });
}
