# n2-Mímir 종합 리서치 — AI 에이전트 경험 시스템
> 수집일: 2026-03-23 | 총 12회 웹 검색 + 논문 원문 정독 기반

---

## 🎯 Part 1. 핵심 문제 정의

### 현재 AI 에이전트의 근본적 한계

LLM 기반 에이전트의 가중치(weights)는 추론(inference) 시 변경이 불가능하다.
이는 모든 LLM 에이전트가 공유하는 구조적 한계이며, 모델이 아무리 "똑똑"해져도 해결되지 않는 문제다.

**증상:**
- 같은 실수를 매 세션 반복 (Day 1 증후군)
- "알겠습니다"라고 말하지만 다음 세션에 똑같은 행동
- 규칙을 기억하고 있지만 행동이 바뀌지 않음
- 사용자가 직접 규칙을 작성해서 강제해야 함 (GEMINI.md, Ark 등)

**N2 생태계에서의 실제 사례:**
```
1. "D:\Project.N2\soul은 배포판, 건들지 마" → Core Memory에 저장됨
2. 3일간 반복 경고 → 매번 "알겠습니다" 응답
3. 새 세션 시작 → 또 배포판 soul 폴더에서 파일 탐색
4. = 학습 없음, 무한루프
```

### 문제의 본질

```
기억(Memory)   = 데이터를 저장하고 검색하는 능력        ✅ N2에 있음
경험(Experience) = 행동의 결과를 관찰하고 기록하는 능력    ✅ N2에 있음 (Ledger)
학습(Learning)  = 경험에서 패턴을 추출하여 행동을 수정하는 능력  ❌ N2에 없음
```

### n2-Mímir가 해결할 문제

```
경험 데이터(Ledger/KV) → [Mímir Engine] → 행동 강제(Clotho/Ark)

이 "다리"를 놓는 것이 Mímir의 핵심 역할이다.
```

---

## 📚 Part 2. 핵심 논문 상세 분석

### 2-1. ExpeL: LLM Agents Are Experiential Learners
> ⭐⭐⭐ **n2-Mímir에 가장 직접적으로 관련된 논문**

| 항목 | 내용 |
|------|------|
| **저자** | Andrew Zhao, Daniel Huang, Quentin Xu, Matthieu Lin, Yong-Jin Liu, Gao Huang |
| **출처** | arXiv:2308.10144 (2023), AAAI 2024 |
| **핵심 기여** | 가중치 업데이트 없이, 경험에서 통찰(insight)을 추출하여 에이전트 성능 향상 |

#### 핵심 메커니즘 (논문 원문 기반)

**Phase 1: 경험 수집 (Gathering Experiences)**

ExpeL은 Reflexion을 활용하여 경험을 수집한다:
1. 에이전트가 학습 작업(training task)을 시도
2. 실패 시 자기 반성(self-reflect)을 생성하여 다음 시도에 활용
3. 최대 Z번 재시도하며, 모든 성공/실패 경로(trajectory)를 경험 풀(experience pool)에 저장
4. 성공/실패 쌍(pairs)이 핵심 — 같은 작업에서 실패한 경로와 성공한 경로를 비교할 수 있음

```
Training Task → 시도 → 실패 → 반성 → 재시도 → 성공
                  ↓                         ↓
              경험 풀에 저장           경험 풀에 저장
              (실패 trajectory)      (성공 trajectory)
```

**Phase 2: 경험에서 배우기 (Learning from Experiences)**

수집된 경험에서 두 가지 방법으로 학습:

**방법 A - 유사 경험 검색 (Experience Recall):**
- Faiss 벡터 스토어에 성공 경로를 저장
- all-mpnet-base-v2 임베딩으로 작업 유사도 계산
- 새로운 작업 시 가장 유사한 성공 경로를 top-k로 검색
- 검색된 경험을 few-shot 예제로 컨텍스트에 주입

**방법 B - 통찰 추출 (Insight Extraction):**
- LLM에게 성공/실패 쌍을 비교시켜 통찰 생성
- 사용 가능한 연산자:
  - `ADD` — 새로운 통찰 추가 (초기 중요도 = 2)
  - `EDIT` — 기존 통찰 수정 (중요도 +1)
  - `UPVOTE` — 기존 통찰에 동의 (중요도 +1)
  - `DOWNVOTE` — 기존 통찰에 반대 (중요도 -1)
