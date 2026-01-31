# Reviewer Guide — MVP Podcast Clip Pipeline

> **Please review this repo as a tool, not a platform.**
>
> The goal is **reliability, determinism, and creator trust** — not feature breadth.

---

## What This Is

A deterministic pipeline that converts long-form podcast video into short vertical clips with captions and clean cuts.

**MVP is complete when:**
1. One command produces postable clips
2. Captions are readable and synced
3. Review/export loop works end-to-end
4. A creator can ship without touching an editor

---

## Quick Start for Reviewers

```bash
# 1. Install dependencies
cd podflow-studio
npm install
cd src/python && pip install -r requirements.txt

# 2. Run smoke tests (no video needed)
cd ../../..
python tools/smoke_test.py

# 3. Run unit tests
cd podflow-studio/src/python
python -m unittest discover -s tests

# 4. Run the app
cd ../..
npm start
```

---

## Test Checks

### A) Pipeline Smoke Test

```bash
python tools/smoke_test.py
```

**Expected:**
- All tests pass
- No import errors
- Feature extraction works
- Candidate detection works
- Scoring is deterministic

**With video:**
```bash
python tools/smoke_test.py --video /path/to/podcast.mp4
```

---

### B) Determinism Test

Run the detector twice with the same input:

```bash
cd podflow-studio/src/python

# Run 1
python detector.py /path/to/video.mp4 '{"mvp_mode": true, "job_dir": "/tmp/test1"}' > /tmp/run1.txt

# Run 2
python detector.py /path/to/video.mp4 '{"mvp_mode": true, "job_dir": "/tmp/test2"}' > /tmp/run2.txt

# Compare (ignore progress messages, compare RESULT lines)
grep "^RESULT:" /tmp/run1.txt > /tmp/result1.json
grep "^RESULT:" /tmp/run2.txt > /tmp/result2.json
diff /tmp/result1.json /tmp/result2.json
```

**Expected:**
- Same clip timestamps
- Same scores
- Same score breakdowns
- `diff` shows no differences

---

### C) Caption Integrity Test

1. Export a clip with captions enabled
2. Open in video player
3. Check:
   - [ ] No overlapping subtitles
   - [ ] No mid-word cuts
   - [ ] Words highlight in sync with audio
   - [ ] Text is readable (size, contrast)

---

### D) UI Contract Test

1. Launch the app (`npm start`)
2. Test the workflow:

| Step | Action | Expected |
|------|--------|----------|
| 1 | Drop video file | Video appears in preview |
| 2 | Click "Analyze" | Progress bar shows, clips appear |
| 3 | Click a clip | Clip is selected, preview shows segment |
| 4 | Press `A` key | Clip marked as accepted |
| 5 | Press `R` key | Clip marked as rejected |
| 6 | Click "Export" | Export dialog opens |
| 7 | Export clips | Files created, folder opens |

**Checklist:**
- [ ] Can complete workflow without reading docs?
- [ ] Max 2 decisions per clip?
- [ ] No hidden settings required?
- [ ] Clear feedback for all actions?

---

### E) Python Unit Tests

```bash
cd podflow-studio/src/python
python -m unittest discover -s tests -v
```

**Expected:** All tests pass

**Test coverage:**
- `test_ai_cache.py` - AI caching
- `test_ai_fallbacks.py` - Graceful degradation
- `test_ai_schemas.py` - Schema validation
- `test_baseline.py` - Rolling baselines
- `test_gating.py` - Speech gates
- `test_vad_utils.py` - VAD utilities

---

### F) Eval Harness

```bash
python tools/eval/run_eval.py --dataset data/sample.json --k 10
```

**Expected:**
- Precision@10 metric computed
- Report generated to `tools/eval/report.json`

---

## Code Review Checklist

### Architecture

- [ ] Python pipeline is independent of UI (no renderer imports)
- [ ] Each stage has clear input/output
- [ ] No hidden side effects
- [ ] Caching is based on file existence

### Determinism

- [ ] No random number generation
- [ ] No time-based logic
- [ ] No external API calls affecting scoring
- [ ] Sorting is stable

### Error Handling

- [ ] FFmpeg errors show clear message
- [ ] Missing API key falls back gracefully
- [ ] No silent failures
- [ ] Errors don't crash the app

