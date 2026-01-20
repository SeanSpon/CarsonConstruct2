---
name: MVP Pipeline Implementation
overview: Implement the deterministic MVP clip detection pipeline with exact scoring formulas, 9:16 vertical export, and caption burning. Includes precise contracts for candidates.json, clips.json, speech density, IoU de-dupe, stage resume, and caption wrapping.
todos:
  - id: mvp-features
    content: Update features.py with MVP parameters (0.10s hop, dB conversion, 20s baseline, speech_mask from transcript)
    status: completed
  - id: mvp-scoring
    content: Create mvp_scoring.py with exact scoring formula and clip window proposer
    status: completed
  - id: mvp-candidates
    content: Implement candidate event generation with exact schema contract
    status: completed
  - id: iou-dedupe
    content: Implement global IoU-based de-duplication with exact formula
    status: completed
  - id: detector-mvp
    content: Update detector.py with MVP mode, stage resume/skip logic, output files
    status: completed
  - id: vertical-export
    content: Add resolution-agnostic 9:16 center crop export
    status: completed
  - id: ass-captions
    content: Generate ASS subtitles with 2-line max, word wrapping, bottom-third style
    status: completed
  - id: caption-burn
    content: Add FFmpeg ASS caption burning pipeline
    status: completed
  - id: settings-types
    content: Add MVP export settings types to renderer types
    status: completed
  - id: ui-integration
    content: Add UI controls for MVP mode and vertical export settings
    status: completed
---

# MVP Pipeline Implementation Plan

## Current State Analysis

The existing codebase already has:

- Job system with stage tracking ([`podflow-studio/src/main/jobs/jobStore.ts`](podflow-studio/src/main/jobs/jobStore.ts))
- Detection pipeline with audio extraction, transcription, pattern detection ([`podflow-studio/src/python/detector.py`](podflow-studio/src/python/detector.py))
- Pattern detectors: payoff, monologue, laughter, silence ([`podflow-studio/src/python/patterns/`](podflow-studio/src/python/patterns/))
- Audio feature extraction ([`podflow-studio/src/python/features.py`](podflow-studio/src/python/features.py))
- Scoring and de-duplication ([`podflow-studio/src/python/utils/scoring.py`](podflow-studio/src/python/utils/scoring.py))
- FFmpeg export handlers ([`podflow-studio/src/main/ipc/exportHandlers.ts`](podflow-studio/src/main/ipc/exportHandlers.ts))

---

## Precise Contracts and Schemas

### 1. Speech Density: Transcript Coverage Method

**Truth source:** Whisper transcript segments (already in `transcript.json`)

```python
def build_speech_mask_from_transcript(
    times: np.ndarray,
    transcript: dict
) -> np.ndarray:
    """
    speech_flag(t) = 1 if t falls inside any Whisper segment
    """
    mask = np.zeros(len(times), dtype=bool)
    segments = transcript.get("segments", [])
    for seg in segments:
        seg_start, seg_end = seg["start"], seg["end"]
        mask |= (times >= seg_start) & (times <= seg_end)
    return mask
```

**Persist in `features.json`:**

```json
{
  "hop": 0.1,
  "frames": [
    {"t": 530.0, "rms_db": -18.2, "z_rms": 2.1, "silence": false, "speech": true},
    ...
  ],
  "speech_mask": [true, true, false, ...],
  "duration": 3842.5
}
```

### 2. Candidate Event Schema (`candidates.json`)

Each detector outputs candidates with this exact contract:

```json
{
  "candidates": [
    {
      "type": "energy_spike",
      "t_peak": 542.3,
      "start": 539.8,
      "end": 546.2,
      "meta": {
        "baseline_db": -24.1,
        "peak_db": -11.3,
        "sustained_s": 1.2
      }
    },
    {
      "type": "silence_to_spike",
      "t_peak": 612.7,
      "start": 608.0,
      "end": 618.4,
      "meta": {
        "silence_start": 606.8,
        "silence_end": 610.2,
        "silence_len": 3.4,
        "peak_db": -9.8,
        "baseline_db": -22.1
      }
    },
    {
      "type": "laughter_like",
      "t_peak": 789.2,
      "start": 785.5,
      "end": 794.1,
      "meta": {
        "burst_count": 5,
        "total_burst_s": 2.8
      }
    }
  ]
}
```

