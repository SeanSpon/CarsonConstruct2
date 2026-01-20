# PodClip

**Simple, Deterministic Podcast Clip Generator**

A tool that takes a long podcast video and outputs multiple short vertical clips with:
- Clean hard cuts
- Karaoke-style captions (word-level highlight)
- Optional angle switching (rule-based)
- Optional b-roll overlay (rule-based)
- FFmpeg-based export

## Philosophy

- **No hype AI abstractions** - Just Whisper for transcription, everything else is deterministic
- **No dead code** - Every file has a clear purpose
- **One clear pipeline** - Input → Transcription → Detection → Captions → Export
- **Readable in one sitting** - Simple, well-commented code

## Installation

```bash
# 1. Install FFmpeg (required)
# Mac:
brew install ffmpeg

# Windows:
winget install FFmpeg

# Linux:
apt install ffmpeg

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Set OpenAI API key (for Whisper transcription)
export OPENAI_API_KEY="sk-..."
```

## Quick Start

```bash
# Basic usage - generate 10 clips from a podcast
python -m podclip podcast.mp4 --out clips/

# That's it! Check clips/ for your vertical clips.
```

## Usage

```bash
python -m podclip INPUT [OPTIONS]

Arguments:
  INPUT                 Input video file (mp4, mov, mkv)

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
  --broll FILE...       B-roll videos for overlay
  --api-key KEY         OpenAI API key
  --cache-dir DIR       Cache directory for intermediate files
  --verbose, -v         Verbose output
```

## Examples

```bash
# Generate clips with custom settings
python -m podclip podcast.mp4 --out clips/ --count 15 --min-duration 20 --max-duration 45

# Skip long intro and outro
python -m podclip podcast.mp4 --out clips/ --skip-intro 90 --skip-outro 60

# With multiple camera angles
python -m podclip main.mp4 --angles cam1.mp4 cam2.mp4 --out clips/

# Minimal white captions
python -m podclip podcast.mp4 --out clips/ --caption-style minimal

# No captions (raw clips)
python -m podclip podcast.mp4 --out clips/ --no-captions
```

## Pipeline Architecture

```
input/
└── Load video, extract audio, validate

transcription/
└── Whisper transcription with word-level timestamps
    (This is the SINGLE SOURCE OF TRUTH)

detection/
├── Speech density analysis (words/sec)
├── Silence → speech spike detection
├── Sentence boundary alignment
└── Deterministic scoring (0-100)

captions/
└── Build karaoke-style ASS captions from word timestamps

editing/
├── Angle switching (cut on sentences, every 3-5s)
└── B-roll overlay (audio unchanged, video only)

export/
└── FFmpeg vertical 9:16 export with burned-in captions
```

## Output Structure

```
clips/
├── clip_001.mp4          # Vertical video with captions
├── clip_002.mp4
├── ...
├── captions/
│   ├── clip_001.ass      # ASS caption files
│   ├── clip_002.ass
│   └── ...
└── clips.json            # Metadata (timestamps, scores)
```

## Detection Criteria

Clips are detected using ONLY deterministic rules:

1. **Speech Density** (0-35 pts)
   - High words/second = engaging content
   - 3+ words/sec = maximum score

2. **Hook Strength** (0-25 pts)
   - Energy in first 3 seconds
   - Starting at sentence boundary = bonus

3. **Length Score** (0-20 pts)
   - Ideal: 15-30 seconds
   - Acceptable: 10-45 seconds

4. **Boundary Bonus** (0-10 pts)
   - Clips that start/end on sentences

5. **Payoff Bonus** (0-10 pts)
   - Silence → speech patterns (dramatic pauses)

**Total: 0-100 points**

## API Cost

- **Whisper transcription**: ~$0.006/minute = ~$0.36/hour
- **Everything else**: Free (local processing)

## Requirements

- Python 3.8+
- FFmpeg (must be in PATH)
- OpenAI API key (for Whisper)

## License

MIT
