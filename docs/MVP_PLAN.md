# Sellable MVP Plan - PodFlow/Clipper Studio

**Generated:** 2026-01-18  
**Version:** 1.0  
**Target:** Ship a golden MVP in ~2-3 weeks

---

## 🗺️ REPO MAP

### Project Structure

| Component | Path | Purpose |
|-----------|------|---------|
| **Clipper Studio** | `/clipper-studio/` | AI-free fast clip detection (2 patterns) |
| **PodFlow Studio** | `/podflow-studio/` | Full-featured with optional AI enhancement |
| **Eval Harness** | `/tools/eval/` | Precision@K evaluation runner |
| **Architecture Docs** | `/ARCHITECTURE.md` | Comprehensive system documentation |

### A) Electron Entrypoints

| File | Role |
|------|------|
| `podflow-studio/src/main/index.ts` | Main process entry (window creation, IPC registration) |
| `clipper-studio/src/main/index.ts` | Same for Clipper variant |
| `*/src/preload/preload.ts` | Secure IPC bridge (contextBridge API) |
| `*/src/renderer/index.tsx` | React app entry |

### B) IPC Communication Path

```
Renderer → Main → Python → Main → Renderer

1. window.api.startDetection(projectId, filePath, settings)
2. ipcMain.handle('start-detection') → spawn('python', ['detector.py', ...])
3. Python stdout: PROGRESS:XX:message / RESULT:{json}
4. Main parses → webContents.send('detection-progress' / 'detection-complete')
5. Renderer updates Zustand store
```

**Key IPC Handlers:**
- `/src/main/ipc/fileHandlers.ts` - File dialogs, validation
- `/src/main/ipc/detectionHandlers.ts` - Python process management
- `/src/main/ipc/exportHandlers.ts` - FFmpeg export orchestration

### C) Python Detection Pipeline

| File | Purpose |
|------|---------|
| `detector.py` | Main entry, orchestrates pipeline |
| `features.py` | Feature cache (RMS, centroid, flatness, ZCR, onset, VAD) |
| `vad_utils.py` | WebRTC VAD, boundary snapping |
| `patterns/payoff.py` | Silence → spike detection |
| `patterns/monologue.py` | Sustained energy detection |
| `patterns/laughter.py` | Burst cluster detection (PodFlow only) |
| `patterns/debate.py` | Rapid turn-taking (PodFlow only) |
| `patterns/silence.py` | Dead space detection |
| `utils/baseline.py` | Rolling median baselines |
| `utils/clipworthiness.py` | Hard gates + soft-score ensemble |
| `utils/scoring.py` | Final ranking, merging, selection |
| `ai/transcription.py` | Whisper API (optional) |
| `ai/clip_enhancement.py` | GPT-4o-mini titles/validation (optional) |

### D) Clip Result JSON Schema

```typescript
interface Clip {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  
  // Detection
  pattern: 'payoff' | 'monologue' | 'laughter' | 'debate';
  patternLabel: string;
  description: string;
  algorithmScore: number;
  hookStrength: number;
  hookMultiplier: number;
  
  // AI Enhancement (optional)
  transcript?: string;
  title?: string;
  hookText?: string;
  category?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  aiQualityMultiplier?: number;
  isComplete?: boolean;
  startsClean?: boolean;
  endsClean?: boolean;
  
  // Clipworthiness breakdown
  clipworthiness?: {
    hardGates: Record<string, boolean>;
    softScores: Record<string, number>;
    weights: Record<string, number>;
    finalScore: number;
  };
  
  finalScore: number;
  trimStartOffset: number;
  trimEndOffset: number;
  status: 'pending' | 'accepted' | 'rejected';
}
```

### E) Export Pipeline

| Mode | FFmpeg Command | Use Case |
|------|----------------|----------|
| **Fast** | `-c copy -avoid_negative_ts make_zero` | Quick preview, keyframe-aligned |
| **Accurate** | `-c:v libx264 -preset fast -crf 23 -c:a aac` | Frame-perfect cuts |
| **Full Edit** | `filter_complex` with concat | Dead space removal |

