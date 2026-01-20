# MVP Architecture — Deterministic Podcast Clip Pipeline

> A deterministic pipeline that converts long-form podcast video into short vertical clips with captions and clean cuts.

---

## System Overview

```
Input Video(s)
     ↓
┌─────────────────────────────────────────────────┐
│  Stage A: Audio Extraction (FFmpeg)             │
│  - Extract 22.05kHz mono WAV                    │
│  - Output: audio.wav                            │
└─────────────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────────────┐
│  Stage B: Transcription (Whisper API)           │
│  - Word-level timestamps                        │
│  - Output: transcript.json                      │
└─────────────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────────────┐
│  Stage C: Feature Extraction (librosa)          │
│  - RMS, centroid, flatness, ZCR, onset          │
│  - VAD segments                                 │
│  - Output: features.json                        │
└─────────────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────────────┐
│  Stage D: Candidate Detection                   │
│  - Silence → spike patterns                     │
│  - Energy monologues                            │
│  - Laughter bursts                              │
│  - Output: candidates.json                      │
└─────────────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────────────┐
│  Stage E: Scoring + Selection                   │
│  - Deterministic scoring                        │
│  - De-duplication (IOU threshold)               │
│  - Top-N selection                              │
│  - Output: clips.json                           │
└─────────────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────────────┐
│  Stage F: Export (FFmpeg)                       │
│  - Frame-accurate cuts                          │
│  - Vertical format (9:16)                       │
│  - Output: clip_001.mp4, clip_002.mp4, ...      │
└─────────────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────────────┐
│  Stage G: Caption Burn (optional)               │
│  - ASS karaoke captions                         │
│  - Word-level highlighting                      │
│  - Output: clip_001_captioned.mp4, ...          │
└─────────────────────────────────────────────────┘
```

---

## Folder Structure (Locked)

```
podflow-studio/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # Entry point, window creation
│   │   └── ipc/                 # IPC handlers
│   │       ├── fileHandlers.ts  # File dialogs, validation
│   │       ├── detectionHandlers.ts  # Python spawning
│   │       └── exportHandlers.ts     # FFmpeg export
│   │
│   ├── renderer/                # React frontend (thin)
│   │   ├── App.tsx              # Root component
│   │   └── components/
│   │       └── editor/          # EditorView components
│   │
│   └── python/                  # Detection pipeline (pure)
│       ├── detector.py          # Main entry point
│       ├── features.py          # Feature extraction
│       ├── vad_utils.py         # Voice activity detection
│       ├── patterns/            # Pattern detectors
│       │   ├── payoff.py
│       │   ├── monologue.py
│       │   ├── laughter.py
│       │   └── silence.py
│       └── utils/               # Scoring utilities
│           ├── mvp_candidates.py
│           ├── mvp_scoring.py
│           └── clipworthiness.py
```

### Architecture Rules

1. **`python/` never imports from `renderer/`**
2. **`renderer/` only calls `python/` via IPC**
3. **No cross-stage coupling** — each stage reads from previous stage's output
4. **No hidden side effects** — all state changes are explicit

---

## Stage Details

### Stage A: Audio Extraction

**Input:** Video file (MP4, MOV, MKV, AVI, WebM)  
**Output:** `job_dir/audio.wav`

```python
# FFmpeg command
ffmpeg -y -i input.mp4 -vn -acodec pcm_s16le -ar 22050 -ac 1 audio.wav
```

**Parameters:**
- Sample rate: 22050 Hz
- Channels: 1 (mono)
- Format: PCM 16-bit signed little-endian

**Caching:** Skip if `audio.wav` exists and is non-empty.

---

### Stage B: Transcription

**Input:** `audio.wav`  
**Output:** `job_dir/transcript.json`

**Format:**
```json
{
  "text": "Full transcript text...",
  "segments": [
    {
      "id": 0,
      "start": 0.0,
      "end": 4.5,
      "text": "Welcome to the show."
    }
  ],
  "words": [
    {
      "word": "Welcome",
      "start": 0.0,
      "end": 0.4
    }
  ]
}
```

**Fallback:** If no API key, create empty transcript:
```json
{"text": "", "segments": [], "words": []}
```

**Caching:** Skip if `transcript.json` exists.

---

### Stage C: Feature Extraction

**Input:** `audio.wav`, `transcript.json`  
**Output:** `job_dir/features.json`

**Features Computed:**

| Feature | Description | Shape |
|---------|-------------|-------|
| `rms` | Root mean square energy | `[N_frames]` |
| `centroid` | Spectral centroid (brightness) | `[N_frames]` |
| `flatness` | Spectral flatness (noise vs tone) | `[N_frames]` |
| `zcr` | Zero-crossing rate | `[N_frames]` |
| `onset` | Onset strength | `[N_frames]` |
| `times` | Frame timestamps | `[N_frames]` |
| `vad_segments` | Voice activity regions | `[{start, end}, ...]` |
| `word_timestamps` | From transcript | `[{word, start, end}, ...]` |

