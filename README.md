# Carson Construct 2 - Podcast Clip Detection Studio

> **Turn hours of content into viral-ready clips in minutes.**

Carson Construct 2 is an AI-powered desktop application that automatically identifies the most engaging, shareable moments in podcasts and long-form video content. Built for content creators who want to maximize their reach without spending hours scrubbing through footage.

---

## The Problem We Solve

Content creators face a painful bottleneck: **finding the best moments in hours of footage is tedious, time-consuming, and inconsistent**. A 2-hour podcast might contain 5-10 viral-worthy clips, but manually reviewing and extracting them can take 4-8 hours of editing time.

**Carson Construct 2 automates this process**, using a combination of audio analysis, pattern detection, and optional AI enhancement to surface the clips most likely to perform well on social media.

---

## Design Philosophy

### 1. **AI-Optional, Never AI-Dependent**
We believe AI should enhance your workflow, not hold it hostage. Our detection pipeline works completely offline using sophisticated audio analysis. AI features (transcription, title generation) are available but never required. You control your costs and your data.

### 2. **Professional Tools, Creator-Focused**
We've brought features from professional NLE software (Premiere Pro, DaVinci Resolve) to a streamlined interface designed specifically for podcast workflows. No bloat, no learning curve—just the tools you need.

### 3. **Trust Through Transparency**
Every clip comes with a detailed score breakdown explaining *why* it was selected. You'll see the hard gates (speech ratio, audio quality), soft scores (hook strength, engagement potential), and pattern detection results. No black boxes.

### 4. **Works With Your Existing Workflow**
Export directly to Premiere Pro, DaVinci Resolve, or Final Cut Pro. Our clips integrate seamlessly with your existing editing process—we're a detection tool, not a replacement for your NLE.

---

## Who Is This For?

| Audience | Use Case |
|----------|----------|
| **Solo Podcasters** | Find your best soundbites for TikTok, Instagram Reels, YouTube Shorts |
| **Podcast Networks** | Process multiple episodes quickly, maintain consistent clip quality |
| **Content Agencies** | Batch process client content, export to multiple NLEs |
| **YouTube Creators** | Extract highlights from long streams, interviews, or vlogs |
| **Social Media Managers** | Generate a week's worth of short-form content from one long video |

---

## Two Products, One Goal

### PodFlow Studio *(Active Development)*

The full-featured clip finder with optional AI enhancement.

- **4 Pattern Detectors**: Payoff moments, passionate monologues, laughter/reactions, debates
- **AI Enhancement**: Whisper transcription + GPT-powered title generation
- **NLE Export**: Premiere Pro, DaVinci Resolve, Final Cut Pro markers & timelines
- **Professional Editing**: Timeline markers, audio ducking, ripple delete, speed controls
- **Processing Time**: ~2-5 minutes for a 1-hour podcast
- **Cost**: ~$0.50 per video with AI, $0 without

```bash
cd podflow-studio
npm install
npm start
```

### Clipper Studio

Lightweight, AI-free alternative for speed-focused workflows.

- **2 Pattern Detectors**: Payoff + Monologue
- **Fully Offline**: No API keys, no costs, no data leaves your machine
- **Processing Time**: ~30-60 seconds for a 1-hour podcast
- **Cost**: $0 per video

```bash
cd clipper-studio
npm install
npm start
```

---

## How It Works

### The Detection Pipeline

1. **Audio Extraction** — FFmpeg extracts and normalizes audio
2. **Feature Analysis** — Calculate energy, spectral content, voice activity
3. **Pattern Detection** — Multiple detectors run in parallel:
   - **Payoff Detector**: Finds silence → energy spike patterns (punchlines, reveals, reactions)
   - **Monologue Detector**: Identifies sustained high-energy speech (rants, passionate takes)
   - **Laughter Detector**: Clusters of high-frequency burst patterns
   - **Debate Detector**: Rapid turn-taking between speakers
4. **Clipworthiness Scoring** — Hard gates filter out bad clips, soft scores rank the rest
5. **Boundary Snapping** — VAD ensures clips never cut mid-word
6. **AI Enhancement** *(optional)* — Whisper transcription + GPT title/hook generation

### Pattern Detection: What We Look For

| Pattern | What It Finds | Example |
|---------|--------------|---------|
| **Payoff** | Build-up → punchline moments | "So I looked him dead in the eye and said... [SILENCE]... GET OUT!" |
| **Monologue** | Sustained passionate speech | A 45-second rant about a topic the host cares deeply about |
| **Laughter** | Comedic reactions | Multiple burst-laugh patterns indicating a funny moment |
| **Debate** | Rapid back-and-forth | Two hosts disagreeing, quick exchanges, heated discussion |