- 중요도가 0에 도달하면 통찰 삭제
- 이 메커니즘으로 잘못된 통찰이 자연스럽게 걸러짐

```
실패 trajectory + 성공 trajectory
    → LLM 비교 분석
    → "이 상황에서는 X하지 말고 Y해야 한다" (insight)
    → ADD/UPVOTE/DOWNVOTE로 중요도 관리
    → 최종 통찰 세트 생성
```

**Phase 3: 작업 추론 (Task Inference)**
- 새 작업 수행 시: 추출된 통찰 목록 + 유사 성공 경험을 컨텍스트에 주입
- 통찰은 작업 지시사항에 추가, 유사 경험은 few-shot 예제로 추가
- 단 한 번의 시도로 작업 수행 (재시도 없음)

**Phase 4: 전이 학습 (Transfer Learning)**
- 한 도메인에서 추출한 통찰을 다른 도메인에 적용 가능
- 소량의 대상 도메인 예제로 통찰을 "파인튜닝"
- 통찰이 자연어이므로 해석 가능하고 편집 가능

#### ExpeL의 핵심 강점 (Mímir 설계에 반영할 점)

1. **해석 가능성**: 통찰이 자연어 → 사용자가 검사/수정/삭제 가능
2. **접근성**: 파인튜닝 불필요, 적은 데이터, 낮은 컴퓨팅
3. **유연성**: 특정 모델에 종속되지 않음
4. **지속적 개선**: 기반 모델이 좋아지면 통찰 품질도 향상
5. **전이 가능**: 한 도메인 통찰을 다른 도메인에 적용 가능

#### N2 Mímir 적용 포인트

```
ExpeL 개념            →    N2 Mímir 구현
─────────────────────────────────────────────
경험 풀(Experience Pool) →    Soul Ledger + KV-Cache
통찰 추출(Insight)       →    Mímir Engine (자동 통찰 생성)
경험 검색(Recall)        →    Arachne 시맨틱 검색 확장
통찰 적용(Inference)     →    n2_boot 시 자동 주입
연산자(ADD/EDIT/VOTE)    →    Clotho/Ark 규칙 자동 생성/수정
```

---

### 2-2. Reflexion: Language Agents with Verbal Reinforcement Learning

| 항목 | 내용 |
|------|------|
| **저자** | Noah Shinn, Federico Cassano, Edward Berman, Ashwin Gopinath, Karthik Narasimhan, Shunyu Yao |
| **출처** | arXiv:2303.11366 (2023), NeurIPS 2023 |
| **핵심 기여** | 가중치 업데이트 없이, 언어적 자기 반성으로 성능 향상. HumanEval 91% (GPT-4 기본 80% 대비) |

#### 핵심 메커니즘

```
시도(Trial) → 피드백(Feedback) → 반성(Reflection) → 에피소딕 메모리에 저장 → 다음 시도에 주입
```

1. **에이전트가 작업 시도** — 행동 경로(trajectory) 생성
2. **피드백 수신** — 스칼라 값(성공/실패) 또는 자유 형식 텍스트
3. **자기 반성 생성** — 실패 원인 분석, 개선 방향 제시 (자연어)
4. **에피소딕 메모리에 저장** — 반성 텍스트를 슬라이딩 윈도우로 유지
5. **다음 시도에 주입** — 반성 텍스트를 프롬프트 컨텍스트에 추가

#### 핵심 결과

| 벤치마크 | Reflexion | 기존 SOTA | 향상 |
|----------|-----------|-----------|------|
| HumanEval (코딩) | 91% pass@1 | 80% (GPT-4) | +11% |
| AlfWorld (의사결정) | 130/134 | 기존 방법 대비 대폭 향상 | |
| HotpotQA (추론) | 유의미한 향상 | | |

#### Reflexion의 한계 (Mímir가 해결해야 할 부분)

- **세션 내(intra-task) 개선만 가능** — 세션이 끝나면 반성 텍스트 소멸
- **세션 간(inter-task) 전이 없음** — ExpeL이 이 한계를 보완
- **장기 기억 메커니즘 없음** — 외부 시스템(Soul KV 등)과 결합 필요

#### N2 Mímir 적용 포인트