**Parameters:**
- Hop length: 0.10 seconds (100ms frames)
- RMS window: 0.40 seconds
- Baseline window: 20 seconds (rolling median)

**Serialization:** NumPy arrays → lists for JSON.

---

### Stage D: Candidate Detection

**Input:** `features.json`  
**Output:** `job_dir/candidates.json`

**Detectors:**

#### 1. Silence → Spike (Payoff)

Detects moments where silence is followed by energy spike (punchlines, reveals).

```python
# Algorithm
1. Find silence regions: rms < baseline - silence_threshold_db
2. Find runs of silence ≥ silence_run_s
3. Look for spike after silence: rms > baseline + spike_threshold_db
4. Require spike sustains for spike_sustain_s
```

**Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `silence_threshold_db` | -35 | dB below baseline for silence |
| `silence_run_s` | 1.2 | Minimum silence duration |
| `spike_threshold_db` | 8.0 | dB above baseline for spike |
| `spike_sustain_s` | 0.7 | Minimum spike duration |

#### 2. Energy Monologue

Detects sustained high-energy segments (rants, hot takes).

```python
# Algorithm
1. Find regions where rms > percentile_70
2. Check ZCR indicates speech (not music)
3. Require duration ≥ min_duration
```

#### 3. Laughter Burst

Detects clustered energy bursts (comedic moments).

```python
# Algorithm
1. Find burst peaks: rms > baseline + laughter_z_rms * std
2. Cluster bursts within laughter_gap_s
3. Require cluster duration ≥ laughter_min_s
```

**Output Format:**
```json
{
  "candidates": [
    {
      "type": "payoff",
      "peak_time": 125.4,
      "silence_start": 123.0,
      "silence_end": 124.8,
      "spike_rms_db": 12.5,
      "contrast_db": 18.3
    }
  ]
}
```

---

### Stage E: Scoring + Selection

**Input:** `candidates.json`, `features.json`, `transcript.json`  
**Output:** `job_dir/clips.json`

#### Scoring Formula

For each candidate, try multiple clip lengths and pick the best:

```python
clip_lengths = [12, 18, 24, 35]  # seconds

for length in clip_lengths:
    clip = expand_candidate(candidate, length)
    score = compute_score(clip, features, transcript)
    keep best (clip, score)
```

#### Score Components

| Component | Weight | Description |
|-----------|--------|-------------|
| `contrast_score` | 0.30 | Silence-to-spike contrast in dB |
| `density_score` | 0.25 | Words per second from transcript |
| `boundary_score` | 0.20 | Alignment with sentence boundaries |
| `hook_score` | 0.15 | Energy in first 3 seconds |
| `coherence_score` | 0.10 | VAD segment alignment |

**Final Score:**
```python
final_score = sum(component * weight for component, weight in components)
final_score = round(final_score, 1)  # 0-100 scale
```

#### De-duplication

Remove overlapping clips using IOU (Intersection over Union):

```python
def iou(clip_a, clip_b):
    intersection = max(0, min(a.end, b.end) - max(a.start, b.start))
    union = (a.end - a.start) + (b.end - b.start) - intersection
    return intersection / union

# Remove if IOU > 0.6
```

#### Selection

1. Sort by final_score descending
2. Take top N clips
3. Sort output by start time

**Output Format:**
```json
{
  "clips": [
    {
      "id": "clip_001",
      "startTime": 125.0,
      "endTime": 149.5,
      "duration": 24.5,
      "pattern": "payoff",
      "score": 85.2,
      "score_breakdown": {
        "contrast_score": 28.5,
        "density_score": 22.1,
        "boundary_score": 18.0,
        "hook_score": 11.2,
        "coherence_score": 5.4
      },
      "source_candidate": {...}
    }
  ],
  "params": {
    "top_n": 10,
    "clip_lengths_tried": [12, 18, 24, 35],
    "iou_threshold": 0.6
  }
}
```

---

### Stage F: Export

**Input:** `clips.json`, source video  
**Output:** `output_dir/clip_001.mp4`, ...

**FFmpeg Command (Accurate Mode):**
```bash
ffmpeg -i input.mp4 -ss 125.0 -t 24.5 \
  -c:v libx264 -preset fast -crf 23 \
  -c:a aac -b:a 192k \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" \
  clip_001.mp4
```

**FFmpeg Command (Fast Mode):**
```bash
ffmpeg -ss 125.0 -i input.mp4 -t 24.5 -c copy clip_001.mp4
```

---

### Stage G: Caption Burn (Optional)

**Input:** Exported clips, transcript  
**Output:** `output_dir/clip_001_captioned.mp4`, ...

