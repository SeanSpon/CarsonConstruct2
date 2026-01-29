# ClipBot

**AI-powered podcast clip detection and auto-editing for short-form content.**

> Transform a 60-minute podcast into 5-10 premium, story-complete clips ready for social media — no editing required.

---

## What It Does

1. **Upload** — Drop a podcast video
2. **Process** — AI detects clip-worthy moments and transcribes
3. **Review** — Preview auto-edited clips with burned-in captions
4. **Export** — Download vertical 9:16 clips ready for TikTok, Reels, Shorts

**Output:** Ready-to-post vertical clips with animated karaoke-style captions.

---

## Quick Start

### Prerequisites

- **Node.js** 18+
- **Python** 3.9+
- **FFmpeg** (in PATH)

### Installation

```bash
# Clone
git clone https://github.com/SeanSpon/CarsonConstruct2.git
cd CarsonConstruct2/podflow-studio

# Install Node dependencies
npm install

# Install Python dependencies
cd src/python
pip install -r requirements.txt
cd ../..

# Start the app
npm start
```

### First Run

1. Click **Choose Video File**
2. Select a podcast episode (any length)
3. Click **Start Processing**
4. Wait for detection (~2-5 min for a 30-min video)
5. Review detected clips
6. Export to folder

---

## Features

| Feature | Status |
|---------|--------|
| Automatic transcription (Whisper) | ✅ |
| Story-first clip detection | ✅ |
| Karaoke-style captions | ✅ |
| Vertical 9:16 export | ✅ |
| Dead space removal | ✅ |
| Multiple caption styles | ✅ |
| B-roll integration | ✅ |
| Project history | ✅ |
| Custom style presets | ✅ |

---

## Detection Logic

Clips are detected using **deterministic, inspectable rules** — not black-box ML:

| Signal | Description |
|--------|-------------|
| **Silence → Spike** | Energy drops then spikes (dramatic moments) |
| **Speech Density** | High words-per-second (engaging content) |
| **Sentence Boundaries** | Clean start/end points |
| **Duration** | 15-90 second windows |
| **Story Completeness** | Setup → Core → Resolution structure |

Every clip passes 4 quality gates before being shown:

1. **Narrative Gate** — Must have 2 of 3 story elements
2. **Visual Gate** — Clean cuts, proper duration
3. **Caption Gate** — Understandable when muted
4. **Confidence Gate** — System confidence ≥60%

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron + React UI                       │
│         Upload → Processing → Review (3 screens only)        │
└─────────────────────────────┬───────────────────────────────┘
                              │ IPC
┌─────────────────────────────┴───────────────────────────────┐
│                    Node.js Main Process                      │
│     File Handlers · Detection · Export · Project Storage     │
└─────────────────────────────┬───────────────────────────────┘
                              │ spawn
┌─────────────────────────────┴───────────────────────────────┐
│                    Python Pipeline                           │
│  Transcription → Features → Detection → Scoring → Export     │
└─────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
clipbot/
├── podflow-studio/           # Electron desktop app
│   ├── src/
│   │   ├── main/             # Node.js main process
│   │   │   └── ipc/          # IPC handlers
│   │   ├── renderer/         # React UI
│   │   │   ├── components/   # UI components
│   │   │   ├── pages/        # Screen components
│   │   │   └── stores/       # Zustand state
│   │   ├── preload/          # Electron bridge
│   │   └── python/           # Detection pipeline
│   │       ├── detector.py   # Main entry
│   │       ├── patterns/     # Pattern detectors
│   │       ├── ai/           # AI enhancement
│   │       ├── broll/        # B-roll system
│   │       ├── export/       # Multi-format export
│   │       └── storage/      # Project persistence
│   └── package.json
├── core/                     # Narrative detection logic
│   ├── narrative/            # Story structure
│   └── pipeline/             # Processing stages
├── config/                   # Configuration
└── docs/                     # Documentation
```

---

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | Whisper transcription API | Optional |
| `HF_TOKEN` | HuggingFace for diarization | Optional |

### Detection Settings

Configurable in the Settings modal:

- **Target clip count** — 5-10 clips
- **Min/Max duration** — 15-90 seconds
- **Skip intro/outro** — Skip first/last 30 seconds
- **Caption style** — Viral, Minimal, or Bold

---

## CLI Usage

Run detection directly without the UI:

```bash
cd podflow-studio/src/python
python detector.py /path/to/video.mp4 '{"mvp_mode": true}'
```

Output format:
```json
{
  "clips": [
    {
      "id": "clip_001",
      "startTime": 312.4,
      "endTime": 344.8,
      "duration": 32.4,
      "pattern": "payoff",
      "score": 82,
      "reason": "silence→spike + high speech density"
    }
  ],
  "deadSpaces": [...],
  "transcript": {...}
}
```

---

## Testing

```bash
# Python unit tests
cd podflow-studio/src/python
python -m unittest discover -s tests

# Core logic tests
python scripts/test_core.py

# Evaluation harness
python tools/eval/run_eval.py --dataset data/sample.json --k 10
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| App doesn't start | Run `npm install` in `podflow-studio/` |
| Detection fails | Ensure Python dependencies installed |
| No clips detected | Try longer video (>5 min) |
| Export fails | Check FFmpeg is in PATH |
| API key missing | Works without key (uses local Whisper) |

---

## Design Principles

1. **UI is the source of truth** — State flows from UI decisions
2. **3 screens only** — Upload, Processing, Review
3. **No black boxes** — All detection logic is inspectable
4. **Ship first** — No analytics, accounts, or settings bloat
5. **Trust, speed, ship-ability** — Optimize for these

---

## What This Intentionally Does NOT Do

- ❌ No user accounts or cloud storage
- ❌ No learning from user behavior
- ❌ No "viral predictions" (unprovable)
- ❌ No social integrations
- ❌ No complex project management

---

## Documentation

| Document | Description |
|----------|-------------|
| [MVP_ARCHITECTURE.md](./docs/MVP_ARCHITECTURE.md) | System design |
| [MVP_RULES.md](./docs/MVP_RULES.md) | Quality gates |
| [PIPELINE_FLOW.md](./docs/PIPELINE_FLOW.md) | Processing stages |
| [REVIEWER_GUIDE.md](./docs/REVIEWER_GUIDE.md) | PR review checklist |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Full system docs |

---

## Contributing

1. Check [docs/MVP_PLAN.md](./docs/MVP_PLAN.md) for priorities
2. Follow `.github/pull_request_template.md`
3. Run tests before submitting

---

## License

Proprietary - All rights reserved.

---

**Version:** 1.0.0  
**Status:** Beta Ready
