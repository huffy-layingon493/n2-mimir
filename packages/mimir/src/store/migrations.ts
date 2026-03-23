// Schema migration runner — versioned database schema evolution
import type BetterSqlite3 from 'better-sqlite3';
import { SCHEMA_VERSION } from './schema.js';

/**
 * Migration definitions: version → SQL statements to execute.
 * Each key is the TARGET version to migrate TO.
 * SQL runs inside a transaction for atomicity.
 */
const MIGRATIONS: Record<number, ReadonlyArray<string>> = {
  // v1 is the initial schema (created by SCHEMA_SQL in schema.ts)
  // Future migrations go here:
  // 2: [
  //   'ALTER TABLE experiences ADD COLUMN embedding_status TEXT DEFAULT NULL;',
  //   'CREATE INDEX IF NOT EXISTS idx_exp_embedding ON experiences(embedding_status);',
  // ],
};

/** Read current schema version from database meta table */
function getCurrentVersion(db: BetterSqlite3.Database): number {
  try {
    const row = db.prepare(
      "SELECT value FROM meta WHERE key = 'schema_version'"
    ).get() as { value: string } | undefined;
    return row ? parseInt(row.value, 10) : 0;
  } catch {
    // meta table doesn't exist yet → version 0
    return 0;
  }
}

/** Update schema version in meta table */
function setVersion(db: BetterSqlite3.Database, version: number): void {
  db.prepare(
    "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)"
  ).run(String(version));
}

/**
 * Run all pending migrations from current version to SCHEMA_VERSION.
 * Each migration runs in a transaction for safety.
 *
 * @returns number of migrations applied
 */
export function runMigrations(db: BetterSqlite3.Database): number {
  const current = getCurrentVersion(db);
  if (current >= SCHEMA_VERSION) return 0;

  let applied = 0;

  for (let v = current + 1; v <= SCHEMA_VERSION; v++) {
    const sqls = MIGRATIONS[v];
    if (!sqls || sqls.length === 0) continue;

    db.transaction(() => {
      for (const sql of sqls) {
        db.exec(sql);
      }
      setVersion(db, v);
    })();

    applied++;
  }

  // Ensure version is current even if no migrations needed
  if (applied === 0) {
    setVersion(db, SCHEMA_VERSION);
  }

  return applied;
}
