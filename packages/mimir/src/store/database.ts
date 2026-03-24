// MimirDatabase — Rust-first, better-sqlite3 fallback
// Architecture: Rust core handles all I/O via napi-rs bindings.
// If native module unavailable, falls back to better-sqlite3 (TS).

import type {
  ExperienceEntry, ExperienceInput, ExperienceFilter,
  Insight, InsightInput, InsightFilter,
  TagChain, TagFrequency, RankedExperience,
  EffectMeasurement,
} from '../types.js';
import { getNativeBinding } from './native.js';
import type { NativeBinding } from './native.js';
import { SCHEMA_SQL } from './schema.js';
import { runMigrations } from './migrations.js';
import type BetterSqlite3 from 'better-sqlite3';
// ESM-CJS interop: better-sqlite3 is a native CJS module,
// createRequire is needed to load it from ESM context.
import { createRequire } from 'node:module';

import { randomUUID, randomBytes } from 'crypto';

/** Generate a UUID v4 */
function uuid(): string {
  // Use crypto.randomUUID if available (Node 19+), fallback for older versions
  if (randomUUID) {
    return randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = randomBytes(1)[0] & 0xf;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Estimate token cost (rough: 1 token ≈ 4 chars) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * MimirDatabase — hybrid Rust/TS database wrapper.
 *
 * Strategy:
 * - If Rust native module is available → delegates all operations to Rust (rusqlite)
 * - If not → falls back to better-sqlite3 (TypeScript)
 *
 * This ensures the package works even without compiled Rust bindings,
 * while providing maximum performance when they're available.
 */
export class MimirDatabase {
  private readonly native: NativeBinding | null;
  private readonly nativeHandle: number | null;
  private readonly fallbackDb: BetterSqlite3.Database | null;
  private readonly mode: 'rust' | 'fallback';

  constructor(dbPath: string) {
    this.native = getNativeBinding();

    if (this.native) {
      // Rust mode: all I/O through native bindings
      this.nativeHandle = this.native.openDatabase(dbPath);
      this.fallbackDb = null;
      this.mode = 'rust';
    } else {
      // Fallback mode: better-sqlite3
      // ESM → createRequire(import.meta.url), CJS → native require
      this.nativeHandle = null;
      let loadModule: NodeRequire;
      if (typeof import.meta?.url === 'string' && import.meta.url !== '') {
        loadModule = createRequire(import.meta.url);
      } else {
        // CJS context: require is natively available (tsup bundles __require shim)
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        loadModule = require;
      }
      try {
        const Database = loadModule('better-sqlite3') as typeof BetterSqlite3;
        this.fallbackDb = new Database(dbPath);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `[n2-mimir] Failed to load better-sqlite3: ${msg}\n\n` +
          `Install it with: npm install better-sqlite3\n` +
          `Requirements: Node.js >= 20, Python 3, C++ Build Tools\n` +
          `  - Windows: npm install --global windows-build-tools\n` +
          `  - macOS: xcode-select --install\n` +
          `  - Linux: sudo apt-get install build-essential python3`,
        );
      }
      this.fallbackDb.pragma('journal_mode = WAL');
      this.fallbackDb.pragma('foreign_keys = ON');
      this.initializeFallback();
      this.mode = 'fallback';
    }
  }

  /** Get current engine mode */
  getMode(): 'rust' | 'fallback' {
    return this.mode;
  }

  /** Initialize fallback schema */
  private initializeFallback(): void {
    if (!this.fallbackDb) return;
    this.fallbackDb.exec(SCHEMA_SQL);
    runMigrations(this.fallbackDb);
  }

  // === Experience CRUD ===

  insertExperience(input: ExperienceInput): ExperienceEntry {
    if (this.native && this.nativeHandle !== null) {
      const id = this.native.insertExperience(this.nativeHandle, JSON.stringify(input));
      const json = this.native.getExperience(this.nativeHandle, id);
      return JSON.parse(json) as ExperienceEntry;
    }
    return this.insertExperienceFallback(input);
  }

  getExperience(id: string): ExperienceEntry | undefined {
    if (this.native && this.nativeHandle !== null) {
      const json = this.native.getExperience(this.nativeHandle, id);
      return json ? JSON.parse(json) as ExperienceEntry : undefined;
    }
    return this.getExperienceFallback(id);
  }

  queryExperiences(filter: ExperienceFilter): ExperienceEntry[] {
    if (this.native && this.nativeHandle !== null) {
      const json = this.native.queryExperiences(this.nativeHandle, JSON.stringify(filter));
      return JSON.parse(json) as ExperienceEntry[];
    }
    return this.queryExperiencesFallback(filter);
  }

  // === FTS5 Search ===

  searchExperiences(query: string, limit = 20): RankedExperience[] {
    if (this.native && this.nativeHandle !== null) {
      const json = this.native.searchExperiences(this.nativeHandle, query, limit);
      return JSON.parse(json) as RankedExperience[];
    }
    return this.searchExperiencesFallback(query, limit);
  }

  // === Insight CRUD ===

  insertInsight(input: InsightInput): Insight {
    if (this.native && this.nativeHandle !== null) {
      const id = this.native.insertInsight(this.nativeHandle, JSON.stringify(input));
      const json = this.native.getInsight(this.nativeHandle, id);
      return JSON.parse(json) as Insight;
    }
    return this.insertInsightFallback(input);
  }

  getInsight(id: string): Insight | undefined {
    if (this.native && this.nativeHandle !== null) {
      const json = this.native.getInsight(this.nativeHandle, id);
      return json ? JSON.parse(json) as Insight : undefined;
    }
    return this.getInsightFallback(id);
  }

  queryInsights(filter: InsightFilter): Insight[] {
    if (this.native && this.nativeHandle !== null) {
      const json = this.native.queryInsights(this.nativeHandle, JSON.stringify(filter));
      return JSON.parse(json) as Insight[];
    }
    return this.queryInsightsFallback(filter);
  }

  // === Voting ===

  upvoteInsight(id: string): void {
    if (this.native && this.nativeHandle !== null) {
      this.native.upvoteInsight(this.nativeHandle, id);
      return;
    }
    this.upvoteInsightFallback(id);
  }

  downvoteInsight(id: string): void {
    if (this.native && this.nativeHandle !== null) {
      this.native.downvoteInsight(this.nativeHandle, id);
      return;
    }
    this.downvoteInsightFallback(id);
  }

  graduateInsight(id: string, convertedType: string, convertedRef: string): void {
    if (this.native && this.nativeHandle !== null) {
      this.native.graduateInsight(this.nativeHandle, id, convertedType, convertedRef);
      return;
    }
    this.graduateInsightFallback(id, convertedType, convertedRef);
  }

  // === Tags ===

  setTags(experienceId: string, tags: ReadonlyArray<TagChain>): void {
    if (this.native && this.nativeHandle !== null) {
      this.native.setTags(this.nativeHandle, experienceId, JSON.stringify(tags));
      return;
    }
    this.setTagsFallback(experienceId, tags);
  }

  getTagFrequencies(tags: ReadonlyArray<string>, limit = 50): TagFrequency[] {
    if (this.native && this.nativeHandle !== null) {
      const json = this.native.getTagFrequencies(this.nativeHandle, JSON.stringify(tags), limit);
      return JSON.parse(json) as TagFrequency[];
    }
    return this.getTagFrequenciesFallback(tags, limit);
  }

  findExperiencesByTags(tags: ReadonlyArray<string>, limit = 20): ExperienceEntry[] {
    if (this.native && this.nativeHandle !== null) {
      const json = this.native.findExperiencesByTags(this.nativeHandle, JSON.stringify(tags), limit);
      return JSON.parse(json) as ExperienceEntry[];
    }
    return this.findExperiencesByTagsFallback(tags, limit);
  }

  // === Effect tracking ===

  recordEffect(measurement: EffectMeasurement): void {
    if (this.native && this.nativeHandle !== null) {
      this.native.recordEffect(this.nativeHandle, JSON.stringify(measurement));
      return;
    }
    this.recordEffectFallback(measurement);
  }

  // === Embeddings (Tier 2 semantic search) ===

  storeEmbedding(sourceType: 'experience' | 'insight', sourceId: string, vector: readonly number[], model: string): void {
    if (this.native && this.nativeHandle !== null) {
      this.native.storeEmbedding(this.nativeHandle, sourceType, sourceId, JSON.stringify(vector), model);
      return;
    }
    this.storeEmbeddingFallback(sourceType, sourceId, vector, model);
  }

  getEmbedding(sourceType: string, sourceId: string): { vector: readonly number[]; model: string } | null {
    if (this.native && this.nativeHandle !== null) {
      const json = this.native.getEmbedding(this.nativeHandle, sourceType, sourceId);
      if (!json) return null;
      return { vector: JSON.parse(json) as number[], model: 'native' };
    }
    return this.getEmbeddingFallback(sourceType, sourceId);
  }

  getAllEmbeddings(): Array<{ sourceType: string; sourceId: string; vector: readonly number[] }> {
    // Fallback only — Rust core can add batch method later
    return this.getAllEmbeddingsFallback();
  }

  // === Utility ===

  getStats(): { experiences: number; insights: number; tags: number } {
    if (this.native && this.nativeHandle !== null) {
      return JSON.parse(this.native.getStats(this.nativeHandle));
    }
    return this.getStatsFallback();
  }

  close(): void {
    if (this.native && this.nativeHandle !== null) {
      this.native.closeDatabase(this.nativeHandle);
    } else if (this.fallbackDb) {
      this.fallbackDb.close();
    }
  }

  // === Layer Intersection (architecture.md §8-8) ===

  /**
   * Find experiences matching ALL given tag layers (AND condition).
   * This is the core of "layer intersection" — fp2 principle applied.
   *
   * Example: findExperiencesByTagsIntersection([['랜딩페이지'], ['제과점', '카페']])
   *   → returns only experiences tagged with BOTH a term from layer[0] AND layer[1]
   */
  findExperiencesByTagsIntersection(
    tagLayers: ReadonlyArray<ReadonlyArray<string>>,
    limit = 20,
  ): ExperienceEntry[] {
    if (tagLayers.length === 0) return [];
    // TODO: implement in Rust native. For now, only available in fallback mode.
    if (!this.fallbackDb) return [];
    return this.findByTagsIntersectionFallback(tagLayers, limit);
  }

  // === Delta Learning (architecture.md §8-8 Step 5) ===

  /**
   * Upsert experience: if a similar experience exists (same agent+project+category+action),
   * increment its frequency. Otherwise insert new.
   * Returns { isNew: boolean, id: string }
   */
  upsertExperience(input: ExperienceInput): { isNew: boolean; id: string } {
    // TODO: implement in Rust native. For now, only available in fallback mode.
    if (!this.fallbackDb) {
      // Rust mode fallback: insert as new (no deduplicate)
      const entry = this.insertExperience(input);
      return { isNew: true, id: entry.id };
    }
    return this.upsertExperienceFallback(input);
  }

  // === Tag Similarity (architecture.md §8-8 — user confirmation) ===

  /**
   * Find tags similar to the given tag (user-confirmed equivalences).
   * autoOnly=true → only returns pairs with confidence >= 0.9
   */
  findSimilarTags(tag: string, autoOnly = false): Array<{ tag: string; confidence: number }> {
    // TODO: implement in Rust native. For now, only available in fallback mode.
    if (!this.fallbackDb) return [];
    return this.findSimilarTagsFallback(tag, autoOnly);
  }

  /**
   * Record or update a user-confirmed tag similarity.
   * Existing pair → confidence increases, confirmed_count++.
   * New pair → inserted with confidence=0.5.
   */
  upsertTagSimilarity(tagA: string, tagB: string): void {
    // TODO: implement in Rust native. For now, only available in fallback mode.
    if (!this.fallbackDb) return;
    this.upsertTagSimilarityFallback(tagA, tagB);
  }

  // ================================================
  // === Fallback implementations (better-sqlite3) ===
  // ================================================

  private get db(): BetterSqlite3.Database {
    if (!this.fallbackDb) throw new Error('Fallback DB not initialized');
    return this.fallbackDb;
  }

  private insertExperienceFallback(input: ExperienceInput): ExperienceEntry {
    const id = uuid();
    const now = new Date().toISOString();
    const tokenCost = estimateTokens(
      `${input.context} ${input.action} ${input.outcome} ${input.correction ?? ''}`
    );

    this.db.prepare(`
      INSERT INTO experiences (id, session_id, agent, project, type, category, severity,
        context, action, outcome, correction, source_ref, frequency, token_cost, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      id, input.sessionId ?? '', input.agent, input.project,
      input.type, input.category, input.severity ?? 'info',
      input.context, input.action, input.outcome,
      input.correction ?? null, input.sourceRef ?? null,
      tokenCost, now,
    );

    return this.getExperienceFallback(id)!;
  }

  private getExperienceFallback(id: string): ExperienceEntry | undefined {
    const row = this.db.prepare('SELECT * FROM experiences WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.mapExperience(row) : undefined;
  }

  private queryExperiencesFallback(filter: ExperienceFilter): ExperienceEntry[] {
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

  private searchExperiencesFallback(query: string, limit: number): RankedExperience[] {
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

  private insertInsightFallback(input: InsightInput): Insight {
    const id = uuid();
    const now = new Date().toISOString();
    const tokenCost = input.tokenCost ?? estimateTokens(input.compressed || input.description);

    this.db.prepare(`
      INSERT INTO insights (id, created_at, updated_at, agent, description, compressed,
        token_cost, category, scope, importance, confidence, effect_score, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 2, 0.5, 0.0, 'active')
    `).run(id, now, now, input.agent, input.description, input.compressed, tokenCost, input.category, input.scope ?? 'project');

    return this.getInsightFallback(id)!;
  }

  private getInsightFallback(id: string): Insight | undefined {
    const row = this.db.prepare('SELECT * FROM insights WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.mapInsight(row) : undefined;
  }

  private queryInsightsFallback(filter: InsightFilter): Insight[] {
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

  private upvoteInsightFallback(id: string): void {
    this.db.prepare(
      "UPDATE insights SET importance = importance + 1, updated_at = datetime('now') WHERE id = ?"
    ).run(id);
  }

  private downvoteInsightFallback(id: string): void {
    this.db.prepare(
      "UPDATE insights SET importance = MAX(0, importance - 1), status = CASE WHEN importance <= 1 THEN 'retired' ELSE status END, updated_at = datetime('now') WHERE id = ?"
    ).run(id);
  }

  private graduateInsightFallback(id: string, convertedType: string, convertedRef: string): void {
    this.db.prepare(
      "UPDATE insights SET status = 'graduated', converted_type = ?, converted_ref = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(convertedType, convertedRef, id);
  }

  private setTagsFallback(experienceId: string, tags: ReadonlyArray<TagChain>): void {
    const del = this.db.prepare('DELETE FROM tags WHERE experience_id = ?');
    const ins = this.db.prepare('INSERT INTO tags (experience_id, level, tag) VALUES (?, ?, ?)');
    this.db.transaction(() => {
      del.run(experienceId);
      for (const t of tags) {
        ins.run(experienceId, t.level, t.tag);
      }
    })();
  }

  private getTagFrequenciesFallback(tags: ReadonlyArray<string>, limit: number): TagFrequency[] {
    if (tags.length === 0) return [];
    const placeholders = tags.map(() => '?').join(',');
    const sql = `SELECT level, tag, COUNT(*) as frequency FROM tags WHERE tag IN (${placeholders}) GROUP BY level, tag ORDER BY frequency DESC LIMIT ?`;
    return this.db.prepare(sql).all(...tags, limit) as TagFrequency[];
  }

  private findExperiencesByTagsFallback(tags: ReadonlyArray<string>, limit: number): ExperienceEntry[] {
    if (tags.length === 0) return [];
    const placeholders = tags.map(() => '?').join(',');
    const sql = `SELECT DISTINCT e.* FROM experiences e JOIN tags t ON t.experience_id = e.id WHERE t.tag IN (${placeholders}) ORDER BY e.created_at DESC LIMIT ?`;
    const rows = this.db.prepare(sql).all(...tags, limit) as Record<string, unknown>[];
    return rows.map((r) => this.mapExperience(r));
  }

  private recordEffectFallback(measurement: EffectMeasurement): void {
    this.db.prepare(`
      INSERT INTO effect_tracking (insight_id, session_id, was_relevant, was_followed, outcome)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      measurement.insightId, measurement.sessionId,
      measurement.wasRelevant ? 1 : 0,
      measurement.wasFollowed ? 1 : 0,
      measurement.outcome,
    );
    this.updateEffectScoreFallback(measurement.insightId);
  }

  private updateEffectScoreFallback(insightId: string): void {
    const result = this.db.prepare(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN outcome = 'positive' THEN 1 ELSE 0 END) as positive
      FROM effect_tracking WHERE insight_id = ?
      ORDER BY created_at DESC LIMIT 10
    `).get(insightId) as { total: number; positive: number } | undefined;

    if (result && result.total > 0) {
      const score = result.positive / result.total;
      this.db.prepare("UPDATE insights SET effect_score = ?, updated_at = datetime('now') WHERE id = ?").run(score, insightId);
    }
  }

  private getStatsFallback(): { experiences: number; insights: number; tags: number } {
    const exp = this.db.prepare('SELECT COUNT(*) as c FROM experiences').get() as { c: number };
    const ins = this.db.prepare('SELECT COUNT(*) as c FROM insights').get() as { c: number };
    const tag = this.db.prepare('SELECT COUNT(*) as c FROM tags').get() as { c: number };
    return { experiences: exp.c, insights: ins.c, tags: tag.c };
  }

  // === Embedding Fallback ===

  private storeEmbeddingFallback(
    sourceType: string, sourceId: string, vector: readonly number[], model: string,
  ): void {
    const id = uuid();
    // Store as float32 binary blob for efficiency
    const buffer = new Float32Array(vector).buffer;
    const vectorBlob = Buffer.from(buffer);

    this.db.prepare(`
      INSERT OR REPLACE INTO embeddings (id, source_type, source_id, vector, model)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, sourceType, sourceId, vectorBlob, model);
  }

  private getEmbeddingFallback(
    sourceType: string, sourceId: string,
  ): { vector: readonly number[]; model: string } | null {
    const row = this.db.prepare(`
      SELECT vector, model FROM embeddings
      WHERE source_type = ? AND source_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(sourceType, sourceId) as { vector: Buffer; model: string } | undefined;

    if (!row) return null;

    // Convert binary blob back to float32 array
    const float32 = new Float32Array(row.vector.buffer, row.vector.byteOffset, row.vector.byteLength / 4);
    return { vector: Array.from(float32), model: row.model };
  }

  private getAllEmbeddingsFallback(): Array<{ sourceType: string; sourceId: string; vector: readonly number[] }> {
    const rows = this.db.prepare(`
      SELECT source_type, source_id, vector FROM embeddings
    `).all() as Array<{ source_type: string; source_id: string; vector: Buffer }>;

    return rows.map((row) => {
      const float32 = new Float32Array(row.vector.buffer, row.vector.byteOffset, row.vector.byteLength / 4);
      return {
        sourceType: row.source_type,
        sourceId: row.source_id,
        vector: Array.from(float32),
      };
    });
  }

  // === Layer Intersection Fallback ===

  private findByTagsIntersectionFallback(
    tagLayers: ReadonlyArray<ReadonlyArray<string>>,
    limit: number,
  ): ExperienceEntry[] {
    if (tagLayers.length === 0) return [];

    // Build dynamic SQL: each layer adds a JOIN requiring at least one matching tag
    const joins: string[] = [];
    const params: unknown[] = [];

    for (let i = 0; i < tagLayers.length; i++) {
      const layer = tagLayers[i];
      if (layer.length === 0) continue;
      const placeholders = layer.map(() => '?').join(',');
      joins.push(
        `JOIN tags t${i} ON t${i}.experience_id = e.id AND t${i}.tag IN (${placeholders})`
      );
      params.push(...layer);
    }

    if (joins.length === 0) return [];

    const sql = `SELECT DISTINCT e.* FROM experiences e ${joins.join(' ')} ORDER BY e.created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map((r) => this.mapExperience(r));
  }

  // === Delta Learning Fallback ===

  private upsertExperienceFallback(input: ExperienceInput): { isNew: boolean; id: string } {
    // Find existing similar experience (same agent + project + category + similar action)
    const existing = this.db.prepare(`
      SELECT id, frequency FROM experiences
      WHERE agent = ? AND project = ? AND category = ? AND action = ?
      LIMIT 1
    `).get(input.agent, input.project, input.category, input.action) as { id: string; frequency: number } | undefined;

    if (existing) {
      // Delta: increment frequency + update timestamp
      this.db.prepare(`
        UPDATE experiences
        SET frequency = frequency + 1, created_at = datetime('now')
        WHERE id = ?
      `).run(existing.id);
      return { isNew: false, id: existing.id };
    }

    // New experience: insert
    const entry = this.insertExperienceFallback(input);
    return { isNew: true, id: entry.id };
  }

  // === Tag Similarity Fallback ===

  private findSimilarTagsFallback(
    tag: string,
    autoOnly: boolean,
  ): Array<{ tag: string; confidence: number }> {
    const threshold = autoOnly ? 0.9 : 0.0;
    const rows = this.db.prepare(`
      SELECT
        CASE WHEN tag_a = ? THEN tag_b ELSE tag_a END as similar_tag,
        confidence
      FROM tag_similarity
      WHERE (tag_a = ? OR tag_b = ?) AND confidence >= ?
      ORDER BY confidence DESC
    `).all(tag, tag, tag, threshold) as Array<{ similar_tag: string; confidence: number }>;

    return rows.map((r) => ({ tag: r.similar_tag, confidence: r.confidence }));
  }

  private upsertTagSimilarityFallback(tagA: string, tagB: string): void {
    // Normalize order to avoid duplicates (alphabetical)
    const [a, b] = tagA < tagB ? [tagA, tagB] : [tagB, tagA];

    const existing = this.db.prepare(
      'SELECT id, confirmed_count FROM tag_similarity WHERE tag_a = ? AND tag_b = ?'
    ).get(a, b) as { id: number; confirmed_count: number } | undefined;

    if (existing) {
      // Re-confirmation: increase confidence (asymptotic approach to 1.0)
      // Formula: new_confidence = 1 - (1 / (confirmed_count + 1))
      const newCount = existing.confirmed_count + 1;
      const newConfidence = 1 - (1 / (newCount + 1));
      this.db.prepare(`
        UPDATE tag_similarity
        SET confidence = ?, confirmed_count = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(newConfidence, newCount, existing.id);
    } else {
      // First confirmation
      this.db.prepare(`
        INSERT INTO tag_similarity (tag_a, tag_b, confidence, confirmed_count)
        VALUES (?, ?, 0.5, 1)
      `).run(a, b);
    }
  }

  // === Row mappers (fallback only) ===

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