**Candidate types:** `energy_spike`, `silence_to_spike`, `laughter_like`

### 3. Final Clip Schema (`clips.json`)

```json
{
  "clips": [
    {
      "clip_id": "clip_001",
      "start": 530.2,
      "end": 552.9,
      "duration": 22.7,
      "score": 87.4,
      "score_breakdown": {
        "energy_lift": 28.5,
        "peak_strength": 22.0,
        "speech_density": 18.0,
        "contrast_bonus": 12.0,
        "length_penalty": 0.0
      },
      "reasons": [
        "energy_lift +9.4dB",
        "speech_density 0.78",
        "contrast 1.4s silence"
      ],
      "source_candidate": {
        "type": "silence_to_spike",
        "t_peak": 542.3
      },
      "snapped": true,
      "snap_reason": "end_to_sentence"
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

## Deterministic Rules

### 4. Exact Scoring Formula

```python
def score_clip(
    clip_start: float,
    clip_end: float,
    candidate: dict,
    features: dict,
    transcript: dict
) -> tuple[float, dict]:
    """
    Returns (score, breakdown) where score is 0-100.
    """
    times = features["times"]
    rms_db = features["rms_db"]
    baseline_db = features["baseline_db"]
    speech_mask = features["speech_mask"]
    
    # Slice to clip window
    clip_mask = (times >= clip_start) & (times <= clip_end)
    clip_rms_db = rms_db[clip_mask]
    clip_baseline = baseline_db[clip_mask]
    clip_speech = speech_mask[clip_mask]
    
    # 1. Energy lift (0-35 pts)
    # Compare median in clip vs median in prev 20s
    prev_start = max(0, clip_start - 20.0)
    prev_mask = (times >= prev_start) & (times < clip_start)
    prev_median_db = np.median(rms_db[prev_mask]) if prev_mask.any() else -40.0
    clip_median_db = np.median(clip_rms_db) if len(clip_rms_db) else -40.0
    lift_db = clip_median_db - prev_median_db
    energy_lift = np.clip(lift_db / 10.0 * 35.0, 0, 35)
    
    # 2. Peak strength (0-25 pts)
    # Max dB in clip minus baseline at that point
    if len(clip_rms_db):
        peak_idx = np.argmax(clip_rms_db)
        peak_delta = clip_rms_db[peak_idx] - clip_baseline[peak_idx]
    else:
        peak_delta = 0
    # +8 dB -> 10 pts, +14 dB -> 25 pts
    peak_strength = np.clip((peak_delta - 8) / 6 * 15 + 10, 0, 25)
    
    # 3. Speech density (0-20 pts)
    speech_ratio = np.mean(clip_speech) if len(clip_speech) else 0
    # 60%+ -> full points, <30% -> near zero
    if speech_ratio >= 0.6:
        speech_pts = 20.0
    elif speech_ratio < 0.3:
        speech_pts = speech_ratio / 0.3 * 5.0
    else:
        speech_pts = 5.0 + (speech_ratio - 0.3) / 0.3 * 15.0
    
    # 4. Contrast bonus (0-15 pts) - only for silence_to_spike
    contrast_bonus = 0.0
    if candidate["type"] == "silence_to_spike":
        silence_len = candidate["meta"].get("silence_len", 0)
        # 1.2s -> 10 pts, 2.5s+ -> 15 pts
        contrast_bonus = np.clip((silence_len - 1.2) / 1.3 * 5 + 10, 10, 15)
    
    # 5. Length penalty (0 to -10 pts)
    duration = clip_end - clip_start
    if duration < 10:
        length_penalty = -6
    elif duration > 40:
        length_penalty = -6
    elif 15 <= duration <= 30:
        length_penalty = 0
    elif duration < 15:
        length_penalty = -(15 - duration) / 5 * 6
    else:  # 30 < duration <= 40
        length_penalty = -(duration - 30) / 10 * 6
    
    score = energy_lift + peak_strength + speech_pts + contrast_bonus + length_penalty
    score = np.clip(score, 0, 100)
    
    breakdown = {
        "energy_lift": round(energy_lift, 1),
        "peak_strength": round(peak_strength, 1),
        "speech_density": round(speech_pts, 1),
        "contrast_bonus": round(contrast_bonus, 1),
        "length_penalty": round(length_penalty, 1),
        "speech_ratio": round(speech_ratio, 2),
        "lift_db": round(lift_db, 1)
    }
    
    return round(score, 1), breakdown
