# PodClip Architecture

Simple, deterministic podcast clip generator.

## Pipeline Overview

```
┌─────────────┐    ┌───────────────┐    ┌────────────┐    ┌──────────┐    ┌────────┐
│   INPUT     │ -> │ TRANSCRIPTION │ -> │ DETECTION  │ -> │ CAPTIONS │ -> │ EXPORT │
│             │    │               │    │            │    │          │    │        │
│ Load video  │    │ Whisper API   │    │ Find clips │    │ Generate │    │ FFmpeg │
│ Extract wav │    │ Word-level    │    │ Score/rank │    │ ASS subs │    │ 9:16   │
└─────────────┘    └───────────────┘    └────────────┘    └──────────┘    └────────┘
```

## Directory Structure

```
podclip/
├── __init__.py         # Package init, version
├── __main__.py         # Entry point for python -m podclip
├── cli.py              # CLI argument parsing and orchestration
├── requirements.txt    # Dependencies (just openai)
├── README.md           # Documentation
│
├── input/
│   ├── __init__.py
│   └── loader.py       # Video loading, audio extraction, validation
│
├── transcription/
│   ├── __init__.py
│   └── whisper.py      # OpenAI Whisper API integration
│
├── detection/
│   ├── __init__.py
│   ├── candidates.py   # Detect potential clip candidates
│   └── scoring.py      # Score and rank clips (deterministic formula)
│
├── captions/
│   ├── __init__.py
│   └── karaoke.py      # ASS subtitle generation with word timing
│
├── editing/
│   ├── __init__.py
│   ├── angle_switch.py # Rule-based camera angle switching
│   └── broll.py        # Rule-based b-roll overlay
│
└── export/
    ├── __init__.py
    └── vertical.py     # FFmpeg 9:16 export with caption burning
```

## Data Flow

### 1. Input Stage
```python
video_info = load_video("podcast.mp4")
# Returns: VideoInfo(path, duration, width, height, fps)

audio_path = extract_audio("podcast.mp4", "audio.wav", sample_rate=16000)
# Returns: path to 16kHz mono WAV
```

### 2. Transcription Stage
```python
transcript = transcribe("audio.wav", api_key)
# Returns: Transcript(text, words[], segments[], duration)
#
# words: [{word: "Hello", start: 0.0, end: 0.5}, ...]
# segments: [{text: "Hello world.", start: 0.0, end: 1.2}, ...]
```

### 3. Detection Stage
```python
candidates = detect_candidates(transcript, min_duration=15, max_duration=60)
# Returns: [Candidate(start, end, reason, peak_time, speech_density), ...]

clips = score_and_rank(candidates, transcript, top_n=10)
# Returns: [ScoredClip(id, start, end, score, breakdown), ...]
```

**Scoring Formula (0-100 points):**
- Speech density: 0-35 pts (higher words/sec = better)
- Hook strength: 0-25 pts (engaging first 3 seconds)
- Length score: 0-20 pts (ideal 15-30s)
- Boundary bonus: 0-10 pts (starts/ends on sentences)
- Payoff bonus: 0-10 pts (silence → speech patterns)

### 4. Captions Stage
```python
generate_captions(transcript, clip_start, clip_end, "clip_001.ass")
# Writes: ASS subtitle file with word-by-word timing
```

**ASS Format:**
- Word-level timing from transcript
- Grouped into 2-line chunks
- Styled (viral green, minimal white, bold)

### 5. Export Stage
```python
export_vertical_clip(
    source_file="podcast.mp4",
    output_file="clip_001.mp4",
    start_time=120.5,
    end_time=145.2,
    input_width=1920,
    input_height=1080,
    caption_file="clip_001.ass"
)
# Outputs: 1080x1920 vertical video with burned-in captions
```

**FFmpeg Filter Chain:**
```
crop=607:1080:656:0,scale=1080:1920,ass='clip_001.ass'
```

## Key Design Decisions

### 1. Transcript as Single Source of Truth
All timing decisions (clip boundaries, caption timing, cut points) derive from the Whisper transcript. This ensures consistency and makes the pipeline debuggable.

### 2. Deterministic Scoring
No machine learning or probabilistic models for clip detection. The scoring formula is explicit, reproducible, and tunable.

### 3. Minimal Dependencies
- `openai` for Whisper API
- FFmpeg for all video processing (not a Python package)
- Python stdlib for everything else

### 4. No State
Each run is independent. Cache files are optional and only used for development efficiency.

## Cost Analysis

| Component | Cost |
|-----------|------|
| Whisper | $0.006/min |
| FFmpeg | Free |
| Total (1hr video) | ~$0.36 |

## Extension Points

### Adding New Detection Methods
1. Add function in `detection/candidates.py`
2. Return `Candidate` objects with `reason` field
3. Detection is automatically included in ranking

### Adding New Caption Styles
1. Add to `CaptionStyle` enum in `captions/karaoke.py`
2. Define colors in `get_style_colors()`
3. Expose via CLI `--caption-style` option

### Adding Audio Processing
1. Create `audio/` module
2. Process in isolation (don't modify transcript)
3. Pass results to export stage

## Non-Goals

This tool does NOT:
- Run a web server
- Store user data
- Train models
- Integrate with social media APIs
- Provide a GUI

It ONLY:
- Takes video in
- Outputs clips
