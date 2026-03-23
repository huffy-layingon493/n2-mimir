# n2-mimir

> **AI Experience Learning Engine** — learns from experience, changes behavior

## What is Mimir?

AI agents remember, but they don't learn. They make the same mistakes every session.

Mimir breaks this loop:
```
Experience → [Analyze → Extract Patterns → Generate Insights] → Behavior Change
```

**Named after** the Norse guardian of wisdom. Odin sacrificed an eye for knowledge — AI pays with experience.

## Architecture

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

- **Rust Core**: SQLite, FTS5 full-text search, SIMD vector ops (performance)
- **TS Brain**: Pattern analysis, insight generation, token-budgeted overlay

## Token Cost

| Phase | LLM Tokens | Notes |
|-------|-----------|-------|
| ACTIVATE (boot) | ~500 | Overlay injection only. DB queries are free (local SQLite) |
| DIGEST (end) | 0 | Phase 1-2: template-based, no LLM needed |
| DIGEST + LLM | ~1000-2000 | Phase 3: optional LLM analysis via local Ollama or cloud |

**All DB operations (search, tag, vote, score) = 0 tokens.** Runs entirely on local SQLite.

**Search engine**: SQLite FTS5 with **BM25 ranking** (built-in, no external service). Optional local LLM (Ollama) or cloud for deeper analysis.

## Roadmap

### Phase 1 — Standalone Package (Priority)
> `npm install n2-mimir` — works without any external dependencies

- [x] SQLite + FTS5 experience storage
- [x] Keyword-based pattern detection (KR/EN)
- [x] Cascading recall (FTS5 → Tags → Category → Project)
- [x] Token-budgeted overlay assembly (70/30 split)
- [x] Insight voting + graduation system
- [x] Effect tracking + scoring
- [x] 83 unit tests passing
- [ ] Rust core build (napi-rs)
- [ ] npm publish

### Phase 2 — N2 Soul Integration (Synergy)
> Connect to Soul ecosystem for maximum effect

- [ ] `activate()` — inject insights at `n2_boot`
- [ ] `digest()` — collect experiences at `n2_work_end`
- [ ] Ledger adapter — auto-collect from Soul Ledger
- [ ] Ark integration — graduated insights → blocking rules
- [ ] Clotho integration — insights → auto-generated workflows

### Phase 3 — LLM Analysis
- [ ] Ollama / Cloud LLM for deeper pattern analysis
- [ ] Contrast pair analysis (ExpeL method)
- [ ] Procedural memory generation

## Install

```bash
npm install n2-mimir
```

## Quick Start

```typescript
import { Mimir } from 'n2-mimir';

const mimir = new Mimir({ dbPath: './mimir.db' });

// Add experience
mimir.addExperience({
  agent: 'rose',
  project: 'my-project',
  action: 'Used special character in directory name',
  outcome: 'Terminal commands all hung',
  correction: 'Use only [a-z0-9-] for directory names',
});

// Recall (cascading search)
const result = mimir.recall('directory naming');

// Get overlay for prompt injection
const overlay = mimir.overlay('directory naming', { tokenBudget: 500 });
```

## License

MIT
