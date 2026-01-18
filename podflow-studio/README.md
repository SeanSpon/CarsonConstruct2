# PodFlow Studio

AI-powered podcast clip detection for content creators. Find viral moments, remove dead space, export clean clips.

## Features

### 🎯 Clip Finder
- **4 Detection Patterns:**
  - **Payoff Moments:** Silence → energy spike (punchlines, reveals)
  - **Energy Monologues:** Sustained high energy + fast pace (rants, hot takes)
  - **Laughter Detection:** Burst energy clusters (comedic moments)
  - **Debate Detection:** Rapid back-and-forth with short gaps
- **AI Enhancement (Optional):**
  - Whisper transcription with word-level timestamps
  - GPT-4o-mini for viral titles, hook text, and quality validation

### ✂️ Auto Edit
- Detect dead spaces (silence > 3 seconds)
- Toggle remove/keep for each silence
- Preview before/after (coming soon)

### 📦 Export
- Export individual clips or full edited video
- Fast mode (stream copy) or Accurate mode (re-encode)
- Metadata JSON with AI-generated titles

## Requirements

- **Python 3.9+** with dependencies:
  ```bash
  pip install librosa numpy scipy soundfile openai python-dotenv
  ```
- **FFmpeg** in system PATH
- **OpenAI API Key** (optional, for AI enhancement)

## Development

```bash
# Install dependencies
npm install

# Start development
npm start

# Build for production
npm run package
```

## Docs

- [Smoke Test](../docs/SMOKE_TEST.md)
- [Known Limitations](../docs/KNOWN_LIMITATIONS.md)

## Tech Stack

- **Frontend:** Electron + React + TypeScript
- **Styling:** Tailwind CSS (dark theme)
- **State:** Zustand
- **Audio Analysis:** Python + librosa
- **Video Processing:** FFmpeg
- **AI:** OpenAI Whisper + GPT-4o-mini

## Project Structure

```
src/
├── main/                    # Electron main process
│   ├── index.ts
│   └── ipc/
│       ├── fileHandlers.ts
│       ├── detectionHandlers.ts
│       └── exportHandlers.ts
├── preload/
│   └── index.ts             # Secure IPC bridge
├── renderer/                # React app
│   ├── App.tsx
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── ClipFinder.tsx
│   │   ├── AutoEdit.tsx
│   │   └── Export.tsx
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── ClipCard.tsx
│   │   ├── DeadSpaceItem.tsx
│   │   └── ...
│   ├── stores/
│   │   └── store.ts
│   └── types/
│       └── index.ts
└── python/
    ├── detector.py          # Main entry
    ├── patterns/
    │   ├── payoff.py        # Silence → spike
    │   ├── monologue.py     # Sustained energy
    │   ├── laughter.py      # Burst clusters
    │   ├── debate.py        # Rapid turn-taking
    │   └── silence.py       # Dead space
    ├── ai/
    │   ├── transcription.py # Whisper API
    │   └── clip_enhancement.py # GPT-4o-mini
    └── utils/
        ├── audio.py
        └── scoring.py
```

## License

MIT
