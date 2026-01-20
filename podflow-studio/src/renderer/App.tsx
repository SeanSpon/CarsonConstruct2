import { useEffect, useRef } from 'react';
import { EditorView } from './components/editor';
import DetectionSummaryModal from './components/editor/DetectionSummaryModal';
import { useStore } from './stores/store';
import type { Clip, DeadSpace, Transcript, SpeakerSegment } from './types';

function App() {
  const { 
    project,
    setDetectionProgress, 
    setDetectionError, 
    setPendingDetectionResults,
    acceptPendingResults,
    rejectPendingResults,
    pendingDetectionResults,
    setSpeakerSegments,
    setExportProgress,
    setExporting,
    setLastExportDir,
    currentJobId,
    setCurrentJobId,
    setLastJobId,
  } = useStore();

  // Restore session state on mount
  useEffect(() => {
    const state = useStore.getState();
    
    // FIX: Force correct export settings if they're wrong
    if (state.exportSettings.exportClips === false) {
      console.log('[App] Fixing export settings - enabling individual clip export');
      state.updateExportSettings({
        exportClips: true,
        exportClipsCompilation: false,
        exportFullVideo: false,
      });
    }
    
    // Validate that the persisted project file still exists
    if (state.project?.filePath) {
      // Validate file exists asynchronously
      window.api.validateFile(state.project.filePath).then((validation) => {
        if (!validation.valid) {
          // File no longer exists, clear the project
          console.log('[App] Persisted project file no longer exists, clearing state');
          useStore.getState().clearProject();
        } else {
          // File exists, update project metadata if needed
          console.log('[App] Restoring session state for project:', state.project.fileName);
        }
      }).catch(() => {
        // Error validating, clear project
        useStore.getState().clearProject();
      });
    }
  }, []); // Only run on mount

  // Use a ref to track current job ID without causing re-subscriptions
  // This prevents race conditions when detection events arrive during state updates
  const currentJobIdRef = useRef<string | null>(currentJobId);
  useEffect(() => {
    currentJobIdRef.current = currentJobId;
  }, [currentJobId]);

  // Set up IPC listeners - only once on mount
  useEffect(() => {
    // Detection progress
    const unsubProgress = window.api.onDetectionProgress((data) => {
      const jobId = currentJobIdRef.current;
      // Accept events if no job is active (jobId is null) or if projectId matches
      if (jobId && data.projectId !== jobId) return;
      setDetectionProgress({
        percent: data.progress,
        message: data.message,
      });
    });

    // Detection complete
    const unsubComplete = window.api.onDetectionComplete((data) => {
      const jobId = currentJobIdRef.current;
      // Accept events if no job is active (jobId is null) or if projectId matches
      if (jobId && data.projectId !== jobId) return;
      
      // Safely parse clips with fallback to empty array
      const rawClips = Array.isArray(data.clips) ? data.clips : [];
      const clips = (rawClips as Clip[]).map((clip, index) => ({
        ...clip,
        id: clip.id || `clip_${index + 1}`,
        status: 'pending' as const,
        trimStartOffset: clip.trimStartOffset || 0,
        trimEndOffset: clip.trimEndOffset || 0,
      }));

      // Safely parse dead spaces with fallback to empty array
      const rawDeadSpaces = Array.isArray(data.deadSpaces) ? data.deadSpaces : [];
      const deadSpaces = (rawDeadSpaces as DeadSpace[]).map((ds, index) => ({
        ...ds,
        id: ds.id || `dead_${index + 1}`,
        remove: true, // Default to remove
      }));

      // Safely parse speaker segments with fallback to empty array
      const rawSpeakers = Array.isArray(data.speakers) ? data.speakers : [];
      const speakers = (rawSpeakers as SpeakerSegment[]).map((seg, index) => ({
        ...seg,
        speakerId: seg.speakerId || `speaker_${index}`,
        speakerName: seg.speakerName || `Speaker ${index + 1}`,
      }));

      setPendingDetectionResults({ clips, deadSpaces, transcript: data.transcript as Transcript | null });
      console.log('[App] Detection complete - showing summary modal with', clips.length, 'clips');
      setSpeakerSegments(speakers);
      setCurrentJobId(null);
      setLastJobId(data.projectId);
    });

    // Detection error
    const unsubError = window.api.onDetectionError((data) => {
      const jobId = currentJobIdRef.current;
      // Accept events if no job is active (jobId is null) or if projectId matches
      if (jobId && data.projectId !== jobId) return;
      setDetectionError(data.error);
      setCurrentJobId(null);
    });

    // Export progress
    const unsubExportProgress = window.api.onExportProgress((data) => {
      setExportProgress({
        current: data.current,
        total: data.total,
        clipName: data.clipName,
      });
    });

    // Export complete
    const unsubExportComplete = window.api.onExportComplete((data) => {
      setExporting(false);
      setExportProgress(null);
      if (data.success) {
        setLastExportDir(data.outputDir);
        console.log(`✅ Export successful! ${data.clipCount} files saved to:`, data.outputDir);
        alert(`✅ Export Complete!\n\n${data.clipCount} file(s) saved to:\n${data.outputDir}\n\nFolder opened automatically.`);
      } else {
        console.error('❌ Export failed:', data.errors);
        alert(`❌ Export Failed!\n\n${data.errors.join('\n')}`);
      }
    });

    return () => {
      unsubProgress();
      unsubComplete();
      unsubError();
      unsubExportProgress();
      unsubExportComplete();
    };
  }, [
    setDetectionProgress,
    setDetectionError,
    setPendingDetectionResults,
    setSpeakerSegments,
    setExportProgress,
    setExporting,
    setLastExportDir,
    setCurrentJobId,
    setLastJobId,
  ]); // Note: currentJobId is NOT in deps - we use ref instead

  return (
    <>
      <EditorView />
      {pendingDetectionResults && (
        <DetectionSummaryModal
          clips={pendingDetectionResults.clips}
          deadSpaces={pendingDetectionResults.deadSpaces}
          transcript={pendingDetectionResults.transcript}
          onAccept={acceptPendingResults}
          onReject={rejectPendingResults}
        />
      )}
    </>
  );
}

export default App;
