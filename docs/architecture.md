# n2-Mímir 아키텍처 기획서
> **AI 에이전트 경험 엔진** — 경험에서 배우고, 행동을 바꾸는 시스템
> v0.1 | 2026-03-23 | 작성: Rose

---

## 1. 프로젝트 개요

### 1-1. 네이밍

**n2-Mímir (미미르)** — 북유럽 신화에서 지혜의 샘을 지키는 존재.
오딘이 한쪽 눈을 바쳐 지혜를 얻었듯, AI도 경험이라는 대가를 치르고 성장한다.

### 1-2. 왜 Mímir가 필요한가

> **Soul은 기억한다. Mímir는 배운다.**
> Soul이 일기장이라면, Mímir는 일기장을 정리해서 교훈으로 만드는 두뇌다.

Soul에는 이미 모든 기억이 있다:
- Ledger에 모든 작업 이력이 있다
- KV-Cache에 세션 컨텍스트가 있다
- Core Memory에 규칙이 있다
- Brain에 공유 지식이 있다

**그런데 왜 같은 실수를 반복하는가?**

```
기억 = 있다 ✅
학습 = 안 된다 ❌

"기억은 있는데 학습이 안 된다"
→ 이것이 Mímir가 존재하는 유일한 이유다.
```

Mímir의 역할은 단 하나:

```
기존 기억(Soul) → [학습된 경험으로 변환] → 언제든지 꺼내서 사용
                          ↑
                    이것이 Mímir

기억 저장? → Soul이 한다 (Mímir는 안 한다)
기억 검색? → Arachne이 한다 (Mímir는 안 한다) 
규칙 차단? → Ark가 한다 (Mímir는 안 한다)
워크플로우? → Clotho가 한다 (Mímir는 안 한다)

Mímir는 오직: 기억 → 교훈 → 행동 변화. 이것만 한다.
```

이것은 **모델의 문제가 아닌 구조의 문제**다. GPT-5가 와도, Claude 4가 와도 해결 안 됨.

### 1-3. 해결 방향

가중치를 바꾸지 않고도 행동을 수정하는 방법:

```
경험 데이터 → [Mímir: 분석 → 통찰 → 규칙] → 컨텍스트 주입 + 행동 강제

예시:
  Ledger: "D:\Project.N2\soul 접근 → 주인님 교정 3회"
  → Mímir 분석: "배포판 경로 접근 = 실패 패턴"
  → 통찰 생성: "D:\Project.N2\soul은 배포판. D:\Project.N2\n2-browser\soul이 진짜"
  → 규칙 생성: 부팅 시 자동 주입 + Ark 차단 규칙 추가
  → 결과: 다음 세션에서 배포판 접근 시도 시 물리적 차단
```

### 1-4. 포지셔닝

```
독립 모듈: 어떤 AI 에이전트 시스템에든 붙일 수 있는 경험 엔진
N2 통합:  Soul + Arachne + Ark + Clotho와 결합하면 풀 파워

단독 Mímir → "기억에서 배우는 AI" (가치 있음)
Soul+Mímir → "기억 + 검색 + 분석 + 강제 = 진짜 성장하는 AI" (유일무이)
```

---

## 2. N2 생태계 컨텍스트

### 2-1. Mímir의 위치

```
┌─── 감각 ─────────────┐
│ QLN (브라우저)          │
│ Kraken (웹 탐색)       │
│ 터미널 출력             │
│ 사용자 피드백           │
└────────┬─────────────┘
         ↓ 경험 데이터
┌─── 기억 ─────────────┐
│ Soul Ledger (불변 기록) │
│ KV-Cache (세션 기억)   │
│ Core Memory (정체성)   │
│ Brain (공유 기억)      │
│ Entity (사물/사람 정보) │
│ Arachne (코드 구조)    │
└────────┬─────────────┘
         ↓
┌─── 🔥 Mímir (NEW) ──┐
│ 경험 분석               │
│ 통찰 추출               │
│ 규칙 자동 생성           │
│ 효과 추적               │
└────────┬─────────────┘
         ↓
┌─── 행동 ─────────────┐
│ Ark (규칙 차단)         │
│ Clotho (상태머신 강제)  │
│ 부팅 시 컨텍스트 주입    │
└──────────────────────┘
```

### 2-2. 타 시스템과의 차별점

| 비교 대상 | 접근 방식 | 한계 |
|----------|----------|------|
| AutoResearchClaw evolution.py | 실패 로그 → JSONL → 프롬프트 주입 | 기억 없음, 검색 없음, 강제 없음 |
| mem0.ai | 벡터 DB 기반 기억 | 경험 분석 없음, 행동 수정 없음 |
| Reflexion | 세션 내 자기 반성 | 세션 간 전이 없음 |
| ExpeL | 경험→통찰 추출 | 행동 강제 메커니즘 없음 |
| **n2-Mímir** | **기억→분석→통찰→규칙→강제** | **풀 파이프라인** |

---

## 3. 핵심 아키텍처

### 3-0. 설계 철학 (★ 모든 구현은 이것을 따른다)

