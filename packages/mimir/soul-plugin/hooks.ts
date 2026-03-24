// soul-plugin/hooks.ts — Soul MCP hook integration (architecture.md 5-3)
// n2_boot → activate() | n2_work_end → digest()

import { Mimir } from '../src/index.js';
import type { MimirConfig, AssemblyResult } from '../src/types.js';

/**
 * SoulPlugin — connects Mímir to Soul's boot/end lifecycle.
 *
 * Usage:
 *   const plugin = new SoulPlugin({ dbPath: './mimir.db' });
 *   // Called by Soul during n2_boot:
 *   const overlay = await plugin.activate(project, agent, tokenBudget);
 *   // Called by Soul during n2_work_end:
 *   await plugin.digest(project, agent, sessionData);
 */
export class SoulPlugin {
  private readonly mimir: Mimir;

  constructor(config?: MimirConfig) {
    this.mimir = new Mimir(config);
  }

  /**
   * ACTIVATE path — called during n2_boot.
   * Retrieves relevant experience and assembles a prompt overlay.
   *
   * @param project - Current project name
   * @param agent - Current agent name
   * @param tokenBudget - Max tokens for overlay (default: 500)
   * @returns AssemblyResult with overlay text and metadata
   */
  async activate(
    project: string,
    agent: string,
    tokenBudget?: number,
  ): Promise<AssemblyResult> {
    // Build a topic from project+agent context for recall
    const topic = `${project} ${agent}`;
    const result = this.mimir.recall(topic, project, agent);

    // If custom budget, use assembler directly
    if (tokenBudget) {
      const { assemble } = await import('../src/orchestrator/assembler.js');
      return assemble(result, tokenBudget);
    }

    return this.mimir.overlay(topic, project, agent);
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
    // Step 1: Convert session data to experiences
    const experiences = convertSessionToExperiences(project, agent, sessionData);

    // Step 2: Delta-learn each experience
    let newCount = 0;
    let updatedCount = 0;
    for (const exp of experiences) {
      const result = this.mimir.deltaLearn(exp);
      if (result.isNew) newCount++;
      else updatedCount++;
    }

    // Step 3: Run full digest (analyze patterns + generate insights)
    const digestResult = await this.mimir.digest({ project, agent });

    return {
      experiencesCollected: newCount + updatedCount,
      experiencesNew: newCount,
      experiencesUpdated: updatedCount,
      insightsGenerated: digestResult.insightsCreated,
      insightsGraduated: digestResult.graduated.length,
    };
  }

  /** Get current Mimir stats */
  getStats(): { experiences: number; insights: number; tags: number } {
    return this.mimir.getStats();
  }

  /** Close database connection */
  close(): void {
    this.mimir.close();
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
  readonly experiencesNew: number;
  readonly experiencesUpdated: number;
  readonly insightsGenerated: number;
  readonly insightsGraduated: number;
}

/**
 * Convert session data to experience inputs for delta learning.
 * Extracts meaningful experiences from work summary, decisions, and file changes.
 */
function convertSessionToExperiences(
  project: string,
  agent: string,
  data: SessionData,
): Array<import('../src/types.js').ExperienceInput> {
  const experiences: Array<import('../src/types.js').ExperienceInput> = [];

  // Summary → pattern experience
  if (data.summary) {
    experiences.push({
      agent,
      project,
      type: 'pattern',
      category: 'workflow',
      context: `Session work on ${project}`,
      action: data.summary.slice(0, 500),
      outcome: 'Session completed',
      sessionId: new Date().toISOString(),
    });
  }

  // Decisions → success experiences
  if (data.decisions) {
    for (const decision of data.decisions) {
      experiences.push({
        agent,
        project,
        type: 'success',
        category: 'architecture',
        context: `Decision made during ${project} session`,
        action: decision.slice(0, 500),
        outcome: 'Decision applied',
        sessionId: new Date().toISOString(),
      });
    }
  }

  // Files created → success experiences
  if (data.filesCreated) {
    for (const file of data.filesCreated) {
      experiences.push({
        agent,
        project,
        type: 'success',
        category: 'coding_pattern',
        context: `Created file in ${project}`,
        action: `Created ${file.path}`,
        outcome: file.desc,
        sessionId: new Date().toISOString(),
      });
    }
  }

  return experiences;
}