**ASS Caption Format:**
```
[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Style: Default,Arial,72,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,0,2,30,30,50,1

[Events]
Dialogue: 0,0:00:00.00,0:00:00.40,Default,,0,0,0,karaoke,{\k10}Welcome
Dialogue: 0,0:00:00.40,0:00:00.80,Default,,0,0,0,karaoke,{\k8}to
```

**FFmpeg Burn Command:**
```bash
ffmpeg -i clip_001.mp4 -vf "ass=clip_001.ass" clip_001_captioned.mp4
```

---

## Data Flow Diagram

```
┌──────────────┐
│  input.mp4   │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│   audio.wav  │────▶│ transcript   │
└──────┬───────┘     │    .json     │
       │             └──────┬───────┘
       │                    │
       ▼                    │
┌──────────────┐            │
│  features    │◀───────────┘
│    .json     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ candidates   │
│    .json     │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│   clips      │────▶│  clip_001    │
│    .json     │     │    .mp4      │
└──────────────┘     │  clip_002    │
                     │    .mp4      │
                     │     ...      │
                     └──────────────┘
```

---

## IPC Communication

### Renderer → Main

| Channel | Payload | Response |
|---------|---------|----------|
| `start-detection` | `{projectId, filePath, settings}` | `{success, error?}` |
| `cancel-detection` | `{projectId}` | `{success}` |
| `export-clips` | `{sourceFile, clips, outputDir, settings}` | `{success, outputDir}` |
| `select-file` | — | `{path, name, size}` |
| `validate-file` | `{filePath}` | `{valid, duration, format}` |

### Main → Renderer

| Channel | Payload |
|---------|---------|
| `detection-progress` | `{projectId, progress: 0-100, message}` |
| `detection-complete` | `{projectId, clips, deadSpaces, transcript}` |
| `detection-error` | `{projectId, error}` |
| `export-progress` | `{current, total, clipName}` |
| `export-complete` | `{success, outputDir, clipCount}` |

### Python → Main (stdout)

```
PROGRESS:20:Extracting audio...
PROGRESS:50:Detecting candidates...
RESULT:{"clips": [...], "deadSpaces": [...], "transcript": {...}}
ERROR:Failed to extract audio
```

---

## Caching Strategy

Each stage caches its output in `job_dir/`:

| Stage | Cache File | Cache Key |
|-------|------------|-----------|
| A | `audio.wav` | File existence |
| B | `transcript.json` | File existence |
| C | `features.json` | File existence |
| D | `candidates.json` | File existence |
| E | `clips.json` | File existence |

**Force Re-run:** Set `force_rerun: true` in settings.

**Cache Invalidation:** Delete the job directory.

---

## Error Handling

| Error | Behavior |
|-------|----------|
| FFmpeg not found | Error message with install instructions |
| Audio extraction failed | Error message, exit |
| Transcription API failed | Fallback to empty transcript |
| Feature extraction failed | Error message, exit |
| No candidates found | Return empty clips array |
| Export failed | Skip clip, continue with next |

**Principle:** Fail fast for critical errors, graceful degradation for optional stages.

---

## Configuration Reference

### Detection Settings

```json
{
  "mvp_mode": true,
  "job_dir": "/path/to/job",
  "target_count": 10,
  "min_duration": 15,
  "max_duration": 60,
  "skip_intro": 30,
  "skip_outro": 30,
  
  "hop_s": 0.10,
  "rms_window_s": 0.40,
  "baseline_window_s": 20.0,
  "silence_threshold_db": -35,
  "spike_threshold_db": 8.0,
  "spike_sustain_s": 0.7,
  "silence_run_s": 1.2,
  
  "clip_lengths": [12, 18, 24, 35],
  "min_clip_s": 8,
  "max_clip_s": 45,
  "iou_threshold": 0.6,
  
  "openai_api_key": "sk-...",
  "ffmpeg_path": "/usr/local/bin/ffmpeg"
}
```

---

## Determinism Guarantee

For the same input video and settings:

1. **Same audio extraction** — FFmpeg is deterministic
2. **Same transcription** — Whisper API returns consistent results
3. **Same features** — librosa feature extraction is deterministic
4. **Same candidates** — Pattern detection uses fixed thresholds
5. **Same scores** — Scoring formula has no randomness
6. **Same selection** — Sorting is stable, IOU threshold is fixed

**Test:** Run twice, `diff` the outputs. Should be identical.

---

## Performance Benchmarks

| Stage | Time (1hr video) | Notes |
|-------|------------------|-------|
| Audio extraction | ~10s | FFmpeg stream copy |
| Transcription | ~90s | Whisper API |
| Feature extraction | ~20s | librosa on 22kHz mono |
| Candidate detection | ~5s | NumPy vectorized |
| Scoring + selection | ~2s | Pure Python |
| **Total** | ~2-3 min | With transcription |
| **Total** | ~30-60s | Without transcription |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2026-01 | MVP pipeline with stage caching |
| 1.0.0 | 2026-01 | Initial release |