```
1. Mímir는 도구가 아니다. 체질이다.
   - Arachne: 도구를 호출해야 컨텍스트를 가져온다 (수동)
   - Mímir: 부팅만 하면 경험이 자동으로 흘러 들어온다 (자동)
   - "유튜브 영상 만들어" 한마디에 포맷/도구/주의사항이 이미 떠오른다

2. 설계가 90%다.
   - 성급하게 레이어를 쌓지 않는다
   - 각 모듈은 하나만 잘 한다 (fp2 원칙)
   - 관료적 7-layer가 아닌, 실전적 5-module

3. 토큰은 금이다.
   - 아무리 좋은 통찰도 프롬프트에 쏟아부으면 역효과
   - Arachne의 핵심 — 토큰 예산 안에서 최적 조립
   - 50개 통찰이 있어도 예산 안에서 상위 5개만 주입

4. 부팅하면 Day 100이다.
   - 모든 경험은 SQLite에 영구 보존
   - 세션/모델/에이전트가 바뀌어도 경험은 그대로
   - JSONL 같은 느린 방식 금지 — SQL 밀리초 검색

5. Soul을 다시 만드는 게 아니다.
   - 기억 저장? → Soul이 한다
   - 기억 검색? → Arachne이 한다
   - Mímir는 오직: 기억 → 교훈 → 행동 변화
```

### 3-1. 5-Module 아키텍처

```
진짜 작동 경로는 딱 2개:

경로 1: ACTIVATE (부팅 시 — 빠르게, 토큰 적게)
  "이 작업에 관련된 경험을 최소 토큰으로 자동 주입"
  boot → Rust 검색(< 1ms) → 토큰 예산 내 조립 → 자동 흐름

경로 2: DIGEST (종료 시 — 느려도 됨)
  "이번 세션에서 뭘 배웠는지 정리해서 영구 저장"
  work_end → 경험 수집 → LLM 분석 → 압축 저장
```

```
┌─── Rust Core (불변 — 한번 만들면 안 건드림) ───────┐
│                                                    │
│  engine   — SQLite + FTS5 + 태그 체인 + 임베딩     │
│             (모든 I/O: 읽기/쓰기/검색/마이그레이션)  │
│                                                    │
│  compute  — 시간 가중치 + cosine + 점수            │
│             + 토큰 비용 계산 (모든 수학)             │
│                                                    │
└──────────────────┬─────────────────────────────────┘
                   │ napi-rs 바인딩
┌──────────────────▼─────────────────────────────────┐
│                                                    │
│  TypeScript Brain (가변 — LLM 바뀌면 여기만 수정)   │
│                                                    │
│  digest    — 기억 → 압축된 통찰로 변환              │
│              (학습 경로: work_end 시 자동 실행)      │
│              수집 → 분류 → 비교 분석 → 통찰 생성     │
│                                                    │
│  activate  — 경험 → 토큰 예산 내 자동 주입          │
│              (회수 경로: boot 시 자동 실행)          │
│              검색 → 정렬 → 예산 채우기 → 주입        │
│              ★ 도구 호출 아님! 자동으로 흐름!        │
│                                                    │
│  soul-plugin — MCP 훅 (연결만 담당)                 │
│                n2_boot → activate()                 │
│                n2_work_end → digest()               │
│                                                    │
└────────────────────────────────────────────────────┘
```

### 3-2. Arachne vs Mímir — 왜 다른가

```
Arachne (수동 도구):
  개발자: "코드 컨텍스트 줘" → assemble() 호출 → 결과
  → 명시적 호출이 필요. 안 부르면 안 온다.

Mímir (자동 체질):
  부팅: boot → activate() 자동 → 경험이 이미 AI의 일부
  작업: "유튜브 영상 만들어" → 이미 알고 있음
        가로 16:9, 썸네일 필수, BGM 저작권프리...
  → 물어볼 필요 없다. 경험이 나의 일부니까.

공통점 (Arachne에서 가져온 핵심):
  ✅ 토큰 예산 시스템 — budget 안에서 최적 조립
  ✅ 중요도 기반 정렬 — 가장 중요한 것부터
  ✅ 압축 전달 — 최소 토큰으로 최대 정보
```

### 3-3. 토큰 예산 시스템

```
activate() 실행 시:

  입력: 토큰 예산 (config, 기본값 500 토큰)

  1. Rust engine:  관련 통찰 20개 검색           (< 1ms)
  2. Rust compute: 중요도 × 관련성 × 시간 가중치   (< 0.1ms)
  3. TS activate:  토큰 비용 계산 + 예산 채우기:

     통찰 1: "배포판 접근 금지" (12 토큰) → 누적 12  ✅
     통찰 2: "&&대신 ; 사용" (8 토큰)     → 누적 20  ✅
     통찰 3: "npm install 승인" (15 토큰) → 누적 35  ✅
     ...
     통찰 N: 예산 초과 → STOP

  결과: 500 토큰 안에 가장 중요한 경험만 압축 전달
  50개 통찰이 있어도 토큰 5개짜리만 쓰면 100개도 가능
```

### 3-4. 핵심 데이터 구조

#### ExperienceEntry (경험 엔트리)

```typescript
interface ExperienceEntry {
  id: string;
  timestamp: string;             // ISO 8601
  sessionId: string;
  agent: string;
  project: string;

  // 경험 내용
  type: 'success' | 'failure' | 'correction' | 'pattern';
  category: string;              // coding, navigation, workflow, etc.
  context: string;               // 무엇을 하고 있었나
  action: string;                // 무엇을 했나
  outcome: string;               // 결과가 어땠나
  correction?: string;           // 사용자가 어떻게 교정했나

  // 메타데이터
  severity: 'info' | 'warning' | 'error' | 'critical';
  tokenCost: number;             // ★ 이 경험을 주입하면 토큰 몇 개 드는지
  sourceRef?: string;            // 출처 (ledger ID, KV snapshot ID 등)
}
```

