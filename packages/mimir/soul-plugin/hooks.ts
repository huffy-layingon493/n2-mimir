// soul-plugin/hooks.ts — Soul MCP hook integration (architecture.md 5-3)
// n2_boot → activate() | n2_work_end → digest()

import type { MimirConfig, AssemblyResult } from '../src/types.js';

/**
 * SoulPlugin — connects Mímir to Soul's boot/end lifecycle.
 *
 * Usage:
 *   const plugin = new SoulPlugin(mimirInstance);
 *   // Called by Soul during n2_boot:
 *   const overlay = await plugin.activate(project, agent, tokenBudget);
 *   // Called by Soul during n2_work_end:
 *   await plugin.digest(project, agent, sessionData);
 */
export class SoulPlugin {
  private readonly config: MimirConfig;

  constructor(config: MimirConfig) {
    this.config = config;
  }

  /**
   * ACTIVATE path — called during n2_boot.
   * Retrieves relevant experience and assembles a prompt overlay.
   *
   * @param project - Current project name
   * @param agent - Current agent name
   * @param tokenBudget - Max tokens for overlay (default: config.tokenBudget or 500)
   * @returns AssemblyResult with overlay text and metadata
   */
  async activate(
    project: string,
    agent: string,
    tokenBudget?: number,
  ): Promise<AssemblyResult> {
    const budget = tokenBudget ?? this.config.tokenBudget ?? 500;

    // TODO (Phase 2): implement full activate flow
    // 1. Query graduated + critical insights from Rust core
    // 2. Assemble overlay within token budget
    // 3. Return for prompt injection
    return {
      overlay: '',
      totalTokens: 0,
      insightCount: 0,
      selectedIds: [],
    };
  }

  /**
   * DIGEST path — called during n2_work_end.
   * Collects this session's experiences, analyzes patterns, generates insights.
   *
   * @param project - Current project name
   * @param agent - Current agent name
   * @param sessionData - Session work data (summary, decisions, files, etc.)
   */
  async digest(
    project: string,
    agent: string,
    sessionData: SessionData,
  ): Promise<DigestResult> {
    // TODO (Phase 2): implement full digest flow
    // 1. Collect experiences from Ledger via adapter
    // 2. Normalize via collector/normalizer
    // 3. Analyze patterns via analyzer
    // 4. Generate insights via insight/generator
    // 5. Store results via Rust core
    return {
      experiencesCollected: 0,
      insightsGenerated: 0,
      insightsUpdated: 0,
    };
  }
}

/** Session data from n2_work_end */
export interface SessionData {
  readonly summary: string;
  readonly decisions?: ReadonlyArray<string>;
  readonly todo?: ReadonlyArray<string>;
  readonly filesCreated?: ReadonlyArray<{ path: string; desc: string }>;
  readonly filesModified?: ReadonlyArray<{ path: string; desc: string }>;
}

/** Result of digest operation */
export interface DigestResult {
  readonly experiencesCollected: number;
  readonly insightsGenerated: number;
  readonly insightsUpdated: number;
}