```

### 5. Clip Window Proposer

```python
def propose_clip_windows(
    candidate: dict,
    transcript: dict,
    duration: float,
    clip_lengths: list = [12, 18, 24, 35],
    min_clip: float = 8,
    max_clip: float = 45
) -> list[tuple[float, float]]:
    """
    Generate candidate clip windows around peak, snapped to sentence boundaries.
    """
    t_peak = candidate["t_peak"]
    center = t_peak + 1.0  # Bias slightly after peak for payoff
    
    proposals = []
    for L in clip_lengths:
        raw_start = center - L * 0.45
        raw_end = center + L * 0.55
        
        # Snap to transcript boundaries
        snapped_start = snap_to_segment_boundary(
            raw_start, transcript, direction="backward", max_adjust=2.0
        )
        snapped_end = snap_to_segment_boundary(
            raw_end, transcript, direction="forward", max_adjust=2.0
        )
        
        # Apply padding
        snapped_start = max(0, snapped_start - 0.6)
        snapped_end = min(duration, snapped_end + 0.8)
        
        # Clamp to min/max
        clip_duration = snapped_end - snapped_start
        if clip_duration < min_clip:
            continue
        if clip_duration > max_clip:
            snapped_end = snapped_start + max_clip
        
        proposals.append((snapped_start, snapped_end))
    
    return proposals


def snap_to_segment_boundary(
    target_time: float,
    transcript: dict,
    direction: str,  # "backward" or "forward"
    max_adjust: float = 2.0
) -> float:
    """
    Snap to nearest transcript segment boundary within max_adjust seconds.
    """
    segments = transcript.get("segments", [])
    if not segments:
        return target_time
    
    best = target_time
    best_dist = max_adjust + 1
    
    for seg in segments:
        if direction == "backward":
            # Prefer segment starts before target
            boundary = seg["start"]
            if boundary <= target_time:
                dist = target_time - boundary
                if dist <= max_adjust and dist < best_dist:
                    best = boundary
                    best_dist = dist
        else:  # forward
            # Prefer segment ends after target
            boundary = seg["end"]
            if boundary >= target_time:
                dist = boundary - target_time
                if dist <= max_adjust and dist < best_dist:
                    best = boundary
                    best_dist = dist
    
    return best
```

### 6. IoU De-duplication (Global, Exact Formula)

```python
def compute_iou(a_start: float, a_end: float, b_start: float, b_end: float) -> float:
    """
    Intersection over Union for two time intervals.
    """
    intersection = max(0, min(a_end, b_end) - max(a_start, b_start))
    union = (a_end - a_start) + (b_end - b_start) - intersection
    if union <= 0:
        return 0.0
    return intersection / union


def nms_clips(
    clips: list[dict],
    iou_threshold: float = 0.6
) -> list[dict]:
    """
    Non-max suppression: sort by score desc, reject overlapping clips.
    Global de-dupe (all candidate types together).
    """
    sorted_clips = sorted(clips, key=lambda c: c["score"], reverse=True)
    kept = []
    
    for clip in sorted_clips:
        dominated = False
        for existing in kept:
            iou = compute_iou(
                clip["start"], clip["end"],
                existing["start"], existing["end"]
            )
            if iou >= iou_threshold:
                dominated = True
                break
        if not dominated:
            kept.append(clip)
    
    return kept
```

**Selection order:**

1. Score ALL proposed windows from ALL candidates
2. NMS/IoU prune globally
3. THEN take top_n

### 7. Stage Resume/Skip Logic

```python
def should_skip_stage(output_path: str, force: bool = False) -> bool:
    """Check if stage output exists and should be skipped."""
    if force:
        return False
    return os.path.exists(output_path) and os.path.getsize(output_path) > 0


