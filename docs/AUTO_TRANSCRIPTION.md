# ✅ MVP Flow - Transcript Auto-Generation

## What Changed

The UI now correctly reflects the MVP architecture:

### Before (WRONG):
```
Upload video → Upload transcript (REQUIRED) → Start Detection
```

### After (CORRECT):
```
Upload video → Start Detection → Auto-transcribe → Story gates → Clips
```

---

## User Flow

### 1. Upload Video
- Click "Start New Project"
- Select video file
- **That's it** - no transcript required

### 2. Transcript Handling (Automatic)
- Backend auto-transcribes using faster-whisper (local, no API)
- Transcript saved to cache for reuse
- **Optional**: User can override with custom transcript

### 3. Detection Pipeline
```
Stage A: Extract audio (5%)
Stage B: Auto-transcribe (20%)
Stage C: Extract features (35%)
Stage D: Detect candidates (50%)
Stage E: Score clips (70%)
Stage F: Story gates (87%) ⭐ NEW
Complete (95%)
```

### 4. Story Gates Filter
- Each clip analyzed for narrative structure
- Clips without complete stories are dropped
- Survivors have `narrativeConfidence` and `storyComplete` fields

---

## UI Copy Changes

| Location | Old | New |
|----------|-----|-----|
| Modal Header | "Upload video and transcript to begin" | "Upload video to begin • Transcript auto-generated" |
| Transcript Step | "Transcript File (Required)" | "Transcript File (Optional)" |
| Step Icon | Red `2` | Green `⚡` |
| Button Text | "Upload Transcript" | "Override with Custom Transcript" |
| Info Box | "Why Transcript First?" | "✓ Transcript Handling" |
| Home Button | "Upload video + transcript" | "Upload video • Auto-transcribe & analyze" |

---

## Backend Contract

The `detector.py` already handles this correctly:

```python
# Stage B: Transcribe
if transcript_exists_in_cache:
    use_cached_transcript()
elif user_uploaded_transcript:
    use_uploaded_transcript()
else:
    auto_transcribe_with_faster_whisper()  # ← DEFAULT PATH
```

**No backend changes needed** - it was already correct.

---

## Testing

### Quick Test (Without UI)
```bash
cd C:\Users\Sean\Desktop\git\clipbot
python scripts/run_podcast_test.py --example -v
```

### Full Test (With UI)
1. Launch app: `npm start` from `podflow-studio/`
2. Upload video (NO transcript)
3. Click "Start Detection"
4. Watch progress: you'll see "Stage B: No transcript found, using local Whisper model..."
5. Review clips - look for `narrativeConfidence` field

---

## Dependencies

Added to `requirements.txt`:
```
faster-whisper>=0.10.0  # For auto-transcription
```

Installed:
```bash
pip install faster-whisper
```

---

## What the User Sees Now

### Modal Dialog
✅ Video selected
⚡ Transcript (Optional) - "Auto-generated unless you provide one"
✓ Transcript Handling
- Auto-transcribed during detection
- Upload one only if you want to override
- No API keys required to preview results

[Cancel] [Start Detection] ← **Now enabled with just video**

---

## Philosophy Lock-In

> "Transcript is infrastructure, not a prerequisite"

- Users don't paste ASTs into Cursor
- Users don't upload SRTs to ClipBot
- The system handles it invisibly
- Override is available but buried

This removes friction and builds trust.