#### Insight (통찰)

```typescript
interface Insight {
  id: string;
  createdAt: string;
  updatedAt: string;
  agent: string;

  // 통찰 내용
  description: string;           // 자연어 (사람이 읽을 수 있음)
  compressed: string;            // ★ 최소 토큰 압축 버전
  category: string;
  scope: 'global' | 'project' | 'agent';

  // 점수
  importance: number;            // UPVOTE +1, DOWNVOTE -1 (초기 2)
  confidence: number;            // 0~1 (지지 경험 수)
  effectScore: number;           // 적용 후 실제 효과
  tokenCost: number;             // ★ compressed 버전의 토큰 수

  // 생명주기
  status: 'active' | 'dormant' | 'retired' | 'graduated';
}
```

### 3-5. 작동 흐름

```
═══ 부팅 (ACTIVATE 경로) ═══════════════════════════

  n2_boot() 실행
    ↓
  soul-plugin: activate() 자동 호출
    ↓
  Rust engine: 프로젝트/에이전트 관련 통찰 검색 (< 1ms)
    ↓
  Rust compute: 중요도 × 시간 가중치로 정렬 (< 0.1ms)
    ↓
  TS activate: 토큰 예산 내 compressed 통찰 조립
    ↓
  프롬프트에 자동 주입 (★ 도구 호출 아님!)
    ↓
  에이전트는 이미 모든 경험을 "알고 있는" 상태로 시작

★★★ 핵심 원칙 (2026-03-23 추가) ★★★

  부팅 때 전부 쏟아내는 게 아니다!
  쏟아내면 컨텍스트 터져서 들어오자마자 나가야 됨.

  기억은 떠올려야 나온다. 경험은 그냥 나온다.
  → 사용자가 주제를 말하는 그 순간,
    orchestrator가 관련 경험만 자동으로 가져온다.

  예시:
    주인님: "유튜브 영상 만들어"
      → classifier: domain = "영상"
      → recall: 영상 관련 경험 연쇄 검색 (~10ms)
      → assembler: 토큰 예산 내에서 관련 통찰만 조립
      → AI에게: 가로 16:9, 썸네일 필수, BGM 저작권프리...
      → 이건 '검색 결과'가 아니라 '그냥 아는 것'으로 느껴져야 한다.

  부팅 시: graduated급 critical 경고만 최소 주입
  작업 시: 주제가 주어지는 순간 orchestrator 발동 → 경험 자동 recall


═══ 종료 (DIGEST 경로) ═════════════════════════════

  n2_work_end() 실행
    ↓
  soul-plugin: digest() 자동 호출
    ↓
  TS digest: Ledger/KV에서 이번 세션 경험 수집
    ↓
  TS digest: 교정 패턴 감지 + 성공/실패 비교
    ↓
  TS digest: LLM으로 통찰 생성 (compressed 버전 포함)
    ↓
  Rust engine: SQLite에 영구 저장 + 태그 자동 생성
    ↓
  효과 추적: 이전 통찰이 이번 세션에 도움 됐는지 점수 갱신

★★★ 왜 converter/가 핵심인가 (2026-03-23 추가) ★★★

  Core Memory에 아무리 열심히 적어놔도 AI가 안 읽으면 의미 없다.
  → 이래서 Ark와 Clotho를 만든 것이다.

  통찰을 "적어놓는 것"으로는 행동이 안 바뀐다.
  converter/가 하는 일:
    - overlay.ts → 프롬프트 주입 (최소 강제, 무시 가능)
    - ark.ts    → Ark 규칙으로 변환 (물리적 차단, 무시 불가)
    - clotho.ts → Clotho 워크플로우로 변환 (강제 루틴, 건너뛸 수 없음)

  graduated 통찰(importance≥5, effectScore≥0.8)만 변환 대상.
  = "충분히 검증된 경험만 강제 규칙이 된다."
```

---

## 4. 독립 모듈 설계 (Standalone)

### 4-1. 독립 동작 모드

Mímir는 Soul 없이도 동작할 수 있어야 한다.

```
독립 모드에서 사용 가능한 것:
  ✅ 경험 수집 (SQLite 스토어)
  ✅ SQL 오케스트레이터 (연쇄 검색, FTS5 전문 검색)
  ✅ 시맨틱 검색 (Ollama 임베딩 기본 탑재)
  ✅ 패턴 분석 (LLM 호출)
  ✅ 통찰 생성/관리
  ✅ 프롬프트 오버레이 생성
  ❌ Ark/Clotho 규칙 생성 (Soul 없음 → 프롬프트 주입만)
  ❌ 불변 Ledger (SQLite experiences 테이블이 대체)
```

### 4-2. npm 패키지 구조