- Reflexion의 "자기 반성" 기능은 Mímir의 **1차 분석 레이어**로 활용
- 세션 내 반성 → **KV-Cache에 저장** → **ExpeL 방식으로 통찰 추출** → **Clotho 규칙화**
- 이렇게 하면 Reflexion의 세션 한계를 극복 가능

---

### 2-3. Voyager: An Open-Ended Embodied Agent with Large Language Models

| 항목 | 내용 |
|------|------|
| **저자** | Guanzhi Wang et al. (NVIDIA, Caltech, Stanford 등) |
| **출처** | arXiv:2305.16291 (2023) |
| **핵심 기여** | Minecraft에서 영구 스킬 라이브러리를 구축하며 무한 성장하는 에이전트 |

#### 3가지 핵심 구성요소

**1) 자동 커리큘럼 (Automatic Curriculum)**
- LLM이 현재 상태를 보고 다음 목표를 자동 설정
- "철 곡괭이 만들기" → "다이아몬드 채굴" → ... 순차적 난이도 상승
- 탐험 극대화가 목표

**2) 스킬 라이브러리 (Skill Library)**
- 각 스킬 = 실행 가능한 JavaScript 함수
- 함수 이름 + 설명으로 검색 가능
- 새 스킬을 기존 스킬 조합으로 구축 → **복합(compositional)** → 능력 기하급수적 확장
- 치명적 망각(catastrophic forgetting) 방지 — 한번 배운 스킬은 영구 보존

```javascript
// Voyager 스킬 예시
async function mineIronOre(bot) {
  // 곡괭이 확인
  const pickaxe = bot.inventory.items().find(i => i.name.includes('pickaxe'));
  if (!pickaxe) {
    await craftStonePickaxe(bot); // ← 기존 스킬 호출
  }
  // 철광석 찾기 & 채굴
  const ironOre = bot.findBlock({ matching: 'iron_ore' });
  await bot.dig(ironOre);
}
```

**3) 반복 프롬프팅 (Iterative Prompting)**
- 환경 피드백 + 실행 에러 + 자기 검증을 반영
- 코드가 에러나면 에러 메시지를 LLM에 전달 → 수정 → 재시도
- 성공 시 자기 검증(self-verification) 루틴 실행

#### 핵심 성과

| 지표 | Voyager | 기존 SOTA | 배율 |
|------|---------|-----------|------|
| 고유 아이템 획득 | 3.3x 더 많음 | | 3.3x |
| 이동 거리 | 2.3x 더 멀리 | | 2.3x |
| 기술 트리 해금 | 15.3x 빠름 | | 15.3x |

#### N2 Mímir 적용 포인트

- **스킬 라이브러리 ≈ Clotho 워크플로우 자동 생성**
  - 경험에서 검증된 행동 패턴을 Clotho `.n2` 워크플로우로 저장
  - 새 스킬을 기존 스킬 조합으로 구축 → Clotho 워크플로우 체이닝
- **자동 커리큘럼 ≈ 작업 우선순위 자동 설정**
- **자기 검증 ≈ n2_coding_verify() 자동화**

---

### 2-4. Memory-R1: Enhancing LLM Agents to Manage Memories via RL

| 항목 | 내용 |
|------|------|
| **출처** | arXiv:2508.19828 (2025) |
| **핵심 기여** | RL로 LLM이 메모리 관리 자체를 학습 — ADD, UPDATE, DELETE 연산 최적화 |

#### 핵심 메커니즘

```
두 개의 에이전트:
1. Memory Manager — 메모리 연산 (ADD/UPDATE/DELETE) 학습
2. Answer Agent — 관련 메모리 선택 학습

둘 다 outcome-driven RL로 파인튜닝
→ 작업 성공/실패에 따라 보상 → 메모리 관리 전략 최적화
```

#### 원자적 메모리 연산

| 연산 | 설명 | N2 대응 |
|------|------|---------|
| ADD | 새 정보를 메모리에 추가 | n2_brain_write |
| UPDATE | 기존 메모리 갱신 | n2_core_write |
| DELETE | 불필요한 메모리 삭제 | (현재 없음 → Mímir가 필요) |

#### N2 Mímir 적용 포인트

- Soul Memory의 **자동 정리/최적화** 시스템
- 어떤 기억을 유지하고, 어떤 것을 버릴지 자동 판단
- Core Memory가 비대해지는 것 방지 — 핵심만 남기는 메커니즘

