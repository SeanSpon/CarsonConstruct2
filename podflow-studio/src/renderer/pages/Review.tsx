import { useEffect, useMemo, useState, useCallback, memo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Play, Download } from 'lucide-react';
import { useStore } from '../stores/store';
import type { Clip } from '../types';
import {
  applyPatch,
  createClipProject,
  type ClipProject,
  type Patch,
  type ExportPreset,
} from '../review/clipProject';
import { PageHeader, EditorLayout } from '../components/layout';
import { Button, ErrorState, SuccessState, IconButton } from '../components/ui';
import { VideoPlayer, TrimPanel, PatchPanel, ClipDetailsPanel } from '../components/review';

function Review() {
  const navigate = useNavigate();
  const { clipId } = useParams();
  const [searchParams] = useSearchParams();
  const jobIdParam = searchParams.get('job');

  const { project, clips, transcript, exportSettings, lastJobId } = useStore();
  const [clipProject, setClipProject] = useState<ClipProject | null>(null);
  const [pendingPatch, setPendingPatch] = useState<Patch | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportComplete, setExportComplete] = useState(false);

  const clip = useMemo<Clip | undefined>(
    () => clips.find((c) => c.id === clipId),
    [clips, clipId]
  );

  const jobId = jobIdParam || lastJobId || '';

  useEffect(() => {
    if (!project) {
      navigate('/');
    }
  }, [project, navigate]);

  useEffect(() => {
    const load = async () => {
      if (!project || !clip || !jobId) return;
      const loaded = await window.api.loadClipProject(jobId, clip.id);
      if (loaded.success && loaded.payload) {
        setClipProject(loaded.payload as ClipProject);
        return;
      }

      const fresh = createClipProject(jobId, clip, project.filePath, transcript);
      setClipProject(fresh);
      await window.api.saveClipProject(jobId, clip.id, fresh);
    };
    load();
  }, [project, clip, jobId, transcript]);

  const videoSrc = useMemo(() => {
    if (!project) return '';
    const sanitized = project.filePath.replace(/\\/g, '/');
    return `file://${sanitized}`;
  }, [project]);

  const persistProject = useCallback(async (nextProject: ClipProject) => {
    setClipProject(nextProject);
    if (clip && jobId) {
      await window.api.saveClipProject(jobId, clip.id, nextProject);
    }
  }, [clip, jobId]);

  const updateInOut = useCallback(async (nextIn: number, nextOut: number) => {
    if (!clipProject) return;
    const clampedIn = Math.max(0, Math.min(nextIn, nextOut - 0.2));
    const clampedOut = Math.max(clampedIn + 0.2, nextOut);
    await persistProject({
      ...clipProject,
      edit: { ...clipProject.edit, in: clampedIn, out: clampedOut },
      updatedAt: Date.now(),
    });
  }, [clipProject, persistProject]);

  const handleReset = useCallback(() => {
    if (!clipProject || !clip) return;
    persistProject({
      ...clipProject,
      edit: { ...clipProject.edit, in: clip.startTime, out: clip.endTime },
    });
  }, [clipProject, clip, persistProject]);

  const handlePresetChange = useCallback((preset: ExportPreset) => {
    if (!clipProject) return;
    persistProject({ ...clipProject, exportPreset: preset });
  }, [clipProject, persistProject]);

  const generatePatch = useCallback((type: 'tight' | 'caption' | 'preset') => {
    if (!clipProject) return;

    let patch: Patch;

    if (type === 'tight') {
      patch = {
        id: `patch_${Date.now()}`,
        label: 'Tighten cut points',
        source: 'ai',
        createdAt: Date.now(),
        ops: [
          { type: 'nudge_in', delta: 0.2 },
          { type: 'nudge_out', delta: -0.2 },
        ],
      };
    } else if (type === 'caption') {
      const words = clipProject.captions.segments
        .slice(0, 3)
        .flatMap((seg) => seg.text.split(' '))
        .slice(0, 5);
      patch = {
        id: `patch_${Date.now()}`,
        label: 'Emphasize caption hooks',
        source: 'ai',
        createdAt: Date.now(),
        ops: [
          {
            type: 'emphasize_caption_words',
            style: 'uppercase',
            words,
          },
        ],
      };
    } else {
      patch = {
        id: `patch_${Date.now()}`,
        label: 'Apply Shorts preset',
        source: 'ai',
        createdAt: Date.now(),
        ops: [{ type: 'set_export_preset', preset: '9:16' }],
      };
    }

    setPendingPatch(patch);
  }, [clipProject]);

  const applyPendingPatch = useCallback(async () => {
    if (!clipProject || !pendingPatch) return;
    const next = applyPatch(clipProject, pendingPatch);
    setPendingPatch(null);
    await persistProject(next);
  }, [clipProject, pendingPatch, persistProject]);

  const rejectPendingPatch = useCallback(() => {
    setPendingPatch(null);
  }, []);

  const handleExport = useCallback(async () => {
    if (!project || !clipProject || !clip) return;
    setExportError(null);
    setExportComplete(false);

    try {
      const outputDir = await window.api.selectOutputDir();
      if (!outputDir) return;

      const result = await window.api.exportClips({
        sourceFile: project.filePath,
        clips: [
          {
            id: clip.id,
            startTime: clipProject.edit.in,
            endTime: clipProject.edit.out,
            trimStartOffset: 0,
            trimEndOffset: 0,
            title: clip.title,
            hookText: clip.hookText,
            category: clip.category,
          },
        ],
        deadSpaces: [],
        outputDir,
        settings: exportSettings,
      });

      if (!result.success) {
        setExportError(result.error || 'Export failed');
        return;
      }

      setExportComplete(true);
    } catch (err) {
      setExportError(String(err));
    }
  }, [project, clipProject, clip, exportSettings]);

  if (!project || !clip || !clipProject) return null;

  return (
    <div className="h-full flex flex-col bg-sz-bg">
      <PageHeader
        title="Review Clip"
        subtitle={clip.title || `Clip ${clip.id}`}
        icon={<Play className="w-4 h-4" />}
        compact
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={handleExport}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export Clip
          </Button>
        }
      >
        <button
          onClick={() => navigate('/clips')}
          className="flex items-center gap-1.5 text-sz-text-secondary hover:text-sz-accent text-xs mt-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Clips
        </button>
      </PageHeader>

      <div className="flex-1 overflow-hidden">
        <EditorLayout
          showLeftPanel={false}
          centerPanel={
            <div className="p-4 space-y-4">
              <VideoPlayer
                src={videoSrc}
                clipProject={clipProject}
              />

              <TrimPanel
                clipProject={clipProject}
                originalIn={clip.startTime}
                originalOut={clip.endTime}
                onUpdateInOut={updateInOut}
                onReset={handleReset}
                onPresetChange={handlePresetChange}
              />

              {exportError && <ErrorState message={exportError} />}
              {exportComplete && <SuccessState title="Export complete" message="Your clip has been exported." />}
            </div>
          }
          rightPanel={
            <div className="p-4 space-y-4">
              <PatchPanel
                pendingPatch={pendingPatch}
                onGeneratePatch={generatePatch}
                onApplyPatch={applyPendingPatch}
                onRejectPatch={rejectPendingPatch}
              />

              <ClipDetailsPanel clip={clip} clipProject={clipProject} />
            </div>
          }
          rightPanelWidth="w-80"
        />
      </div>
    </div>
  );
}

export default memo(Review);
