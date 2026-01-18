# Smoke Test Checklist - PodFlow Studio

Run through this checklist to verify the app is working correctly.

**Time required**: ~10-15 minutes  
**Requirements**: Test video file (MP4, 5-30 minutes recommended for quick testing)

---

## Prerequisites

### 1. Verify Dependencies
```bash
# Check Python version (need 3.9+)
python --version

# Check FFmpeg is installed
ffmpeg -version

# Check ffprobe is installed  
ffprobe -version
```

### 2. Install Python Dependencies
```bash
cd podflow-studio/src/python
pip install -r requirements.txt
```

### 3. Start the App
```bash
cd podflow-studio
npm install  # First time only
npm start
```

---

## Test Cases

### Test 1: File Selection
- [ ] App launches without errors
- [ ] Home screen shows "New Project" button
- [ ] Click "New Project" → File dialog opens
- [ ] Select MP4 file → File info displayed (name, duration, size)
- [ ] Click "Analyze" → Navigates to Clip Finder page

**Pass criteria**: File selected and info displayed correctly

---

### Test 2: Detection Pipeline
- [ ] Progress bar appears and updates (5%, 15%, 30%, etc.)
- [ ] Progress messages show current step ("Extracting audio...", "Detecting payoffs...")
- [ ] Detection completes within 2 minutes for 30-minute video
- [ ] Clips appear in grid layout
- [ ] At least 5 clips detected (for typical podcast content)

**Pass criteria**: Detection completes without crash, clips displayed

---

### Test 3: Clip Card Display
For each clip card, verify:
- [ ] Score displayed (0-100 with flame icon)
- [ ] Duration badge visible (e.g., "45s")
- [ ] Pattern badge visible (Payoff/Monologue/Laughter/Debate)
- [ ] Timestamp range shown (e.g., "2:30.00 – 3:15.00")
- [ ] Accept/Reject buttons visible

**Pass criteria**: All clip metadata visible and readable

---

### Test 4: Accept/Reject Workflow
- [ ] Click "Accept" on clip → Green border + checkmark appears
- [ ] Filter by "Accepted" → Only accepted clips shown
- [ ] Click "Reject" on different clip → Card grays out
- [ ] Filter by "Rejected" → Only rejected clips shown
- [ ] Click "All" → All clips shown
- [ ] Click "Accept" again on accepted clip → Toggles back to pending

**Pass criteria**: Status changes reflect immediately in UI and filters

---

### Test 5: Trim Controls
- [ ] Click "-5s" on Start → trimStartOffset decreases
- [ ] Click "+5s" on Start → trimStartOffset increases
- [ ] Click "-5s" on End → trimEndOffset decreases
- [ ] Click "+5s" on End → trimEndOffset increases
- [ ] Duration badge updates to reflect new duration
- [ ] Timestamp range updates

**Pass criteria**: Trim offsets apply and display correctly

---

### Test 6: Score Breakdown ("Why This Clip?")
- [ ] Click "Why this clip?" expander on any clip
- [ ] Quality Gates section shows (with checkmarks/x marks)
- [ ] Score Components section shows bars (Pattern, Hook, Coherence)
- [ ] Weighted Final Score shown at bottom
- [ ] Click expander again → Section collapses

**Pass criteria**: Score breakdown displays detailed scoring info

---

### Test 7: Dead Space Detection (AutoEdit)
- [ ] Navigate to "Auto Edit" from sidebar
- [ ] Dead spaces list appears (if silences >3s exist in video)
- [ ] Total dead space time displayed
- [ ] Each item shows start/end timestamps and duration
- [ ] Click "Remove" toggle → Item turns red
- [ ] Click "Keep" toggle → Item returns to gray
- [ ] "Remove All" button marks all for removal
- [ ] "Keep All" button marks all to keep
- [ ] "New Duration" updates based on selections

**Pass criteria**: Dead space list functional with toggles

---

### Test 8: Export - Fast Mode
- [ ] Accept at least 2 clips
- [ ] Navigate to Export page
- [ ] Check "Export Accepted Clips"
- [ ] Select "Fast" mode
- [ ] Click "Choose output folder" → Select destination
- [ ] Click "Export" button
- [ ] Progress shows "Exporting 1 of 2..."
- [ ] Export completes with success message
- [ ] Click "Open Folder" → Folder opens in file explorer
- [ ] Exported MP4 files exist
- [ ] **Play exported file in VLC → Video plays without errors**

**Pass criteria**: Clips export and are playable

---

### Test 9: Export - Accurate Mode
- [ ] Same steps as Test 8, but select "Accurate" mode
- [ ] Export takes longer (re-encoding)
- [ ] **Play exported file → Frame-accurate cuts (no drift)**

**Pass criteria**: Accurate mode produces clean cuts

---

### Test 10: Export Full Video (Dead Space Removed)
- [ ] Mark some dead spaces for removal in AutoEdit
- [ ] Navigate to Export
- [ ] Check "Export Full Video (Dead Space Removed)"
- [ ] Uncheck "Export Accepted Clips" 
- [ ] Export
- [ ] **Play edited_full.mp4 → Silences are removed**

**Pass criteria**: Full video exports with dead spaces cut out

---

### Test 11: AI Enhancement (Optional - requires API key)
Skip if no OpenAI API key available.

- [ ] Set OPENAI_API_KEY environment variable
- [ ] Enable "Use AI Enhancement" in settings
- [ ] Run detection
- [ ] Clips show AI-generated titles
- [ ] Clips show hook text in purple
- [ ] Category badge appears (funny/insightful/story/etc.)

**Pass criteria**: AI metadata appears on clips

---

### Test 12: AI Fallback (No API key)
- [ ] Ensure OPENAI_API_KEY is NOT set
- [ ] Enable "Use AI Enhancement" in settings
- [ ] Run detection
- [ ] Progress shows "AI enabled without API key; using heuristics..."
- [ ] Detection completes successfully (no crash)
- [ ] Clips show algorithm-generated descriptions (no AI titles)

**Pass criteria**: App works without API key, graceful fallback

---

### Test 13: Error Handling
- [ ] Try to select non-video file (e.g., .txt) → Error message shown
- [ ] Cancel detection mid-progress → No crash, returns to idle state
- [ ] Try export with no clips accepted → "Select at least one" message

**Pass criteria**: Errors handled gracefully with clear messages

---

## Results Summary

| Test | Pass/Fail | Notes |
|------|-----------|-------|
| 1. File Selection | | |
| 2. Detection Pipeline | | |
| 3. Clip Card Display | | |
| 4. Accept/Reject | | |
| 5. Trim Controls | | |
| 6. Score Breakdown | | |
| 7. Dead Space Detection | | |
| 8. Export Fast | | |
| 9. Export Accurate | | |
| 10. Export Full Video | | |
| 11. AI Enhancement | | |
| 12. AI Fallback | | |
| 13. Error Handling | | |

**Overall Result**: _____ / 13 tests passed

---

## Known Issues Found

List any issues discovered during testing:

1. 
2. 
3. 

---

## Tester Information

- **Date**: 
- **Tester**: 
- **OS**: 
- **Test video**: 
- **Video duration**: 
