# Carson Construct 2 - Current MVP Architecture

## Scope
This document describes the shipped MVP architecture for the two desktop apps in this repo: Clipper Studio and PodFlow Studio. It covers current components and data flow only. Future ideas live in `docs/ROADMAP.md`.

## Apps
- **Clipper Studio:** Algorithm-only clip detection (payoff + monologue) and export.
- **PodFlow Studio:** Algorithmic clip detection (payoff, monologue, laughter, debate) plus optional AI enhancement for transcripts and titles.

## High-level architecture
```
Renderer (React) -> Main process (Electron/Node) -> Python pipeline -> Main -> Renderer
                         |                                 |
                         |                                 -> FFmpeg exports
                         -> File selection + validation
```

## Components

### Renderer (React)
- Entry points: `clipper-studio/src/renderer` and `podflow-studio/src/renderer`
- Pages: file intake, clip review, auto edit, export
- State: Zustand stores for project, progress, results, and settings

### Main process (Electron)
- File selection + validation: `src/main/ipc/fileHandlers.ts`
- Detection orchestration: `src/main/ipc/detectionHandlers.ts`
- Export orchestration: `src/main/ipc/exportHandlers.ts`

### Python pipeline
- Entry: `src/python/detector.py`
- Pattern detectors: `src/python/patterns/*`
- Scoring: `src/python/utils/clipworthiness.py`
- Optional AI enhancement (PodFlow only): `src/python/ai/*`

## Current data flow (PodFlow Studio)
1. User selects a video file in the renderer.
2. Main process validates file metadata.
3. Main process spawns the Python detector.
4. Python extracts audio, runs detectors, and returns ranked clips plus dead spaces.
5. Optional AI enhancement augments clip metadata.
6. Renderer displays results and drives export.

## Outputs
- Ranked clips with scores and metadata
- Dead space segments for Auto Edit
- Exports via FFmpeg (clips or full edited video)
- Optional transcript metadata when AI enhancement is enabled

## Related docs
- `docs/SMOKE_TEST.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/ROADMAP.md`
