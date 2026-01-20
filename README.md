# PodClip

**Simple, Deterministic Podcast Clip Generator**

A command-line tool that takes a long podcast video and outputs multiple short vertical clips with:
- Clean hard cuts
- Karaoke-style captions (word-level highlight)
- Optional angle switching (rule-based)
- Optional b-roll overlay (rule-based)
- FFmpeg-based export

## Quick Start

```bash
# 1. Install FFmpeg
brew install ffmpeg  # Mac
# or: apt install ffmpeg (Linux)
# or: winget install FFmpeg (Windows)

# 2. Install Python dependencies
cd podclip
pip install -r requirements.txt

# 3. Set your OpenAI API key (for Whisper transcription)
export OPENAI_API_KEY="sk-..."

# 4. Run it!
python -m podclip input.mp4 --out clips/
```

## What You Get

```
clips/
├── clip_001.mp4          # Vertical 9:16 video with burned-in captions
├── clip_002.mp4
├── clip_003.mp4
├── ...
├── captions/
│   ├── clip_001.ass      # ASS subtitle files (if needed separately)
│   └── ...
└── clips.json            # Metadata (timestamps, scores, reasons)
```

## Philosophy

- **No hype AI abstractions** — Just Whisper for transcription, everything else is deterministic
- **No dead code** — Every file has a clear purpose
- **One clear pipeline** — Input → Transcription → Detection → Captions → Export
- **Readable in one sitting** — Simple, well-commented code

## Pipeline

```
podclip/
├── input/         → Load video, extract audio, validate
├── transcription/ → Whisper word-level timestamps (SINGLE SOURCE OF TRUTH)
├── detection/     → Deterministic clip detection (speech density, silence breaks)
├── captions/      → Karaoke-style ASS captions
├── editing/       → Rule-based angle switching, b-roll overlay
└── export/        → FFmpeg vertical 9:16 export with captions
```

## Usage

```bash
python -m podclip INPUT [OPTIONS]

Options:
  --out, -o DIR         Output directory (default: clips/)
  --count, -n NUM       Number of clips to generate (default: 10)
  --min-duration SECS   Minimum clip duration (default: 15)
  --max-duration SECS   Maximum clip duration (default: 60)
  --skip-intro SECS     Skip first N seconds (default: 30)
  --skip-outro SECS     Skip last N seconds (default: 30)
  --no-captions         Disable caption burning
  --caption-style       viral|minimal|bold (default: viral)
  --angles FILE...      Additional camera angles for switching
  --api-key KEY         OpenAI API key
  --verbose, -v         Verbose output
```

## Examples

```bash
# Basic: 10 clips with default settings
python -m podclip podcast.mp4 --out clips/

# Custom count and duration
python -m podclip podcast.mp4 --out clips/ -n 15 --min-duration 20 --max-duration 45

# Skip long intro/outro
python -m podclip podcast.mp4 --out clips/ --skip-intro 90 --skip-outro 60

# With multiple camera angles
python -m podclip main.mp4 --angles cam1.mp4 cam2.mp4 --out clips/

# Minimal captions
python -m podclip podcast.mp4 --out clips/ --caption-style minimal
```

## Cost

- **Whisper**: ~$0.006/minute ≈ $0.36/hour
- **Everything else**: Free (local FFmpeg)

## Requirements

- Python 3.8+
- FFmpeg (must be in PATH)
- OpenAI API key

## License

MIT
