// semantic — Embedder + semantic search tests
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Embedder } from '../src/semantic/embedder.js';
import { experienceToText, insightToText } from '../src/semantic/search.js';
import { MimirDatabase } from '../src/store/database.js';
import { existsSync, unlinkSync } from 'fs';

describe('Embedder', () => {
  it('should be unavailable when no config provided', () => {
    const embedder = new Embedder();
    expect(embedder.isAvailable()).toBe(false);
  });

  it('should be unavailable when endpoint is missing', () => {
    const embedder = new Embedder({ provider: 'ollama', model: 'nomic-embed-text' });
    expect(embedder.isAvailable()).toBe(false);
  });

  it('should be unavailable when model is missing', () => {
    const embedder = new Embedder({ provider: 'ollama', model: '', endpoint: 'http://localhost:11434' });
    expect(embedder.isAvailable()).toBe(false);
  });

  it('should be available when endpoint and model are set', () => {
    const embedder = new Embedder({
      provider: 'ollama',
      model: 'nomic-embed-text',
      endpoint: 'http://localhost:11434',
    });
    expect(embedder.isAvailable()).toBe(true);
  });

  it('should return null when unavailable', async () => {
    const embedder = new Embedder();
    const result = await embedder.embed('test text');
    expect(result).toBeNull();
  });

  it('should return all nulls for batch when unavailable', async () => {
    const embedder = new Embedder();
    const results = await embedder.embedBatch(['a', 'b', 'c']);
    expect(results).toEqual([null, null, null]);
  });
});

describe('semantic text conversion', () => {
  it('experienceToText should combine fields', () => {
    const text = experienceToText({
      id: '1', timestamp: '', sessionId: '', agent: 'a', project: 'p',
      type: 'success', category: 'c', severity: 'info',
      context: 'PowerShell scripting',
      action: 'used semicolon',
      outcome: 'command worked',
      frequency: 1, tokenCost: 10, createdAt: '',
    });
    expect(text).toContain('PowerShell scripting');
    expect(text).toContain('used semicolon');
    expect(text).toContain('command worked');
  });

  it('experienceToText should include correction if present', () => {
    const text = experienceToText({
      id: '1', timestamp: '', sessionId: '', agent: 'a', project: 'p',
      type: 'correction', category: 'c', severity: 'info',
      context: 'ctx', action: 'act', outcome: 'out',
      correction: 'fix this',
      frequency: 1, tokenCost: 10, createdAt: '',
    });
    expect(text).toContain('fix this');
  });

  it('insightToText should return description', () => {
    const text = insightToText({
      id: '1', createdAt: '', updatedAt: '', agent: 'a',
      description: 'Always use semicolons in PowerShell',
      compressed: 'short', tokenCost: 5, category: 'c',
      scope: 'project', importance: 3, confidence: 0.8,
      effectScore: 0.5, status: 'active',
    });
    expect(text).toBe('Always use semicolons in PowerShell');
  });
});

describe('database embedding storage', () => {
  const TEST_DB = './test-semantic.db';
  let db: MimirDatabase;

  beforeEach(() => {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    db = new MimirDatabase(TEST_DB);
  });

  afterEach(() => {
    db.close();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  it('should store and retrieve embeddings', () => {
    const testVector = [0.1, 0.2, 0.3, 0.4, 0.5];
    db.storeEmbedding('experience', 'exp-001', testVector, 'nomic-embed-text');

    const result = db.getEmbedding('experience', 'exp-001');
    expect(result).not.toBeNull();
    expect(result!.model).toBe('nomic-embed-text');
    expect(result!.vector.length).toBe(5);

    // Float32 precision: values should be approximately equal
    for (let i = 0; i < testVector.length; i++) {
      expect(Math.abs(Number(result!.vector[i]) - testVector[i])).toBeLessThan(0.001);
    }
  });

  it('should return null for non-existent embedding', () => {
    const result = db.getEmbedding('experience', 'nonexistent');
    expect(result).toBeNull();
  });

  it('should list all embeddings', () => {
    db.storeEmbedding('experience', 'exp-1', [1, 2, 3], 'test-model');
    db.storeEmbedding('insight', 'ins-1', [4, 5, 6], 'test-model');

    const all = db.getAllEmbeddings();
    expect(all.length).toBe(2);
    expect(all.some((e) => e.sourceType === 'experience')).toBe(true);
    expect(all.some((e) => e.sourceType === 'insight')).toBe(true);
  });
});
