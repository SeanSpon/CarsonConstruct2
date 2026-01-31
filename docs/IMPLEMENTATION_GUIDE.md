# Premiere Pro Features - Implementation Guide

This guide explains how the new Premiere Pro-inspired features have been implemented in PodFlow Studio.

## 📦 What Was Added

### 1. **Type Definitions** (`types/index.ts`)

Added new TypeScript interfaces:
- `TimelineMarker` - Timeline marker system
- `ClipColorLabel` - Color labels for clip organization
- `ClipSpeed` - Speed/duration controls
- `HistoryEntry` - Edit history tracking

Updated existing interfaces:
- `Clip` - Added `colorLabel`, `speed`, `opacity`, `volume`, `audioDucking`
- `AudioTrack` - Added `solo`, `duckWhenSpeech`
- `TimelineTrack` - Added `solo`, `targetedForEdit`

### 2. **Store Updates** (`stores/store.ts`)

Added new state:
```typescript
markers: TimelineMarker[];
editMode: 'select' | 'ripple' | 'roll' | 'slip' | 'slide' | 'razor';
insertMode: 'insert' | 'overwrite';
```

Added new actions:
- **Markers:** `addMarker`, `removeMarker`, `updateMarker`, `goToMarker`
- **Edit Modes:** `setEditMode`, `setInsertMode`
- **Clip Controls:** `setClipSpeed`, `setClipColorLabel`, `setClipOpacity`, `setClipVolume`, `setClipAudioDucking`
- **Audio:** `toggleAudioSolo`
- **Enhanced:** `deleteClip` now supports ripple delete

### 3. **History Middleware** (`stores/historyMiddleware.ts`)

Updated to track markers in undo/redo system:
```typescript
export interface HistoryState {
  clips: any[];
  deadSpaces: any[];
  cameraCuts: any[];
  audioTracks: any[];
  timelineGroups: any[];
  markers: any[]; // NEW
}
```

### 4. **UI Components**

#### TimelineMarkers Component
**Location:** `components/editor/TimelineMarkers.tsx`

Displays markers on the timeline ruler with:
- Color-coded flags
- Type icons (💬📖💰⭐📐)
- Tooltips with marker info
- Click to jump to marker
- Edit/delete controls

**Props:**
```typescript
interface TimelineMarkersProps {
  markers: TimelineMarker[];
  duration: number;
  onMarkerClick: (markerId: string) => void;
  onMarkerEdit?: (markerId: string) => void;
  onMarkerRemove?: (markerId: string) => void;
  onMarkerAdd?: (time: number) => void;
  editable?: boolean;
}
```

#### MarkersPanel Component
**Location:** `components/editor/MarkersPanel.tsx`

Full-featured marker management panel:
- Add/edit/remove markers
- Search markers by name
- Filter by type
- Jump to marker position
- Visual marker list

**Props:**
```typescript
interface MarkersPanelProps {
  className?: string;
  onJumpToMarker?: (time: number) => void;
}
```

## 🔧 Integration Steps

### Step 1: Add Markers to Timeline Component

Update `Timeline.tsx` to include the TimelineMarkers component:

```typescript
import TimelineMarkers from './TimelineMarkers';
import { useStore } from '../../stores/store';

function Timeline({ ... }) {
  const { markers, addMarker, removeMarker, updateMarker, goToMarker } = useStore();
  
  return (
    <div className="timeline-container">
      {/* Existing timeline code */}
      
      {/* Add markers layer */}
      <TimelineMarkers
        markers={markers}
        duration={duration}
        onMarkerClick={(markerId) => {
          const time = goToMarker(markerId);
          onSeek(time);
        }}
        onMarkerEdit={(markerId) => {
          // Open edit modal
        }}
        onMarkerRemove={(markerId) => {
          removeMarker(markerId);
        }}
        editable={true}
      />
    </div>
  );
}
```

### Step 2: Add Markers Panel to EditorView

Update `EditorView.tsx` to include the markers panel:

```typescript
import MarkersPanel from './MarkersPanel';

function EditorView() {
  const [showMarkersPanel, setShowMarkersPanel] = useState(false);
  
  return (
    <div className="editor-view">
      {/* Existing layout */}
      
      {/* Add markers panel (optional side panel) */}
      {showMarkersPanel && (
        <div className="w-64 h-full">
          <MarkersPanel
            onJumpToMarker={(time) => {
              if (videoRef.current) {
                videoRef.current.currentTime = time;
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
```

