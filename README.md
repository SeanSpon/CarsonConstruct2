# ClipBot — Story-First Short-Form Production Engine

> **Not a clip factory. A taste firewall.** Turn one podcast episode into 5–10 premium, story-complete clips that feel human-edited.

## ⚡ The Core Rule

**If a clip doesn't tell a complete story, it doesn't ship.**

Most AI clippers embarrass brands with contextless slop. ClipBot refuses to ship incomplete stories.

---

## 🎯 MVP Architecture

```
INPUT → SEGMENT → ANALYZE → GATE → RANK → SHIP
```

### The 4 Quality Gates

Every clip must pass ALL gates. Fail any one = DROP.

| Gate | Rule | Threshold |
|------|------|-----------|
| 🎭 **Narrative** | Must have 2 of 3: setup, core, resolution | ≥2 elements |
| 🎬 **Visual** | Clean cuts, proper duration | 15-90 seconds |
| 📝 **Caption** | Understandable when muted | ≥15 words |
| 🎯 **Confidence** | System must be confident | ≥60% |

---

## 📁 New Folder Structure

```
clipbot/
├── core/                      # 🧠 The editorial brain (NEW)
│   ├── narrative/             # Story structure detection
│   │   ├── unit.py            # NarrativeUnit schema
│   │   ├── detector.py        # Story element detection
│   │   └── gate.py            # Quality gates
│   └── pipeline/              # Story-first processing
│
├── podflow-studio/            # Electron desktop app (existing)
├── config/mvp-rules.json      # MVP configuration
├── docs/                      # Documentation
│   ├── MVP_RULES.md           # What ClipBot refuses to do
│   ├── PIPELINE_FLOW.md       # Processing stages
│   └── UI_PHILOSOPHY.md       # Design principles
└── scripts/test_core.py       # Core logic tests
```

---

## 🚀 Quick Start

```bash
# Test the new core logic
python scripts/test_core.py

# Run PodFlow Studio
cd podflow-studio
npm install && npm start
```

---

## 🔒 MVP Rules

**Allowed human actions:**
- ⭐ Star/Favorite
- 👍 Approve  
- 👎 Reject
- "More like this"

**Expected review time: 2-5 minutes**

**See:** [docs/MVP_RULES.md](docs/MVP_RULES.md)

---

## Original System (Below)

The legacy documentation follows. The new `core/` module provides the story-first logic.

---

## What This Does (Legacy)

```
Input Video(s)
     ↓
Transcription (word-level timestamps)
     ↓
Deterministic Clip Detection
     ↓
Caption Rendering (karaoke-style)
     ↓
Rule-based Editing (cuts / angles / b-roll)
     ↓
FFmpeg Export (9:16)
```

**MVP is complete when:**
- One command produces postable clips
- Captions are readable and synced
- Review/export loop works end-to-end
- A creator can ship without touching an editor

---

## Quick Start

### Prerequisites

- **Node.js** 18+
- **Python** 3.8+
- **FFmpeg** (in PATH or bundled)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/podflow-studio.git
cd podflow-studio

# Install Node dependencies
cd podflow-studio
npm install

# Install Python dependencies
cd src/python
pip install -r requirements.txt
```

### Run the App

```bash
cd podflow-studio
npm start
```

### Run Detection Directly (CLI)

```bash
cd podflow-studio/src/python
python detector.py /path/to/podcast.mp4 '{"mvp_mode": true, "job_dir": "/tmp/clips"}'
```

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Electron (React + TypeScript)                │
│                         EditorView UI                           │
│     ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│     │   Run    │ →  │  Review  │ →  │  Export  │              │
│     └──────────┘    └──────────┘    └──────────┘              │
└─────────────────────────┬───────────────────────────────────────┘
                          │ IPC
┌─────────────────────────┴───────────────────────────────────────┐
│                    Main Process (Node.js)                       │
│           File Handlers │ Detection │ Export │ Jobs             │
└─────────────────────────┬───────────────────────────────────────┘
                          │ spawn
┌─────────────────────────┴───────────────────────────────────────┐
│                    Python Detection Pipeline                    │
│     Transcription → Detection → Scoring → Caption → Export      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Folder Structure

```
podflow-studio/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # Entry point
│   │   └── ipc/                 # IPC handlers
│   │       ├── fileHandlers.ts
│   │       ├── detectionHandlers.ts
│   │       └── exportHandlers.ts
│   │
│   ├── renderer/                # React UI
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   └── editor/          # Main UI components
│   │   └── stores/              # Zustand state
│   │
│   └── python/                  # Detection pipeline
│       ├── detector.py          # Main entry point
│       ├── features.py          # Audio feature extraction
│       ├── vad_utils.py         # Voice activity detection
│       ├── patterns/            # Pattern detectors
│       │   ├── payoff.py        # Silence → spike
│       │   ├── monologue.py     # Sustained energy
│       │   ├── laughter.py      # Burst clusters
│       │   └── silence.py       # Dead space
│       └── utils/               # Scoring utilities
│           ├── mvp_candidates.py
│           ├── mvp_scoring.py
│           └── clipworthiness.py
│
├── tools/
│   └── eval/                    # Evaluation harness
│       └── run_eval.py
│
└── docs/                        # Documentation
    ├── MVP_PLAN.md
    ├── MVP_ARCHITECTURE.md
    └── REVIEWER_GUIDE.md
