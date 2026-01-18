# Known Limitations - PodFlow Studio MVP

Last updated: 2026-01-18

This document honestly lists current limitations. We believe in transparency with users.

---

## Installation & Setup

### 1. Python & FFmpeg Required (Manual Install)
- **Issue**: User must install Python 3.9+ and FFmpeg manually
- **Impact**: Non-technical users may struggle with setup
- **Workaround**: Follow installation docs carefully
- **Planned Fix**: Bundle Python/FFmpeg in future releases

### 2. No Auto-Updates
- **Issue**: App does not check for or install updates automatically
- **Impact**: Users must manually download new versions
- **Workaround**: Check GitHub releases periodically

---

## Detection

### 3. Processing Time Varies
- **Issue**: 1-2 hour videos may take 1-3 minutes depending on system specs
- **Impact**: Slower machines may see longer wait times
- **Workaround**: Use a machine with 8GB+ RAM and SSD

### 4. Pattern Detection Accuracy
- **Issue**: Algorithm-based detection is ~75-85% accurate for viral potential
- **Impact**: Some suggested clips may not be ideal; some good clips may be missed
- **Workaround**: Review all candidates; use Accept/Reject to curate

### 5. No Speaker Diarization
- **Issue**: Cannot filter clips by specific speaker
- **Impact**: Multi-host podcasts require manual review to find specific host's moments
- **Workaround**: Use transcript search or review clips manually

---

## AI Enhancement

### 6. API Key Required for AI Features
- **Issue**: Whisper transcription and GPT title generation require OpenAI API key
- **Impact**: Without API key, AI features are skipped (app still works)
- **Workaround**: Get API key from platform.openai.com or use algorithm-only mode

### 7. AI Costs ~$0.50/video
- **Issue**: Each video with AI enhancement costs approximately $0.40-$0.60
- **Impact**: High-volume users may incur significant costs
- **Workaround**: Disable AI for bulk processing; enable only for final polish

### 8. Invalid API Keys
- **Issue**: Malformed or expired API keys may cause unclear errors
- **Impact**: User may not immediately understand why AI features failed
- **Workaround**: Verify API key at platform.openai.com; check for trailing spaces

---

## Export

### 9. Fast Mode Frame Drift
- **Issue**: Fast export mode (stream copy) aligns to keyframes, causing up to ~500ms boundary drift
- **Impact**: Clip start/end may be slightly off from what was trimmed
- **Workaround**: Use "Accurate" mode for final exports requiring precise cuts

### 10. Large File Exports
- **Issue**: Exporting full videos >2GB may be slow or fail on low-memory systems
- **Impact**: Memory pressure during concat filter processing
- **Workaround**: Close other apps; ensure 16GB+ RAM for very long videos

### 11. Codec Compatibility
- **Issue**: Some uncommon video codecs may not be detected or exported correctly
- **Impact**: Files with unusual codecs may fail to process
- **Workaround**: Convert source to H.264 MP4 before processing

---

## UI/UX

### 12. No In-App Video Preview
- **Issue**: Cannot play clips inside the app to preview before accepting
- **Impact**: User must export or use external player to verify clip quality
- **Workaround**: Use VLC or QuickTime to preview source file at timestamps

### 13. No Keyboard Shortcuts
- **Issue**: No keyboard navigation for power users (j/k for nav, a/r for accept/reject)
- **Impact**: Mouse-only workflow is slower for bulk curation
- **Workaround**: Use mouse; shortcuts planned for future release

### 14. No Undo for Bulk Actions
- **Issue**: "Remove All" dead spaces cannot be undone in one click
- **Impact**: Accidental bulk actions require manually re-toggling each item
- **Workaround**: Be careful with bulk buttons; re-run detection if needed

---

## Out of Scope (Not Bugs)

These are intentionally not included in the MVP:

- **Captions/Subtitles**: Not supported
- **B-roll insertion**: Not supported  
- **Social media posting**: Not supported
- **Batch processing**: Not supported (one video at a time)
- **Cloud processing**: All processing is local

---

## Reporting Issues

If you encounter issues not listed here:

1. Check that Python and FFmpeg are correctly installed
2. Try re-running detection with different settings
3. Open an issue on GitHub with:
   - Your OS version
   - Video file details (codec, duration, size)
   - Error message (if any)
   - Steps to reproduce
