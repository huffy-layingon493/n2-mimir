// n2-Mímir Public API — standalone experience learning engine
import type {
  MimirConfig, ExperienceInput, ExperienceFilter,
  RawExperience, RecallResult, AssemblyResult,
  InsightFilter, Insight, ExperienceAdapter,
} from './types.js';
import { MimirDatabase } from './store/database.js';
import { normalize } from './collector/normalizer.js';
import { GenericAdapter } from './collector/adapters/generic.js';
import { findContrastPairs } from './analyzer/comparator.js';
import { detectRepeatedPatterns } from './analyzer/detector.js';
import { generateFromContrasts, generateFromPatterns } from './insight/generator.js';
import { applyOperations, deduplicateOperations } from './insight/voting.js';
import { retireDormantInsights } from './insight/store.js';
import { recall } from './orchestrator/recall.js';
import { assemble } from './orchestrator/assembler.js';
import { evaluateGraduation } from './tracker/scorer.js';

const DEFAULT_CONFIG: Required<MimirConfig> = {
  dbPath: './mimir.db',
  tokenBudget: 500,
  halfLife: 14,
  llm: { provider: 'ollama', model: 'qwen3:8b', endpoint: 'http://localhost:11434' },
};

/**
 * Mimir — Experience Learning Engine
 *
 * Usage:
 * ```typescript
 * const mimir = new Mimir({ dbPath: './my-experiences.db' });
 *
 * // Add experience
 * mimir.addExperience({ ... });
 *
 * // When user mentions a topic → recall related experience
 * const result = mimir.recall('PowerShell scripting');
 *
 * // Run digest to analyze and generate insights
 * await mimir.digest({ project: 'my-app' });
 *
 * // Get overlay for prompt injection
 * const overlay = mimir.overlay('my-app');
 * ```
 */
export class Mimir {
  private readonly db: MimirDatabase;
  private readonly config: Required<MimirConfig>;
  private readonly adapters: ExperienceAdapter[] = [];
  private readonly genericAdapter: GenericAdapter;

  constructor(config?: MimirConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<MimirConfig>;
    this.db = new MimirDatabase(this.config.dbPath);
    this.genericAdapter = new GenericAdapter();
    this.adapters.push(this.genericAdapter);
  }

  /** Register an external experience adapter */
  registerAdapter(adapter: ExperienceAdapter): void {
    this.adapters.push(adapter);
  }

  // === Core API: Experience ===

  /** Add a single experience directly */
  addExperience(input: ExperienceInput): void {
    this.db.insertExperience(input);
  }

  /** Add raw experience (auto-normalized) */
  addRawExperience(raw: RawExperience): boolean {
    const normalized = normalize(raw);
    if (!normalized) return false;
    this.db.insertExperience(normalized);
    return true;
  }

  /** Query stored experiences */
  queryExperiences(filter: ExperienceFilter): ReturnType<MimirDatabase['queryExperiences']> {
    return this.db.queryExperiences(filter);
  }

  // === Core API: Recall (the main mechanism) ===

  /**
   * Recall relevant experiences for a given topic.
   * THIS is what fires when the user says something —
   * the orchestrator searches and assembles automatically.
   */
  recall(topic: string, project?: string, agent?: string): RecallResult {
    return recall(this.db, topic, project, agent, this.config.tokenBudget);
  }

  /**
   * Get assembled overlay ready for prompt injection.
   * Calls recall + assemble in one step.
   */
  overlay(topic: string, project?: string, agent?: string): AssemblyResult {
    const result = this.recall(topic, project, agent);
    return assemble(result, this.config.tokenBudget, this.config.halfLife);
  }

  // === Core API: Digest ===

  /**
   * Digest: collect experiences → analyze patterns → generate insights.
   * Call this at end of session or periodically.
   */
  async digest(options: { project: string; agent?: string }): Promise<{
    collected: number;
    contrasts: number;
    patterns: number;
    insightsCreated: number;
    graduated: string[];
  }> {
    // Step 1: Collect from all adapters
    let collected = 0;
    for (const adapter of this.adapters) {
      const rawExperiences = await adapter.collect(options.project, options.agent ?? 'default');
      for (const raw of rawExperiences) {
        if (this.addRawExperience(raw)) collected++;
      }
    }

    // Step 2: Analyze recent experiences
    const recentExperiences = this.db.queryExperiences({
      project: options.project,
      agent: options.agent,
      limit: 100,
    });

    const contrastPairs = findContrastPairs(recentExperiences);
    const repeatedPatterns = detectRepeatedPatterns(recentExperiences);

    // Step 3: Generate insight operations
    const contrastOps = generateFromContrasts(contrastPairs);
    const patternOps = generateFromPatterns(repeatedPatterns);
    const allOps = [...contrastOps, ...patternOps];

    // Step 4: Deduplicate (convert ADD to UPVOTE if similar exists)
    const dedupedOps = deduplicateOperations(this.db, allOps);

    // Step 5: Apply operations
    const { applied } = applyOperations(this.db, dedupedOps);

    // Step 6: Check graduation + retire dormant
    const graduated = evaluateGraduation(this.db);
    retireDormantInsights(this.db);

    return {
      collected,
      contrasts: contrastPairs.length,
      patterns: repeatedPatterns.length,
      insightsCreated: applied,
      graduated,
    };
  }

  // === Insight access ===

  /** Query insights */
  queryInsights(filter: InsightFilter): Insight[] {
    return this.db.queryInsights(filter);
  }

  /** Get graduated insights (ready for rule conversion) */
  getGraduatedInsights(): Insight[] {
    return this.db.queryInsights({ status: 'graduated' });
  }

  /** Get database statistics */
  getStats(): { experiences: number; insights: number; tags: number } {
    return this.db.getStats();
  }

  /** Close database */
  close(): void {
    this.db.close();
  }
}

// Re-export types for consumers
export type {
  ExperienceEntry, ExperienceInput, ExperienceFilter,
  Insight, InsightInput, InsightFilter,
  RawExperience, RecallResult, AssemblyResult,
  MimirConfig, ExperienceAdapter,
} from './types.js';
