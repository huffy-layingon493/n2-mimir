// Embedder — Ollama/OpenAI embedding API client
// Gracefully inactive when no endpoint is configured

import type { LlmConfig } from '../types.js';

/** Embedding result */
export interface EmbeddingResult {
  readonly vector: readonly number[];
  readonly model: string;
}

/**
 * Embedder — converts text into embedding vectors.
 *
 * - Ollama: POST /api/embeddings { model, prompt }
 * - OpenAI: POST /v1/embeddings { model, input }
 * - No endpoint configured → isAvailable() = false → embed() returns null
 */
export class Embedder {
  private readonly config: LlmConfig | undefined;
  private readonly _available: boolean;
  private readonly _cache: Map<string, EmbeddingResult> = new Map();

  constructor(config?: LlmConfig) {
    this.config = config;
    this._available = !!(config?.endpoint && config.model);
  }

  /** Whether semantic search is enabled */
  isAvailable(): boolean {
    return this._available;
  }

  /** Convert text to embedding vector. Returns null if inactive */
  async embed(text: string): Promise<EmbeddingResult | null> {
    if (!this._available || !this.config?.endpoint) return null;

    try {
      const vector = await this.callApi(text);
      const result: EmbeddingResult = { vector, model: this.config.model };
      this._cache.set(text, result);
      return result;
    } catch {
      // Embedding failure is non-fatal — Tier 1 keyword search continues
      return null;
    }
  }

  /**
   * Sync embedding lookup from cache.
   * Returns cached result or null if not cached.
   * Use embed() first to populate the cache.
   */
  embedSync(text: string): EmbeddingResult | null {
    return this._cache.get(text) ?? null;
  }

  /** Batch embed multiple texts (concurrency limited: 3) */
  async embedBatch(texts: readonly string[]): Promise<(EmbeddingResult | null)[]> {
    if (!this._available) return texts.map(() => null);
    const results: (EmbeddingResult | null)[] = new Array(texts.length).fill(null);
    const CONCURRENCY = 3;
    for (let i = 0; i < texts.length; i += CONCURRENCY) {
      const batch = texts.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map((t) => this.embed(t)));
      for (let j = 0; j < batchResults.length; j++) {
        results[i + j] = batchResults[j];
      }
    }
    return results;
  }

  /** Call API based on provider */
  private async callApi(text: string): Promise<readonly number[]> {
    const { provider, model, endpoint } = this.config!;

    switch (provider) {
      case 'ollama':
        return this.callOllama(endpoint!, model, text);
      case 'openai':
        return this.callOpenAI(endpoint!, model, text);
      default:
        // anthropic 등 미지원 provider → ollama 방식으로 시도
        return this.callOllama(endpoint!, model, text);
    }
  }

  /** Ollama: POST /api/embeddings */
  private async callOllama(endpoint: string, model: string, text: string): Promise<readonly number[]> {
    const url = endpoint.replace(/\/$/, '') + '/api/embeddings';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      throw new Error(`Ollama embedding failed: ${response.status}`);
    }

    const data = await response.json() as { embedding: number[] };
    return data.embedding;
  }

  /** OpenAI-compatible: POST /v1/embeddings */
  private async callOpenAI(endpoint: string, model: string, text: string): Promise<readonly number[]> {
    const url = endpoint.replace(/\/$/, '') + '/v1/embeddings';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: text }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`OpenAI embedding failed: ${response.status}`);
    }

    const data = await response.json() as { data: Array<{ embedding: number[] }> };
    return data.data[0].embedding;
  }
}
