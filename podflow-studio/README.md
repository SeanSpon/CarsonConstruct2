# PodFlow Studio

AI-powered podcast and video clip detection and editing application.

## Features

- **AI-Powered Clip Detection** - Automatically find engaging moments in podcasts/videos
- **Multi-Camera Support** - Switch between camera angles based on speaker
- **Auto-Save** - Projects automatically save to `.podflow` files every 30 seconds
- **Export Options** - Individual clips, compilations, or full videos with dead space removed
- **NLE Export** - Export to Premiere Pro, DaVinci Resolve, Final Cut Pro (FCP XML, EDL)
- **AI Chat Assistant** - Get editing help and suggestions from AI

## Getting Started

### 1. Import a Video

- Drag and drop a video/audio file into the app, or
- Use **File > Import Video** to browse for a file
- Supported formats: MP4, MOV, MKV, MP3, WAV, AAC, etc.

### 2. Automatic Project Creation

When you import a video, PodFlow Studio automatically creates a `.podflow` project file next to your source video. For example:

```
myvideo.mp4
myvideo.podflow  <-- Created automatically
```

### 3. AI Detection (Optional)

Click **Analyze** to run AI detection which will:
- Transcribe audio using Whisper
- Find engaging patterns (hooks, debates, stories, etc.)
- Generate suggested clip titles and hook text

### 4. Edit and Review

- Accept/Reject clips using **A** and **R** keys
- Trim clips on the timeline
- Apply effects from the Effects Panel
- Use AI Chat for editing suggestions

### 5. Export

- **Export Clips** - Individual clip files
- **Export Compilation** - All accepted clips joined into one video
- **Export Full Video** - Source video with dead spaces removed
- **Export to Premiere** - FCP XML and EDL for professional NLEs

## Panels

### Project Panel (Left)
- Browse project files and recent projects
- View media library
- Import additional assets (B-roll, music, SFX)

### Effects Panel (Right)
- Apply AI effects (auto-zoom, silence removal, etc.)
- Video adjustments (brightness, contrast, etc.)
- Audio adjustments (volume, normalization, etc.)

### AI Chat Panel (Right)
- Ask the AI for editing help
- Get suggestions for clip titles
- Automate editing tasks

### QA Panel
- Quality check your clips before export
- Auto-fix common issues (mid-word cuts, silence, etc.)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `A` | Accept clip |
| `R` | Reject clip |
| `Tab` | Next clip |
| `Shift+Tab` | Previous clip |
| `Left/Right` | Seek 1 second |
| `Shift+Left/Right` | Seek 5 seconds |
| `Ctrl+S` | Save project |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+O` | Open project |
| `Ctrl+N` | New project |
| `Ctrl+J` | Toggle AI Chat |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+E` | Export all accepted clips |

## Project Files

### .podflow Format

PodFlow Studio saves projects as `.podflow` files which contain:

- Source video reference
- Detected clips and their status
- Dead space regions
- Transcript data
- Editing preferences
- Timeline state
- Camera cuts and audio tracks

### Auto-Save

Projects auto-save every 30 seconds when there are unsaved changes:
- If a `.podflow` file exists, it saves directly to that file
- If no project file exists yet, it creates one next to the source video
- A fallback recovery file is also saved in case of errors

### Recovery

If PodFlow Studio detects an unsaved auto-save file on startup, it will offer to recover your work.

## AI Providers

PodFlow Studio supports multiple AI providers for different tasks:

| Provider | Chat | Transcription | Vision |
|----------|------|---------------|--------|
| Anthropic (Claude) | ✓ | - | ✓ |
| OpenAI (GPT-4) | ✓ | ✓ | ✓ |
| Google (Gemini) | ✓ | - | ✓ |
| Ollama (Local) | ✓ | - | - |

Configure API keys in **Settings**.

## System Requirements

- Windows 10/11, macOS 10.15+, or Linux
- 8GB RAM minimum (16GB recommended)
- FFmpeg (bundled with the app)
- Python 3.8+ (for AI detection)

## Development

```bash
# Install dependencies
cd podflow-studio
npm install

# Run in development mode
npm start

# Build for production
npm run package
```

## Support

- Press `?` or click **Help** for keyboard shortcuts
- Click the **Documentation** icon for detailed help
- Use **AI Chat** to ask for editing assistance

---

All processing happens locally on your machine. Nothing is uploaded to external servers (except when using cloud AI providers for optional AI enhancement).
