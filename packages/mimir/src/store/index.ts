// store/ — Database layer (Rust native + better-sqlite3 fallback)
export { MimirDatabase } from './database.js';
export { isNativeAvailable, getNativeBinding } from './native.js';
export { SCHEMA_SQL, SCHEMA_VERSION } from './schema.js';
export { runMigrations } from './migrations.js';
