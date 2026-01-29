# State Persistence Fix - Test Guide

## Problem
When users navigated away from the Review screen and came back, or loaded clips from History, captions would disappear with the message "No transcript loaded".

## Root Cause
The Zustand store's `persist` middleware was only saving `settings` and `lastExportDir`, not the `transcript` and `clips` data that are needed to display captions.

## Solution Implemented

### 1. Store Persistence Configuration Updated
**File**: `/podflow-studio/src/renderer/stores/store.ts` (lines 157-161)

Changed the `partialize` function to include:
- `clips` - The detected clips data
- `transcript` - The transcript with segments for captions
- `captionStyle` - User's caption style preference

**Before**:
```typescript
partialize: (state) => ({
  settings: state.settings,
  lastExportDir: state.lastExportDir,
}),
```

**After**:
```typescript
partialize: (state) => ({
  settings: state.settings,
  lastExportDir: state.lastExportDir,
  clips: state.clips,
  transcript: state.transcript,
  captionStyle: state.captionStyle,
}),
```

### 2. Enhanced Logging Added
Added comprehensive console logging to track state flow:

- **App Mount** (line 60-67): Logs when store is hydrated on app startup
- **Back Button Navigation** (lines 514-521): Logs when navigating away from review
- **History Load** (line 498): Logs when transcript is restored from history
- **Caption Render Check** (line 903): Logs transcript segment count and display status

## How to Test

### Test 1: Direct Navigation (Review → Home → Review)
1. Upload video + transcript
2. Run detection → clips appear in review
3. ✓ Captions visible with segment count shown
4. Click "Back" button
5. Click "Review X Clips" button
6. ✓ Captions should still be visible (transcript persisted from store)

### Test 2: Refresh Page (F5)
1. Upload video + transcript
2. Run detection → review screen shows captions
3. Press F5 to reload page
4. ✓ App opens to review screen
5. ✓ Captions still visible (transcript restored from localStorage)

### Test 3: History/Recent Activity
1. Upload video + transcript
2. Run detection → export clips
3. Go to History screen
4. Click on the project name
5. ✓ Review button shows with clip count
6. Click review button
7. ✓ Captions visible for all clips

### Test 4: Caption Style Persistence
1. In review screen with captions, change caption style
2. Navigate away (back to home)
3. Click "Review X Clips" again
4. ✓ Caption style should be preserved

## Verification Logs to Watch

Open browser DevTools (F12) → Console to see:

```
[App Mount] Store hydration check: {
  clips: 10,
  transcriptSegments: 1052,
  captionStyle: 'viral',
  screen: 'home'
}
```

After detection:
```
[App] Detection complete, clips: 10, transcript segments: 1052
```

When navigating:
```
[Review] Going back to home, current transcript segments: 1052
[History Load] Loading transcript: 1052 segments
[Captions] Render check - hasTranscript: true, segments: 1052, showCaptions: true
✓ 1052 transcript segments loaded • Captions will appear on video
```

## Files Modified
1. `/podflow-studio/src/renderer/stores/store.ts` - Persist config
2. `/podflow-studio/src/renderer/App.tsx` - Logging for debugging

## Next Steps
1. Start the app: `npm start`
2. Follow Test 1 sequence above
3. Watch console logs (F12) to confirm state persists
4. Repeat Tests 2-4 to verify all navigation paths work
5. Report any issues where "No transcript loaded" appears

If persistence still doesn't work:
- Clear browser localStorage (Cmd+Shift+Delete or `localStorage.clear()` in console)
- Verify localStorage is enabled in browser
- Check if Firefox/Safari have different storage behavior than Chrome
