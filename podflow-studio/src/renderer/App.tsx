import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useStore } from './stores/store';
import { useHistoryStore } from './stores/historyStore';
import { ClipTypeSelector, type ClipMood } from './components/ui/ClipTypeSelector';
import { CaptionStyleSelector } from './components/ui/CaptionStyleSelector';
import { CaptionOverlay } from './components/ui/CaptionOverlay';
import { HistoryScreen } from './components/ui/HistoryScreen';
import { VideoAndTranscriptModal } from './components/ui/VideoAndTranscriptModal';
import { SettingsModal } from './components/ui/SettingsModal';
import { CutsPanel } from './components/ui/CutsPanel';
import GlobalBusyOverlay from './components/ui/GlobalBusyOverlay';
import type { Clip, Transcript, SpeakerSegment } from './types';
import { formatDuration, getScoreLabel } from './types';
import { ScoreBadge, StatusBadge } from './components/ui/Badge';
import { 
  clampFramingModel, 
  createCenterCropFramingModel,
  createFaceCenteredFramingModel,
  createSpeakerOrientedFramingModel,
  getFramingAtTime,
  generateSpeakerKeyframes,
  assignDefaultSpeakerPositions,
} from '../shared/framing';

// 4 screens: Home, Review, Export, History
type Screen = 'home' | 'review' | 'export' | 'history';

function filePathToFileUrl(filePath: string): string {
  const trimmed = filePath.trim();
  if (trimmed.startsWith('file://')) return trimmed;

  // Electron/Chromium expects file URLs like: file:///C:/Users/... (not file://C:\Users\...)
  const normalized = trimmed.replace(/\\/g, '/');
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `file://${encodeURI(withLeadingSlash)}`;
}