**Verification:** Currently missing - needs implementation.

### F) Existing Components

| Feature | Status | Location |
|---------|--------|----------|
| Feature cache | ✅ Done | `features.py` |
| VAD boundary snapping | ✅ Done | `vad_utils.py` |
| Speech gate | ✅ Done | `clipworthiness.py` |
| Local baselines | ✅ Done | `baseline.py` |
| Clipworthiness scoring | ✅ Done | `clipworthiness.py` (breakdown returned) |
| AI Transcription | ✅ Done | `ai/transcription.py` |
| AI Enhancement | ✅ Done | `ai/clip_enhancement.py` |
| Eval harness | ✅ Done | `tools/eval/run_eval.py` |
| Export fast/accurate | ✅ Done | `exportHandlers.ts` |
| **Score breakdown UI** | ❌ Missing | ClipCard shows score but not breakdown |
| **Export verification** | ❌ Missing | No file playability check |
| **AI result caching** | ❌ Missing | Re-runs AI on every detection |
| **Packaging** | ❌ Missing | Requires manual Python/FFmpeg install |

---

## 📋 MVP WORKSTREAMS

### Workstream 1: Core Reliability

**Goal:** Detection pipeline is stable, boundaries clean, gates work.

- [x] Feature cache (RMS, centroid, ZCR, onset, VAD)
- [x] VAD boundary snapping (±2s window, tail padding)
- [x] Speech gate (ratio ≥0.70, flatness ≤0.45, min 6s speech)
- [x] Local baselines (rolling median windows)
- [x] Clipworthiness ensemble scoring
- [ ] Export verification (check output file is playable)
- [ ] Error recovery (Python crash → graceful UI message)

**Acceptance Criteria:**
- Detection completes without crash on any valid MP4/MOV
- No clips cut mid-word (VAD snap verified)
- Exported files play in VLC/QuickTime without error

**Risks:**
- VAD may miss quiet speech → Mitigation: adjustable thresholds
- FFmpeg may fail on some codecs → Mitigation: fallback to accurate mode

### Workstream 2: AI Enrichment (Optional)

**Goal:** AI improves post-worthiness without being required.

- [x] Whisper transcription integration
- [x] GPT-4o-mini title/validation generation
- [ ] Cache AI results to disk (by file hash)
- [ ] Graceful fallback when API key missing
- [ ] Rate limit handling

**Acceptance Criteria:**
- App works fully without OPENAI_API_KEY set
- AI results cached, second run instant
- Clear UI indicator when AI is active vs skipped

**Risks:**
- API rate limits → Mitigation: exponential backoff
- Cost overrun → Mitigation: show estimated cost before running

### Workstream 3: UI Polish

**Goal:** Clip list is informative, export UX is clear.

- [x] ClipCard with score, pattern, category badges
- [x] Accept/reject workflow
- [x] Trim controls
- [ ] **"Why This Clip" score breakdown panel** (show hard gates, soft scores)
- [ ] Export progress with clip names
- [ ] Export completion summary with file paths
- [ ] Keyboard shortcuts (j/k nav, a/r accept/reject)

**Acceptance Criteria:**
- User can see exactly why a clip scored high/low
- Export shows exactly what will be created
- Non-technical user can complete flow in <5 minutes

**Risks:**
- Information overload → Mitigation: collapsible details

### Workstream 4: Packaging/Distribution

**Goal:** User doesn't need to install Python/FFmpeg manually.

- [ ] Bundle FFmpeg binary (platform-specific)
- [ ] Package Python environment (PyInstaller or embedded Python)
- [ ] Create installer (electron-forge makers)
- [ ] Document "dev run" vs "beta run" paths

**Acceptance Criteria:**
- Double-click installer → app runs
- No terminal commands needed for end user

**Risks:**
- Binary size → Mitigation: compress, use static builds
- Platform differences → Mitigation: separate CI for each OS

### Workstream 5: Proof Artifacts

**Goal:** Demonstrate the product works with evidence.

