# n2-mimir

**경험이 기억이 되고, 기억이 행동을 바꾼다.**

AI 에이전트를 위한 경험 학습 엔진. 과거 성공/실패 경험을 자동으로 분석하고, 패턴을 추출하여 다음 작업에 적용합니다.

## 핵심 개념

```
세션 종료 → digest() → 경험 분석 → 인사이트 생성 → 다음 세션에서 자동 recall
```

- **경험(Experience)**: 성공/실패/수정 기록 (context + action + outcome)
- **인사이트(Insight)**: 반복 패턴에서 추출된 학습 결과
- **Recall**: 주제가 언급되면 관련 경험이 자동으로 떠오름
- **Overlay**: 프롬프트에 삽입할 수 있는 토큰 예산 기반 텍스트

## 설치

```bash
npm install n2-mimir better-sqlite3
```

## 빠른 시작

```typescript
import { Mimir } from 'n2-mimir';

// 1. 초기화
const mimir = new Mimir({
  dbPath: './my-experiences.db',
  tokenBudget: 500,
  halfLife: 14, // 시간 가중치 반감기 (일)
});

// 2. 경험 추가
mimir.addExperience({
  agent: 'rose',
  project: 'my-app',
  type: 'failure',
  category: 'coding_pattern',
  context: 'PowerShell 스크립트 작성',
  action: '&& 연산자 사용',
  outcome: '구문 에러 발생',
  correction: '; 연산자로 교체',
});

// 3. Recall — 주제 언급 시 관련 경험 자동 검색
const result = mimir.recall('PowerShell 스크립팅');
console.log(result.experiences);  // 관련 경험 목록
console.log(result.confidence);   // 'none' | 'ambiguous' | 'clear'

// 4. Overlay — 프롬프트 삽입용 텍스트 생성
const overlay = mimir.overlay('PowerShell 스크립팅');
console.log(overlay.overlay);      // 토큰 예산 내 경험 요약
console.log(overlay.totalTokens);  // 사용된 토큰 수

// 5. Digest — 세션 종료 시 패턴 분석 + 인사이트 생성
const digest = await mimir.digest({ project: 'my-app', agent: 'rose' });
console.log(digest.insightsCreated); // 생성된 인사이트 수

// 6. 종료
mimir.close();
```

## 3-Tier 검색 아키텍처

| Tier | 방식 | 속도 | 조건 |
|------|------|------|------|
| **1** | FTS5 + 태그 체인 | ~1ms | 항상 작동 |
| **2** | Ollama 임베딩 (cosine similarity) | ~100ms | `llm.endpoint` 설정 시 |
| **3** | Soul 생태계 연동 | - | `n2-soul` 플러그인 설치 시 |

### Tier 2 시맨틱 검색 활성화

```typescript
const mimir = new Mimir({
  dbPath: './experiences.db',
  llm: {
    provider: 'ollama',           // 'ollama' | 'openai'
    model: 'nomic-embed-text',    // 임베딩 모델
    endpoint: 'http://localhost:11434', // Ollama 서버 주소
  },
});

// 비동기 recall (시맨틱 검색 포함)
const result = await mimir.recallAsync('PowerShell 스크립팅');
```

> `llm.endpoint`를 설정하지 않으면 Tier 2는 자동 스킵되고 Tier 1만 작동합니다.

## API

### `new Mimir(config?)`
| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `dbPath` | `string` | `'./mimir.db'` | SQLite DB 경로 |
| `tokenBudget` | `number` | `500` | Overlay 최대 토큰 |
| `halfLife` | `number` | `14` | 시간 가중치 반감기 (일) |
| `llm` | `LlmConfig` | - | 시맨틱 검색용 임베딩 설정 |

### 핵심 메서드

| 메서드 | 설명 |
|--------|------|
| `addExperience(input)` | 경험 추가 |
| `recall(topic, project?, agent?)` | 동기 recall (Tier 1) |
| `recallAsync(topic, project?, agent?)` | 비동기 recall (Tier 1 + 2) |
| `overlay(topic, project?, agent?)` | 토큰 예산 기반 프롬프트 오버레이 |
| `digest({ project, agent? })` | 패턴 분석 + 인사이트 생성 |
| `queryInsights(filter)` | 인사이트 조회 |
| `getStats()` | DB 통계 |
| `close()` | DB 종료 |

## Soul 생태계 연동

n2-mimir는 단독으로 작동하지만, [n2-soul](https://github.com/n2-project/n2-soul)과 함께 사용하면 시너지를 극대화할 수 있습니다:

- `n2_boot` → 자동 `recall` (세션 시작 시 관련 경험 활성화)
- `n2_work_end` → 자동 `digest` (세션 종료 시 학습)

## 라이선스

Apache-2.0