---

### 2-5. Agent Workflow Memory (AWM)

| 항목 | 내용 |
|------|------|
| **출처** | arXiv (2024-2025), GitHub: zorazrw/agent-workflow-memory |
| **핵심 기여** | 과거 경험에서 재사용 가능한 워크플로우를 자동 생성 |

#### 핵심 메커니즘

```
과거 작업 경로(trajectories)
    → 패턴 분석
    → 워크플로우(task recipe) 추출
    → 워크플로우 라이브러리에 저장
    → 새 작업 시 유사 워크플로우 검색 + 적용
```

- **오프라인 모드**: 학습 데이터에서 배치로 워크플로우 추출
- **온라인 모드**: 실시간으로 새 경험에서 워크플로우 학습

#### N2 Mímir 적용 포인트

- **⭐ Clotho 워크플로우 자동 생성의 직접적 참조 모델**
- Ledger의 작업 경로에서 반복 패턴 감지 → Clotho `.n2` 파일로 변환
- 예: "npm 패키지 발행 전 반드시 테스트 실행" 패턴이 3번 발견 → 자동 워크플로우 생성

---

### 2-6. A-Mem: Agentic Memory for LLM Agents

| 항목 | 내용 |
|------|------|
| **출처** | NeurIPS 2025, GitHub: WujiangXu/A-mem |
| **핵심 기여** | Zettelkasten(메모 상자) 원리에 기반한 동적 메모리 조직화 시스템 |

#### 핵심 특징

- 메모리를 원자적 노트(atomic notes)로 분해
- 각 노트 간 연결(links) 자동 생성 — 지식 그래프 형태
- 동적 인덱싱으로 메모리 규모에 따라 확장
- 메모리 자체가 "진화(evolve)" — 새 경험이 추가되면 기존 메모리 구조 재조직

#### N2 Mímir 적용 포인트

- Entity Memory의 확장 — 엔터티 간 관계를 그래프로 관리
- 통찰(insight) 간 연결 관계 자동 생성
- 중복 통찰 자동 통합

---

### 2-7. SuperIntelliAgent: Continuous Intelligence Growth Framework

| 항목 | 내용 |
|------|------|
| **출처** | arXiv (Nov 2025) |
| **핵심 기여** | Frozen LLM + Trainable Small Model 하이브리드 학습 |

#### 핵심 메커니즘

```
Frozen LLM (GPT-4/Claude 등, 수정 불가)
    → pseudo-training signals 생성
    → Small Diffusion Model이 이 신호로 DPO 학습
    → 인간 어노테이션 없이 자기 지도(self-supervised) 지속 개선
```

#### N2 Mímir 적용 포인트

- 맥미니의 Ollama 모델(qwen3:8b 등)을 **보조 경험 분석 모델**로 활용
- 메인 LLM(Claude/Gemini)이 생성한 경험을 소형 모델이 분석/분류
- 소형 모델은 파인튜닝 가능 → 진정한 "학습" 실현 가능

---

### 2-8. EvoAgentX: Self-Evolution Engine

| 항목 | 내용 |
|------|------|
| **출처** | GitHub: EvoAgentX/EvoAgentX (2025) |
| **핵심 기여** | 에이전틱 워크플로우의 자동 생성, 평가, 진화 프레임워크 |

#### 핵심 특징

- 자연어 목표 → 워크플로우 자동 생성
- 내장 평가(evaluation) 시스템
- **자기 진화 엔진(Self-Evolution Engine)** — 워크플로우를 반복적으로 최적화
- 단기 메모리(ephemeral) + 장기 메모리(persistent) 통합

#### N2 Mímir 적용 포인트

- Clotho 워크플로우의 자동 최적화 엔진으로 참조
- 워크플로우 성공률 추적 → 저성과 워크플로우 자동 수정/제거

---

### 2-9. AgentRefine: Learning to Correct from Trajectories

| 항목 | 내용 |
|------|------|
| **출처** | arXiv (2025) |
| **핵심 기여** | 과거 실행 경로를 관찰하여 실수 교정 패턴 학습 |

#### N2 Mímir 적용 포인트

- Ledger의 작업 경로를 분석 → "이 지점에서 실수가 발생했다" 자동 감지
- 실수 패턴 DB 구축 → 동일 패턴 감지 시 선제 경고