- [ ] Demo pack (input MP4, outputs, metadata.json)
- [ ] Run eval harness on sample data
- [ ] Screen recording of full workflow
- [ ] Known limitations document

**Acceptance Criteria:**
- Demo pack runs on fresh machine
- Eval shows Precision@10 metric
- Screen recording <3 minutes, shows complete flow

---

## 🔢 PR PLAN (Implementation Order)

### PR #1: UI "Why This Clip" Score Breakdown Panel
**Scope:** Display clipworthiness breakdown in ClipCard  
**Files:**
- `podflow-studio/src/renderer/components/ClipCard.tsx`
- `clipper-studio/src/renderer/components/ClipCard.tsx`

**No backend changes required** - data already returned by Python.

### PR #2: Export Hardening
**Scope:** Verify exports, better errors, completion summary  
**Files:**
- `*/src/main/ipc/exportHandlers.ts`
- `*/src/renderer/pages/Export.tsx`

### PR #3: AI Caching + Fallbacks
**Scope:** Cache transcription/enhancement to disk, graceful missing key  
**Files:**
- `*/src/python/ai/transcription.py`
- `*/src/python/ai/clip_enhancement.py`
- `*/src/python/detector.py`

### PR #4: Packaging Improvements
**Scope:** Bundle FFmpeg, document Python packaging path  
**Files:**
- `*/forge.config.ts`
- `docs/INSTALLER_PLAN.md`

### PR #5: Docs + Demo Pack + Release Checklist
**Scope:** Complete documentation, proof artifacts  
**Files:**
- `docs/RELEASE_CHECKLIST.md`
- `docs/DEMO_PACK.md`
- `demo/` folder with sample outputs
- Update `README.md`

---

## ⚠️ TOP 5 RISKS AND MITIGATIONS

### 1. Python/FFmpeg Installation Friction
**Risk:** Non-technical users can't run the app  
**Impact:** HIGH - blocks all users without dev setup  
**Mitigation:**
- Short-term: Clear installation docs with screenshots
- Medium-term: Bundle FFmpeg binary
- Long-term: Embed Python or compile to native

### 2. Export Boundary Drift (Fast Mode)
**Risk:** Fast mode cuts at wrong frames due to keyframe alignment  
**Impact:** MEDIUM - clips may start/end unexpectedly  
**Mitigation:**
- Default to accurate mode for short clips
- Show warning when fast mode drift exceeds 500ms
- Add "verify" step that checks exported duration

### 3. AI API Costs/Failures
**Risk:** User incurs unexpected charges or API fails mid-run  
**Impact:** MEDIUM - frustration, incomplete results  
**Mitigation:**
- Show cost estimate before AI run
- Cache all AI results by file hash
- Graceful fallback to algorithm-only mode

### 4. Detection False Positives
**Risk:** Too many low-quality clips waste user time  
**Impact:** MEDIUM - trust erosion  
**Mitigation:**
- Speech gate already filters noise/music
- Add "confidence threshold" slider
- Show score breakdown so users understand why

### 5. Cross-Platform Build Failures
**Risk:** App works on dev machine but not on user's OS  
**Impact:** HIGH - blocks adoption  
**Mitigation:**
- CI builds for Windows/Mac/Linux
- Beta test on fresh VMs
- Document known platform issues

---

## 🎯 SUCCESS CRITERIA

A non-technical editor can:
1. **Install** the app without command-line steps
2. **Drop an MP4** and see clips within 2 minutes
3. **Understand scores** via the breakdown panel
4. **Export clips** that play correctly in any video player
5. **Trust the product** because it explains itself

---

## 📆 SEQUENCE (Not Time Estimates)

```
1. PR #1: UI Score Breakdown (unblocks user trust)
   ↓
2. PR #2: Export Hardening (unblocks reliable output)
   ↓
3. PR #3: AI Caching (unblocks cost-effective AI)
   ↓
4. PR #4: Packaging (unblocks non-dev users)
   ↓
5. PR #5: Docs + Demo (unblocks sales/marketing)
```

Each PR is independently shippable and adds value.
