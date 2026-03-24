// Simulation 3: cosineSimilarity unified utility verification
// Ensures the shared function works identically in all import paths
import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from '../src/utils/math.js';
import { cosineSimilarity as verifierCosineSim } from '../src/search/verifier.js';

describe('Simulation 3: cosineSimilarity Unified Utility', () => {

  // --- Core math correctness ---

  it('identical vectors should return 1.0', () => {
    const v = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 10);
  });

  it('orthogonal vectors should return 0.0', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 10);
  });

  it('opposite vectors should return -1.0', () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 10);
  });

  it('partially similar vectors should return between 0 and 1', () => {
    const a = [1, 1, 0];
    const b = [1, 0, 1];
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });

  // --- Edge case guards ---

  it('empty vectors should return 0', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('mismatched lengths should return 0', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it('zero vectors should return 0 (no division by zero)', () => {
    expect(cosineSimilarity([0, 0, 0], [0, 0, 0])).toBe(0);
  });

  it('null-like edge cases should return 0', () => {
    expect(cosineSimilarity(null as unknown as number[], [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], undefined as unknown as number[])).toBe(0);
  });

  // --- Re-export consistency ---

  it('verifier re-export should return same result as utils/math', () => {
    const a = [0.1, 0.5, 0.9, 0.2, 0.7];
    const b = [0.3, 0.6, 0.1, 0.8, 0.4];

    const fromUtils = cosineSimilarity(a, b);
    const fromVerifier = verifierCosineSim(a, b);

    expect(fromUtils).toBe(fromVerifier);
  });

  it('verifier re-export should handle edge cases identically', () => {
    expect(verifierCosineSim([], [])).toBe(cosineSimilarity([], []));
    expect(verifierCosineSim([1], [1])).toBe(cosineSimilarity([1], [1]));
  });

  // --- High-dimensional vectors (embedding-sized) ---

  it('should handle 768-dim vectors (nomic-embed-text size)', () => {
    const dim = 768;
    const a = Array.from({ length: dim }, (_, i) => Math.sin(i * 0.01));
    const b = Array.from({ length: dim }, (_, i) => Math.cos(i * 0.01));

    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThan(-1);
    expect(sim).toBeLessThan(1);
    expect(typeof sim).toBe('number');
    expect(Number.isNaN(sim)).toBe(false);
  });
});
