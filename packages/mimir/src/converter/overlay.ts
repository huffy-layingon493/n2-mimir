// Overlay converter — generates prompt injection text from insights
import type { Insight } from '../types.js';
import { scoreInsight } from '../analyzer/weight.js';

/**
 * Generate a prompt overlay from relevant insights.
 * This is what gets injected when a topic is mentioned.
 * Uses token budget to prevent context overflow.
 */
export function generateOverlay(
  insights: ReadonlyArray<Insight>,
  tokenBudget = 500,
  halfLife = 14,
): string {
  if (insights.length === 0) return '';

  // Score and sort by relevance
  const scored = insights
    .map((insight) => ({ insight, score: scoreInsight(insight, halfLife) }))
    .sort((a, b) => b.score - a.score);

  const lines: string[] = [];
  let tokensUsed = 0;

  // Header
  const header = '⚡ Mímir Experience Overlay:';
  tokensUsed += estimateTokens(header);
  lines.push(header);

  for (const { insight } of scored) {
    // Use compressed version (cheaper) if available, else full description
    const text = insight.compressed || insight.description;
    const cost = estimateTokens(text) + 5; // 5 for bullet + newline

    if (tokensUsed + cost > tokenBudget) break;

    const prefix = insight.status === 'graduated' ? '🔒' : insight.importance >= 4 ? '⚠️' : '💡';
    lines.push(`${prefix} ${text}`);
    tokensUsed += cost;
  }

  if (lines.length <= 1) return ''; // Only header, no insights fit budget

  return lines.join('\n');
}

/** Rough token estimation (1 token ≈ 4 chars) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