### Clipworthiness Scoring

Every clip passes through a two-stage scoring system:

**Hard Gates** (must pass all):
- Speech ratio ≥ 70% (not music or silence)
- Spectral flatness ≤ 0.45 (not noise or background music)
- Minimum 6 seconds of actual speech

**Soft Scores** (weighted average):
- Pattern strength (how confident is the detection?)
- Hook strength (does the first 3 seconds grab attention?)
- Coherence (does it start/end at natural speech boundaries?)

---

## AI Provider Flexibility

PodFlow Studio supports multiple AI providers through a unified abstraction layer:

| Provider | Models | Cost | Best For |
|----------|--------|------|----------|
| **OpenAI** | GPT-4o, GPT-4o-mini, Whisper | Pay-per-use | Highest quality |
| **Anthropic** | Claude 3.5 Sonnet, Opus, Haiku | Pay-per-use | Detailed analysis |
| **Google Gemini** | 1.5 Pro, 1.5 Flash | Free tier available | Budget-conscious |
| **Ollama** | Llama 3, Mistral, Phi | Free, offline | Privacy-focused |

Switch providers without changing code. A/B test different models. Fall back gracefully if one fails.

---

## Professional Editing Features

PodFlow Studio includes Premiere Pro-inspired tools optimized for podcast workflows:

- **Timeline Markers** — Chapter, ad-read, key-moment, segmentation markers with NLE export
- **Ripple Delete** — Remove clips and automatically close gaps
- **Speed/Duration Controls** — Time remapping from 0.25x to 4x
- **Audio Ducking** — Auto-lower music during speech
- **Edit Modes** — Select, Ripple, Roll, Slip, Slide, Razor
- **Track Controls** — Mute, solo, lock per track
- **Undo/Redo History** — Visual history panel, unlimited undo

See [PREMIERE_PRO_FEATURES.md](./docs/PREMIERE_PRO_FEATURES.md) for the complete feature list.

---

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.8+
- FFmpeg (in PATH or bundled)

### Installation

```bash
# Clone the repository
git clone https://github.com/SeanSpon/CarsonConstruct2.git
cd CarsonConstruct2

# Install PodFlow Studio
cd podflow-studio
npm install
cd src/python && pip install -r requirements.txt
cd ../..

# Start the app
npm start
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `A` | Accept clip |
| `R` | Reject clip |
| `Tab` | Next clip |
| `← / →` | Seek 1 second |
| `J / K / L` | Rewind / Pause / Fast-forward |
| `M` | Add marker |
| `Ctrl+E` | Export all accepted |

---

## Metrics & Performance

| Metric | PodFlow Studio | Clipper Studio |
|--------|----------------|----------------|
| **Processing Speed** | 2-5 min / hour of content | 30-60 sec / hour of content |
| **Memory Usage** | < 1GB peak | < 500MB peak |
| **Cost per Video** | ~$0.50 (with AI) / $0 (without) | $0 |
| **Pattern Types** | 4 (payoff, monologue, laughter, debate) | 2 (payoff, monologue) |
| **NLE Export** | ✅ Premiere, DaVinci, FCP | ✅ Basic export |

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Complete system architecture, algorithms, and research roadmap |
| [docs/MVP_PLAN.md](./docs/MVP_PLAN.md) | Current development priorities and PR plan |
| [docs/AI_PROVIDERS.md](./docs/AI_PROVIDERS.md) | Multi-provider AI abstraction guide |
| [docs/PREMIERE_PRO_FEATURES.md](./docs/PREMIERE_PRO_FEATURES.md) | Professional editing features |
| [docs/RELEASE_CHECKLIST.md](./docs/RELEASE_CHECKLIST.md) | Pre-release quality checklist |

---

## Architecture Overview

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

---

## Evaluation & Testing

Run the evaluation harness to measure precision@K:

```bash
python tools/eval/run_eval.py --dataset data/sample.json --k 10
```

Run Python unit tests:

```bash
cd podflow-studio/src/python
python -m unittest discover -s tests
```

---

## Contributing

1. Check [docs/MVP_PLAN.md](./docs/MVP_PLAN.md) for current priorities
2. Follow the PR template in `.github/pull_request_template.md`
3. Ensure lint and tests pass before submitting

---

## Why "Carson Construct 2"?

This is the second iteration of the Carson Construct project, rebuilt from the ground up with lessons learned from v1. The focus shifted from general video editing to specialized podcast/long-form content clip detection—a narrower problem with a clearer solution.

---

## License

Proprietary - All rights reserved.

---

**Version**: 1.0.0  
**Last Updated**: January 20, 2026