---

## 🧠 Part 3. 인지과학 — 인간의 경험 학습 메커니즘

### 절차적 기억 (Procedural Memory)

인간의 기술 습득은 3단계를 거친다 (Fitts & Posner, 1967):

**1단계: 인지(Cognitive) 단계**
- 의식적 집중, 많은 에러, 피드백에 크게 의존
- AI 에이전트의 현재 상태: 매번 의식적으로 규칙을 읽어야 함

**2단계: 연합(Associative) 단계**
- 연습과 반복으로 행동이 세련됨
- 의식적 노력 감소, 자동화 시작
- **Mímir가 목표하는 단계**: 경험이 쌓이면서 자동으로 행동이 개선

**3단계: 자율(Autonomous) 단계**
- 기술이 자동으로 수행, 의식적 개입 최소화
- "몸이 기억하는" 상태
- **Mímir의 궁극적 목표**: Clotho 규칙으로 자동화된 "근육 기억"

### 뇌의 학습 메커니즘과 Mímir 대응

| 뇌 구조 | 역할 | Mímir 대응 |
|---------|------|-----------|
| **해마(Hippocampus)** | 단기→장기 기억 변환, 경험 인코딩 | KV-Cache → Ledger |
| **기저핵(Basal Ganglia)** | 습관 학습, 자극-반응 연결 | Clotho 상태머신 |
| **소뇌(Cerebellum)** | 타이밍 조절, 에러 교정 | Mímir 에러 감지 |
| **전전두엽(Prefrontal)** | 의사결정, 계획 | LLM 추론 |

### 예측 오차 (Prediction Error)

인간 학습의 핵심 메커니즘:
```
기대(Prediction) ≠ 결과(Outcome) → 예측 오차(Prediction Error) → 모델 업데이트
```

- 뇌에서 도파민 신호가 예측 오차를 전달
- 오차가 클수록 학습량이 큼
- **Mímir 적용**: 에이전트의 "기대한 행동" vs "실제 결과"의 차이를 측정 → 교훈 강도 결정

### 피드백의 종류와 효과

| 피드백 유형 | 설명 | N2에서의 구현 |
|------------|------|--------------|
| **즉시 피드백** | 행동 직후 결과 (tsc 에러, 빌드 실패) | 터미널 출력 |
| **지연 피드백** | 시간 후 결과 (주인님의 교정) | Ledger 기록 |
| **질적 피드백** | "이건 좋지 않아" (초기 단계에 효과적) | 주인님 코멘트 |
| **양적 피드백** | 점수, 메트릭 (숙달 단계에 효과적) | 코드 품질 지표 |

---

## 🔧 Part 4. 기술 참조 — 산업용 메모리 시스템

### mem0.ai 아키텍처

mem0는 프로덕션급 AI 에이전트 메모리 솔루션:

**하이브리드 데이터 스토어:**
- **벡터 DB** — 시맨틱/에피소딕 메모리 (의미 기반 검색)
- **그래프 DB** (Neo4j) — 엔터티 관계 저장 (관계 기반 검색)
- **키-값 스토어** — 사실 정보 저장 (빠른 접근)

**운영 흐름:**
1. **추출 단계(Extraction)**: 새 메시지에서 중요 정보 식별 → 메모리 단위로 변환
2. **갱신 단계(Update)**: 기존 메모리와 비교 → ADD/UPDATE/DELETE/NO-OP 판단

**성과 (LOCOMO 벤치마크):**
- OpenAI 기본 메모리 대비 **정확도 26% 향상**
- **p95 지연시간 91% 감소**
- **토큰 비용 90%+ 절감**

#### N2 Mímir 적용 포인트

- Soul Memory를 mem0 스타일 하이브리드 구조로 진화 가능
- 현재: JSON 파일 기반 → 미래: 벡터 DB + 그래프 DB 하이브리드
- Entity Memory의 관계 저장에 그래프 DB 도입 고려

---

### Awesome-Agent-Memory Survey (218편 논문 분석, 2023-2025)

GitHub: AgentMemoryWorld/Awesome-Agent-Memory

**메모리 분류 체계:**