```

---

## Detection Logic (Deterministic)

### Signals Used

| Signal | Description | Weight |
|--------|-------------|--------|
| **Silence → Spike** | Energy drop followed by sudden increase | High |
| **Speech Density** | Words per second from transcript | Medium |
| **Sentence Boundaries** | Clean start/end at sentence breaks | Medium |
| **Duration Window** | 15–60 seconds for clip length | Gate |

### Output Format

```json
{
  "id": "clip_001",
  "startTime": 312.4,
  "endTime": 344.8,
  "duration": 32.4,
  "pattern": "payoff",
  "score": 82,
  "score_breakdown": {
    "silence_score": 35,
    "spike_score": 30,
    "speech_density": 12,
    "boundary_bonus": 5
  },
  "reason": "silence→spike + high speech density"
}
```

**No ML tuning. No feedback loops. Fully inspectable.**

---

## UI Contract

### Screen 1 — Run

- Select podcast video
- Optional: angle videos, b-roll folder
- Click "Generate Clips"

### Screen 2 — Review (one clip at a time)

- Video preview
- Captions toggle
- Start/end trim
- Accept / Reject / Export

### Screen 3 — Export

- Progress bar
- Exported clip list
- Open folder button

**Rule:** If a screen doesn't support showing output clearly OR making 1–2 decisions per clip, it doesn't exist.

---

## Test Checks

### A) Pipeline Smoke Test

```bash
cd podflow-studio/src/python
python detector.py input.mp4 '{"mvp_mode": true, "job_dir": "/tmp/test"}'
```

**Expected:** No crashes, ≥5 clips, captions rendered

### B) Determinism Test

Run twice with same input → Same timestamps, same scores

### C) Python Unit Tests

```bash
cd podflow-studio/src/python
python -m unittest discover -s tests
```

### D) Eval Harness

```bash
python tools/eval/run_eval.py --dataset data/sample.json --k 10
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | For Whisper transcription | Optional |
| `HF_TOKEN` | HuggingFace token for diarization | Optional |

### Detection Settings

```json
{
  "mvp_mode": true,
  "target_count": 10,
  "min_duration": 15,
  "max_duration": 60,
  "skip_intro": 30,
  "skip_outro": 30
}
```

---

## What This Intentionally Does NOT Do

- ❌ No analytics, onboarding, theming, or settings
- ❌ No user accounts or persistence
- ❌ No learning systems or cloud infra
- ❌ No "AI explanations" or black-box behavior
- ❌ No viral predictions

**Why?** Optimize for trust, speed, and ship-ability.

---

## Out of Scope (Intentionally)

| Feature | Status | Reason |
|---------|--------|--------|
| Learning from user behavior | Not planned | Adds complexity, reduces transparency |
| Social integrations | Not planned | Different product |
| Multi-project management | Not planned | Scope creep |
| Styling and theming | Not planned | Ship first |
| "Viral" predictions | Not planned | Unprovable |

---

## Failure Handling

| Failure | Behavior |
|---------|----------|
| Missing FFmpeg | Clear error with install instructions |
| No clips detected | Explicit message shown |
| Export failure | Clip skipped, pipeline continues |
| API key missing | Graceful fallback to algorithm-only mode |

No background jobs. No queues. No retries beyond local scope.

---

## Documentation

| Document | Description |
|----------|-------------|
| [MVP_PLAN.md](./docs/MVP_PLAN.md) | Implementation plan and workstreams |
| [MVP_ARCHITECTURE.md](./docs/MVP_ARCHITECTURE.md) | Detailed pipeline architecture |
| [REVIEWER_GUIDE.md](./docs/REVIEWER_GUIDE.md) | What reviewers should check |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Complete system documentation |

---

## Contributing

1. Check [docs/MVP_PLAN.md](./docs/MVP_PLAN.md) for current priorities
2. Follow the PR template in `.github/pull_request_template.md`
3. Run tests before submitting:

```bash
cd podflow-studio/src/python
python -m unittest discover -s tests
```

---

## License

Proprietary - All rights reserved.

---

**Version:** 2.0.0 (MVP)  
**Last Updated:** January 2026
