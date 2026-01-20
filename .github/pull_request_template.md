# MVP: Deterministic Podcast Clip Pipeline

## Summary

This PR strips the codebase down to a **deterministic podcast clip machine** with a minimal UI that exists only to run the pipeline, review clips, and export results.

### What this PR does

- Replaces all speculative AI, dashboards, and editor UI with a single-purpose pipeline
- Introduces a strict 3-screen UI: **Run → Review → Export**
- Makes the backend the single source of truth
- Ensures every file maps directly to clip production

### What this PR intentionally does NOT do

- No analytics, onboarding, theming, or settings
- No user accounts or persistence
- No learning systems or cloud infra
- No "AI explanations" or black-box behavior

### Why

- Optimize for **trust, speed, and ship-ability**
- Reduce cognitive load for creators
- Make the system **auditable and predictable**

---

## Type of Change

- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Documentation update
- [ ] Refactor (no functional changes)

---

## Deterministic Detection Logic

**Signals used (only):**
- Speech density (words/sec)
- Silence → speech transitions
- Sentence boundaries
- Duration window (15–60s)

**Output per clip:**
```json
{
  "start": 312.4,
  "end": 344.8,
  "score": 82,
  "reason": "silence→spike + high speech density"
}
```

No ML tuning. No feedback loops. Fully inspectable.

---

## Test Checks (What Reviewers Should Run)

### A) Pipeline Smoke Test

```bash
cd podflow-studio
npm install
cd src/python && pip install -r requirements.txt && cd ../..

# Run detection on sample video
npm start
# OR run Python directly:
# cd src/python && python detector.py /path/to/video.mp4 '{"mvp_mode": true, "job_dir": "/tmp/test"}'
```

**Expected:**
- No crashes
- ≥5 clips generated
- Captions rendered
- Vertical output

### B) Determinism Test

Run twice with same input.

**Expected:**
- Same clip timestamps
- Same scores
- Same exports

### C) Caption Integrity Test

- No overlapping subtitles
- No mid-word cuts
- Karaoke highlight syncs to audio

### D) UI Contract Test

- Can user generate → review → export without explanation?
- Max decisions per clip ≤ 2
- No hidden settings

### E) Python Unit Tests

```bash
cd podflow-studio/src/python
python -m unittest discover -s tests
```

---

## How to Test

### Quick Test Commands

```bash
# Install dependencies
cd podflow-studio && npm install
cd src/python && pip install -r requirements.txt

# Run the app
cd podflow-studio && npm start

# Run Python tests
cd podflow-studio/src/python && python -m unittest discover -s tests

# Run eval harness
python tools/eval/run_eval.py --dataset data/sample.json --k 10
```

### Manual Test Steps

1. Launch the app (`npm start`)
2. Drop a podcast video file
3. Click "Analyze" / "Generate Clips"
4. Review detected clips in the clip strip
5. Accept/reject clips (A/R keys)
6. Export selected clips
7. Verify exported files play correctly

---

## Files Changed

| File | Change |
|------|--------|
| `src/python/detector.py` | MVP pipeline with stage caching |
| `src/python/utils/mvp_candidates.py` | Deterministic candidate detection |
| `src/python/utils/mvp_scoring.py` | Transparent scoring with breakdown |
| `src/renderer/components/editor/*` | Minimal UI components |
| `docs/MVP_ARCHITECTURE.md` | Complete pipeline documentation |

---

## Checklist

- [ ] I have tested this locally
- [ ] Lint passes (`npm run lint`)
- [ ] No console errors in dev tools
- [ ] Python tests pass
- [ ] Detection is deterministic (same input → same output)
- [ ] Exported clips are playable
- [ ] Documentation updated
- [ ] No hardcoded API keys or secrets

---

## Reviewer Guidance

> **Please review this repo as a tool, not a platform.**
>
> The goal is **reliability, determinism, and creator trust** — not feature breadth.

### What to look for:

1. **Determinism**: Same input always produces same output
2. **Transparency**: Every score has a breakdown
3. **Simplicity**: Minimal decisions required per clip
4. **Reliability**: No crashes, all exports playable

### What NOT to suggest:

- "Add analytics tracking"
- "Add user preferences"
- "Make it learn from usage"
- "Add cloud sync"

This is intentionally minimal. Ship first, iterate later.

---

## Risks / Rollback Notes

**Risks:**
- FFmpeg not installed → Clear error message with install instructions
- No clips detected → Explicit message shown to user
- Export failure → Clip skipped, pipeline continues

**Rollback:**
- Revert to previous commit
- All changes are self-contained

---

## Related Issues

<!-- Link to GitHub issues: Fixes #123, Relates to #456 -->