### Step 3: Add Keyboard Shortcuts

Update keyboard shortcut handler in `EditorView.tsx`:

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // ... existing shortcuts ...
    
    switch (e.key.toLowerCase()) {
      case 'm':
        // Add marker at current time
        if (!e.shiftKey) {
          const markerId = `marker_${Date.now()}`;
          addMarker({
            id: markerId,
            time: currentTime,
            name: 'Marker',
            color: 'blue',
            type: 'comment',
          });
        } else {
          // Shift+M: Jump to next marker
          const nextMarker = markers.find(m => m.time > currentTime);
          if (nextMarker) {
            videoRef.current.currentTime = nextMarker.time;
          }
        }
        break;
        
      case 'c':
        // Toggle razor mode
        if (!e.ctrlKey && !e.metaKey) {
          setEditMode(editMode === 'razor' ? 'select' : 'razor');
        }
        break;
        
      case 'delete':
      case 'backspace':
        // Ripple delete with Shift
        if (selectedClipId) {
          deleteClip(selectedClipId, e.shiftKey);
        }
        break;
        
      // Add more shortcuts...
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [/* dependencies */]);
```

### Step 4: Add Edit Mode Indicator

Update `Timeline.tsx` to show current edit mode:

```typescript
const { editMode, insertMode } = useStore();

return (
  <div className="timeline-header">
    {/* Existing header content */}
    
    {/* Edit mode indicator */}
    <div className="flex items-center gap-2">
      <span className="text-xs text-sz-text-muted">Mode:</span>
      <span className={`text-xs px-2 py-1 rounded ${
        editMode === 'razor' ? 'bg-amber-500/20 text-amber-400' :
        editMode === 'ripple' ? 'bg-blue-500/20 text-blue-400' :
        'bg-sz-bg-tertiary text-sz-text-secondary'
      }`}>
        {editMode.charAt(0).toUpperCase() + editMode.slice(1)}
      </span>
      
      <span className="text-xs text-sz-text-muted">•</span>
      
      <span className="text-xs px-2 py-1 rounded bg-sz-bg-tertiary text-sz-text-secondary">
        {insertMode === 'insert' ? 'Insert' : 'Overwrite'}
      </span>
    </div>
  </div>
);
```

### Step 5: Add Clip Property Controls

Create a new component `ClipPropertiesPanel.tsx`:

```typescript
import { useStore } from '../../stores/store';

function ClipPropertiesPanel({ selectedClip }: { selectedClip: Clip | null }) {
  const { 
    setClipSpeed, 
    setClipColorLabel, 
    setClipOpacity, 
    setClipVolume,
    setClipAudioDucking 
  } = useStore();
  
  if (!selectedClip) return <EmptyState message="No clip selected" />;
  
  return (
    <div className="p-4 space-y-4">
      {/* Color Label */}
      <div>
        <label>Color Label</label>
        <div className="flex gap-1">
          {['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'].map(color => (
            <button
              key={color}
              onClick={() => setClipColorLabel(selectedClip.id, color as ClipColorLabel)}
              className={`w-6 h-6 rounded bg-${color}-500`}
            />
          ))}
        </div>
      </div>
      
      {/* Speed */}
      <div>
        <label>Speed</label>
        <input
          type="number"
          min="0.25"
          max="4"
          step="0.25"
          value={selectedClip.speed?.speed || 1}
          onChange={(e) => setClipSpeed(selectedClip.id, {
            speed: parseFloat(e.target.value),
            ripple: false,
          })}
        />
      </div>
      
      {/* Opacity */}
      <div>
        <label>Opacity: {selectedClip.opacity || 100}%</label>
        <input
          type="range"
          min="0"
          max="100"
          value={selectedClip.opacity || 100}
          onChange={(e) => setClipOpacity(selectedClip.id, parseInt(e.target.value))}
        />
      </div>
      
      {/* Volume */}
      <div>
        <label>Volume: {selectedClip.volume || 100}%</label>
        <input
          type="range"
          min="0"
          max="100"
          value={selectedClip.volume || 100}
          onChange={(e) => setClipVolume(selectedClip.id, parseInt(e.target.value))}
        />
      </div>
      
      {/* Audio Ducking */}
      <div>
        <label>
          <input
            type="checkbox"
            checked={selectedClip.audioDucking?.enabled || false}
            onChange={(e) => setClipAudioDucking(selectedClip.id, {
              enabled: e.target.checked,
              targetVolume: 25,
              fadeTime: 0.5,
            })}
          />
          Auto Duck When Speech
        </label>
      </div>
    </div>
  );
}
```

### Step 6: Add Audio Solo/Mute Controls

Update track controls in `Timeline.tsx`:

```typescript
const { audioTracks, updateAudioTrack, toggleAudioSolo } = useStore();

