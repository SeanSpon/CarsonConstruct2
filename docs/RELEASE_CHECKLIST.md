# Release Checklist - PodFlow/Clipper Studio

Use this checklist before every release to ensure quality and reliability.

---

## Pre-Merge Checks

### Code Quality
- [ ] All lint errors resolved (`npm run lint` in both apps)
- [ ] No TypeScript errors
- [ ] No console.error calls in production code (except error handlers)
- [ ] Python tests pass (`cd src/python && python -m unittest discover -s tests`)

### Dependencies
- [ ] No security vulnerabilities (`npm audit`)
- [ ] Python requirements.txt up to date
- [ ] No unused dependencies

---

## Functional Smoke Tests

Run these tests on **at least 2 different MP4 files** (short <5min, long >30min).

### Detection Pipeline
- [ ] Detection starts without error
- [ ] Progress bar updates smoothly (no spam, no stalls)
- [ ] Detection completes with clips found
- [ ] Clip boundaries don't cut mid-word (listen to first/last 2 seconds)
- [ ] Score breakdown shows in UI when expanded
- [ ] Re-analyze button works

### AI Enhancement (Optional)
- [ ] Works when OPENAI_API_KEY is set
- [ ] Gracefully skips when key is missing (no error, no crash)
- [ ] Titles generated are relevant (not generic)
- [ ] Second run uses cached results (if caching implemented)

### Export Pipeline
- [ ] Fast mode exports clips
- [ ] Accurate mode exports clips
- [ ] Exported files play in:
  - [ ] VLC
  - [ ] QuickTime (macOS)
  - [ ] Windows Media Player (Windows)
- [ ] File duration matches expected (within 1 second)
- [ ] No audio/video sync issues
- [ ] Metadata JSON exported alongside clips
- [ ] Full video with dead space removal works (if using auto-edit)

### Error Handling
- [ ] Invalid file shows clear error (not crash)
- [ ] Canceling detection doesn't leave zombie processes
- [ ] Network error during AI shows retry option
- [ ] Export failure shows which clip failed

### UI/UX
- [ ] All pages load without white screen
- [ ] Navigation between pages works
- [ ] Settings persist after restart
- [ ] Recent projects list updates
- [ ] Dark theme renders correctly
- [ ] No layout shifts during loading

---

## Performance Benchmarks

### Detection Speed
| Video Duration | Target Time | Actual |
|----------------|-------------|--------|
| 5 minutes      | <15 seconds |        |
| 30 minutes     | <45 seconds |        |
| 60 minutes     | <90 seconds |        |

### Memory Usage
- [ ] Peak memory stays under 1GB for 1-hour video
- [ ] Memory releases after detection completes

### Export Speed (Fast Mode)
| Clip Count | Target Time | Actual |
|------------|-------------|--------|
| 5 clips    | <10 seconds |        |
| 10 clips   | <20 seconds |        |

---

## Release Artifacts

### Required Files
- [ ] `demo/input/` - Sample input MP4 (short, royalty-free)
- [ ] `demo/output/` - Exported clips from sample
- [ ] `demo/metadata.json` - Detection results JSON
- [ ] `docs/KNOWN_LIMITATIONS.md` - Honest list of what doesn't work yet

### Optional but Recommended
- [ ] Screen recording of full workflow (upload to YouTube/Loom)
- [ ] Eval report (`python tools/eval/run_eval.py --dataset data/sample.json`)

---

## Platform-Specific Tests

### Windows
- [ ] App starts without "DLL not found" errors
- [ ] File dialogs open correctly
- [ ] Paths with spaces work
- [ ] FFmpeg subprocess runs

### macOS
- [ ] App passes Gatekeeper (signed or instructions to bypass)
- [ ] Apple Silicon (M1/M2) works
- [ ] Microphone/file permissions handled

### Linux
- [ ] AppImage runs on Ubuntu 22.04+
- [ ] GTK file dialogs work
- [ ] FFmpeg found in PATH

---

## Final Sign-Off

| Check | Verified By | Date |
|-------|-------------|------|
| Code review complete | | |
| Smoke tests pass | | |
| Demo pack created | | |
| Release notes written | | |

---

## Known Limitations (Current)

Document these honestly in release notes:

1. **Python/FFmpeg Required:** User must install manually
2. **No Auto-Updates:** Manual download for updates
3. **Fast Mode Drift:** May cut slightly off boundary
4. **AI Costs:** ~$0.50 per video with AI enabled
5. **No Diarization:** Can't filter by speaker yet

---

## Post-Release Monitoring

After release, monitor for:
- [ ] GitHub Issues for crash reports
- [ ] User feedback on clip quality
- [ ] Common installation problems
- [ ] Performance issues on low-end machines
