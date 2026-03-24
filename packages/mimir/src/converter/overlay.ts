// Overlay converter — generates prompt injection text from insights
// Includes question sequence logic (architecture.md §8-9)
import type { Insight } from '../types.js';
import type { RecallConfidence } from '../orchestrator/recall.js';
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

/**
 * Generate question sequence prefix based on recall confidence (architecture.md §8-9).
 *
 * - none:      "⚡ 이 주제는 처음입니다. 사용자에게 구체적으로 질문하세요."
 * - ambiguous: "⚡ 과거 선호: X(3회), Y(1회). 확인 후 진행하세요."
 * - clear:     "⚡ 기본값: X. 바로 진행 가능."
 */
export function generateQuestionSequencePrefix(
  confidence: RecallConfidence,
  dominantPattern?: string,
  patternCounts?: ReadonlyArray<{ pattern: string; count: number }>,
): string {
  switch (confidence) {
    case 'none':
      return '⚡ 이 주제는 처음입니다. 사용자에게 구체적으로 질문하세요.';

    case 'ambiguous': {
      if (!patternCounts || patternCounts.length === 0) {
        return '⚡ 과거 경험이 있지만 패턴이 불명확합니다. 확인 후 진행하세요.';
      }
      const summary = patternCounts
        .slice(0, 3) // top 3 only
        .map((p) => `${p.pattern.slice(0, 30)}(${p.count}회)`)
        .join(', ');
      return `⚡ 과거 선호: ${summary}. 확인 후 진행하세요.`;
    }

    case 'clear': {
      const pattern = dominantPattern?.slice(0, 50) ?? '확인됨';
      return `⚡ 기본값: ${pattern}. 바로 진행 가능.`;
    }
  }
}

/** Rough token estimation (1 token ≈ 4 chars) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