# In main pipeline:
def run_mvp_pipeline(job_dir: str, input_path: str, settings: dict):
    audio_path = os.path.join(job_dir, "audio.wav")
    features_path = os.path.join(job_dir, "features.json")
    transcript_path = os.path.join(job_dir, "transcript.json")
    candidates_path = os.path.join(job_dir, "candidates.json")
    clips_path = os.path.join(job_dir, "clips.json")
    force = settings.get("force_rerun", False)
    
    # Stage A: Extract audio
    if not should_skip_stage(audio_path, force):
        extract_audio(input_path, audio_path)
    
    # Stage B: Transcribe
    if not should_skip_stage(transcript_path, force):
        transcript = transcribe_with_whisper(audio_path, settings["openai_api_key"])
        write_json(transcript_path, transcript)
    else:
        transcript = read_json(transcript_path)
    
    # Stage C: Compute features (includes speech_mask from transcript)
    if not should_skip_stage(features_path, force):
        features = compute_mvp_features(audio_path, transcript)
        write_json(features_path, features)
    else:
        features = read_json(features_path)
    
    # Stage D: Detect candidates
    if not should_skip_stage(candidates_path, force):
        candidates = detect_all_candidates(features, settings)
        write_json(candidates_path, {"candidates": candidates})
    else:
        candidates = read_json(candidates_path)["candidates"]
    
    # Stage E: Score + de-dupe
    # Always rerun if settings change (could add settings hash check)
    clips = score_and_select_clips(candidates, features, transcript, settings)
    write_json(clips_path, {"clips": clips, "params": settings})
    
    return clips
```

---

## Resolution-Agnostic Vertical Crop

```typescript
// In exportHandlers.ts

function getVerticalCropFilter(inputWidth: number, inputHeight: number): string {
  // Target: 1080x1920 (9:16)
  const targetWidth = 1080;
  const targetHeight = 1920;
  
  // Method: scale to target height first, then center crop width
  // This handles any input resolution correctly
  
  // Calculate crop width at native height
  const cropWidth = Math.round(inputHeight * 9 / 16);
  const cropX = Math.round((inputWidth - cropWidth) / 2);
  
  // Filter chain:
  // 1. Crop to 9:16 at native resolution (centered)
  // 2. Scale to target 1080x1920
  return `crop=${cropWidth}:${inputHeight}:${cropX}:0,scale=${targetWidth}:${targetHeight}`;
}
```

---

## ASS Captions (2-Line Max, Word Wrap)

### ASS File Generation

```python
def generate_ass_captions(
    transcript: dict,
    clip_start: float,
    clip_end: float,
    output_path: str,
    max_chars_per_line: int = 32,
    max_lines: int = 2
) -> None:
    """
    Generate ASS subtitle file for clip with:
    - Bottom-third positioning
    - 2-line max with word wrapping
    - Big font with stroke/shadow
    """
    # ASS header
    ass_header = """[Script Info]
Title: Clip Captions
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial Black,72,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,2,40,40,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    
    events = []
    segments = transcript.get("segments", [])
    
    for seg in segments:
        seg_start = seg["start"]
        seg_end = seg["end"]
        
        # Skip segments outside clip
        if seg_end < clip_start or seg_start > clip_end:
            continue
        
        # Adjust times relative to clip
        rel_start = max(0, seg_start - clip_start)
        rel_end = min(clip_end - clip_start, seg_end - clip_start)
        
        # Wrap text to max_chars_per_line, max 2 lines
        text = seg["text"].strip()
        wrapped = wrap_text(text, max_chars_per_line, max_lines)
        
        # Format times as H:MM:SS.cc
        start_str = format_ass_time(rel_start)
        end_str = format_ass_time(rel_end)
        
        # ASS uses \N for line breaks
        ass_text = wrapped.replace("\n", "\\N")
        
        events.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{ass_text}")
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(ass_header)
        f.write("\n".join(events))


def wrap_text(text: str, max_chars: int, max_lines: int) -> str:
    """Word-wrap text to max_chars per line, max max_lines lines."""
    words = text.split()
    lines = []
    current_line = []
    current_len = 0
    
    for word in words:
        word_len = len(word)
        if current_len + word_len + (1 if current_line else 0) > max_chars:
            if current_line:
                lines.append(" ".join(current_line))
                if len(lines) >= max_lines:
                    break
            current_line = [word]
            current_len = word_len
        else:
            current_line.append(word)
            current_len += word_len + (1 if len(current_line) > 1 else 0)
    
    if current_line and len(lines) < max_lines:
        lines.append(" ".join(current_line))
    
    return "\n".join(lines)


def format_ass_time(seconds: float) -> str:
    """Format seconds as H:MM:SS.cc for ASS."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds % 1) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"
