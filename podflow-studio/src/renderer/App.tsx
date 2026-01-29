/**
 * 🔒 LOCKED: 3 SCREENS ONLY (Rule #2)
 * 
 * Screen 1: Upload - User provides input
 * Screen 2: Processing - System works
 * Screen 3: Review - User decides
 * 
 * THE UI IS THE SOURCE OF TRUTH (Rule #1)
 */

import { useEffect, useCallback, useRef } from 'react';
import { useStore } from './stores/store';
import { useHistoryStore } from './stores/historyStore';
import { UploadScreen, ProcessingScreen, AutoEditReview } from './pages';
import type { Clip, Transcript, ProcessingStage } from './types';

// Map backend progress messages to UI stages
function parseStageFromMessage(message: string): ProcessingStage {
  const lower = message.toLowerCase();
  
  if (lower.includes('preparing') || lower.includes('extracting') || lower.includes('stage a')) {
    return 'preparing';
  }
  if (lower.includes('transcrib') || lower.includes('listening') || lower.includes('stage b')) {
    return 'listening';
  }
  if (lower.includes('understand') || lower.includes('story') || lower.includes('feature') || lower.includes('stage c')) {
    return 'understanding';
  }
  if (lower.includes('detect') || lower.includes('finding') || lower.includes('candidate') || lower.includes('stage d')) {
    return 'finding';
  }
  if (lower.includes('scor') || lower.includes('building') || lower.includes('select') || lower.includes('stage e')) {
    return 'building';
  }
  if (lower.includes('final') || lower.includes('complete') || lower.includes('stage f')) {
    return 'finalizing';
  }
  
  // Default based on progress percentage
  return 'preparing';
}

