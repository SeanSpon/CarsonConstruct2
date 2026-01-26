# UI Philosophy

## The Feeling We're Designing For

> "I click one thing, things happen, I feel smart."

That's it. That's the whole philosophy.

---

## What Users Should Feel

### ✅ Should Feel
- Calm
- Confident
- In control (without effort)
- Like the system has taste
- Like decisions are obvious

### ❌ Should NOT Feel
- Confused
- Overwhelmed
- Anxious about choices
- Like they need to rescue clips
- Like they're debugging

---

## UI Rules (Non-Negotiable)

### Rule 1: One Main Button
- "Run Episode" is the primary action
- Everything flows from there
- No multi-step setup wizards

### Rule 2: No Technical Language
- ❌ "FFmpeg"
- ❌ "LLM"
- ❌ "VAD"
- ❌ "Transcription pipeline"
- ✅ "Analyzing..."
- ✅ "Finding stories..."
- ✅ "Almost ready..."

### Rule 3: Progress Feels Alive
- Smooth animations
- Clear stage indicators
- No frozen screens
- No mystery spinners

### Rule 4: Decisions Are Instant
- Approve = one click
- Reject = one click
- Favorite = one click
- No confirmation dialogs for basic actions

### Rule 5: No Visible Pipelines
- Users don't need to know how it works
- They need to know it works
- Hide complexity, show results

---

## The Review Screen

### Show ONLY
```
┌────────────────────────────────┐
│       [Video Preview]          │
│                                │
├────────────────────────────────┤
│   🔥 Top Pick                  │
├────────────────────────────────┤
│   ⭐    👍    👎               │
├────────────────────────────────┤
│   3 of 8 reviewed              │
└────────────────────────────────┘
```

### Hide
- Timelines
- Waveforms
- Sliders
- Effects toggles
- Advanced settings
- Debug info

---

## Confidence Labels

| Score | Label | Meaning |
|-------|-------|---------|
| ≥ 85% | 🔥 | Top Pick - definitely ship |
| ≥ 70% | 👍 | Solid - safe to ship |
| ≥ 60% | 🧪 | Optional - your call |
| < 60% | ❌ | Never shown (already dropped) |

---

## Allowed Actions

### ⭐ Star/Favorite
- "I love this one"
- Moves to top of export queue
- Visual feedback: heart fills

### 👍 Approve
- "Ship it"
- Clip goes to export
- Visual feedback: checkmark

### 👎 Reject
- "Not this one"
- Clip removed from queue
- Visual feedback: fade out
- No guilt, no "are you sure?"

### "More like this"
- Optional feedback
- Helps improve future runs
- Low friction input

---

## Forbidden UI Patterns

### ❌ Modals on modals
- One modal max
- Never stack dialogs

### ❌ Settings during run
- All settings before "Run Episode"
- Once running, no interruptions

### ❌ Timeline editing
- No scrubbing
- No trim handles
- If you need to edit, the system failed

### ❌ Rescue buttons
- No "force export"
- No "override quality check"
- No "export anyway"

### ❌ Scary warnings
- No red alerts for normal behavior
- Dropped clips = system working, not error

---

## Dopamine Triggers

### When a clip passes all gates
- Subtle green glow
- Soft "success" sound (optional)
- Feels: earned, clean

### When review is complete
- Celebration moment
- "X clips ready to ship!"
- Clear next action

### When clips are dropped
- Not an error state
- "X clips dropped for quality"
- Feels: professional, intentional

---

## Progress States

### Running
```
Finding stories...
████████░░░░░░░░ 45%
```

### Gate Results
```
✅ 8 clips passed quality gates
❌ 7 dropped for quality

[Continue to Review]
```

### Review Complete
```
🎉 All done!

6 clips approved
2 rejected

[Export All] [Export Selected]
```

---

## The Bottom Line

The UI should make users feel:

> "Damn, this system has taste."

Not:
> "Damn, this system has features."

**Simplicity is the feature.**
