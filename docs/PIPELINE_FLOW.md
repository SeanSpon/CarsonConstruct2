# Pipeline Flow

## Overview

```
INPUT → SEGMENT → ANALYZE → GATE → RANK → SHIP
```

One direction. No loops. No rescue.

---

## Stage 1: INPUT

**What happens:**
- Accept one podcast episode
- YouTube URL or MP4 upload
- Extract audio for processing

**Rules:**
- One episode per run
- No batch processing
- No bulk queues

---

## Stage 2: SEGMENT

**What happens:**
- Full transcription (Whisper)
- Segment into 30-120 second chunks
- Use sentence boundaries

**Output:**
- List of transcript segments
- Word-level timestamps

---

## Stage 3: ANALYZE (Narrative Detection)

**What happens:**
- Each segment evaluated for story structure
- AI or heuristics detect:
  - Setup (context, question, claim)
  - Core (explanation, tension, insight)
  - Resolution (takeaway, conclusion)
- Confidence score assigned

**Output:**
- NarrativeUnit for each segment
- Story element flags
- Confidence scores

---

## Stage 4: GATE (Quality Firewall)

**What happens:**
- Apply 4 quality gates to each NarrativeUnit
- Gates run in sequence:
  1. Narrative Completeness
  2. Visual Continuity
  3. Caption Clarity
  4. Confidence Threshold

**Rules:**
- Fail ANY gate = DROP
- No exceptions
- No fallbacks
- No revisions

**Output:**
- Survivors only (passed all 4 gates)
- Dropped count (for logging)

---

## Stage 5: RANK

**What happens:**
- Sort survivors by confidence (highest first)
- Limit to target count (default: 10)

**Output:**
- Top N clips ready to ship

---

## Stage 6: SHIP

**What happens:**
- Export clips via FFmpeg
- Render captions
- Generate platform-ready MP4s

**Output:**
- 5-10 vertical clips
- Clean captions
- Confidence labels

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│                     INPUT                            │
│              (YouTube URL / MP4)                     │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│                   SEGMENT                            │
│          (Transcribe + Split)                        │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│                   ANALYZE                            │
│    (Detect: Setup? Core? Resolution?)                │
│    (Assign: Confidence Score)                        │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│                    GATE                              │
│  ┌────────────────────────────────────────────────┐ │
│  │ Gate 1: Narrative Completeness (≥2 elements)   │ │
│  │ Gate 2: Visual Continuity (clean cuts)         │ │
│  │ Gate 3: Caption Clarity (≥15 words)            │ │
│  │ Gate 4: Confidence Threshold (≥60%)            │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│        ❌ FAIL ANY → DROP (no exceptions)           │
│        ✅ PASS ALL → SURVIVE                        │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│                    RANK                              │
│         (Sort by confidence, limit to 10)            │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│                    SHIP                              │
│         (Export → Platform-ready MP4s)               │
│         (🔥 Top Pick / 👍 Solid / 🧪 Optional)       │
└─────────────────────────────────────────────────────┘
```

---

## Key Differences from Old System

| Old System | New System |
|------------|------------|
| Find "good moments" | Build complete stories |
| Score and rank all | Filter first, rank survivors |
| Pattern-based | Narrative-based |
| Volume-optimized | Quality-gated |
| Clips compete | Clips prove eligibility |
| Rescue possible | Rejection is final |

---

## Error Handling

**If transcription fails:**
- Return error, no clips

**If AI detection fails:**
- Fall back to heuristics
- Continue pipeline

**If no clips survive gates:**
- Return empty result
- Log gate failure breakdown
- This is a VALID outcome

**Never:**
- Lower thresholds to get output
- Skip gates
- Force clips through