function App() {
  const { 
    project,
    setProject,
    clips,
    setDetectionProgress, 
    setDetectionError, 
    setDetecting,
    isDetecting,
    detectionError,
    addDetectionLog,
    clearDetectionLogs,
    setResults,
    updateClipStatus,
    updateClipTrim,
    updateClipAutoOrient,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateClipSpeakerPosition,
    setExportProgress,
    setExporting,
    isExporting,
    setLastExportDir,
    lastExportDir,
    currentJobId,
    setCurrentJobId,
    setLastJobId,
    settings,
    transcript,
    transcriptAvailable,
    transcriptError,
    setTranscriptMeta,
    captionStyle,
    setCaptionStyle,
    openaiApiKey,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    speakerSegments,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    speakerPositions,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    autoOrientEnabled,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setSpeakerSegments,
    setSpeakerPositions,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setAutoOrientEnabled,
  } = useStore();

  const { addProject, updateProject, addClip: addClipToHistory, getProjectClips, getProject } = useHistoryStore();

  const [screen, setScreen] = useState<Screen>('home');
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [exportedClips, setExportedClips] = useState<string[]>([]);
  const [showCaptions, setShowCaptions] = useState(true);
  const [selectedMood, setSelectedMood] = useState<ClipMood>('all');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadedFromHistory, setLoadedFromHistory] = useState(false);
  const [showVideoTranscriptModal, setShowVideoTranscriptModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const previewStageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wasPlayingBeforeScrubRef = useRef(false);
  const currentJobIdRef = useRef<string | null>(currentJobId);
  const detectingStartedAtRef = useRef<number | null>(null);
  const projectRef = useRef(project);
  const currentProjectIdRef = useRef<string | null>(currentProjectId);

  useEffect(() => {
    currentJobIdRef.current = currentJobId;
  }, [currentJobId]);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  // Ensure video element reloads when the underlying source file changes.
  useEffect(() => {
    if (!project?.filePath) return;
    const video = videoRef.current;
    if (!video) return;

    try {
      video.pause();
      video.load();
    } catch {
      // ignore
    }
  }, [project?.filePath]);

  useEffect(() => {
    currentProjectIdRef.current = currentProjectId;
  }, [currentProjectId]);

  // Note: ResizeObserver for preview stage was removed as it's not currently used
  // Could be re-enabled if preview size needs to be tracked

  const ensureMinDetectingTime = useCallback(async (minMs = 400) => {
    const startedAt = detectingStartedAtRef.current;
    if (!startedAt) return;
    const elapsed = Date.now() - startedAt;
    if (elapsed < minMs) {
      await new Promise((resolve) => setTimeout(resolve, minMs - elapsed));
    }
  }, []);

  const inferMoodFromPattern = useCallback((pattern: Clip['pattern'] | undefined): Clip['mood'] => {
    switch (pattern) {
      case 'laughter':
        return 'funny';
      case 'debate':
        return 'serious';
      case 'monologue':
        return 'revealing';
      case 'payoff':
      default:
        return 'impactful';
    }
  }, []);

  const normalizePattern = useCallback((value: unknown): Clip['pattern'] | undefined => {
    switch (value) {
      case 'payoff':
      case 'monologue':
      case 'laughter':
      case 'debate':
        return value;
      default:
        return undefined;
    }
  }, []);

  // Log store hydration on mount
  useEffect(() => {
    console.log('[App Mount] Store hydration check:', {
      clips: clips.length,
      transcriptSegments: transcript?.segments?.length || 0,
      captionStyle: captionStyle,
      screen: screen,
    });
  }, []);

  // IPC listeners
  useEffect(() => {
    const unsubProgress = window.api.onDetectionProgress((data) => {
      const jobId = currentJobIdRef.current;
      if (jobId && data.projectId !== jobId) return;

      // If we get progress, we are definitely detecting.
      if (!currentJobIdRef.current) {
        setCurrentJobId(data.projectId);
      }
      setDetecting(true);

      setDetectionProgress({
        percent: data.progress,
        message: data.message,
      });
    });

    const unsubLog = window.api.onDetectionLog((data) => {
      const jobId = currentJobIdRef.current;
      // Never let late log lines (e.g. process exit) resurrect a finished job.
      // Only accept logs for an already-active job, or for a job we *just* started
      // and are still waiting on initial progress.
      if (jobId) {
        if (data.projectId !== jobId) return;
      } else {
        if (!detectingStartedAtRef.current) return;
        setCurrentJobId(data.projectId);
      }

      // Don't force detecting=true purely from logs; progress events drive that.
      addDetectionLog({ ts: data.ts, line: data.line, stream: data.stream });
    });

    const unsubComplete = window.api.onDetectionComplete(async (data) => {
      const jobId = currentJobIdRef.current;
      const payload = data as unknown as {
        projectId: string;
        clips?: unknown;
        transcript?: unknown;
        transcriptAvailable?: unknown;
        transcriptError?: unknown;
        transcriptSource?: unknown;
        speakers?: unknown;
      };

      if (jobId && payload.projectId !== jobId) return;

      await ensureMinDetectingTime();
      
      const transcriptAvailableFromPayload = typeof payload.transcriptAvailable === 'boolean' ? payload.transcriptAvailable : undefined;
      const transcriptErrorFromPayload =
        payload.transcriptError === null || typeof payload.transcriptError === 'string'
          ? (payload.transcriptError as string | null)
          : null;
      const transcriptSourceFromPayload =
        payload.transcriptSource === null || typeof payload.transcriptSource === 'string'
          ? (payload.transcriptSource as string | null)
          : null;

      const transcriptObj = payload.transcript as { segments?: unknown } | null | undefined;
      const transcriptSegmentsLen = Array.isArray(transcriptObj?.segments) ? transcriptObj!.segments.length : 0;

      // Process speaker segments from diarization
      const speakersPayload = payload.speakers as SpeakerSegment[] | undefined;
      const speakerSegs: SpeakerSegment[] = Array.isArray(speakersPayload) ? speakersPayload : [];
      console.log('[App] Speaker segments received:', speakerSegs.length);
      
      // Assign default speaker positions based on detected speakers
      const speakerIds = [...new Set(speakerSegs.map(s => s.speakerId))];
      const defaultPositions = assignDefaultSpeakerPositions(speakerIds);
      console.log('[App] Assigned speaker positions:', defaultPositions);

      const clipsPayload = payload.clips;
      console.log('[App] Detection complete, clips:', Array.isArray(clipsPayload) ? clipsPayload.length : 0, 'transcript segments:', transcriptSegmentsLen);
      const rawClips = Array.isArray(clipsPayload) ? clipsPayload : [];
      const inputWidth = projectRef.current?.width || 1920;
      const inputHeight = projectRef.current?.height || 1080;
      const defaultFraming = createCenterCropFramingModel({
        inputWidth,
        inputHeight,
        targetWidth: 1080,
        targetHeight: 1920,
      });
      
      // Generate framing keyframes for each clip based on speaker segments
      const clips = (rawClips as Clip[]).map((clip, index) => {
        const clipData: Clip = {
          ...clip,
          id: clip.id || `clip_${index + 1}`,
          status: 'pending' as const,
          trimStartOffset: clip.trimStartOffset || 0,
          trimEndOffset: clip.trimEndOffset || 0,
          mood: (clip.mood as Clip['mood']) || inferMoodFromPattern(normalizePattern((clip as { pattern?: unknown }).pattern)),
          framing: clip.framing || defaultFraming,
          autoOrientEnabled: true, // Always enable by default - fallback to center if no speaker data
        };
        
        // Generate framing keyframes for this clip
        if (speakerSegs.length > 0) {
          // We have speaker diarization data - use it for smart framing
          const keyframes = generateSpeakerKeyframes(
            speakerSegs,
            defaultPositions,
            inputWidth,
            inputHeight,
            1080,
            1920,
            clipData.startTime,
            clipData.endTime
          );
          if (keyframes.length > 0) {
            clipData.framingKeyframes = keyframes;
          }
        }
        
        // If no keyframes from speaker diarization, use face detection result
        // The detector.py now adds speakerPositionData with face_center_x for precise positioning
        if (!clipData.framingKeyframes || clipData.framingKeyframes.length === 0) {
          // Get exact face center position from detection (0-1, defaults to 0.5 for center)
          const positionData = (clip as { speakerPositionData?: { face_center_x?: number; num_faces?: number; confidence?: number; position?: string } }).speakerPositionData;
          const debugFaceDetection = (clip as { debug?: { faceDetection?: { face_center_x?: number } } }).debug?.faceDetection;
          const faceCenterX = positionData?.face_center_x ?? debugFaceDetection?.face_center_x ?? 0.5;
          const numFaces = positionData?.num_faces ?? 0;
          const detConfidence = positionData?.confidence ?? 0;

          // Heuristic: "fallback" means OpenCV couldn't find a face/person and we defaulted to 0.5.
          const isFallbackCenter = numFaces === 0 && detConfidence <= 0.35 && Math.abs(faceCenterX - 0.5) < 1e-6;
          
          // Store exact face position for use in preview/export
          clipData.faceCenterX = faceCenterX;
          clipData.faceDetectionNumFaces = numFaces;
          clipData.faceDetectionConfidence = detConfidence;
          clipData.faceDetectionSource = numFaces > 0 ? 'face' : (detConfidence >= 0.4 ? 'person' : 'fallback');
          
          // Enable auto-orient by default when we have face detection data
          clipData.autoOrientEnabled = true;

          // Create framing:
          // - When detection gives us a meaningful center_x: face-centered.
          // - When detection fell back: bias based on categorical speakerPosition (if provided).
          const detectedPosition = (clip as { speakerPosition?: string }).speakerPosition;
          const validPosition = detectedPosition && ['left', 'center', 'right'].includes(detectedPosition)
            ? (detectedPosition as 'left' | 'center' | 'right')
            : 'center';

          const autoFraming = !isFallbackCenter
            ? createFaceCenteredFramingModel({
                inputWidth,
                inputHeight,
                targetWidth: 1080,
                targetHeight: 1920,
                faceCenterX,
              })
            : createSpeakerOrientedFramingModel({
                inputWidth,
                inputHeight,
                targetWidth: 1080,
                targetHeight: 1920,
                speakerPosition: validPosition,
              });
          clipData.framingKeyframes = [{
            time: clipData.startTime,
            framing: autoFraming,
            speakerId: 'face_detection',
          }];

          console.log(
            `[App] Clip ${clipData.id}: face detection → ${isFallbackCenter ? `fallback(${validPosition})` : `x=${faceCenterX.toFixed(3)} faces=${numFaces}`}, autoOrientEnabled=true`
          );
        }
        
        return clipData;
      });

      // Project-wide bias: if some clips detected a subject center but others fell back,
      // apply the average center to the fallback clips so the whole project frames consistently.
      const biasCandidates = clips
        .filter(c => (c.faceDetectionConfidence ?? 0) >= 0.4 && c.faceCenterX !== undefined)
        .map(c => c.faceCenterX as number);
      const projectBiasX = biasCandidates.length > 0
        ? biasCandidates.reduce((a, b) => a + b, 0) / biasCandidates.length
        : undefined;

      const finalClips: Clip[] = projectBiasX === undefined
        ? clips
        : clips.map((c): Clip => {
            const isFallback = (c.faceDetectionSource === 'fallback');
            if (!isFallback) return c;

            // Replace the initial face-detection keyframe with a project-biased framing.
            if (c.framingKeyframes && c.framingKeyframes.length > 0) {
              const biased = createFaceCenteredFramingModel({
                inputWidth,
                inputHeight,
                targetWidth: 1080,
                targetHeight: 1920,
                faceCenterX: projectBiasX,
              });
              return {
                ...c,
                faceCenterX: projectBiasX,
                faceDetectionSource: 'project-bias' as const,
                framingKeyframes: [{
                  ...c.framingKeyframes[0],
                  framing: biased,
                }],
              };
            }
            return c;
          });

      console.log('[App] Processed clips:', finalClips.length);
      console.log('[App] Transcript received:', payload.transcript ? `${transcriptSegmentsLen || 0} segments` : 'null');
      
      // Update speaker positions in store
      setSpeakerPositions(defaultPositions);
      
      setResults(finalClips, [], (payload.transcript as Transcript | null) || null, {
        transcriptAvailable: transcriptAvailableFromPayload,
        transcriptError: transcriptErrorFromPayload,
        transcriptSource: transcriptSourceFromPayload,
      }, speakerSegs);
      setCurrentJobId(null);
      setLastJobId(payload.projectId);
      clearDetectionLogs();
      detectingStartedAtRef.current = null;
      
      // Add to history
      const projectForHistory = projectRef.current;
      const projectIdForHistory = currentProjectIdRef.current;
      if (projectForHistory && projectIdForHistory) {
        console.log('[App] Saving transcript and detected clips to history project:', projectIdForHistory);
        
        // Convert clips to history format
        const detectedClipsForHistory = clips.map(clip => ({
          id: clip.id,
          startTime: clip.startTime,
          endTime: clip.endTime,
          duration: clip.duration,
          title: clip.title,
          mood: clip.mood,
          pattern: clip.pattern,
          patternLabel: clip.patternLabel,
          description: clip.description,
          algorithmScore: clip.algorithmScore,
          finalScore: clip.finalScore,
          hookStrength: clip.hookStrength,
          hookMultiplier: clip.hookMultiplier,
          status: clip.status,
          captionStyle: clip.captionStyle,
        }));
        
        updateProject(projectIdForHistory, {
          clipCount: clips.length,
          acceptedCount: 0,
          transcript: payload.transcript || null,
          transcriptAvailable: transcriptAvailableFromPayload,
          transcriptError: transcriptErrorFromPayload,
          transcriptSource: transcriptSourceFromPayload,
          detectedClips: detectedClipsForHistory,
        });
      }
      
      if (clips.length > 0) {
        console.log('[App] Setting screen to review');
        setScreen('review');
        setCurrentClipIndex(0);
      } else {
        console.log('[App] No clips returned, staying on home screen');
      }
    });

    const unsubError = window.api.onDetectionError(async (data) => {
      const jobId = currentJobIdRef.current;
      if (jobId && data.projectId !== jobId) return;

      await ensureMinDetectingTime();
      setDetectionError(data.error);
      setCurrentJobId(null);
      // Keep logs visible after error (don't clear here)
      detectingStartedAtRef.current = null;
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
        setExportedClips(prev => [...prev, `${data.clipCount} clips exported`]);
      }
    });

    return () => {
      unsubProgress();
      unsubLog();
      unsubComplete();
      unsubError();
      unsubExportProgress();
      unsubExportComplete();
    };
  }, [
    addDetectionLog,
    clearDetectionLogs,
    ensureMinDetectingTime,
    inferMoodFromPattern,
    setCurrentJobId,
    setDetecting,
    setDetectionProgress,
    setDetectionError,
    setResults,
    setExportProgress,
    setExporting,
    setLastExportDir,
    setLastJobId,
  ]);

  // Handle file selection
  const handleSelectFile = useCallback(async () => {
    setShowVideoTranscriptModal(true);
  }, []);

  // Start detection (used for other screens, not modal)
  const handleGenerate = useCallback(async () => {
    console.log('[App] handleGenerate called, project:', project?.fileName);
    if (!project) {
      console.log('[App] handleGenerate: No project');
      return;
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log('[App] Starting detection with jobId:', jobId);
    setCurrentJobId(jobId);
    setDetecting(true);
    setDetectionError(null);
    setDetectionProgress({ percent: 1, message: 'Starting detection…' });
    setTranscriptMeta({ transcriptAvailable: false, transcriptError: null, transcriptSource: null });
    detectingStartedAtRef.current = Date.now();

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
    setCurrentProjectId(projectId);

    try {
      console.log('[App] Calling startDetection API');
      const result = await window.api.startDetection(
        jobId,
        project.filePath,
        { ...settings, openaiApiKey: openaiApiKey || undefined },
        project.duration
      );

      console.log('[App] startDetection result:', result);
      if (!result.success) {
        setDetectionError(result.error || 'Failed to start detection');
        setDetecting(false);
      }
    } catch (err) {
      console.error('[App] startDetection error:', err);
      setDetectionError(String(err));
      setDetecting(false);
    }
  }, [project, settings, openaiApiKey, setCurrentJobId, setDetecting, setDetectionError, setTranscriptMeta, addProject]);

  // Current clip with mood filtering
  const filteredClips = selectedMood === 'all'
    ? clips
    : clips.filter(c => c.mood === selectedMood);

  const moodCounts = useMemo(() => {
    const counts: Record<ClipMood, number> = {
      all: clips.length,
      impactful: 0,
      funny: 0,
      serious: 0,
      somber: 0,
      energetic: 0,
      revealing: 0,
    };

    for (const clip of clips) {
      const mood = clip.mood as ClipMood | undefined;
      if (!mood || mood === 'all') continue;
      if (mood in counts) counts[mood] += 1;
    }

    return counts;
  }, [clips]);
  
  // Reset index if out of bounds after filtering
  useEffect(() => {
    if (currentClipIndex >= filteredClips.length && filteredClips.length > 0) {
      setCurrentClipIndex(0);
    }
  }, [currentClipIndex, filteredClips.length]);
  
  const currentClip = filteredClips[currentClipIndex];
  const acceptedClips = clips.filter(c => c.status === 'accepted');

  const jumpToClip = useCallback((clipId: string) => {
    // If the clip isn't visible in the current filter, switch to 'all' so it becomes visible.
    const indexInFiltered = filteredClips.findIndex(c => c.id === clipId);
    if (indexInFiltered >= 0) {
      setCurrentClipIndex(indexInFiltered);
      return;
    }

    const indexInAll = clips.findIndex(c => c.id === clipId);
    if (indexInAll >= 0) {
      setSelectedMood('all');
      setCurrentClipIndex(indexInAll);
    }
  }, [clips, filteredClips]);

  // Navigation
  const goToNextClip = useCallback(() => {
    if (currentClipIndex < filteredClips.length - 1) {
      setCurrentClipIndex(currentClipIndex + 1);
    }
  }, [currentClipIndex, filteredClips.length]);

  const goToPrevClip = useCallback(() => {
    if (currentClipIndex > 0) {
      setCurrentClipIndex(currentClipIndex - 1);
    }
  }, [currentClipIndex]);

  // Accept/Reject
  const handleAccept = useCallback(() => {
    if (currentClip) {
      updateClipStatus(currentClip.id, currentClip.status === 'accepted' ? 'pending' : 'accepted');
      goToNextClip();
    }
  }, [currentClip, updateClipStatus, goToNextClip]);

  const handleReject = useCallback(() => {
    if (currentClip) {
      updateClipStatus(currentClip.id, currentClip.status === 'rejected' ? 'pending' : 'rejected');
      goToNextClip();
    }
  }, [currentClip, updateClipStatus, goToNextClip]);

  // Export all accepted clips with vertical format and captions
  const handleExportAll = useCallback(async () => {
    if (!project || acceptedClips.length === 0) return;

    try {
      const outputDir = await window.api.selectOutputDir();
      if (!outputDir) return;

      setScreen('export');
      setExporting(true);

      // Map caption style to settings
      const captionSettings = {
        viral: { fontSize: 72, outline: 4, shadow: 2 },
        minimal: { fontSize: 56, outline: 2, shadow: 1 },
        bold: { fontSize: 84, outline: 6, shadow: 3 },
      }[captionStyle] || { fontSize: 72, outline: 4, shadow: 2 };

      // Use MVP vertical export with captions
      await window.api.exportMvpClips({
        sourceFile: project.filePath,
        clips: acceptedClips.map(clip => ({
          clip_id: clip.id,
          start: clip.startTime + clip.trimStartOffset,
          end: clip.endTime + clip.trimEndOffset,
          duration: (clip.endTime + clip.trimEndOffset) - (clip.startTime + clip.trimStartOffset),
          captionStyle: clip.captionStyle || captionStyle,
          framing: clip.framing,
          framingKeyframes: clip.autoOrientEnabled !== false ? clip.framingKeyframes : undefined,
          autoOrientEnabled: clip.autoOrientEnabled,
          faceCenterX: clip.faceCenterX,  // Pass exact face position for export
        })),
        transcript: transcript || { segments: [] },
        outputDir,
        inputWidth: project.width || 1920,
        inputHeight: project.height || 1080,
        settings: {
          format: 'mp4',
          vertical: true,
          targetWidth: 1080,
          targetHeight: 1920,
          burnCaptions: true,
          captionStyle: {
            fontName: 'Arial Black',
            ...captionSettings,
          },
        },
      });

      // Update history
      if (currentProjectId) {
        updateProject(currentProjectId, {
          lastExportDir: outputDir,
          exportedCount: acceptedClips.length,
        });
        
        // Save all exported clips to history
        acceptedClips.forEach(clip => {
          addClipToHistory({
            projectId: currentProjectId,
            title: clip.title || clip.id,
            startTime: clip.startTime + clip.trimStartOffset,
            endTime: clip.endTime + clip.trimEndOffset,
            duration: (clip.endTime + clip.trimEndOffset) - (clip.startTime + clip.trimStartOffset),
            mood: clip.mood,
            exportedAt: Date.now(),
            exportPath: outputDir,
            captionStyle,
          });
        });
      }
    } catch (err) {
      console.error('Export failed:', err);
      setExporting(false);
    }
  }, [project, acceptedClips, transcript, setExporting, currentProjectId, updateProject, addClipToHistory, captionStyle]);

  // Open export folder
  const handleOpenFolder = useCallback(() => {
    if (lastExportDir) {
      window.api.openFolder(lastExportDir);
    }
  }, [lastExportDir]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (screen !== 'review') return;
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (videoRef.current) {
            if (videoRef.current.paused) videoRef.current.play();
            else videoRef.current.pause();
          }
          break;
        case 'a':
        case 'A':
          handleAccept();
          break;
        case 'r':
        case 'R':
          handleReject();
          break;
        case 'ArrowLeft':
          goToPrevClip();
          break;
        case 'ArrowRight':
          goToNextClip();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, handleAccept, handleReject, goToNextClip, goToPrevClip]);

  // Seek video when clip changes
  useEffect(() => {
    if (currentClip && videoRef.current) {
      videoRef.current.currentTime = currentClip.startTime + currentClip.trimStartOffset;
    }
  }, [currentClip]);

  // ========================================
  // SCREEN: HISTORY
  // ========================================
  if (screen === 'history') {
    return (
      <>
        <GlobalBusyOverlay />
        <HistoryScreen
          onBack={() => setScreen('home')}
          onLoadProject={(projectId) => {
          // Load clips from history - prefer detected clips, fallback to exported clips
          const historyProject = getProject(projectId);
          const exportedClips = getProjectClips(projectId);
          
          if (!historyProject) {
            console.log('Project not found:', projectId);
            setScreen('home');
            return;
          }
          
          // Try to use detected clips first (all clips from detection), then exported clips
          const detectedClips = historyProject.detectedClips || [];
          const hasDetectedClips = detectedClips.length > 0;
          const hasExportedClips = exportedClips.length > 0;
          
          if (!hasDetectedClips && !hasExportedClips) {
            console.log('No clips found for project:', projectId);
            setScreen('home');
            return;
          }
          
          // Convert clips to regular format
          let loadedClips: Clip[];
          
          if (hasDetectedClips) {
            // Use detected clips (preserves all clips from detection)
            console.log('[History Load] Using detected clips:', detectedClips.length);
            loadedClips = detectedClips.map((clip) => ({
              id: clip.id,
              startTime: clip.startTime,
              endTime: clip.endTime,
              duration: clip.duration,
              pattern: (clip.pattern || 'payoff') as 'payoff' | 'debate' | 'laughter' | 'monologue' | 'silence' | 'story_beat' | 'natural_break' | 'topic_shift' | 'quotable' | 'emotional_peak',
              patternLabel: clip.patternLabel || clip.title || '',
              description: clip.description || '',
              algorithmScore: clip.algorithmScore ?? 100,
              finalScore: clip.finalScore ?? 100,
              hookStrength: clip.hookStrength ?? 75,
              hookMultiplier: clip.hookMultiplier ?? 1.0,
              trimStartOffset: 0,
              trimEndOffset: 0,
              status: (clip.status || 'pending') as 'pending' | 'accepted' | 'rejected',
              title: clip.title,
              mood: (clip.mood || 'impactful') as 'impactful' | 'funny' | 'serious' | 'somber' | 'energetic' | 'revealing' | undefined,
              captionStyle: clip.captionStyle,
            }));
          } else {
            // Fallback to exported clips only
            console.log('[History Load] Using exported clips:', exportedClips.length);
            loadedClips = exportedClips.map((clip) => ({
              id: clip.id,
              startTime: clip.startTime,
              endTime: clip.endTime,
              duration: clip.duration,
              pattern: 'payoff' as const,
              patternLabel: clip.title,
              description: `Exported clip`,
              algorithmScore: 100,
              finalScore: 100,
              hookStrength: 75,
              hookMultiplier: 1.0,
              trimStartOffset: 0,
              trimEndOffset: 0,
              status: 'accepted' as const,
              title: clip.title,
              mood: (clip.mood || 'impactful') as 'impactful' | 'funny' | 'serious' | 'somber' | 'energetic' | 'revealing' | undefined,
              captionStyle: clip.captionStyle,
            }));
          }

          const nextProject = {
            filePath: historyProject.filePath,
            fileName: historyProject.fileName,
            duration: historyProject.duration,
            size: historyProject.size ?? 0,
            resolution: historyProject.resolution,
            width: historyProject.width,
            height: historyProject.height,
            fps: historyProject.fps,
            thumbnailPath: historyProject.thumbnailPath,
            bitrate: historyProject.bitrate,
          };
          
          // Set the loaded clips and go to review screen
          const loadedTranscript = (historyProject.transcript as Transcript | null) ?? null;
          const loadedTranscriptObj = loadedTranscript as { segments?: unknown } | null;
          const loadedSegmentsLen = Array.isArray(loadedTranscriptObj?.segments) ? loadedTranscriptObj!.segments.length : 0;
          console.log('[History Load] Loading transcript:', loadedTranscript ? `${loadedSegmentsLen} segments` : 'null');

          const transcriptMeta = {
            transcriptAvailable: historyProject.transcriptAvailable,
            transcriptError: historyProject.transcriptError ?? null,
            transcriptSource: historyProject.transcriptSource ?? null,
          };

          const initialCaptionStyle = loadedClips[0]?.captionStyle;

          // Hard reset first so the <video> can't visually "stick" to a previous source.
          setProject(null);
          setResults([], [], null, {
            transcriptAvailable: false,
            transcriptError: null,
            transcriptSource: null,
          });
          setCurrentTime(0);
          setCurrentClipIndex(0);

          // Apply the selected history project on the next tick.
          setTimeout(() => {
            setProject(nextProject);
            setResults(loadedClips, [], loadedTranscript, transcriptMeta);
            if (initialCaptionStyle) setCaptionStyle(initialCaptionStyle);
            setCurrentProjectId(projectId);
            setLoadedFromHistory(true);
            setCurrentClipIndex(0);
            setScreen('review');
          }, 0);
          }}
        />
      </>
    );
  }

  // ========================================
  // SCREEN 1: HOME
  // ========================================
  if (screen === 'home') {
    return (
      <>
        <GlobalBusyOverlay />
        <div className="h-screen w-screen flex flex-col bg-sz-bg text-sz-text relative">
          {/* Settings and History Buttons - Fixed Top Right */}
          <div className="absolute top-6 right-6 flex gap-2 z-10">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2.5 hover:bg-sz-bg-secondary rounded-lg transition-colors"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={() => setScreen('history')}
              className="p-2.5 hover:bg-sz-bg-secondary rounded-lg transition-colors"
              title="View History"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>

          {/* Main Content - Centered */}
          <div className="flex-1 flex items-center justify-center px-8">
            <div className="max-w-2xl w-full space-y-8">
              {/* Header */}
              <div className="text-center space-y-2">
                <h1 className="text-5xl font-bold tracking-tight">PodFlow ®</h1>
                <p className="text-lg text-sz-text-muted">Find the best clips in your podcast</p>
              </div>

              {/* Workflow Steps */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-sz-accent text-white flex items-center justify-center text-lg font-bold mx-auto">1</div>
                  <div>
                    <p className="font-semibold text-sm">Upload Video</p>
                    <p className="text-xs text-sz-text-muted mt-1">Select your podcast video file</p>
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-sz-accent text-white flex items-center justify-center text-lg font-bold mx-auto">2</div>
                  <div>
                    <p className="font-semibold text-sm">Add Transcript</p>
                    <p className="text-xs text-sz-text-muted mt-1">Upload SRT/VTT for captions</p>
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-sz-accent text-white flex items-center justify-center text-lg font-bold mx-auto">3</div>
                  <div>
                    <p className="font-semibold text-sm">Review Clips</p>
                    <p className="text-xs text-sz-text-muted mt-1">Accept/reject with captions visible</p>
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-sz-accent text-white flex items-center justify-center text-lg font-bold mx-auto">4</div>
                  <div>
                    <p className="font-semibold text-sm">Export</p>
                    <p className="text-xs text-sz-text-muted mt-1">Save clips with captions burned in</p>
                  </div>
                </div>
              </div>

              {/* New Project Button */}
              <button
                onClick={handleSelectFile}
                className="w-full p-12 border-2 border-dashed border-sz-border rounded-2xl hover:border-sz-accent hover:bg-sz-bg-secondary transition-all group"
              >
                <p className="text-5xl mb-3 group-hover:scale-110 transition-transform">🎬</p>
                <p className="font-bold text-xl mb-1">Start New Project</p>
                <p className="text-sm text-sz-text-muted">Upload video + transcript</p>
              </button>

              {/* Review Clips Button (if clips exist) */}
              {clips.length > 0 && !isDetecting && (
                <button
                  onClick={() => setScreen('review')}
                  className="w-full py-5 px-6 bg-sz-accent text-white font-bold rounded-xl hover:bg-sz-accent-hover transition-all shadow-lg hover:shadow-xl text-lg"
                >
                  📺 Review {clips.length} Detected Clips
                </button>
              )}

          {detectionError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <p className="text-sm text-red-400">{detectionError}</p>
            </div>
          )}
            </div>
          </div>
        </div>

        {showVideoTranscriptModal && (
        <VideoAndTranscriptModal
          onConfirm={async (data) => {
            console.log('[App] Modal confirmed with:', data);
            try {
                // Start showing feedback immediately (even before ffprobe validation finishes)
                const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                console.log('[App] Starting detection with jobId:', jobId);

                setCurrentJobId(jobId);
                setDetecting(true);
                setDetectionError(null);
                setDetectionProgress({ percent: 1, message: 'Validating video…' });
                setTranscriptMeta({ transcriptAvailable: false, transcriptError: null, transcriptSource: null });
                detectingStartedAtRef.current = Date.now();

              const validation = await window.api.validateFile(data.videoPath);
              if (!validation.valid) {
                  setCurrentJobId(null);
                  setDetecting(false);
                  setDetectionProgress(null);
                  throw new Error(validation.error || 'Invalid video file');
                return;
              }

                setDetectionProgress({ percent: 3, message: 'Preparing project…' });

              // Create project object from validation data
              const projectData = {
                filePath: data.videoPath,
                fileName: data.videoName,
                size: data.videoSize,
                duration: validation.duration || 0,
                resolution: validation.resolution,
                width: validation.width,
                height: validation.height,
                fps: validation.fps,
                thumbnailPath: validation.thumbnailPath,
                bitrate: validation.bitrate,
                videoHash: data.videoHash,
              };

              // Set project AND start detection immediately with the project data
              setProject(projectData);
              setShowVideoTranscriptModal(false);

              setDetectionProgress({ percent: 4, message: 'Starting detection…' });

              // Add to history
              const projectId = addProject({
                fileName: projectData.fileName,
                filePath: projectData.filePath,
                duration: projectData.duration,
                clipCount: 0,
                acceptedCount: 0,
                thumbnailPath: projectData.thumbnailPath,
                size: projectData.size,
                resolution: projectData.resolution,
                width: projectData.width,
                height: projectData.height,
                fps: projectData.fps,
                bitrate: projectData.bitrate,
              });
              setCurrentProjectId(projectId);

              try {
                console.log('[App] Calling startDetection API');
                const result = await window.api.startDetection(
                  jobId,
                  projectData.filePath,
                  { ...settings, openaiApiKey: openaiApiKey || undefined },
                  projectData.duration
                );

                console.log('[App] startDetection result:', result);
                if (!result.success) {
                  setCurrentJobId(null);
                  setDetecting(false);
                  setDetectionProgress(null);
                  throw new Error(result.error || 'Failed to start detection');
                }
              } catch (err) {
                console.error('[App] startDetection error:', err);
                setDetectionError(err instanceof Error ? err.message : String(err));
                setDetecting(false);
                setDetectionProgress(null);
                setCurrentJobId(null);
                throw err;
              }
            } catch (err: unknown) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              console.error('[App] Modal error:', errorMessage);
              // Surface error inside the modal (it will stay open if we didn't close it yet)
              throw new Error(errorMessage || 'Failed to start detection');
            }
          }}
          onCancel={() => setShowVideoTranscriptModal(false)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} />
      )}
      </>
    );
  }

  // ========================================
  // SCREEN 2: REVIEW
  // ========================================
  if (screen === 'review') {
    // Handle no clips after filtering
    if (filteredClips.length === 0) {
      return (
        <>
          <GlobalBusyOverlay />
          <div className="h-screen w-screen flex flex-col bg-sz-bg text-sz-text">
            <div className="p-4 border-b border-sz-border flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setScreen('home')}
                className="p-2 hover:bg-sz-bg-secondary rounded-lg transition-colors"
                title="Back to Home"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <ClipTypeSelector
                selectedMood={selectedMood}
                onMoodChange={(mood) => {
                  setSelectedMood(mood);
                  setCurrentClipIndex(0);
                }}
                moodCounts={moodCounts}
              />
            </div>
            <div className="text-sm text-sz-text-muted">
              0 clips (0 total)
            </div>
          </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
              <div className="text-6xl">🔍</div>
              <h3 className="text-xl font-semibold">No clips match this filter</h3>
              <p className="text-sz-text-muted">Try selecting a different mood or view all clips</p>
              <button
                onClick={() => setSelectedMood('all')}
                className="px-6 py-3 bg-sz-accent text-white rounded-lg hover:bg-sz-accent-hover transition-colors"
              >
                View All Clips
              </button>
              </div>
            </div>
          </div>
        </>
      );
    }

    if (!currentClip) {
      return (
        <>
          <GlobalBusyOverlay />
          <div className="h-screen w-screen flex items-center justify-center bg-sz-bg text-sz-text">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sz-accent mx-auto"></div>
              <p className="text-sz-text-muted">Loading clips...</p>
            </div>
          </div>
        </>
      );
    }

    const effectiveStart = currentClip.startTime + currentClip.trimStartOffset;
    const effectiveEnd = currentClip.endTime + currentClip.trimEndOffset;
    const duration = effectiveEnd - effectiveStart;

    const previewRingClass =
      currentClip.status === 'accepted'
        ? 'ring-4 ring-green-600/40'
        : currentClip.status === 'rejected'
        ? 'ring-4 ring-red-600/40'
        : 'ring-0';

    return (
      <>
        <GlobalBusyOverlay />
        <div className="h-screen w-screen flex flex-col min-h-0 bg-sz-bg text-sz-text">
          {/* Caption Warning Banner */}
          {showCaptions && (!transcriptAvailable || !transcript || !transcript.segments || transcript.segments.length === 0) && (
            <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2 flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm text-yellow-400">
                ⚠️ No transcript available — captions won’t show.
                {transcriptError ? ` ${transcriptError}` : ''}
              </span>
            </div>
          )}
        
        {/* Top Bar with Filter */}
        <div className="p-4 border-b border-sz-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (loadedFromHistory) {
                  console.log('[Review] Going back to history');
                  setLoadedFromHistory(false);
                  setScreen('history');
                } else {
                  console.log('[Review] Going back to home, current transcript segments:', transcript?.segments?.length || 0);
                  setScreen('home');
                }
              }}
              className="p-2 hover:bg-sz-bg-secondary rounded-lg transition-colors"
              title={loadedFromHistory ? "Back to History" : "Back to Home"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            {loadedFromHistory && (
              <div className="px-3 py-1 bg-blue-600/20 text-blue-400 text-sm rounded-lg border border-blue-600/30">
                📂 Viewing Exported Clips
              </div>
            )}
            <ClipTypeSelector
              selectedMood={selectedMood}
              onMoodChange={(mood) => {
                setSelectedMood(mood);
                setCurrentClipIndex(0);
              }}
              moodCounts={moodCounts}
            />
            <CaptionStyleSelector
              selectedStyle={captionStyle}
              onStyleChange={setCaptionStyle}
            />
          </div>
          <div className="text-sm text-sz-text-muted">
            {filteredClips.length} clips {selectedMood !== 'all' && `(${clips.length} total)`}
          </div>
        </div>

        {/* Review Layout (3-column): Left = video preview, Middle = controls, Right = cuts panel */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Left Column: Video Preview */}
          <div className="w-[380px] min-w-[380px] shrink-0 flex items-center justify-center bg-black p-4 border-r border-sz-border">
            <div ref={previewStageRef} className="flex items-center justify-center w-full h-full">
              {(() => {
                const inputWidth = project?.width || 1920;
                const inputHeight = project?.height || 1080;
                
                // Get face center X position (from detection or default to center)
                const faceCenterX = currentClip.faceCenterX ?? 0.5;
                
                // Create face-centered framing based on exact face position
                const faceFraming = createFaceCenteredFramingModel({
                  inputWidth,
                  inputHeight,
                  targetWidth: 1080,
                  targetHeight: 1920,
                  faceCenterX,
                });
                
                const baseFraming = currentClip.framing || faceFraming;

                // Use dynamic speaker-oriented framing if we have keyframes
                // Otherwise use the face-centered framing
                let framing = baseFraming;
                
                if (currentClip.autoOrientEnabled !== false) {
                  if (currentClip.framingKeyframes && currentClip.framingKeyframes.length > 0) {
                    // Use keyframe-based framing (from speaker diarization or face detection)
                    const dynamicFraming = getFramingAtTime(currentClip.framingKeyframes, currentTime, 0.4);
                    if (dynamicFraming) {
                      framing = dynamicFraming;
                    }
                  } else {
                    // Use face-centered framing
                    framing = faceFraming;
                  }
                }

                // Always preview in the *export* output aspect so preview matches export.
                const exportWidth = 1080;
                const exportHeight = 1920;
                const previewFraming = clampFramingModel({
                  ...framing,
                  width: exportWidth,
                  height: exportHeight,
                  aspect: exportWidth / exportHeight,
                });

                // Preview crop using object-fit: cover + object-position.
                // For a 16:9 video in a 9:16 container with object-fit: cover:
                // - Video height fills container, width overflows
                // - object-position: X% aligns X% of video with X% of container
                // - To show crop starting at crop.x: X = crop.x / (1 - crop.w) * 100
                const cropW = previewFraming.crop.w || 1;
                const cropX = previewFraming.crop.x || 0;
                const maxOffset = Math.max(0.001, 1 - cropW); // Avoid division by zero
                const objectPositionX = Math.min(100, Math.max(0, (cropX / maxOffset) * 100));

                return (
                  <div 
                    className={`relative rounded-xl overflow-hidden ${previewRingClass}`} 
                    style={{ 
                      aspectRatio: '9 / 16',
                      width: '100%',
                      maxHeight: 'calc(100vh - 140px)',
                    }}
                  >
                    <video
                      key={project?.filePath || 'no-project'}
                      ref={videoRef}
                      src={project ? filePathToFileUrl(project.filePath) : undefined}
                      className="w-full h-full object-cover transition-all duration-300 ease-out"
                      style={{
                        objectPosition: `${objectPositionX}% 50%`,
                      }}
                  controls={false}
                  onTimeUpdate={(e) => {
                    const time = e.currentTarget.currentTime;
                    setCurrentTime(time);
                    // Loop clip when it reaches the end
                    if (time >= effectiveEnd && videoRef.current) {
                      videoRef.current.currentTime = effectiveStart;
                    }
                  }}
                  onClick={() => {
                    if (videoRef.current) {
                      if (videoRef.current.paused) videoRef.current.play();
                      else videoRef.current.pause();
                    }
                  }}
                    />
                    <div className="absolute top-3 left-3 pointer-events-none">
                      <StatusBadge status={currentClip.status} />
                    </div>

                    <CaptionOverlay
                      transcript={transcript}
                      transcriptAvailable={transcriptAvailable}
                      transcriptError={transcriptError}
                      currentTime={currentTime}
                      clipStart={effectiveStart}
                      clipEnd={effectiveEnd}
                      captionStyle={captionStyle}
                      show={showCaptions}
                    />
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Middle Column: Clip Info & Controls */}
          <div className="flex-1 min-w-0 flex flex-col overflow-y-auto bg-sz-bg-secondary">
            <div className="p-6 space-y-4">
            
            {/* Timeline controls at top of bottom panel */}
            {(() => {
              const clipDuration = Math.max(0, duration || 0);
              const clipTime = Math.max(0, Math.min(clipDuration, currentTime - effectiveStart));

              const seekTo = (nextClipTimeSeconds: number, options?: { resumeIfPlaying?: boolean }) => {
                const video = videoRef.current;
                if (!video) return;
                const clamped = Math.max(0, Math.min(clipDuration, nextClipTimeSeconds));
                video.currentTime = effectiveStart + clamped;
                setCurrentTime(video.currentTime);
                if (options?.resumeIfPlaying && wasPlayingBeforeScrubRef.current) {
                  void video.play();
                }
              };

              return (
                <div className="bg-sz-bg border border-sz-border rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="px-3 py-2 rounded-md bg-sz-bg-tertiary hover:bg-sz-bg-hover transition-colors text-sm font-medium"
                      onClick={() => {
                        const video = videoRef.current;
                        if (!video) return;
                        if (video.paused) void video.play();
                        else video.pause();
                      }}
                      title="Play / Pause"
                    >
                      {videoRef.current?.paused ? '▶ Play' : '⏸ Pause'}
                    </button>

                    <button
                      type="button"
                      className="px-3 py-2 rounded-md bg-sz-bg-tertiary hover:bg-sz-bg-hover transition-colors text-sm font-medium"
                      onClick={() => {
                        const video = videoRef.current;
                        if (!video) return;
                        video.currentTime = effectiveStart;
                        setCurrentTime(video.currentTime);
                        void video.play();
                      }}
                      title="Replay"
                    >
                      ↻ Replay
                    </button>

                    <div className="text-xs text-sz-text-secondary tabular-nums whitespace-nowrap">
                      {formatDuration(clipTime)} / {formatDuration(clipDuration)}
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={Math.max(clipDuration, 0.001)}
                      step={0.05}
                      value={clipTime}
                      onMouseDown={() => {
                        const video = videoRef.current;
                        wasPlayingBeforeScrubRef.current = !!(video && !video.paused);
                        if (video && !video.paused) video.pause();
                      }}
                      onMouseUp={() => {
                        seekTo(clipTime, { resumeIfPlaying: true });
                      }}
                      onChange={(e) => {
                        const next = Number(e.currentTarget.value);
                        seekTo(next);
                      }}
                      className="flex-1 sz-timeline-range accent-sz-accent"
                      aria-label="Video timeline"
                    />
                  </div>
                </div>
              );
            })()}

            {/* Clip Counter & Mood Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-sz-accent">
                  Clip {currentClipIndex + 1} of {filteredClips.length}
                </p>
                {currentClip.mood && (
                  <span className="px-3 py-1 text-xs font-medium bg-sz-accent/20 text-sz-accent rounded-full">
                    {currentClip.mood}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <ScoreBadge score={Math.round(currentClip.finalScore || 0)} size="sm" />
                <p className="text-sm text-sz-text-muted">
                  {formatDuration(duration)} • {getScoreLabel(Math.round(currentClip.finalScore || 0))}
                </p>
              </div>
            </div>

            {/* Title */}
            {currentClip.title && (
              <p className="font-semibold text-lg">{currentClip.title}</p>
            )}

            {/* Caption Controls - More Prominent */}
            <div className="bg-sz-bg border border-sz-accent/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={showCaptions}
                    onChange={(e) => {
                      console.log('[Captions] Toggle to:', e.target.checked);
                      setShowCaptions(e.target.checked);
                    }}
                    className="w-4 h-4 accent-sz-accent"
                  />
                  <span className="text-sm font-medium">
                    {showCaptions ? '📝 Captions ON' : '📝 Captions OFF'}
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-sz-accent/20 px-2 py-1 rounded text-sz-accent font-medium">
                    {captionStyle}
                  </span>
                  <button
                    onClick={() => {
                      // Simple cycle through caption styles
                      const styles: Array<'viral' | 'minimal' | 'bold'> = ['viral', 'minimal', 'bold'];
                      const currentIdx = styles.indexOf(captionStyle);
                      const nextIdx = (currentIdx + 1) % styles.length;
                      console.log('[Captions] Switching style from', captionStyle, 'to', styles[nextIdx]);
                      setCaptionStyle(styles[nextIdx]);
                    }}
                    className="text-xs px-2 py-1 bg-sz-bg-tertiary hover:bg-sz-accent/20 rounded transition-colors"
                  >
                    Change Style
                  </button>
                </div>
              </div>
              {(() => {
                const hasSegments = !!(transcript && transcript.segments && transcript.segments.length > 0);
                const available = transcriptAvailable || hasSegments;
                console.log('[Captions] Render check - available:', available, 'segments:', transcript?.segments?.length || 0, 'showCaptions:', showCaptions);
                
                if (showCaptions && available && hasSegments) {
                  return (
                    <p className="text-xs text-green-400">
                      ✓ {transcript.segments.length} transcript segments loaded • Captions will appear on video
                    </p>
                  );
                } else if (!showCaptions) {
                  return (
                    <p className="text-xs text-sz-text-muted">
                      Enable captions to see transcript on the video preview
                    </p>
                  );
                } else {
                  return (
                    <p className="text-xs text-yellow-400">
                      ⚠ No transcript available{transcriptError ? `: ${transcriptError}` : ' — upload transcript file or re-run detection'}
                    </p>
                  );
                }
              })()}
            </div>

            {/* Trim Controls */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-xs text-sz-text-muted">Start Trim</label>
                <input
                  type="range"
                  min={-5}
                  max={5}
                  step={0.1}
                  value={currentClip.trimStartOffset}
                  onChange={(e) => updateClipTrim(currentClip.id, parseFloat(e.target.value), currentClip.trimEndOffset)}
                  className="w-full"
                />
                <p className="text-xs text-sz-text-muted">{currentClip.trimStartOffset.toFixed(1)}s</p>
              </div>
              <div className="flex-1">
                <label className="text-xs text-sz-text-muted">End Trim</label>
                <input
                  type="range"
                  min={-5}
                  max={5}
                  step={0.1}
                  value={currentClip.trimEndOffset}
                  onChange={(e) => updateClipTrim(currentClip.id, currentClip.trimStartOffset, parseFloat(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-sz-text-muted">{currentClip.trimEndOffset.toFixed(1)}s</p>
              </div>
            </div>
            
            {/* Speaker Position & Framing Controls */}
            <div className="bg-sz-bg border border-sz-border rounded-lg p-3 space-y-3">
              {/* Auto-Orient Toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentClip.autoOrientEnabled !== false}
                  onChange={(e) => updateClipAutoOrient(currentClip.id, e.target.checked)}
                  className="w-4 h-4 accent-sz-accent"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium">
                    🎯 Smart Framing
                  </span>
                  <p className="text-xs text-sz-text-muted mt-0.5">
                    {currentClip.framingKeyframes && currentClip.framingKeyframes.length > 1
                      ? `Auto-tracking (${currentClip.framingKeyframes.length} transitions)`
                      : currentClip.faceCenterX !== undefined
                        ? (() => {
                            const pct = (currentClip.faceCenterX * 100).toFixed(0);
                            const numFaces = currentClip.faceDetectionNumFaces ?? 0;
                            const conf = currentClip.faceDetectionConfidence;
                            const source = currentClip.faceDetectionSource;
                            if (numFaces > 0) {
                              return `Auto-centered on face (${pct}%)${conf ? ` • conf ${conf.toFixed(2)}` : ''}`;
                            }
                            if (source === 'project-bias') {
                              return `Auto-centered (project bias ${pct}%)`;
                            }
                            // Coarse subject fallback (upper-body / person detector)
                            if ((conf ?? 0) >= 0.4 && currentClip.faceCenterX !== 0.5) {
                              return `Auto-centered on subject (${pct}%)`;
                            }
                            return `Centered (no detection)`;
                          })()
                        : 'Use speaker position for vertical crop'
                    }
                  </p>
                </div>
              </label>
            </div>

            {/* Action Buttons */}
            {!loadedFromHistory && (
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-wider text-sz-text-muted font-semibold">Step 1: Accept or Reject</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleAccept}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all transform hover:scale-105 ${
                      currentClip.status === 'accepted'
                        ? 'bg-green-600 text-white shadow-lg shadow-green-600/50'
                        : 'bg-sz-bg-tertiary text-sz-text hover:bg-green-600 hover:text-white'
                    }`}
                  >
                    {currentClip.status === 'accepted' ? '✓ Accepted' : '✓ Accept (A)'}
                  </button>
                  <button
                    onClick={handleReject}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all transform hover:scale-105 ${
                      currentClip.status === 'rejected'
                        ? 'bg-red-600 text-white shadow-lg shadow-red-600/50'
                        : 'bg-sz-bg-tertiary text-sz-text hover:bg-red-600 hover:text-white'
                    }`}
                  >
                    {currentClip.status === 'rejected' ? '✗ Rejected' : '✗ Reject (R)'}
                  </button>
                </div>
                <p className="text-xs text-sz-text-muted text-center">Use arrow keys to navigate clips →</p>
              </div>
            )}

            {loadedFromHistory && (
              <div className="flex items-center justify-center py-3 px-4 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-600/30">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Already Exported ✓
              </div>
            )}

            {/* Export Section */}
            {!loadedFromHistory && (
              <div className="bg-sz-bg border-2 border-sz-accent/30 rounded-lg p-4 space-y-3">
                <p className="text-xs uppercase tracking-wider text-sz-accent font-semibold">Step 2: Export Clips</p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleExportAll}
                    disabled={acceptedClips.length === 0}
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                      acceptedClips.length === 0
                        ? 'bg-sz-bg-tertiary text-sz-text'
                        : 'bg-green-600 text-white hover:bg-green-500'
                    }`}
                  >
                    {acceptedClips.length === 0
                      ? 'Export Accepted Clips →'
                      : `Export ${acceptedClips.length} Accepted →`}
                  </button>
                </div>
                <p className="text-xs text-sz-text-muted text-center">
                  {acceptedClips.length === 0
                    ? 'Accept clips above to enable export'
                    : acceptedClips.length === 1
                    ? `${acceptedClips.length} clip ready to export`
                    : `${acceptedClips.length} clips ready to export`}
                </p>
              </div>
            )}

            {/* Navigation (optional) */}
            <div className="flex items-center justify-between pt-4 border-t border-sz-border">
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPrevClip}
                  disabled={currentClipIndex === 0}
                  className="px-4 py-2 bg-sz-bg-tertiary rounded-lg hover:bg-sz-bg-hover disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  ← Prev
                </button>
                <span className="text-xs text-sz-text-muted px-2">
                  {currentClipIndex + 1} / {filteredClips.length}
                </span>
                {/* No Next button: accept/reject auto-advances; arrow keys still work */}
              </div>
              
              {loadedFromHistory && (
                <button
                  onClick={() => setScreen('home')}
                  className="px-6 py-2 bg-sz-accent text-white rounded-lg font-medium hover:bg-sz-accent-hover transition-colors"
                >
                  Done
                </button>
              )}
            </div>
            </div>
          </div>

          {/* Right Column: Cuts Panel */}
          <CutsPanel
            clips={clips}
            currentClipId={currentClip.id}
            onSelectClip={jumpToClip}
            transcript={transcript}
            transcriptAvailable={transcriptAvailable}
            transcriptError={transcriptError}
          />
        </div>
        </div>
      </>
    );
  }

  // ========================================
  // SCREEN 3: EXPORT
  // ========================================
  if (screen === 'export') {
    if (isExporting) {
      return (
        <>
          <GlobalBusyOverlay />
          <div className="h-screen w-screen bg-sz-bg" />
        </>
      );
    }

    return (
      <>
        <GlobalBusyOverlay />
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-sz-bg text-sz-text p-8">
          <div className="max-w-md w-full space-y-6 text-center">
              <div className="space-y-2 mb-4">
                <div className="text-5xl">✅</div>
                <h1 className="text-2xl font-bold">Export Complete!</h1>
              </div>

              {/* Exported Clips List */}
              {exportedClips.length > 0 && (
                <div className="text-left bg-green-600/20 border border-green-600/30 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-semibold text-green-400 mb-2">✓ Exported {exportedClips.length} clips with captions</p>
                  {exportedClips.map((item, i) => (
                    <p key={i} className="text-xs text-green-300">
                      • {item}
                    </p>
                  ))}
                </div>
              )}

              {/* Open Folder */}
              {lastExportDir && (
                <button
                  onClick={handleOpenFolder}
                  className="w-full py-3 px-6 bg-sz-accent text-white rounded-lg font-semibold hover:bg-sz-accent-hover transition-all transform hover:scale-105"
                >
                  📁 Open Export Folder
                </button>
              )}

              {/* Navigation Options */}
              <div className="flex flex-col gap-2 pt-4">
                <button
                  onClick={() => {
                    setExportedClips([]);
                    setScreen('review');
                  }}
                  className="w-full py-2 px-6 bg-sz-bg-secondary rounded-lg hover:bg-sz-bg-tertiary transition-colors font-medium"
                >
                  Back to Review
                </button>
                <button
                  onClick={() => {
                    setExportedClips([]);
                    setScreen('home');
                  }}
                  className="w-full py-2 px-6 bg-sz-bg-secondary rounded-lg hover:bg-sz-bg-tertiary transition-colors font-medium"
                >
                  New Project
                </button>
              </div>

          </div>
        </div>
      </>
    );
  }

  // Fallback
  return (
    <>
      <div className="h-screen w-screen flex items-center justify-center bg-sz-bg text-sz-text">
        <p>Loading...</p>
      </div>
      {showVideoTranscriptModal && (
        <VideoAndTranscriptModal
          onConfirm={async (data) => {
            try {
              const validation = await window.api.validateFile(data.videoPath);
              if (!validation.valid) {
                alert('Invalid video file');
                return;
              }

              setProject({
                filePath: data.videoPath,
                fileName: data.videoName,
                size: data.videoSize,
                duration: validation.duration || 0,
                resolution: validation.resolution,
                width: validation.width,
                height: validation.height,
                fps: validation.fps,
                thumbnailPath: validation.thumbnailPath,
                bitrate: validation.bitrate,
                videoHash: data.videoHash,
              });

              setShowVideoTranscriptModal(false);
              handleGenerate();
            } catch (err: unknown) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              console.error('[App] Fallback modal error:', errorMessage);
              alert('Error: ' + errorMessage);
            }
          }}
          onCancel={() => setShowVideoTranscriptModal(false)}
        />
      )}
    </>
  );
}

export default App;