| 분류 기준 | 유형 | 설명 |
|-----------|------|------|
| **형태(Substrate)** | Internal | 모델 내부 (컨텍스트 윈도우) |
| | External | 외부 저장소 (DB, 파일) |
| **인지 메커니즘** | Episodic | 에피소드 기억 (특정 사건) |
| | Semantic | 의미 기억 (일반 지식) |
| | Sensory | 감각 기억 (즉시 입력) |
| | Working | 작업 기억 (활성 컨텍스트) |
| | **Procedural** | **절차 기억 (기술/습관)** ← 가장 중요 |
| **주체** | User-centric | 사용자 선호/개인화 |
| | Agent-centric | 에이전트 자체 학습 |

#### N2 현재 상태 매핑

| 인지 메커니즘 | N2 구현체 | Mímir 확장 |
|-------------|----------|-----------|
| Episodic | Ledger (작업 기록) | 성공/실패 경로 분석 |
| Semantic | Brain (공유 지식) | 통찰(insight) 저장 |
| Sensory | QLN (외부 입력) | - |
| Working | KV-Cache (세션 컨텍스트) | 관련 통찰 자동 주입 |
| **Procedural** | **없음** ❌ | **Clotho 워크플로우 자동 생성** |

> **핵심 발견**: N2에 가장 부족한 것은 **절차 기억(Procedural Memory)** — "이 상황에서 자동으로 이렇게 행동" 하는 메커니즘. Mímir가 이것을 만들어야 한다.

---

## 🏗️ Part 5. N2 생태계와 Mímir 통합 아키텍처 (초안)

### 현재 N2 아키텍처 (Mímir 없이)

```
┌─── 감각 입력 ─────────────────────────────┐
│  QLN            = 외부 세계 경험/관찰         │
│  터미널 출력      = 빌드/실행 피드백           │
│  주인님 피드백    = 교정, 칭찬, 지적           │
└──────────────────────────────────────────┘
                ↓ (경험 데이터)
┌─── 기억 저장 ─────────────────────────────┐
│  Ledger         = 불변 작업 기록 (일기장)      │
│  KV-Cache       = 세션 기억 (단기→장기)        │
│  Core Memory    = 정체성/규칙 기억             │
│  Brain          = 에이전트 간 공유 기억          │
│  Entity Memory  = 사람/하드웨어/프로젝트 정보    │
│  Arachne        = 코드 구조 기억               │
└──────────────────────────────────────────┘
                ↓ (이 연결이 없음 = 무한루프!)
┌─── 행동 강제 ─────────────────────────────┐
│  Ark            = 규칙 차단 (정규식 패턴)       │
│  Clotho         = 상태머신 워크플로우 강제       │
│  GEMINI.md      = 에이전트 지침 (수동 작성)     │
│  n2-coding      = 코딩 스탠다드 (수동 작성)     │
└──────────────────────────────────────────┘
```

### Mímir 통합 후 아키텍처 (목표)

```
┌─── 감각 입력 ──────────────────────────────┐
│  QLN / 터미널 / 주인님 피드백                   │
└──────────────────────────────────────────┘
                ↓
┌─── 기억 저장 ──────────────────────────────┐
│  Ledger / KV-Cache / Core / Brain / Arachne  │
└──────────────────────────────────────────┘
                ↓
┌─── 🔥 Mímir Engine (NEW) ─────────────────┐
│                                              │
│  Layer 1: 경험 수집 (Experience Gathering)    │
│  ├─ Ledger 데이터 자동 분석                    │
│  ├─ KV-Cache 세션 간 비교                     │
│  └─ 주인님 교정 패턴 감지                      │
│                                              │
│  Layer 2: 패턴 분석 (Pattern Analysis)        │
│  ├─ 성공/실패 경로 비교 (ExpeL 방식)           │
│  ├─ 반복 실수 감지 (AgentRefine 방식)          │
│  └─ 워크플로우 패턴 추출 (AWM 방식)            │
│                                              │
│  Layer 3: 통찰 생성 (Insight Generation)      │
│  ├─ 자연어 통찰 추출 + UPVOTE/DOWNVOTE 관리    │
│  ├─ 통찰 중요도 점수 관리                      │
│  └─ 통찰 간 연결 관계 생성 (A-Mem 방식)         │
│                                              │
│  Layer 4: 규칙 변환 (Rule Conversion)         │
│  ├─ 통찰 → Ark 규칙 자동 생성                  │
│  ├─ 통찰 → Clotho 워크플로우 자동 생성          │
│  └─ 통찰 → Core Memory 자동 업데이트           │
│                                              │
│  Layer 5: 적용 & 검증 (Application)           │
│  ├─ n2_boot 시 관련 통찰 자동 주입              │
│  ├─ 생성된 규칙의 효과 추적                     │
│  └─ 비효과적 규칙 자동 비활성화                  │
│                                              │
└──────────────────────────────────────────┘
                ↓
┌─── 행동 강제 ──────────────────────────────┐
│  Ark (+ Mímir 자동 생성 규칙)                  │
│  Clotho (+ Mímir 자동 생성 워크플로우)          │
│  Core Memory (+ Mímir 자동 업데이트 통찰)       │
└──────────────────────────────────────────┘
```