```
n2-mimir/
├── README.md
├── package.json
├── src/
│   ├── index.ts                 # 진입점 + public API
│   ├── types.ts                 # ExperienceEntry, Insight, Pattern 타입
│   ├── collector/               # Layer 1: 경험 수집
│   │   ├── index.ts
│   │   ├── adapters/            # 다양한 소스 어댑터
│   │   │   ├── ledger.ts        # Soul Ledger 어댑터
│   │   │   ├── jsonl.ts         # 독립 JSONL 어댑터
│   │   │   └── generic.ts       # 범용 어댑터 (타 시스템용)
│   │   └── normalizer.ts        # 경험 정규화
│   ├── analyzer/                # Layer 2: 패턴 분석
│   │   ├── index.ts
│   │   ├── comparator.ts        # 성공/실패 비교
│   │   ├── detector.ts          # 반복 패턴 감지
│   │   └── weight.ts            # 시간 가중치
│   ├── insight/                 # Layer 3: 통찰 관리
│   │   ├── index.ts
│   │   ├── generator.ts         # LLM 기반 통찰 생성
│   │   ├── voting.ts            # UPVOTE/DOWNVOTE 관리
│   │   └── store.ts             # 통찰 저장소
│   ├── converter/               # Layer 4: 규칙 변환
│   │   ├── index.ts
│   │   ├── overlay.ts           # 프롬프트 오버레이 (독립 모드)
│   │   ├── ark.ts               # Ark 규칙 생성 (Soul 통합)
│   │   └── clotho.ts            # Clotho 워크플로우 생성 (Soul 통합)
│   ├── tracker/                 # Layer 5: 효과 추적
│   │   ├── index.ts
│   │   └── scorer.ts            # 효과 점수 계산
│   ├── orchestrator/            # 경험 오케스트레이터 (연쇄 검색)
│   │   ├── index.ts             # 오케스트레이터 메인
│   │   ├── classifier.ts       # 작업 유형 분류
│   │   ├── recall.ts            # SQL 기반 연쇄 검색
│   │   └── assembler.ts         # 컨텍스트 패킷 조립
│   └── store/                   # 데이터베이스
│       ├── index.ts
│       ├── database.ts          # SQLite 코어 (better-sqlite3)
│       ├── schema.ts            # 테이블/인덱스 정의
│       └── migrations.ts        # 스키마 마이그레이션
├── soul-plugin/                 # Soul MCP 플러그인 (별도)
│   ├── index.ts                 # Soul 통합 진입점
│   ├── hooks.ts                 # n2_boot, n2_work_end 훅
│   └── tools.ts                 # MCP 도구 정의
└── tests/
    └── ...
```

---

## 5. Soul MCP 통합

### 5-1. 새로운 MCP 도구

| 도구 | 역할 | 자동/수동 |
|------|------|----------|
| `n2_mimir_analyze` | 현재 세션의 경험을 분석하여 통찰 추출 | 자동 (work_end 시) |
| `n2_mimir_insights` | 현재 프로젝트의 통찰 목록 조회 | 수동 |
| `n2_mimir_vote` | 통찰에 UPVOTE/DOWNVOTE | 수동 |
| `n2_mimir_overlay` | 현재 작업에 관련한 통찰 오버레이 생성 | 자동 (boot 시) |
| `n2_mimir_status` | Mímir 경험 통계 (총 경험 수, 통찰 수, 효과 점수 등) | 수동 |

### 5-2. 기존 도구 확장

```
n2_boot    → 기존 + Mímir 오버레이 자동 주입
n2_work_end → 기존 + 경험 자동 수집 + 분석 트리거

부팅 보고에 추가:
  "📊 Mímir: 3개의 관련 통찰이 주입되었습니다"
  "  1. ⚠️ D:\Project.N2\soul은 배포판 — 접근 금지"
  "  2. ℹ️ PowerShell에서 && 대신 ; 사용"
  "  3. ℹ️ npm install은 반드시 승인 후 실행"
```

### 5-3. 자동 워크플로우

```
세션 시작:
  n2_boot()
    ├─ 기존 부팅 시퀀스
    └─ Mímir: overlay 자동 생성 → 프롬프트 주입

세션 중:
  n2_work_log() 호출 시
    └─ Mímir: 실시간 경험 버퍼에 추가

세션 종료:
  n2_work_end()
    ├─ 기존 종료 시퀀스 (Ledger + 핸드오프)
    └─ Mímir:
        ├─ 경험 수집 (이번 세션)
        ├─ 패턴 분석 (빠른 모드)
        ├─ 통찰 업데이트 (새 통찰 생성 or 기존 UPVOTE)
        └─ 효과 추적 (이전 통찰이 이번 세션에 도움 됐는지)
```

---

## 6. 시간 가중치 설계

### 6-1. 경험 감쇠 모델

```
최근 경험이 더 중요하다는 원칙.
하지만 "핵심 교훈"은 시간이 지나도 가치를 유지해야 한다.

weight(experience) = base_weight × decay(age) × reinforcement(votes)

where:
  decay(age) = exp(-age_days × ln(2) / half_life)
  half_life = 30일 (기본값, 프로젝트별 조절 가능)
  
  reinforcement = 1 + (upvotes - downvotes) × 0.2
  → 많이 검증된 통찰은 감쇠에 저항

graduated 상태 통찰:
  → 시간 감쇠 없이 영구 유지 (Ark/Clotho 규칙으로 변환되었으므로)
```

### 6-2. 중요도 점수 관리

```
새 통찰 생성         → importance = 2
UPVOTE              → importance += 1
DOWNVOTE            → importance -= 1
EDIT (수정)         → importance += 1  (정제 = 가치 있음)
importance == 0     → status = 'retired' (삭제 후보)
importance >= 5     → graduation 후보 (Ark/Clotho 변환 고려)
effectScore >= 0.8  → graduation 확정
```

