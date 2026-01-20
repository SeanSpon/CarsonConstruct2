# PodFlow Studio - Setup & Changes Guide

## Recent Changes (Caption & Settings Update)

### What Was Fixed
1. **Captions Not Appearing**: Root cause was missing OpenAI API key causing empty transcripts (0 segments/0 words)
2. **Added Settings UI**: New settings modal for configuring OpenAI API key
3. **Local Whisper Fallback**: Added faster-whisper for offline transcription when no API key is provided
4. **Caption Positioning**: Fixed ASS subtitle format for bottom-aligned captions (MarginV: 80px)
5. **FFmpeg Filter Escaping**: Fixed subtitle path escaping for macOS/Unix systems
6. **History Video Preview**: Simplified to placeholder (Electron file:// restrictions)

### New Features
- **Settings Modal**: Click gear icon on home screen to configure OpenAI API key
- **Hybrid Transcription**: Automatically uses OpenAI Whisper API if key exists, falls back to local faster-whisper (base model)
- **Caption Styles**: Support for viral, minimal, and bold caption styles
- **Per-Clip Settings**: Override caption style per clip in history detail view

---

## Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- Python 3.8+
- FFmpeg 6.0+ (with libass support)

### 1. Clone Repository
```bash
git clone https://github.com/SeanSpon/CarsonConstruct2.git
cd CarsonConstruct2-main
```

### 2. Install Python Dependencies
```bash
cd podflow-studio/src/python
python3 -m pip install -r requirements.txt
```

**Key Python Packages:**
- `faster-whisper>=0.10.0` - Local transcription fallback
- `openai-whisper` - OpenAI Whisper API client
- `pyannote.audio` - Voice activity detection
- `torch`, `torchaudio` - ML framework
- `pydub` - Audio processing

### 3. Install Node Dependencies
```bash
cd /path/to/CarsonConstruct2-main/podflow-studio
npm install
```

### 4. Configure Settings (Optional but Recommended)
1. Start the application: `npm start`
2. Click the **Settings** icon (gear) on the home screen
3. Paste your OpenAI API key (for best transcription quality)
4. Click **Save**

**Note:** If no API key is provided, the app will use local faster-whisper (slower but works offline).

---

## Running the Application

### Development Mode
```bash
cd podflow-studio
npm start
```

This will:
- Build the Electron main process
- Build the renderer (React app)
- Launch the Electron window

### First-Time Usage
1. **New Project**: Click "New Project" on home screen
2. **Select Video**: Choose your source video file (MP4, MOV, etc.)
3. **Run Detection**: Wait for AI analysis to complete
   - With API key: Uses OpenAI Whisper for transcription (~2-3 min for 30-min video)
   - Without API key: Uses local faster-whisper base model (~10-15 min for 30-min video)
4. **Review Clips**: Adjust trim points, toggle clips, select caption style
5. **Export**: Click export to generate vertical 1080x1920 MP4s with burned-in captions

---

## How Captions Work

### Transcription Pipeline
1. **Audio Extraction**: FFmpeg extracts audio from source video
2. **Voice Activity Detection**: Pyannote identifies speech segments
3. **Transcription**: 
   - **If API key exists**: Calls OpenAI Whisper API (fast, accurate)
   - **If no API key**: Uses faster-whisper locally (slower, offline)
4. **Caching**: Transcript saved to `{videoHash}/transcript.json` in cache directory
5. **Export**: ASS subtitle file generated with selected style, burned into video with FFmpeg

### Caption Styles
- **Viral**: Bold yellow text, black outline, bottom-center
- **Minimal**: Clean white text, subtle shadow
- **Bold**: Large impact text with heavy outline

### Troubleshooting Captions
If captions don't appear:
1. Check if API key is saved in Settings (or verify faster-whisper is installed)
2. **Delete old cache**: Find `{videoHash}` folder in cache and delete it
3. **Re-run detection**: Load project and run detection again
4. Check console logs for transcript segments: should show `{ segments: N, words: M }` where N > 0

---

## Project Structure

```
podflow-studio/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts            # App entry point
│   │   └── ipc/                # IPC handlers
│   │       ├── detectionHandlers.ts  # MVP detection pipeline
│   │       ├── exportHandlers.ts     # FFmpeg export with captions
│   │       └── fileHandlers.ts       # File I/O
│   ├── renderer/               # React app (UI)
│   │   ├── App.tsx             # Main app component (with Settings)
│   │   ├── components/         # Reusable components
│   │   │   └── SettingsModal.tsx    # NEW: API key configuration
│   │   └── pages/
│   │       ├── Processing.tsx  # Detection progress
│   │       └── Review.tsx      # Clip review & export
│   ├── preload/
│   │   └── index.ts            # IPC bridge type definitions
│   └── python/                 # AI/ML pipeline
│       ├── detector.py         # MODIFIED: Hybrid transcription
│       ├── pipeline.py         # MVP detection orchestrator
│       ├── ai/
│       │   └── transcription.py     # OpenAI Whisper API client
│       ├── autofix/            # Clip validation & auto-fix
│       ├── patterns/           # Content pattern detection
│       └── utils/              # Audio processing utilities
```

---

## Key Files Modified

### 1. `detector.py` (Lines 275-313)
- Added local Whisper fallback using faster-whisper
- Tries OpenAI API first if key exists, else uses WhisperModel("base")
- Converts faster-whisper segments to standard format

### 2. `SettingsModal.tsx` (NEW FILE)
- Password input for API key (masked display)
- Persists to zustand store automatically
- Shows help text for where to get API key

### 3. `App.tsx` (Lines 518-540, 276)
- Added Settings button to home screen header
- Renders SettingsModal when clicked
- Fixed TypeScript type errors for captionStyle property

### 4. `exportHandlers.ts` (Lines 1089-1093, 1273-1276)
- Changed ASS header: `MarginV: 80` (bottom-aligned captions)
- Added `ScaledBorderAndShadow: yes` for consistency
- Fixed FFmpeg filter: colon escaping for paths, single quotes

### 5. `store.ts` (Already had openaiApiKey field)
- DetectionSettings interface includes `openaiApiKey?: string`
- Persisted via zustand middleware to localStorage

---

## Development Workflow

### Making Changes
1. Edit code in `src/` directory
2. Hot reload works for renderer (React)
3. For main process changes, restart with `npm start`

### Testing Captions
1. Add API key in Settings (or skip for local Whisper test)
2. Use a **short video** (1-2 min) for fast iteration
3. Check console for logs: `[MVP Export] Loaded transcript from cache: { segments: N, words: M }`
4. If N = 0, delete cache folder and re-run detection

### Building for Production
```bash
npm run make
```

Generates packaged app in `out/` directory.

---

## Debugging Tips

### Check Transcript Cache
```bash
# Find your video hash in console logs, then:
ls ~/Library/Application\ Support/podflow-studio/cache/{videoHash}/
cat ~/Library/Application\ Support/podflow-studio/cache/{videoHash}/transcript.json
```

Should show JSON with `segments` array containing transcribed text.

### Check Python Dependencies
```bash
cd podflow-studio/src/python
python3 -c "import faster_whisper; print(faster_whisper.__version__)"
```

Should print `0.10.0` or higher.

### FFmpeg Subtitle Test
```bash
# Manually test subtitle burning:
ffmpeg -i input.mp4 -vf "subtitles=captions.ass" -c:v libx264 output.mp4
```

---

## API Keys

### OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Paste into Settings modal in app
4. **Cost**: ~$0.006 per minute of audio (Whisper pricing)

### Local Alternative (No Key Required)
- Uses faster-whisper with base model
- Runs entirely offline on your machine
- Slower but free

---

## Known Issues

1. **Video Preview in History**: Placeholder only (Electron file:// restrictions). Use "Load in Review" button to preview clips.
2. **First Export Slow**: Faster-whisper downloads model on first run (~140MB).
3. **Console Errors**: Autofill errors are harmless Electron DevTools warnings.

---

## Support

For issues or questions:
- Check console logs in DevTools (View > Toggle Developer Tools)
- Verify transcript.json has segments
- Ensure FFmpeg has libass support: `ffmpeg -filters | grep subtitles`

---

## Contributors
- Zachary Robards - Caption fixes, settings UI, local Whisper integration
- Sean (SeanSpon) - Original project maintainer
