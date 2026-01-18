# Known Limitations - PodFlow/Clipper Studio MVP

**Version:** 1.0 (Early Access)  
**Last Updated:** 2026-01-18

---

## Installation Requirements

### Python & FFmpeg Required

This is a desktop application that requires Python and FFmpeg to be installed on your system.

**Required Software:**
- Python 3.9+ with pip
- FFmpeg 4.0+ (must be in system PATH)

**Installation:**
```bash
# Install Python dependencies
cd podflow-studio/src/python
pip install -r requirements.txt

# Verify FFmpeg is installed
ffmpeg -version
```

> **Note:** Future versions will bundle Python and FFmpeg. For now, manual installation is required.

---

## Detection Limitations

### Audio Quality Dependencies

- **Noisy audio:** May produce false positives (speech gate helps but isn't perfect)
- **Heavy music:** Music segments may be incorrectly flagged as clips
- **Multi-speaker overlap:** Detection works best with clear speaker separation

### Pattern Detection Accuracy

- **Payoff detection:** Works best when silence is followed by clear energy spike
- **Monologue detection:** May miss soft-spoken passionate segments
- **Laughter detection:** Works best with distinct laughter bursts (not chuckles)
- **Debate detection:** Requires clear speaker alternation

### Boundary Precision

- VAD snapping attempts to align clip boundaries to speech edges
- May occasionally cut mid-word in fast speech sections
- Trim controls allow manual adjustment in UI

---

## AI Enhancement Limitations

### API Key Required

AI enhancement requires an OpenAI API key. Without it:
- Clips still detected algorithmically
- Titles auto-generated from pattern type
- No semantic analysis

### Cost

- **Whisper transcription:** ~$0.36 per hour of audio
- **GPT-4o-mini enhancement:** ~$0.02 per 10 clips
- **Total:** ~$0.50 per typical podcast episode

### File Size Limit

- Whisper API has 25MB audio file limit
- Long podcasts (>2 hours) may fail transcription
- Clips still detected; only AI titles affected

---

## Export Limitations

### Fast Mode (Stream Copy)

- Uses keyframe-aligned cuts
- Boundaries may drift by a few frames
- Best for quick previews

### Accurate Mode (Re-encode)

- Frame-perfect cuts
- Takes 3-5x longer than fast mode
- Recommended for final exports

### No Export Verification

- Exports are not automatically verified for playability
- Rare: Corrupt files possible if process interrupted
- Recommendation: Verify exports before publishing

---

## Platform Limitations

### Windows

- Long file paths may cause issues (>260 characters)
- Recommend short output folder names

### macOS

- Apple Silicon (M1/M2) requires Rosetta for some Python packages
- Gatekeeper may block unsigned app (right-click → Open)

### Linux

- GTK required for file dialogs
- AppImage format requires FUSE

---

## What This Version Does NOT Do

1. **No Speaker Diarization** - Cannot filter clips by speaker
2. **No Batch Processing** - One video at a time
3. **No Auto-Updates** - Manual download for updates
4. **No Cloud Sync** - All processing is local
5. **No Video Preview** - No in-app playback (use external player)
6. **No Thumbnail Generation** - Export clips only, no thumbnails
7. **No Social Media Upload** - Manual upload required

---

## Planned Improvements

These limitations are being addressed in future versions:

- [ ] Bundled Python/FFmpeg (no manual install)
- [ ] Export verification
- [ ] Batch processing
- [ ] In-app video preview
- [ ] Auto-updates
- [ ] Speaker diarization

---

## Reporting Issues

If you encounter a bug or unexpected behavior:

1. Note the exact steps to reproduce
2. Include the video file format and duration
3. Check console logs for error messages
4. Report via GitHub Issues

---

*This document reflects the current state of the MVP. Limitations are documented honestly to set appropriate expectations for early access users.*