### Output Format

- [ ] All clips have `id`, `startTime`, `endTime`, `score`
- [ ] Score breakdown is attached
- [ ] JSON is serializable
- [ ] Timestamps are in seconds (float)

---

## What to Look For

### Good Signs ✓

1. **Predictable behavior** — Same input always produces same output
2. **Transparent scoring** — Every score has a breakdown
3. **Simple workflow** — Minimal decisions per clip
4. **Clear errors** — No cryptic failures

### Red Flags ✗

1. **Non-deterministic output** — Different results on each run
2. **Black-box scores** — "Score: 85" with no explanation
3. **Complex UI** — Too many options, hidden settings
4. **Silent failures** — Things don't work but no error shown

---

## What NOT to Suggest

This is intentionally minimal. Do not suggest:

- ❌ "Add analytics tracking"
- ❌ "Add user preferences"
- ❌ "Make it learn from usage"
- ❌ "Add cloud sync"
- ❌ "Add viral predictions"
- ❌ "Add onboarding flow"
- ❌ "Add theming options"

**Why?** Ship first, iterate later. These add complexity without proving core value.

---

## File Map

| Path | Purpose |
|------|---------|
| `podflow-studio/src/python/detector.py` | Main pipeline entry |
| `podflow-studio/src/python/features.py` | Audio feature extraction |
| `podflow-studio/src/python/utils/mvp_candidates.py` | Candidate detection |
| `podflow-studio/src/python/utils/mvp_scoring.py` | Scoring and selection |
| `podflow-studio/src/python/patterns/*.py` | Pattern detectors |
| `podflow-studio/src/renderer/components/editor/*.tsx` | UI components |
| `podflow-studio/src/main/ipc/*.ts` | IPC handlers |
| `tools/smoke_test.py` | Smoke test script |
| `tools/eval/run_eval.py` | Evaluation harness |

---

## Dependencies

### Required

| Dependency | Purpose | Install |
|------------|---------|---------|
| Node.js 18+ | Electron runtime | `nvm install 18` |
| Python 3.8+ | Detection pipeline | System package |
| FFmpeg | Audio/video processing | `brew install ffmpeg` |
| numpy | Numerical computing | `pip install numpy` |
| librosa | Audio analysis | `pip install librosa` |
| scipy | Signal processing | `pip install scipy` |
| soundfile | Audio I/O | `pip install soundfile` |

### Optional

| Dependency | Purpose | Install |
|------------|---------|---------|
| OpenAI API key | Whisper transcription | Set `OPENAI_API_KEY` |
| webrtcvad | Voice activity detection | `pip install webrtcvad` |

---

## Common Issues

### "FFmpeg not found"

```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt install ffmpeg

# Windows
winget install FFmpeg
```

### "Module not found: librosa"

```bash
cd podflow-studio/src/python
pip install -r requirements.txt
```

### "No clips detected"

1. Check if video has audio track
2. Check if skip_intro/skip_outro leaves enough content
3. Lower detection thresholds
4. Check debug output for gating reasons

### "Scores are different between runs"

1. Check for random.seed() calls
2. Check for time-based logic
3. Ensure numpy arrays are not being mutated
4. Verify sorting is stable

---

## Performance Expectations

| Operation | Expected Time | Notes |
|-----------|---------------|-------|
| Audio extraction | 10-30s | Depends on video length |
| Feature extraction | 20-40s | ~1hr podcast |
| Candidate detection | 5-10s | Vectorized ops |
| Scoring | 2-5s | Pure Python |
| **Total (no API)** | 40-90s | 1hr podcast |
| Whisper transcription | 60-120s | API call |
| **Total (with API)** | 2-4min | 1hr podcast |

---

## Questions for Review

1. **Is the pipeline deterministic?**
   - Run twice, compare outputs
   
2. **Is the scoring transparent?**
   - Can you understand why a clip scored high/low?
   
3. **Is the UI minimal?**
   - Can you complete the workflow without docs?
   
4. **Are errors clear?**
   - Do failure cases explain what went wrong?

---

## Final Note

> This is a tool, not a platform.
>
> The goal is to help creators produce clips quickly and reliably.
> Everything else is scope creep.

Thank you for reviewing! 🙏
