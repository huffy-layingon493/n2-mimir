# 🧠 n2-mimir

[![npm version](https://img.shields.io/npm/v/n2-mimir.svg)](https://www.npmjs.com/package/n2-mimir)
[![License](https://img.shields.io/badge/license-Dual%20(Apache--2.0%20%2B%20Commercial)-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![npm downloads](https://img.shields.io/npm/dm/n2-mimir.svg)](https://www.npmjs.com/package/n2-mimir)

**한국어** | [English](README.md)

> **AI 경험 학습 엔진** — 경험에서 배우고, 행동을 바꿉니다. 북유럽 신화의 지혜의 수호자 미미르의 이름을 따왔습니다. 🧠

## Mimir란?

AI 에이전트는 기억하지만, **학습하지 않습니다.** 매 세션마다 같은 실수를 반복합니다.

Mimir는 이 고리를 끊습니다:
```
경험 → [분석 → 패턴 추출 → 인사이트 생성] → 행동 변화
```

**이름의 유래**: 북유럽 신화에서 오딘은 지혜를 얻기 위해 한쪽 눈을 바쳤습니다 — AI는 경험이라는 대가를 치릅니다.

## 비전 — 왜 중요한가

기존 AI 에이전트는 거대한 규칙 문서(constitution 파일, 시스템 프롬프트)에 의존합니다. 매 세션마다 수천 토큰을 소비하고 — AI가 따르지 않을 수도 있습니다.

```
Before (토큰 소모형):
  📄 GEMINI.md (3000+ 토큰) → AI가 부팅 시 읽음 → 무시할 수 있음 → 매 세션 반복

After (시스템 강제, 0 토큰):
  🛡️ Ark    → 규칙을 상태 머신으로 컴파일. AI가 우회 불가. 읽을 필요 없음.
  🧵 Clotho → 검증된 인사이트가 자동으로 규칙이 됨. 수동 작성 불필요.
  🧠 Mimir  → 적시에 경험을 회상. 반복 설명 불필요.
```

## 아키텍처

```
┌─────────────────────────────────────┐
│            n2-mimir                 │
├──────────┬──────────────────────────┤
│ Rust Core│  TypeScript Brain        │
│ (napi-rs)│                          │
│          │  collector/ → normalizer │
│ SQLite   │  analyzer/  → patterns   │
│ FTS5     │  insight/   → generator  │
│ Vector   │  converter/ → overlay    │
│          │  tracker/   → scoring    │
│          │  orchestrator/ → recall  │
└──────────┴──────────────────────────┘
```

- **Rust Core**: SQLite, FTS5 전문 검색, SIMD 벡터 연산 (성능)
- **TS Brain**: 패턴 분석, 인사이트 생성, 토큰 예산 기반 오버레이

> 💡 **Rust 없어도 괜찮습니다.** Mimir는 자동으로 `better-sqlite3`로 폴백합니다. 모든 기능이 작동합니다 — SIMD 벡터 가속만 빠집니다.

## 📦 설치

> 💡 **최고의 설치 방법**: AI에게 *"n2-mimir 설치해줘"* 라고 말하세요. 알아서 합니다. 🧠

```bash
npm install n2-mimir
```

**ESM**과 **CJS** 모두 지원:
```typescript
// ESM
import { Mimir } from 'n2-mimir';

// CJS
const { Mimir } = require('n2-mimir');
```

> **요구사항**: Node.js >= 20 + `better-sqlite3` (C++ 빌드 도구 필요).
> 설치 실패 시 에러 메시지에 플랫폼별 안내가 표시됩니다.

## 빠른 시작

### 단독 사용 (Soul 불필요)

```typescript
import { Mimir } from 'n2-mimir';

const mimir = new Mimir({ dbPath: './mimir.db' });

// 경험 추가 — agent/project는 선택사항 (기본값: 'default')
mimir.addExperience({
  type: 'correction',
  category: 'workflow',
  context: '터미널 작업',
  action: '디렉토리 이름에 특수문자 사용',
  outcome: '터미널 명령어가 전부 멈춤',
  correction: '디렉토리 이름은 [a-z0-9-]만 사용',
});

// 멀티 에이전트 환경에서는 agent/project 지정
mimir.addExperience({
  agent: 'rose',
  project: 'my-project',
  type: 'success',
  category: 'coding',
  context: 'React 최적화',
  action: 'React.memo를 리스트 아이템에 적용',
  outcome: '렌더링 시간 60% 감소',
});

// 관련 경험 회상
const result = mimir.recall('directory naming');

// 프롬프트 주입용 오버레이 (500t 예산)
const overlay = mimir.overlay('directory naming');

// Auto Study: 웹에서 자동 학습 (API 키 불필요)
const study = await mimir.autoStudy('React Server Components');
console.log(`검증된 팩트 ${study.factsVerified}개 학습 완료`);

// Digest: 패턴 분석 + 인사이트 생성
await mimir.digest({ project: 'default' });

mimir.close();
```

### Soul 통합

```typescript
// Soul 부팅 시 Mimir가 자동 로드됩니다.
// soul/lib/config.js에서 설정 — 추가 코드 불필요.
```

## 📚 API 레퍼런스

### 경험 수집

| 메서드 | 설명 |
|--------|------|
| `addExperience(input)` | 경험 추가 + 자동 태깅 + 임베딩 |
| `addRawExperience(raw)` | 비정규 경험 추가 (자동 정규화) |
| `queryExperiences(filter)` | project/agent/category/type 기준 조회 |
| `deltaLearn(input)` | Upsert: 기존 → frequency++, 신규 → insert |

### Recall & Overlay

| 메서드 | 설명 |
|--------|------|
| `recall(topic, project?, agent?)` | FTS5 + 태그 + 시맨틱 검색 |
| `recallAsync(topic, project?, agent?)` | + Ollama 코사인 유사도 |
| `overlay(topic, project?, agent?)` | recall + assemble → 프롬프트 주입용 텍스트 |

### Digest & Insights

| 메서드 | 설명 |
|--------|------|
| `digest({ project, agent? })` | 수집 → 분석 → 인사이트 생성 |
| `queryInsights(filter)` | 상태/중요도 기준 인사이트 조회 |
| `getGraduatedInsights()` | 졸업된 인사이트 (규칙 변환 대기) |
| `upvoteInsight(id)` / `downvoteInsight(id)` | 중요도 투표 |

### Auto Study (웹 자동 학습)

| 메서드 | 설명 |
|--------|------|
| `autoStudy(topic, config?)` | 검색 → 크롤링 → 추출 → 교차검증 → 저장 |

### 태그 유사도

| 메서드 | 설명 |
|--------|------|
| `confirmTagSimilarity(tagA, tagB)` | 사용자 확인 태그 유사도 기록 |
| `findSimilarTags(tag, autoOnly?)` | 유사 태그 검색 (confidence 기반) |

### 유틸리티

| 메서드 | 설명 |
|--------|------|
| `getStats()` | `{ experiences, insights, tags }` 통계 |
| `close()` | DB 연결 종료 |

## 학습 생명주기

Mimir의 학습은 인간의 전문성 습득과 같은 경로를 따릅니다:

```
경험 수집 (Experience)
  → 패턴 감지 (Pattern Detection)
    → 통찰 생성 (Insight Generation)
      → 반복 검증 (Voting + Merging)
        → 졸업 (Graduation)
          → 규칙 강제 (Ark Enforcement) ← Clotho
```

### 실제 사례 — "Rose가 부팅 순서를 학습한 과정"

```
Day 1:  Rose가 부팅 후 n2_coding() 건너뜀
        → 사용자 수정 → Mimir가 수정 경험 기록

Day 2:  또 건너뜀
        → 패턴 감지 → 인사이트 생성: "n2_boot 후 반드시 n2_coding 호출"
        → importance: 2

Day 3-5: 계속 잊어먹음
        → 매 수정 = 기존 인사이트 upvote
        → importance: 2 → 6 → 12 → 20 → 34

Day 6+: importance 34 = 최우선 인사이트
        → 매 부팅마다 ⚠️ 주입 → 더 이상 안 잊어먹음 ✅
```

## 토큰 비용

| 단계 | LLM 토큰 | 비고 |
|------|----------|------|
| ACTIVATE (부팅) | ~500 | 오버레이 주입만. DB 쿼리는 무료 (로컬 SQLite) |
| RECALL (작업 시작) | ~300 | 작업 기반 경험 회상 |
| DIGEST (작업 종료) | 0 | 템플릿 기반, LLM 불필요 |
| AUTO STUDY | ~20 (도구 호출만) | 전체 파이프라인은 서버사이드 0 토큰 |

**모든 DB 연산 (검색, 태그, 투표, 점수) = 0 토큰.** 전부 로컬 SQLite에서 실행됩니다.

## 🔧 설정

```javascript
// soul/lib/config.local.js
module.exports = {
    MIMIR: {
        tokenBudget: 500,          // 경험 오버레이 최대 토큰
        halfLife: 14,              // 중요도 반감기 (일)

        // 시맨틱 검색 활성화 (Ollama 필요)
        llm: {
            provider: 'ollama',
            model: 'nomic-embed-text',
            endpoint: 'http://localhost:11434',
        },
    },
};
```

## 🌐 N2 생태계 — 함께하면 더 강력합니다

| 패키지 | 역할 | npm | 단독 사용 |
|--------|------|-----|:---------:|
| **QLN** | 도구 라우팅 (1000+ 도구 → 1 라우터) | `n2-qln` | ✅ |
| **Soul** | 에이전트 기억 & 세션 관리 | `n2-soul` | ✅ |
| **Ark** | 보안 정책 & 코드 검증 | `n2-ark` | ✅ |
| **Arachne** | 코드 컨텍스트 자동 조립 | `n2-arachne` | ✅ |
| **Mimir** | 경험 학습 엔진 🧠 | `n2-mimir` | ✅ |
| **Clotho** | 인사이트 → 규칙 자동 생성 🧵 | `n2-clotho` | ✅ |

> 모든 패키지는 **100% 단독 사용 가능**합니다. 하지만 조합하면 마법이 일어납니다.

### 🔗 시너지: 자기 개선 루프

```
사용자가 AI와 작업
     │
     ▼
┌─── Soul (기억) ──────────────────────────────────┐
│ 세션, 핸드오프, 결정 기록                         │
│ → work_start 시 Mimir recall 트리거              │
│ → work_end 시 Mimir digest 트리거                │
└───────────────┬──────────────────────────────────┘
                │
                ▼
┌─── Mimir (학습) ────────────────────────────────┐
│ 경험 수집 → 인사이트 생성                        │
│ → importance 30+ → 졸업 → Clotho로              │
└───────────────┬──────────────────────────────────┘
                │
                ▼
┌─── Clotho (규칙 자동화) ────────────────────────┐
│ 졸업 인사이트 → .n2 규칙 파일 (0 토큰)           │
│ → Ark가 부팅 시 로드                             │
└───────────────┬──────────────────────────────────┘
                │
                ▼
┌─── Ark (강제) ──────────────────────────────────┐
│ 상태 머신: .n2 컴파일 → 위반 차단               │
│ → 시스템 레벨 강제, AI 우회 불가                 │
│ → 더 많이 일할수록 → 더 똑똑한 규칙             │
└─────────────────────────────────────────────────┘
```

## 📄 라이선스

| 용도 | 라이선스 | 비용 |
|------|----------|------|
| 개인 / 교육 | Apache 2.0 | **무료** |
| 오픈소스 (비상업) | Apache 2.0 | **무료** |
| 상업 / 기업 | 상업 라이선스 | [문의](mailto:lagi0730@gmail.com) |

자세한 내용은 [LICENSE](./LICENSE)를 참조하세요.

## 💖 후원

커피 없으면 스타라도 ☕→⭐

> 후원하기 → [GitHub Sponsors](https://github.com/sponsors/choihyunsus)

---

🌐 [nton2.com](https://nton2.com) · 📦 [npm](https://www.npmjs.com/package/n2-mimir) · 📧 lagi0730@gmail.com

*Mimir — 지혜의 수호자. 경험에서 배우는 당신의 AI.* 🧠