---

## 7. 경험 분류 체계

### 7-1. 경험 카테고리

| 카테고리 | 설명 | 예시 |
|---------|------|------|
| `path_navigation` | 파일/폴더 경로 관련 | 배포판 vs 작업 폴더 혼동 |
| `coding_pattern` | 코딩 습관 관련 | && 사용 금지, 하드코딩 금지 |
| `tool_usage` | 도구 사용 관련 | npm install 승인 필요 |
| `communication` | 소통 관련 | 보고 형식, 호칭 |
| `architecture` | 설계 관련 | 모듈 분리, 파일 구조 |
| `security` | 보안 관련 | 파괴적 명령어 차단 |
| `workflow` | 작업 흐름 관련 | 빌드 순서, 테스트 순서 |
| `preference` | 사용자 선호 관련 | 디자인 스타일, 용어 선택 |

### 7-2. 심각도 수준

| 수준 | 설명 | 예시 |
|------|------|------|
| `critical` | 데이터 손실 위험 | prebuild --clean으로 키스토어 삭제 |
| `error` | 작업 실패 원인 | 배포판 수정 → 시스템 깨짐 |
| `warning` | 반복 교정 대상 | && 대신 ; 사용 |
| `info` | 참고 사항 | 보고 형식 선호 |

---

## 8. 경험 오케스트레이터 — SQL 기반 연쇄 검색

> **핵심 원칙**: "동영상 만들어" 한마디에 관련 경험이 0.1초 만에 전부 떠올라야 한다.

### 8-1. 왜 SQL인가

```
JSONL의 한계:
  - 전체 파일 로드 → 메모리에서 필터 → 느림
  - 복합 조건 검색 불가 (카테고리 + 시간 + 중요도 동시 필터)
  - 관계형 연결 불가 (경험↔통찰↔규칙 간 관계)

SQLite의 장점:
  - 단일 파일, 제로 설치, Node.js native (better-sqlite3)
  - 복합 인덱스로 밀리초 단위 검색
  - FTS5 (전문 검색) 내장 → 시맨틱 검색 보완
  - 관계형 조인 → 연쇄 검색 가능
  - Soul KV-Cache 백업과 동일한 패턴 (이미 검증됨)
```

### 8-2. 데이터베이스 스키마

```sql
-- 경험 테이블 (모든 원시 경험 저장)
CREATE TABLE experiences (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,          -- ISO 8601
  session_id TEXT,
  agent TEXT NOT NULL,
  project TEXT NOT NULL,
  type TEXT NOT NULL,                -- success/failure/correction/pattern
  category TEXT NOT NULL,            -- coding_pattern, workflow, etc.
  severity TEXT DEFAULT 'info',
  context TEXT NOT NULL,             -- 무엇을 하고 있었나
  action TEXT NOT NULL,              -- 무엇을 했나
  outcome TEXT NOT NULL,             -- 결과가 어땠나
  correction TEXT,                   -- 사용자 교정 내용
  source_ref TEXT,                   -- Ledger/KV 출처
  created_at TEXT DEFAULT (datetime('now'))
);

-- 경험 태그 (계층적 분류 — 연쇄 검색의 핵심)
CREATE TABLE experience_tags (
  experience_id TEXT NOT NULL,
  level INTEGER NOT NULL,            -- 태그 깊이 (1=최상위, 2=중위, 3=세부)
  tag TEXT NOT NULL,                 -- 태그 값
  FOREIGN KEY (experience_id) REFERENCES experiences(id),
  PRIMARY KEY (experience_id, level, tag)
);

-- 태그 인덱스 예시:
-- level 1: "영상", "코딩", "배포", "디자인", "문서"
-- level 2: "YouTube", "Shorts", "NTON2", "빌드", "npm"
-- level 3: "가로형", "세로형", "자막편집", "BGM", "썸네일"
-- level 4: "ComfyUI", "Premiere", "FFmpeg", "Tailwind"

-- 통찰 테이블
CREATE TABLE insights (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  agent TEXT NOT NULL,
  description TEXT NOT NULL,         -- 자연어 통찰
  category TEXT NOT NULL,
  scope TEXT DEFAULT 'project',      -- global/project/agent
  importance INTEGER DEFAULT 2,
  confidence REAL DEFAULT 0.5,
  effect_score REAL DEFAULT 0.0,
  status TEXT DEFAULT 'active',      -- active/dormant/retired/graduated
  converted_type TEXT,               -- ark_rule/clotho_workflow/...
  converted_ref TEXT
);

-- 경험↔통찰 관계 (N:M)
CREATE TABLE experience_insight_links (
  experience_id TEXT NOT NULL,
  insight_id TEXT NOT NULL,
  relation TEXT NOT NULL,            -- supports/contradicts
  FOREIGN KEY (experience_id) REFERENCES experiences(id),
  FOREIGN KEY (insight_id) REFERENCES insights(id),
  PRIMARY KEY (experience_id, insight_id)
);

-- 통찰↔통찰 관계 (연관 통찰 그래프)
CREATE TABLE insight_links (
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation TEXT NOT NULL,            -- related/extends/supersedes
  FOREIGN KEY (source_id) REFERENCES insights(id),
  FOREIGN KEY (target_id) REFERENCES insights(id),
  PRIMARY KEY (source_id, target_id)
);

-- 전문 검색 인덱스 (FTS5)
CREATE VIRTUAL TABLE experiences_fts USING fts5(
  context, action, outcome, correction,
  content='experiences',
  content_rowid='rowid'
);

-- 복합 인덱스 (빠른 필터링)
CREATE INDEX idx_exp_project_category ON experiences(project, category);
CREATE INDEX idx_exp_type_severity ON experiences(type, severity);
CREATE INDEX idx_exp_timestamp ON experiences(timestamp DESC);
CREATE INDEX idx_tags_level_tag ON experience_tags(level, tag);
CREATE INDEX idx_insights_status ON insights(status, importance DESC);
```