---

## 🔑 Part 6. 핵심 키워드 및 추가 연구 자료

### 학술 키워드

| 카테고리 | 키워드 |
|---------|--------|
| 학습 방법론 | Continual Learning, Lifelong Learning, Self-Improvement |
| 경험 기반 | Experience-Driven Learning, Experiential Learning, Trial-and-Error |
| 반성/피드백 | Self-Reflection, Self-Refine, Verbal Reinforcement |
| 메모리 | Procedural Memory, Episodic Memory, Working Memory |
| 워크플로우 | Agent Workflow Memory, Skill Library, Action Library |
| 적응 | Self-Evolving Agents, Context Engineering, Meta-Learning |
| 안전 | Catastrophic Forgetting, Alignment, RLHF/RLAIF |

### 주요 GitHub 리포지토리

| 프로젝트 | URL | 관련성 |
|---------|-----|--------|
| zorazrw/agent-workflow-memory | AWM 구현 | ⭐⭐⭐ |
| WujiangXu/A-mem | A-Mem 구현 | ⭐⭐ |
| EvoAgentX/EvoAgentX | 자기진화 프레임워크 | ⭐⭐ |
| CharlesQ9/Self-Evolving-Agents | 자기진화 연구 모음 | ⭐⭐ |
| AgentMemoryWorld/Awesome-Agent-Memory | 메모리 논문 218편 | ⭐⭐⭐ |
| MineDojo/Voyager | Voyager 구현 | ⭐⭐ |
| mem0ai/mem0 | 프로덕션 메모리 | ⭐⭐ |

### 주요 논문 arXiv ID

| 논문 | arXiv ID |
|------|----------|
| ExpeL | 2308.10144 |
| Reflexion | 2303.11366 |
| Voyager | 2305.16291 |
| Memory-R1 | 2508.19828 |
| Lifelong Learning Survey | 2024 (arxiv.org) |
| Continual Learning Survey | 2024 (arxiv.org) |

---

## 💡 Part 7. 핵심 인사이트 요약

### Mímir 설계의 5대 원칙 (리서치에서 도출)

1. **가중치를 바꾸지 않는다** (Weight-Free)
   - 모든 학습은 컨텍스트 레이어에서 발생
   - 통찰은 자연어 텍스트로 관리 → 해석 가능, 수정 가능

2. **경험은 비교에서 온다** (Contrastive Learning)
   - ExpeL의 핵심: 성공 경로 vs 실패 경로 비교
   - 단순 기록이 아닌, **차이**에서 교훈 추출

3. **통찰은 진화한다** (Evolving Insights)
   - UPVOTE/DOWNVOTE로 통찰 중요도 관리
   - 잘못된 통찰은 자연스럽게 사라짐
   - 새 경험이 기존 통찰을 수정/보강

4. **절차적 기억이 핵심이다** (Procedural Memory)
   - "이 상황에서 자동으로 이렇게" = Clotho 워크플로우
   - 선언적 지식("알겠습니다")이 아닌, 절차적 행동("이렇게 한다")

5. **검증 가능해야 한다** (Verifiable)
   - 생성된 규칙/워크플로우의 효과를 추적
   - 효과 없으면 자동 비활성화 → 자정 메커니즘

### 다음 단계

1. [ ] 이 리서치를 주인님과 함께 리뷰
2. [ ] Mímir 아키텍처 상세 설계
3. [ ] 프로토타입 구현 범위 정의
4. [ ] 구현 시작 (Soul MCP 확장 또는 독립 모듈)