```

### FFmpeg Caption Burn Command

```typescript
// In exportHandlers.ts

async function exportClipWithCaptions(
  sourceFile: string,
  outputFile: string,
  clipStart: number,
  clipEnd: number,
  assFile: string,
  inputWidth: number,
  inputHeight: number
): Promise<void> {
  const duration = clipEnd - clipStart;
  const cropFilter = getVerticalCropFilter(inputWidth, inputHeight);
  
  // Chain: crop -> scale -> burn captions
  const filterComplex = `${cropFilter},ass=${assFile.replace(/\\/g, '/')}`;
  
  const args = [
    '-y',
    '-ss', clipStart.toString(),
    '-i', sourceFile,
    '-t', duration.toString(),
    '-vf', filterComplex,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '192k',
    outputFile
  ];
  
  await runFFmpeg(args);
}
```

---

## MVP Default Parameters (Complete)

```python
MVP_DEFAULTS = {
    # Feature extraction
    "hop_s": 0.10,                   # 10 fps feature timeline
    "rms_window_s": 0.40,            # RMS smoothing window
    "baseline_window_s": 20.0,       # Median baseline window
    
    # Detection thresholds
    "silence_threshold_db": -35,     # Absolute silence threshold
    "spike_threshold_db": 8.0,       # dB over baseline for spike
    "spike_sustain_s": 0.7,          # Minimum spike duration
    "silence_run_s": 1.2,            # Silence before contrast event
    "contrast_window_s": 2.0,        # Window after silence for spike
    "laughter_z_rms": 1.5,           # Z-score for laughter bursts
    "laughter_gap_s": 0.3,           # Max gap between bursts
    "laughter_min_s": 1.0,           # Min total burst duration
    
    # Clip selection
    "clip_lengths": [12, 18, 24, 35], # Lengths to try (seconds)
    "min_clip_s": 8,
    "max_clip_s": 45,
    "snap_window_s": 2.0,            # Max sentence boundary snap
    "start_padding_s": 0.6,          # Padding before clip start
    "end_padding_s": 0.8,            # Padding after clip end
    
    # De-duplication
    "iou_threshold": 0.6,            # Overlap rejection threshold
    "top_n": 10,                     # Final clip count
    
    # Captions
    "caption_max_chars": 32,         # Chars per line
    "caption_max_lines": 2,          # Max lines per caption
    "caption_font_size": 72,         # ASS font size
}
```

---

## Key Files to Modify

- `podflow-studio/src/python/features.py` - Add dB conversion, speech_mask from transcript
- `podflow-studio/src/python/utils/mvp_scoring.py` - New file: scoring + window proposer
- `podflow-studio/src/python/utils/mvp_candidates.py` - New file: candidate generation with schema
- `podflow-studio/src/python/utils/scoring.py` - Add IoU de-duplication
- `podflow-studio/src/python/detector.py` - Add MVP mode, stage resume, output files
- `podflow-studio/src/python/utils/ass_captions.py` - New file: ASS generation
- `podflow-studio/src/main/ipc/exportHandlers.ts` - Add vertical crop, ASS burn
- `podflow-studio/src/renderer/types/index.ts` - Add MVP export settings types
- `podflow-studio/src/renderer/stores/store.ts` - Add MVP settings state

---

## Implementation Order

### Phase 1: Python Detection Core

1. Update `features.py` with MVP parameters + speech_mask from transcript
2. Create `mvp_candidates.py` with exact schema
3. Create `mvp_scoring.py` with scoring formula + window proposer
4. Add IoU de-dupe to `scoring.py`
5. Update `detector.py` with MVP mode + stage resume

### Phase 2: Caption Pipeline

6. Create `ass_captions.py` with wrapping logic
7. Add ASS generation to export pipeline

### Phase 3: Export Pipeline

8. Add resolution-agnostic 9:16 crop to `exportHandlers.ts`
9. Add ASS burn to FFmpeg pipeline
10. Wire up full `clips/clip_XXX_captioned.mp4` output

### Phase 4: IPC and UI

11. Add MVP mode to detection settings
12. Update IPC handlers for new export options
13. Add UI for MVP mode and vertical export