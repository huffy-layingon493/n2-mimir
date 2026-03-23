// SQLite database wrapper — better-sqlite3 based, standalone mode
import type {
  ExperienceEntry, ExperienceInput, ExperienceFilter,
  Insight, InsightInput, InsightFilter,
  TagChain, TagFrequency, RankedExperience,
  EffectMeasurement,
} from '../types.js';
import type BetterSqlite3 from 'better-sqlite3';
import { SCHEMA_SQL } from './schema.js';
import { runMigrations } from './migrations.js';
import { createRequire } from 'module';

/** Generate a UUID v4 */
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Estimate token cost (rough: 1 token ≈ 4 chars) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * MimirDatabase — core SQLite wrapper for all Mímir data operations.
 * Standalone mode: no Soul, no external dependencies beyond better-sqlite3.
 *
 * NOTE: better-sqlite3 must be installed by the consumer.
 * It is listed as a peerDependency in package.json.
 */
export class MimirDatabase {
  private readonly db: BetterSqlite3.Database;

  constructor(dbPath: string) {
    // Dynamic import for better-sqlite3 (native CJS module in ESM context)
    const esmRequire = createRequire(import.meta.url);
    const Database = esmRequire('better-sqlite3') as typeof BetterSqlite3;
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initialize();
  }