### 8-3. 연쇄 검색 오케스트레이터 (Cascading Recall)

```
사용자 입력: "유튜브 영상 만들어"

Step 1: 작업 유형 분류 (LLM 또는 키워드)
  → domain = "영상"

Step 2: SQL 오케스트레이터 실행
  ┌─────────────────────────────────────────────────┐
  │ SELECT * FROM experiences e                      │
  │ JOIN experience_tags t ON e.id = t.experience_id │
  │ WHERE t.tag IN ('영상', 'YouTube', '동영상')       │
  │ AND e.type = 'success'                           │
  │ ORDER BY e.timestamp DESC                        │
  │ LIMIT 20;                                        │
  └─────────────────────────────────────────────────┘

Step 3: 관련 태그 체인 자동 확장
  ┌─────────────────────────────────────────────────┐
  │ -- 성공 경험들의 태그 체인 추출                      │
  │ SELECT t.level, t.tag, COUNT(*) as freq          │
  │ FROM experience_tags t                           │
  │ WHERE t.experience_id IN (Step 2 결과)            │
  │ GROUP BY t.level, t.tag                          │
  │ ORDER BY t.level ASC, freq DESC;                 │
  └─────────────────────────────────────────────────┘

  결과:
    Level 1 → 영상(20), 편집(15), 배포(8)
    Level 2 → YouTube(18), Shorts(5), NTON2(3)
    Level 3 → 가로형(12), 세로형(6), 자막(10), BGM(8)
    Level 4 → ComfyUI(7), 프리미어(5), FFmpeg(3)

Step 4: 관련 통찰 즉시 검색
  ┌─────────────────────────────────────────────────┐
  │ SELECT i.* FROM insights i                       │
  │ JOIN experience_insight_links l                  │
  │   ON i.id = l.insight_id                         │
  │ WHERE l.experience_id IN (Step 2 결과)            │
  │ AND i.status = 'active'                          │
  │ ORDER BY i.importance DESC, i.effect_score DESC  │
  │ LIMIT 10;                                        │
  └─────────────────────────────────────────────────┘

Step 5: 오케스트레이터 결과 조립
  {
    domain: "영상",
    platform: "YouTube",
    recentExperiences: [...],     // 최근 성공/실패 경험
    tagChain: {                   // 연쇄 태그 체인
      format: "가로형 16:9",
      editing: ["컷 편집", "자막", "BGM"],
      tools: ["ComfyUI", "프리미어"],
      publishing: ["썸네일 필수", "SEO 태그"]
    },
    insights: [                   // 관련 통찰
      "YouTube 업로드 전 썸네일 반드시 생성",
      "영상 설명에 타임스탬프 포함",
      "BGM은 저작권 프리만 사용"
    ],
    warnings: [                   // 과거 실패에서 배운 주의사항
      "FFmpeg 인코딩 시 -crf 23 이상이면 화질 저하"
    ]
  }
```

### 8-4. 오케스트레이터 실행 흐름

```
"동영상 만들어" 입력
        ↓
┌─── Orchestrator ────────────────────────────┐
│                                              │
│  1. classify(input)                          │
│     → domain: "영상", intent: "제작"          │
│                                              │
│  2. recall(domain, intent)                   │
│     → SQL: 관련 경험 20건 + 태그 체인          │
│     → 소요: ~5ms (SQLite + 인덱스)            │
│                                              │
│  3. enrich(experiences)                      │
│     → SQL: 관련 통찰 + 과거 실패 패턴           │
│     → 소요: ~3ms                              │
│                                              │
│  4. assemble(all)                            │
│     → 구조화된 컨텍스트 패킷 생성               │
│     → 소요: ~2ms                              │
│                                              │
│  총 소요: ~10ms (= "순간적으로 떠오름")          │
│                                              │
└──────────────────────────────────────────────┘
        ↓
  프롬프트에 주입 or MCP 도구 응답으로 반환
```

### 8-5. 계층적 태그 자동 생성

```
경험이 저장될 때 태그를 자동 생성:

방법 1: 키워드 추출 (빠름, 정확도 중간)
  - 경험의 context/action/outcome에서 키워드 추출
  - 사전 정의된 태그 사전과 매칭

방법 2: LLM 분류 (느림, 정확도 높음)
  - LLM에게 경험을 보여주고 태그 체인 생성 요청
  - 배치 처리 (세션 종료 시)

방법 3: 하이브리드 (실전 채택)
  - 저장 시: 키워드 추출으로 즉시 태그
  - 세션 종료 시: LLM으로 태그 정제/보완
  - 연쇄 구조 자동 구축
```

### 8-6. 3-Tier 검색 아키텍처

