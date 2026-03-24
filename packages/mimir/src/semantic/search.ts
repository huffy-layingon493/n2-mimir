// Semantic search — cosine similarity 기반 벡터 검색
// database에 저장된 임베딩과 쿼리 벡터를 비교하여 유사한 경험/인사이트를 찾음

import type { MimirDatabase } from '../store/database.js';
import type { Embedder } from './embedder.js';
import type { ExperienceEntry, Insight } from '../types.js';

/** 시맨틱 검색 결과 */
export interface SemanticResult {
  readonly sourceType: 'experience' | 'insight';
  readonly sourceId: string;
  readonly similarity: number;
}

/**
 * 시맨틱 검색: 쿼리 텍스트를 임베딩 → DB의 저장된 벡터들과 cosine similarity 비교.
 * Embedder가 비활성이면 빈 배열 반환.
 */
export async function semanticSearch(
  db: MimirDatabase,
  embedder: Embedder,
  query: string,
  limit = 10,
): Promise<readonly SemanticResult[]> {
  if (!embedder.isAvailable()) return [];

  const queryEmbedding = await embedder.embed(query);
  if (!queryEmbedding) return [];

  // DB에서 모든 임베딩을 가져와서 cosine similarity 계산
  // (소규모 DB에서는 충분, 대규모에서는 Rust core의 batch_cosine_similarity 사용)
  const allEmbeddings = db.getAllEmbeddings();
  if (allEmbeddings.length === 0) return [];

  const results: SemanticResult[] = allEmbeddings
    .map((emb) => ({
      sourceType: emb.sourceType as 'experience' | 'insight',
      sourceId: emb.sourceId,
      similarity: cosineSimilarity(queryEmbedding.vector, emb.vector),
    }))
    .filter((r) => r.similarity > 0.3) // 최소 유사도 임계값
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
}

/**
 * 경험 또는 인사이트를 임베딩하고 DB에 저장.
 * 이미 임베딩이 있으면 스킵.
 */
export async function embedAndStore(
  db: MimirDatabase,
  embedder: Embedder,
  sourceType: 'experience' | 'insight',
  sourceId: string,
  text: string,
): Promise<boolean> {
  if (!embedder.isAvailable()) return false;

  // 이미 임베딩이 있는지 확인
  const existing = db.getEmbedding(sourceType, sourceId);
  if (existing) return false;

  const result = await embedder.embed(text);
  if (!result) return false;

  db.storeEmbedding(sourceType, sourceId, result.vector, result.model);
  return true;
}

/**
 * 경험을 임베딩용 텍스트로 변환.
 * context + action + outcome을 결합하여 의미 있는 벡터 생성.
 */
export function experienceToText(exp: ExperienceEntry): string {
  const parts = [exp.context, exp.action, exp.outcome];
  if (exp.correction) parts.push(exp.correction);
  return parts.join(' ');
}

/** 인사이트를 임베딩용 텍스트로 변환 */
export function insightToText(insight: Insight): string {
  return insight.description;
}

/** Cosine similarity 계산 (TypeScript fallback — Rust core 없을 때 사용) */
function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom < 1e-10 ? 0 : dot / denom;
}