  /** Initialize schema and run pending migrations */
  private initialize(): void {
    this.db.exec(SCHEMA_SQL);
    this.db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);');
    runMigrations(this.db);
  }

  // === Experience CRUD ===

  /** Insert a new experience */
  insertExperience(input: ExperienceInput): ExperienceEntry {
    const id = uuid();
    const now = new Date().toISOString();
    const tokenCost = estimateTokens(
      `${input.context} ${input.action} ${input.outcome} ${input.correction ?? ''}`
    );

    const stmt = this.db.prepare(`
      INSERT INTO experiences (id, session_id, agent, project, type, category, severity,
        context, action, outcome, correction, source_ref, frequency, token_cost, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    stmt.run(
      id,
      input.sessionId ?? '',
      input.agent,
      input.project,
      input.type,
      input.category,
      input.severity ?? 'info',
      input.context,
      input.action,
      input.outcome,
      input.correction ?? null,
      input.sourceRef ?? null,
      tokenCost,
      now,
    );

    return this.getExperience(id)!;
  }

  /** Get experience by ID */
  getExperience(id: string): ExperienceEntry | undefined {
    const row = this.db.prepare('SELECT * FROM experiences WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.mapExperience(row) : undefined;
  }

  /** Query experiences with filter */
  queryExperiences(filter: ExperienceFilter): ExperienceEntry[] {
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];

    if (filter.project) { conditions.push('project = ?'); params.push(filter.project); }
    if (filter.agent) { conditions.push('agent = ?'); params.push(filter.agent); }
    if (filter.category) { conditions.push('category = ?'); params.push(filter.category); }
    if (filter.type) { conditions.push('type = ?'); params.push(filter.type); }
    if (filter.severity) { conditions.push('severity = ?'); params.push(filter.severity); }
    if (filter.since) { conditions.push('created_at >= ?'); params.push(filter.since); }

    const limit = filter.limit ?? 100;
    const sql = `SELECT * FROM experiences WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map((r) => this.mapExperience(r));
  }

  // === FTS5 Search ===

  /** Full-text search on experiences (BM25 ranking) */
  searchExperiences(query: string, limit = 20): RankedExperience[] {
    const sql = `
      SELECT e.*, rank
      FROM experiences_fts fts
      JOIN experiences e ON e.rowid = fts.rowid
      WHERE experiences_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `;
    const rows = this.db.prepare(sql).all(query, limit) as Array<Record<string, unknown>>;
    return rows.map((r, i) => ({
      experience: this.mapExperience(r),
      rank: i + 1,
    }));
  }

  // === Insight CRUD ===

  /** Insert a new insight */
  insertInsight(input: InsightInput): Insight {
    const id = uuid();
    const now = new Date().toISOString();
    const tokenCost = input.tokenCost ?? estimateTokens(input.compressed || input.description);

    this.db.prepare(`
      INSERT INTO insights (id, created_at, updated_at, agent, description, compressed,
        token_cost, category, scope, importance, confidence, effect_score, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 2, 0.5, 0.0, 'active')
    `).run(id, now, now, input.agent, input.description, input.compressed, tokenCost, input.category, input.scope ?? 'project');

    return this.getInsight(id)!;
  }

  /** Get insight by ID */
  getInsight(id: string): Insight | undefined {
    const row = this.db.prepare('SELECT * FROM insights WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.mapInsight(row) : undefined;
  }

  /** Query insights with filter */
  queryInsights(filter: InsightFilter): Insight[] {
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];

    if (filter.agent) { conditions.push('agent = ?'); params.push(filter.agent); }
    if (filter.category) { conditions.push('category = ?'); params.push(filter.category); }
    if (filter.scope) { conditions.push('scope = ?'); params.push(filter.scope); }
    if (filter.status) { conditions.push('status = ?'); params.push(filter.status); }
    if (filter.minImportance != null) { conditions.push('importance >= ?'); params.push(filter.minImportance); }

    const limit = filter.limit ?? 50;
    const sql = `SELECT * FROM insights WHERE ${conditions.join(' AND ')} ORDER BY importance DESC, effect_score DESC LIMIT ?`;
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map((r) => this.mapInsight(r));
  }

  // === Voting ===

  /** UPVOTE: increase insight importance */
  upvoteInsight(id: string): void {
    this.db.prepare(`
      UPDATE insights SET importance = importance + 1, updated_at = datetime('now') WHERE id = ?
    `).run(id);
  }

  /** DOWNVOTE: decrease insight importance, retire if 0 */
  downvoteInsight(id: string): void {
    this.db.prepare(`
      UPDATE insights SET
        importance = MAX(0, importance - 1),
        status = CASE WHEN importance <= 1 THEN 'retired' ELSE status END,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(id);
  }

  /** Graduate insight (importance >= 5, effectScore >= 0.8) */
  graduateInsight(id: string, convertedType: string, convertedRef: string): void {
    this.db.prepare(`
      UPDATE insights SET status = 'graduated', converted_type = ?, converted_ref = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(convertedType, convertedRef, id);
  }

  // === Tags ===

  /** Set tags for an experience (replaces existing) */
  setTags(experienceId: string, tags: ReadonlyArray<TagChain>): void {
    const del = this.db.prepare('DELETE FROM tags WHERE experience_id = ?');
    const ins = this.db.prepare('INSERT INTO tags (experience_id, level, tag) VALUES (?, ?, ?)');

    this.db.transaction(() => {
      del.run(experienceId);
      for (const t of tags) {
        ins.run(experienceId, t.level, t.tag);
      }
    })();
  }

  /** Get tag frequencies for cascading recall */
  getTagFrequencies(tags: ReadonlyArray<string>, limit = 50): TagFrequency[] {
    if (tags.length === 0) return [];
    const placeholders = tags.map(() => '?').join(',');
    const sql = `
      SELECT level, tag, COUNT(*) as frequency
      FROM tags WHERE tag IN (${placeholders})
      GROUP BY level, tag
      ORDER BY frequency DESC
      LIMIT ?
    `;
    return this.db.prepare(sql).all(...tags, limit) as TagFrequency[];
  }

  /** Find experiences by tags (cascading recall) */
  findExperiencesByTags(tags: ReadonlyArray<string>, limit = 20): ExperienceEntry[] {
    if (tags.length === 0) return [];
    const placeholders = tags.map(() => '?').join(',');
    const sql = `
      SELECT DISTINCT e.* FROM experiences e
      JOIN tags t ON t.experience_id = e.id
      WHERE t.tag IN (${placeholders})
      ORDER BY e.created_at DESC
      LIMIT ?
    `;
    const rows = this.db.prepare(sql).all(...tags, limit) as Record<string, unknown>[];
    return rows.map((r) => this.mapExperience(r));
  }

  // === Effect tracking ===

  /** Record effect measurement */
  recordEffect(measurement: EffectMeasurement): void {
    this.db.prepare(`
      INSERT INTO effect_tracking (insight_id, session_id, was_relevant, was_followed, outcome)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      measurement.insightId,
      measurement.sessionId,
      measurement.wasRelevant ? 1 : 0,
      measurement.wasFollowed ? 1 : 0,
      measurement.outcome,
    );

    // Update insight's effect_score based on recent measurements
    this.updateEffectScore(measurement.insightId);
  }

  /** Recalculate effect score for an insight */
  private updateEffectScore(insightId: string): void {
    const result = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN outcome = 'positive' THEN 1 ELSE 0 END) as positive
      FROM effect_tracking
      WHERE insight_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).get(insightId) as { total: number; positive: number } | undefined;

    if (result && result.total > 0) {
      const score = result.positive / result.total;
      this.db.prepare(`
        UPDATE insights SET effect_score = ?, updated_at = datetime('now') WHERE id = ?
      `).run(score, insightId);
    }
  }

  // === Utility ===

  /** Get statistics */
  getStats(): { experiences: number; insights: number; tags: number } {
    const exp = this.db.prepare('SELECT COUNT(*) as c FROM experiences').get() as { c: number };
    const ins = this.db.prepare('SELECT COUNT(*) as c FROM insights').get() as { c: number };
    const tag = this.db.prepare('SELECT COUNT(*) as c FROM tags').get() as { c: number };
    return { experiences: exp.c, insights: ins.c, tags: tag.c };
  }

  /** Close database connection */
  close(): void {
    this.db.close();
  }

  // === Row mappers ===

  private mapExperience(row: Record<string, unknown>): ExperienceEntry {
    return {
      id: row['id'] as string,
      timestamp: row['timestamp'] as string,
      sessionId: row['session_id'] as string,
      agent: row['agent'] as string,
      project: row['project'] as string,
      type: row['type'] as ExperienceEntry['type'],
      category: row['category'] as string,
      severity: row['severity'] as ExperienceEntry['severity'],
      context: row['context'] as string,
      action: row['action'] as string,
      outcome: row['outcome'] as string,
      correction: row['correction'] as string | undefined,
      sourceRef: row['source_ref'] as string | undefined,
      frequency: row['frequency'] as number,
      tokenCost: row['token_cost'] as number,
      createdAt: row['created_at'] as string,
    };
  }

  private mapInsight(row: Record<string, unknown>): Insight {
    return {
      id: row['id'] as string,
      createdAt: row['created_at'] as string,
      updatedAt: row['updated_at'] as string,
      agent: row['agent'] as string,
      description: row['description'] as string,
      compressed: row['compressed'] as string,
      tokenCost: row['token_cost'] as number,
      category: row['category'] as string,
      scope: row['scope'] as Insight['scope'],
      importance: row['importance'] as number,
      confidence: row['confidence'] as number,
      effectScore: row['effect_score'] as number,
      status: row['status'] as Insight['status'],
      convertedType: row['converted_type'] as string | undefined,
      convertedRef: row['converted_ref'] as string | undefined,
    };
  }
}