```
★ Tier 1은 필수, Tier 2(Ollama)는 선택, Tier 3(Soul)는 통합 시 추가
  Ollama 없어도 SQL FTS5만으로 충분히 빠르게 동작!
  Ollama 있으면 의미 기반 정밀도가 추가됨.

Tier 1: SQL (필수, < 5ms)
  ├─ FTS5 전문 검색 (키워드 매칭)
  ├─ 복합 인덱스 필터링 (카테고리 + 시간 + 중요도)
  └─ 태그 체인 조인 (연쇄 검색)
  → 후보 100건 추출
  → Ollama 없으면 여기서 c14로 Top-K 반환 (충분히 빠르고 정확)

Tier 2: Semantic (선택, < 50ms) — Ollama 있을 때 활성화
  ├─ Ollama 임베딩으로 의미 유사도 계산
  ├─ 임베딩 벡터는 SQLite에 캐시 (재계산 불필요)
  └─ cosine similarity로 re-ranking
  → 후보 100건 → 정밀 20건

Tier 3: Context (Soul 통합 시 추가)
  ├─ Arachne 코드 구조 연관
  ├─ Entity Memory 관계 그래프
  └─ Ledger 원본 데이터 크로스 참조
  → 정밀 20건 → 최종 Top-K

Graceful Degradation:
  Ollama 없음 → Tier 1(SQL)만으로 동작 (성능 90%)
  Ollama 있음 → Tier 1 + Tier 2 (성능 100%)
  Soul 통합  → Tier 1 + Tier 2 + Tier 3 (성능 120%)
```

```sql
-- 임베딩 캐시 테이블 (선택적 — Ollama 있을 때만 사용)
CREATE TABLE IF NOT EXISTS embeddings (
  experience_id TEXT PRIMARY KEY,
  vector BLOB NOT NULL,             -- float32 배열 (768차원)
  model TEXT DEFAULT 'nomic-embed-text',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (experience_id) REFERENCES experiences(id)
);
```

### 8-7. 영속성 원칙 — 부팅해도 모든 경험치가 그대로

```
★ 핵심 원칙: 부팅하면 모든 경험치가 그대로 남아 있어야 한다.

  일반 AI: 부팅 → Day 1 (어제 배운 것 전부 증발)
  n2-Mímir: 부팅 → Day 100 (어제 배운 것이 오늘의 나)

구현 방법:
  - SQLite 데이터베이스 = 영구 저장 (파일 시스템에 보존)
  - 경험/통찰/태그/임베딩 전부 SQLite에 영구 보존
  - n2_boot 시 Mímir DB 자동 로드 → 모든 경험치 즉시 사용 가능
  - 세션이 바뀌어도, 모델이 바뀌어도, 에이전트가 바뀌어도 — 경험은 그대로
  - KV-Cache 백업과 동일한 패턴으로 자동 백업 지원

한마디로:
  "100일치 경험이 SQLite 파일 하나에 전부 들어 있고,
   부팅 한 방으로 10ms 안에 필요한 경험이 다 떠오른다."
```

---

## 9. 구현 로드맵

### Phase 1: 코어 엔진 (v0.1)
> 목표: 독립 동작 가능한 최소 경험 엔진

```
구현 범위:
  ✅ ExperienceEntry / Insight 타입 정의
  ✅ JSONL 기반 저장소
  ✅ 시간 가중치 계산
  ✅ 키워드 기반 경험 분류
  ✅ 프롬프트 오버레이 생성
  ✅ npm 패키지 구조

테스트:
  - 경험 저장/검색
  - 시간 가중치 정확도
  - 오버레이 생성 품질
```

### Phase 2: Soul 통합 (v0.2)
> 목표: n2_boot / n2_work_end와 자동 연결

```
구현 범위:
  ✅ Ledger 어댑터 (Soul Ledger → ExperienceEntry 변환)
  ✅ n2_boot 훅 (통찰 자동 주입)
  ✅ n2_work_end 훅 (경험 자동 수집)
  ✅ MCP 도구 등록 (n2_mimir_*)

테스트:
  - 실제 부팅에서 통찰 주입 확인
  - 세션 종료 시 경험 자동 수집 확인
```

### Phase 3: LLM 기반 분석 (v0.3)
> 목표: 성공/실패 비교 → 통찰 자동 생성

```
구현 범위:
  ✅ ExpeL 방식 경험 비교 분석
  ✅ 통찰 UPVOTE/DOWNVOTE 시스템
  ✅ 시맨틱 검색 통합 (Arachne/Ollama)

테스트:
  - 통찰 품질 검증 (사람이 읽고 납득 가능한지)
  - UPVOTE/DOWNVOTE 중요도 변화
```

### Phase 4: 규칙 자동 생성 (v0.4)
> 목표: 통찰 → Ark 규칙 / Clotho 워크플로우 자동 변환

```
구현 범위:
  ✅ Ark .n2 규칙 자동 생성
  ✅ Clotho 워크플로우 자동 생성
  ✅ 효과 추적 시스템
  ✅ 자동 비활성화/졸업 메커니즘

테스트:
  - 생성된 규칙이 실제로 행동을 바꾸는지 검증
  - 효과 없는 규칙이 자동 비활성화 되는지
```

### Phase 5: 배포 (v1.0)
> 목표: npm 배포 + N2 생태계 완전 통합

