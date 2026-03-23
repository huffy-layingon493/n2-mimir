// Assembler — assemble recalled experiences + insights into token-budgeted output
import type { RecallResult, AssemblyResult, Insight } from '../types.js';
import { scoreInsight } from '../analyzer/weight.js';
import { generateOverlay } from '../converter/overlay.js';

/**
 * Assemble recalled results into a token-budgeted overlay.
 * This is the final step: recall results → prompt-ready text.
 *
 * Budget allocation:
 * - 70% for insights (compressed)
 * - 30% for experience examples (top relevant)
 */
export function assemble(
  result: RecallResult,
  tokenBudget = 500,
  halfLife = 14,
): AssemblyResult {
  // Score and sort insights
  const scoredInsights = result.insights
    .map((insight) => ({ insight, score: scoreInsight(insight, halfLife), tokenCost: insight.tokenCost }))
    .sort((a, b) => b.score - a.score);

  // Budget split: 70% insights, 30% experience context
  const insightBudget = Math.floor(tokenBudget * 0.7);
  const experienceBudget = tokenBudget - insightBudget;

  // Select insights within budget
  const selectedInsights: Insight[] = [];
  let insightTokens = 0;

  for (const { insight, tokenCost } of scoredInsights) {
    const cost = tokenCost || Math.ceil(insight.compressed.length / 4);
    if (insightTokens + cost > insightBudget) break;
    selectedInsights.push(insight);
    insightTokens += cost;
  }

  // Generate overlay from selected insights
  const overlay = generateOverlay(selectedInsights, insightBudget, halfLife);

  // Add experience examples if budget allows
  const experienceLines: string[] = [];
  let expTokens = 0;

  for (const exp of result.experiences.slice(0, 5)) {
    const line = `• [${exp.type}] ${exp.action.slice(0, 60)} → ${exp.outcome.slice(0, 60)}`;
    const cost = Math.ceil(line.length / 4);
    if (expTokens + cost > experienceBudget) break;
    experienceLines.push(line);
    expTokens += cost;
  }

  const fullOverlay = experienceLines.length > 0
    ? `${overlay}\n\n📋 관련 경험:\n${experienceLines.join('\n')}`
    : overlay;

  return {
    overlay: fullOverlay,
    totalTokens: insightTokens + expTokens,
    insightCount: selectedInsights.length,
    selectedIds: selectedInsights.map((i) => i.id),
  };
}
