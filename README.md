# Carson Construct 2 - Podcast Clip Detection Studio

AI-powered podcast and video clip detection for content creators. Find viral-worthy moments in hours of content in minutes.

## Products

This monorepo contains two Electron applications:

### PodFlow Studio (Active Development)

Production-grade clip finder with AI semantic understanding.

- **AI-Enhanced Detection**: Whisper transcription + GPT-4 clip analysis
- **Multiple Pattern Detectors**: Payoff moments, monologues, laughter, debates
- **Smart Boundaries**: VAD-snapped clips that never cut mid-word
- **NLE Export**: Premiere Pro, DaVinci Resolve, Final Cut Pro support
- **Processing Time**: ~2-5 minutes for 1-hour podcast
- **Cost**: ~$0.50 per video (Whisper + GPT API)

```bash
cd podflow-studio
npm install
npm start
```

### Clipper Studio

Lightweight, AI-free alternative for speed-focused workflows.

- **Pure Algorithmic**: No AI costs, fully offline
- **Two Pattern Detectors**: Payoff + Monologue
- **Processing Time**: ~30-60 seconds for 1-hour podcast
- **Cost**: $0 per video

```bash
cd clipper-studio
npm install
npm start
```

## Features

- **Automatic Clip Detection**: Find engaging moments using audio analysis
- **Score Breakdown**: Understand why each clip was selected
- **Clipworthiness Scoring**: Hard gates (speech ratio, flatness) + soft scores
- **VAD Boundary Snapping**: Clips start/end at natural speech boundaries
- **Multiple Export Modes**: Fast (stream copy) or Accurate (re-encode)
- **Project Files**: Save/load `.podflow` project state
- **Auto-Save**: Never lose work with 30-second auto-save

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Complete system architecture and algorithms |
| [docs/MVP_PLAN.md](./docs/MVP_PLAN.md) | Sellable MVP plan and workstreams |
| [docs/AI_PROVIDERS.md](./docs/AI_PROVIDERS.md) | Multi-provider AI abstraction guide |
| [docs/PREMIERE_PRO_FEATURES.md](./docs/PREMIERE_PRO_FEATURES.md) | NLE integration features |
| [docs/RELEASE_CHECKLIST.md](./docs/RELEASE_CHECKLIST.md) | Pre-release quality checklist |

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.8+
- FFmpeg (in PATH or bundled)

### Running PodFlow Studio

```bash
# Clone the repository
git clone https://github.com/SeanSpon/donebytmr.git
cd donebytmr

# Install dependencies
cd podflow-studio
npm install

# Install Python dependencies
cd src/python
pip install -r requirements.txt
cd ../..

# Start the app
npm start
```

### Running Evaluation

```bash
python tools/eval/run_eval.py --dataset data/sample.json --k 10
```

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Electron (React + TypeScript)                │
│                         EditorView UI                           │
└─────────────────────────┬───────────────────────────────────────┘
                          │ IPC
┌─────────────────────────┴───────────────────────────────────────┐
│                    Main Process (Node.js)                       │
│           File Handlers │ Detection │ Export │ Jobs             │
└─────────────────────────┬───────────────────────────────────────┘
                          │ spawn
┌─────────────────────────┴───────────────────────────────────────┐
│                    Python Detection Pipeline                    │
│  Features → Patterns → Scoring → (Optional) AI Enhancement      │
└─────────────────────────────────────────────────────────────────┘
```

## Detection Pipeline

1. **Audio Extraction**: FFmpeg extracts 22.05kHz mono audio
2. **Feature Computation**: RMS, spectral centroid, flatness, ZCR, onset strength
3. **VAD Segmentation**: WebRTC VAD identifies speech regions
4. **Pattern Detection**: Run payoff, monologue, laughter, debate detectors
5. **Clipworthiness Scoring**: Hard gates + soft-score ensemble
6. **Boundary Snapping**: Snap to VAD segments (±2s window)
7. **AI Enhancement** (optional): Whisper transcription + GPT-4 titles

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `A` | Accept clip |
| `R` | Reject clip |
| `Tab` | Next clip |
| `←` / `→` | Seek 1 second |
| `Ctrl+E` | Export all accepted |

## AI Providers

PodFlow Studio supports multiple AI providers through a unified abstraction:

- **OpenAI**: GPT-4o, GPT-4o-mini, Whisper
- **Anthropic**: Claude 3.5 Sonnet, Opus, Haiku
- **Google Gemini**: 1.5 Pro, 1.5 Flash (free tier available)
- **Ollama**: Local models (Llama 3, Mistral) - free & offline

## Contributing

1. Check [docs/MVP_PLAN.md](./docs/MVP_PLAN.md) for current priorities
2. Follow the PR template in `.github/pull_request_template.md`
3. Run tests before submitting:
   ```bash
   cd podflow-studio/src/python
   python -m unittest discover -s tests
   ```

## License

Proprietary - All rights reserved.

---

**Version**: 1.0.0  
**Last Updated**: January 19, 2026