```
구현 범위:
  ✅ npm publish (n2-mimir)
  ✅ README 작성 (영문/한국어)
  ✅ n2-site 문서 페이지 추가
  ✅ 전체 테스트 통과

테스트:
  - 독립 모드 동작 확인
  - Soul 통합 모드 동작 확인
  - 실제 1주일 사용 후 행동 개선 측정
```

---

## 9. 기대 효과

### Before (Mímir 없이)

```
세션 1: 배포판 접근 → 교정 받음 → "알겠습니다"
세션 2: 배포판 접근 → 교정 받음 → "알겠습니다"
세션 3: 배포판 접근 → 교정 받음 → "알겠습니다"
...무한루프
```

### After (Mímir 있을 때)

```
세션 1: 배포판 접근 → 교정 받음 → Mímir 경험 기록
세션 2: 부팅 시 "⚠️ 배포판 접근 주의" 통찰 주입 → 하지만 또 접근
         → Mímir: 2회 반복 감지, 통찰 UPVOTE
세션 3: 부팅 시 통찰 + Ark 차단 규칙 생성 → 배포판 접근 시도 시 물리적 차단
         → "❌ 차단: D:\Project.N2\soul은 배포판입니다. 진짜 소울: D:\Project.N2\n2-browser\soul"
세션 4~∞: 더 이상 배포판 접근하지 않음. Day 1이 아닌 Day 4.
```

---

## 10. 기술 스택 — TypeScript + Rust 하이브리드

### 10-1. 역할 분담

```
┌─── TypeScript (통합 레이어) ─────────────────┐
│ Soul MCP 플러그인 (n2_boot, n2_work_end 훅)   │
│ MCP 도구 인터페이스 (n2_mimir_*)              │
│ LLM 호출 (통찰 생성, 분류, 태그 추출)          │
│ 규칙 변환 (Ark .n2, Clotho 워크플로우)        │
│ Ollama 임베딩 API 호출                        │
│ npm 패키지 진입점                              │
└──────────────┬───────────────────────────────┘
               │ napi-rs 바인딩
┌──────────────▼───────────────────────────────┐
│               Rust (코어 엔진)                 │
│ SQLite 관리 (rusqlite — 제로카피)              │
│ FTS5 전문 검색 엔진                            │
│ 태그 체인 연쇄 검색                             │
│ 벡터 cosine similarity (SIMD 최적화)          │
│ 임베딩 캐시 관리                               │
│ 시간 가중치 배치 계산                           │
│ 경험 DB I/O (읽기/쓰기/마이그레이션)            │
└──────────────────────────────────────────────┘
```

### 10-2. 패키지 구조

```
n2-mimir/
├── packages/
│   ├── core/                     # Rust 코어 엔진
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── lib.rs            # napi-rs 진입점
│   │   │   ├── db.rs             # SQLite (rusqlite)
│   │   │   ├── schema.rs         # 테이블/인덱스 정의
│   │   │   ├── search.rs         # FTS5 + 태그 체인 검색
│   │   │   ├── vector.rs         # cosine similarity (SIMD)
│   │   │   ├── weight.rs         # 시간 가중치 계산
│   │   │   └── migration.rs      # 스키마 마이그레이션
│   │   └── build.rs
│   │
│   └── mimir/                    # TypeScript 통합
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts          # 진입점 + public API
│       │   ├── types.ts          # TS 타입 정의
│       │   ├── collector/        # Layer 1: 경험 수집
│       │   ├── analyzer/         # Layer 2: 패턴 분석
│       │   ├── insight/          # Layer 3: 통찰 관리
│       │   ├── converter/        # Layer 4: 규칙 변환
│       │   ├── tracker/          # Layer 5: 효과 추적
│       │   └── orchestrator/     # 연쇄 검색 오케스트레이터
│       └── soul-plugin/          # Soul MCP 플러그인
│
├── README.md
├── README.ko.md
└── LICENSE
```

### 10-3. 기술 스택 요약

| 영역 | 기술 | 이유 |
|------|------|------|
| **통합** | TypeScript (strict) | Soul MCP 통합, npm 생태계, AI 코딩 최적화 |
| **엔진** | Rust + napi-rs | 제로카피 SQLite, SIMD 벡터 연산, 메모리 안전 |
| **DB** | SQLite (rusqlite) | 단일 파일, FTS5 내장, **영구 보존**, ~0.5ms 검색 |
| **검색** | 3-Tier: FTS5(필수) + Ollama(선택) + Arachne(Soul) | Graceful Degradation |
| **바인딩** | napi-rs | Rust → Node.js 네이티브 애드온 (prebuilt binary 배포) |
| **패키지** | npm (n2-mimir) | N2 생태계 표준 |
| **테스트** | Vitest (TS) + cargo test (Rust) | 각 레이어별 독립 테스트 |
| **빌드** | cargo + tsup | Rust prebuilt → TS 번들링 |

---

> **이 기획서는 v0.2입니다. 주인님 피드백 반영 완료:**
> - ✅ 핵심 미션: "Soul은 기억한다. Mímir는 배운다."
> - ✅ SQL 오케스트레이터 (연쇄 검색 ~10ms)
> - ✅ Ollama 선택사항 (Graceful Degradation)
> - ✅ 부팅해도 모든 경험치 영구 보존
> - ✅ TypeScript + Rust 하이브리드
> - ✅ autoStudy 패턴 분석 완료 (5가지 활용)

