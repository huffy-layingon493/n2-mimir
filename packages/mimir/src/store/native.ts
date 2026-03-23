// native.ts — Rust core native binding loader
// Loads the napi-rs compiled native addon from packages/core
//
// When Rust core is built: uses native bindings (rusqlite, SIMD)
// Fallback: uses better-sqlite3 TypeScript implementation

import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// napi-rs native binding interface (matches lib.rs exports)
export interface NativeBinding {
  openDatabase(dbPath: string): number;
  closeDatabase(handle: number): void;
  insertExperience(handle: number, inputJson: string): string;
  getExperience(handle: number, id: string): string;
  queryExperiences(handle: number, filterJson: string): string;
  searchExperiences(handle: number, query: string, limit: number): string;
  insertInsight(handle: number, inputJson: string): string;
  getInsight(handle: number, id: string): string;
  queryInsights(handle: number, filterJson: string): string;
  upvoteInsight(handle: number, id: string): void;
  downvoteInsight(handle: number, id: string): void;
  graduateInsight(handle: number, id: string, convertedType: string, convertedRef: string): void;
  setTags(handle: number, experienceId: string, tagsJson: string): void;
  getTagFrequencies(handle: number, tagsJson: string, limit: number): string;
  findExperiencesByTags(handle: number, tagsJson: string, limit: number): string;
  recordEffect(handle: number, inputJson: string): void;
  getStats(handle: number): string;
  cosineSimilarity(vecAJson: string, vecBJson: string): number;
  computeWeights(timestampsJson: string, halfLifeDays: number): string;
  storeEmbedding(handle: number, sourceType: string, sourceId: string, vectorJson: string, model: string): void;
  getEmbedding(handle: number, sourceType: string, sourceId: string): string;
}

/** Try to load native Rust binding, returns null if not available */
function tryLoadNative(): NativeBinding | null {
  try {
    const esmRequire = createRequire(import.meta.url);
    // Try platform-specific binary first (napi-rs convention)
    const corePath = join(__dirname, '..', '..', '..', 'core');
    const binding = esmRequire(join(corePath, 'n2-mimir-core.node')) as NativeBinding;
    return binding;
  } catch {
    // Native binding not available
    return null;
  }
}

/** Cached native binding instance */
let _native: NativeBinding | null | undefined;

/** Get native binding or null if unavailable */
export function getNativeBinding(): NativeBinding | null {
  if (_native === undefined) {
    _native = tryLoadNative();
  }
  return _native;
}

/** Check if native (Rust) binding is available */
export function isNativeAvailable(): boolean {
  return getNativeBinding() !== null;
}