function App() {
  const { 
    // Screen state
    screen,
    setScreen,
    currentStage,
    setCurrentStage,
    
    // Project
    project,
    setProject,
    
    // Detection
    isDetecting,
    setDetecting,
    detectionError,
    setDetectionError,
    setDetectionProgress,
    currentJobId,
    setCurrentJobId,
    setLastJobId,
    settings,
    
    // Results
    clips,
    deadSpaces,
    transcript,
    setResults,
    updateClipStatus,
    
    // Export
    isExporting,
    setExporting,
    setExportProgress,
    setLastExportDir,
    captionStyle,
  } = useStore();

  const { addProject, updateProject } = useHistoryStore();
  
  const currentJobIdRef = useRef<string | null>(currentJobId);
  const currentProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentJobIdRef.current = currentJobId;
  }, [currentJobId]);

  // ========================================
  // IPC LISTENERS
  // ========================================
  useEffect(() => {
    const unsubProgress = window.api.onDetectionProgress((data) => {
      const jobId = currentJobIdRef.current;
      if (jobId && data.projectId !== jobId) return;
      
      // Update progress
      setDetectionProgress({
        percent: data.progress,
        message: data.message,
      });
      
      // Map message to UI stage (Rule #4: Backend speaks in UI words)
      const stage = parseStageFromMessage(data.message);
      setCurrentStage(stage);
    });

    const unsubComplete = window.api.onDetectionComplete((data) => {
      const jobId = currentJobIdRef.current;
      if (jobId && data.projectId !== jobId) {
        console.log('[App] Ignoring detection-complete for different job:', data.projectId, 'current:', jobId);
        return;
      }
      
      console.log('[App] Received detection-complete:', data.clips?.length || 0, 'clips,', data.deadSpaces?.length || 0, 'dead spaces');
      
      const rawClips = Array.isArray(data.clips) ? data.clips : [];
      const processedClips = (rawClips as Clip[]).map((clip, index) => ({
        ...clip,
        id: clip.id || `clip_${index + 1}`,
        status: 'pending' as const,
        trimStartOffset: clip.trimStartOffset || 0,
        trimEndOffset: clip.trimEndOffset || 0,
        mood: clip.mood || 'impactful',
      }));

      // Extract dead spaces - these are the sections to remove
      const rawDeadSpaces = Array.isArray(data.deadSpaces) ? data.deadSpaces : [];
      console.log('[App] Dead spaces received:', rawDeadSpaces);

      setResults(processedClips, rawDeadSpaces, data.transcript as Transcript | null);
      setCurrentJobId(null);
      setLastJobId(data.projectId);
      setCurrentStage('finalizing');
      setDetecting(false); // CRITICAL: Mark detection as complete
      
      // Update history
      if (currentProjectIdRef.current) {
        updateProject(currentProjectIdRef.current, {
          clipCount: processedClips.length,
          acceptedCount: 0,
          transcript: data.transcript || null,
        });
      }
      
      // Go to review screen - ALWAYS, even with 0 clips
      console.log('[App] Switching to review screen with', processedClips.length, 'clips');
      setScreen('review');
    });

    const unsubError = window.api.onDetectionError((data) => {
      const jobId = currentJobIdRef.current;
      if (jobId && data.projectId !== jobId) return;
      setDetectionError(data.error);
      setCurrentJobId(null);
    });

    const unsubExportProgress = window.api.onExportProgress((data) => {
      setExportProgress({
        current: data.current,
        total: data.total,
        clipName: data.clipName,
      });
    });

    const unsubExportComplete = window.api.onExportComplete((data) => {
      setExporting(false);
      setExportProgress(null);
      if (data.success) {
        setLastExportDir(data.outputDir);
      }
    });

    return () => {
      unsubProgress();
      unsubComplete();
      unsubError();
      unsubExportProgress();
      unsubExportComplete();
    };
  }, []);

  // ========================================
  // HANDLERS
  // ========================================
  
  const handleStartProcessing = useCallback(async () => {
    if (!project) return;

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    setCurrentJobId(jobId);
    setDetecting(true);
    setDetectionError(null);
    setCurrentStage('preparing');
    setScreen('processing');

    // Add to history
    const projectId = addProject({
      fileName: project.fileName,
      filePath: project.filePath,
      duration: project.duration,
      clipCount: 0,
      acceptedCount: 0,
      thumbnailPath: project.thumbnailPath,
      size: project.size,
      resolution: project.resolution,
      width: project.width,
      height: project.height,
      fps: project.fps,
      bitrate: project.bitrate,
    });
    currentProjectIdRef.current = projectId;

    try {
      const result = await window.api.startDetection(
        jobId,
        project.filePath,
        settings,
        project.duration
      );

      if (!result.success) {
        setDetectionError(result.error || 'Failed to start detection');
        setDetecting(false);
      }
    } catch (err) {
      setDetectionError(String(err));
      setDetecting(false);
    }
  }, [project, settings, setCurrentJobId, setDetecting, setDetectionError, setCurrentStage, setScreen, addProject]);

  const handleCancelProcessing = useCallback(() => {
    setDetecting(false);
    setDetectionError(null);
    setScreen('upload');
  }, [setDetecting, setDetectionError, setScreen]);

  const handleClipStatusChange = useCallback((clipId: string, status: 'pending' | 'approved' | 'rejected') => {
    updateClipStatus(clipId, status);
  }, [updateClipStatus]);

  const handleExportClip = useCallback(async (clip: Clip) => {
    if (!project) return;
    // Export single clip - implementation can be added later
    console.log('Export clip:', clip.id);
  }, [project]);

  // Auto-Edit Export: Remove dead spaces + burn captions
  const handleExportAll = useCallback(async () => {
    if (!project) return;
    
    try {
      const outputDir = await window.api.selectOutputDir();
      if (!outputDir) return;

      setExporting(true);
      console.log('[App] Starting auto-edit export...');
      console.log('[App] Dead spaces to remove:', deadSpaces.length);
      console.log('[App] Has transcript:', !!transcript?.segments?.length);

      const result = await window.api.exportAutoEdit({
        sourceFile: project.filePath,
        outputDir,
        deadSpaces: deadSpaces.map(ds => ({
          id: ds.id,
          startTime: ds.startTime,
          endTime: ds.endTime,
          remove: ds.remove !== false, // Default to true if not specified
        })),
        transcript: transcript ? {
          segments: transcript.segments || [],
          words: transcript.words || [],
          text: transcript.text || '',
        } : null,
        videoDuration: project.duration || 0,
        burnCaptions: !!transcript?.segments?.length, // Only burn if we have captions
        captionStyle: captionStyle,
      });

      console.log('[App] Export result:', result);

      if (result.success && currentProjectIdRef.current) {
        updateProject(currentProjectIdRef.current, {
          lastExportDir: outputDir,
          exportedCount: 1,
        });
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }, [project, deadSpaces, transcript, captionStyle, setExporting, updateProject]);

  const handleBackToUpload = useCallback(() => {
    setProject(null);
    setScreen('upload');
  }, [setProject, setScreen]);

  // ========================================
  // RENDER: 3 SCREENS ONLY
  // ========================================
  
  // Screen 1: Upload
  if (screen === 'upload') {
    return (
      <UploadScreen
        onStartProcessing={handleStartProcessing}
      />
    );
  }

  // Screen 2: Processing
  if (screen === 'processing') {
    return (
      <ProcessingScreen
        currentStage={currentStage}
        detectionProgress={detectionProgress}
        error={detectionError}
        onCancel={handleCancelProcessing}
      />
    );
  }

  // Screen 3: Review - Auto-Edit Preview
  if (screen === 'review') {
    return (
      <AutoEditReview
        clips={clips}
        deadSpaces={deadSpaces}
        transcript={transcript}
        videoPath={project?.filePath || ''}
        videoDuration={project?.duration || 0}
        onBack={handleBackToUpload}
        onExport={handleExportAll}
        isExporting={isExporting}
      />
    );
  }

  // Fallback (should never reach)
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-white">
      <p>Loading...</p>
    </div>
  );
}

export default App;