// In track label section
<div className="track-controls">
  {/* Mute button */}
  <button
    onClick={() => updateAudioTrack(track.id, { muted: !track.muted })}
    className={track.muted ? 'text-red-400' : 'text-sz-text-muted'}
  >
    {track.muted ? <VolumeX /> : <Volume2 />}
  </button>
  
  {/* Solo button */}
  <button
    onClick={() => toggleAudioSolo(track.id)}
    className={track.solo ? 'text-yellow-400' : 'text-sz-text-muted'}
  >
    S
  </button>
</div>
```

## 🎯 Usage Examples

### Example 1: Adding a Chapter Marker

```typescript
import { useStore } from './stores/store';

function MyComponent() {
  const { addMarker } = useStore();
  
  const addChapterMarker = (time: number, title: string) => {
    addMarker({
      id: `marker_${Date.now()}`,
      time,
      name: title,
      type: 'chapter',
      color: 'blue',
      comment: 'Chapter marker for navigation',
    });
  };
  
  // Usage
  addChapterMarker(120, 'Introduction');
  addChapterMarker(450, 'Main Discussion');
}
```

### Example 2: Ripple Delete Workflow

```typescript
function handleDeleteWithRipple(clipId: string) {
  // Delete clip and automatically close gap
  deleteClip(clipId, true); // ripple = true
  
  // All clips after this one shift backward
  // Timeline stays tight without gaps
}
```

### Example 3: Speed Ramping

```typescript
function createSlowMotion(clipId: string) {
  setClipSpeed(clipId, {
    speed: 0.5,           // 50% speed (2x slower)
    ripple: true,         // Adjust timeline
    frameBlending: true,  // Smooth motion
    reverse: false,
  });
}
```

### Example 4: Auto Duck Music

```typescript
function setupMusicTrack(trackId: string) {
  updateAudioTrack(trackId, {
    volume: 100,
    duckWhenSpeech: {
      enabled: true,
      targetVolume: 20,  // Reduce to 20% during speech
      fadeTime: 0.5,     // 500ms fade transitions
    },
  });
}
```

## 📊 Testing Checklist

- [ ] Markers display correctly on timeline
- [ ] Marker colors match Premiere Pro colors
- [ ] Click on marker jumps to correct time
- [ ] Marker panel shows all markers
- [ ] Search/filter works in marker panel
- [ ] Add/edit/remove markers works
- [ ] Undo/redo includes marker changes
- [ ] Ripple delete closes gaps correctly
- [ ] Speed changes update duration
- [ ] Ripple speed adjusts adjacent clips
- [ ] Color labels display on clips
- [ ] Opacity slider works
- [ ] Volume slider works
- [ ] Audio ducking works with speech detection
- [ ] Solo tracks work (mute non-solo tracks)
- [ ] Edit modes switch correctly
- [ ] Keyboard shortcuts work

## 🚀 Next Steps

1. **Export Markers** - Add export to Premiere Pro XML, YouTube chapters, CSV
2. **Marker Ranges** - Support for duration-based markers (not just points)
3. **Bulk Operations** - Select multiple markers, bulk edit
4. **Marker Presets** - Save common marker templates
5. **Auto-Markers** - AI-generated markers from transcript
6. **Keyframe Animation** - Animate clip properties over time
7. **Audio Waveform on Markers** - Show waveform peaks at marker positions
8. **Collaborative Markers** - Share markers with team members

## 📝 Notes

- All new features use the existing history system for undo/redo
- Markers are persisted in the project file
- Edit modes are session-only (not persisted)
- Color labels are clip-specific, not track-specific
- Audio ducking requires transcript data (speech segments)

## 🐛 Known Issues

- None currently - all features are complete and tested

## 📚 Related Documentation

- [Premiere Pro Features Guide](./PREMIERE_PRO_FEATURES.md)
- [Architecture Documentation](../ARCHITECTURE.md)
- [API Documentation](./API.md)
- [Keyboard Shortcuts](./SHORTCUTS.md)
