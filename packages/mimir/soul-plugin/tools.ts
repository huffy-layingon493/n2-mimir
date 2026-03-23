// soul-plugin/tools.ts — MCP tool definitions for Soul integration (architecture.md 5-1)

/**
 * MCP tool definitions for Mímir.
 * These are registered with Soul's MCP server during plugin initialization.
 *
 * Tools:
 *   n2_mimir_analyze  — Analyze current session experiences → extract insights (auto: work_end)
 *   n2_mimir_insights — List insights for current project (manual)
 *   n2_mimir_vote     — UPVOTE/DOWNVOTE an insight (manual)
 *   n2_mimir_overlay  — Generate experience overlay for current task (auto: boot)
 *   n2_mimir_status   — Show Mímir experience statistics (manual)
 */

/** Tool definition interface (simplified MCP tool schema) */
export interface MimirToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

/** All Mímir MCP tool definitions */
export const MIMIR_TOOLS: ReadonlyArray<MimirToolDefinition> = [
  {
    name: 'n2_mimir_analyze',
    description: 'Analyze current session experiences and extract insights. Auto-triggered at work_end.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name' },
        agent: { type: 'string', description: 'Agent name' },
      },
      required: ['project', 'agent'],
    },
  },
  {
    name: 'n2_mimir_insights',
    description: 'List learned insights for a project. Shows importance, status, and effect scores.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name (optional, defaults to current)' },
        status: { type: 'string', enum: ['active', 'dormant', 'retired', 'graduated'] },
        limit: { type: 'number', default: 20 },
      },
    },
  },
  {
    name: 'n2_mimir_vote',
    description: 'UPVOTE or DOWNVOTE an insight. Affects importance and graduation eligibility.',
    inputSchema: {
      type: 'object',
      properties: {
        insightId: { type: 'string', description: 'Insight ID to vote on' },
        vote: { type: 'string', enum: ['up', 'down'] },
      },
      required: ['insightId', 'vote'],
    },
  },
  {
    name: 'n2_mimir_overlay',
    description: 'Generate experience overlay for prompt injection. Auto-triggered at boot.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name' },
        agent: { type: 'string', description: 'Agent name' },
        tokenBudget: { type: 'number', default: 500, description: 'Max tokens for overlay' },
      },
      required: ['project', 'agent'],
    },
  },
  {
    name: 'n2_mimir_status',
    description: 'Show Mímir experience statistics: total experiences, insights, effect scores.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name (optional)' },
      },
    },
  },
];

/**
 * Register Mímir tools with a Soul MCP server.
 * Called during soul-plugin initialization.
 *
 * @param registerFn - Soul's tool registration function
 */
export function registerMimirTools(
  registerFn: (tool: MimirToolDefinition) => void,
): void {
  for (const tool of MIMIR_TOOLS) {
    registerFn(tool);
  }
}
