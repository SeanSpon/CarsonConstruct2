import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, FolderOpen, CheckCircle2, Film, Scissors, Zap, Download, FileVideo, FileText, FileSpreadsheet, Layers, Monitor, Play, Clapperboard, X } from 'lucide-react';
import { useStore } from '../stores/store';
import { formatDuration, type TransitionType } from '../types';
import { PageHeader } from '../components/layout';
import { Button, Card, CardContent, SuccessState, ErrorState, ProgressLoader } from '../components/ui';

// NLE export format type
type NLEFormat = 'fcp-xml' | 'edl' | 'markers-csv' | 'premiere-markers' | 'all';

function Export() {
  const navigate = useNavigate();
  const {
    project,
    clips,
    deadSpaces,
    exportSettings,
    updateExportSettings,
    isExporting,
    exportProgress,
    lastExportDir,
    setExporting,
    isPreviewRendering,
    previewProgress,
    previewFilePath,
    setPreviewRendering,
    setPreviewProgress,
    setPreviewFilePath,
  } = useStore();

  const [outputDir, setOutputDir] = useState<string | null>(lastExportDir);
  const [exportComplete, setExportComplete] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  
  // NLE/Premiere Pro export state
  const [nleFormat, setNleFormat] = useState<NLEFormat>('all');
  const [nleExporting, setNleExporting] = useState(false);
  const [nleProgress, setNleProgress] = useState<string | null>(null);
  const [nleComplete, setNleComplete] = useState(false);
  const [nleResults, setNleResults] = useState<Array<{ format: string; success: boolean; path?: string; error?: string }>>([]);
  const [frameRate, setFrameRate] = useState(project?.fps || 30);
  const [sequenceName, setSequenceName] = useState(project?.fileName.replace(/\.[^/.]+$/, '') || 'PodFlow Sequence');

  useEffect(() => {
    if (!project) {
      navigate('/');
    }
  }, [project, navigate]);

  // Listen for NLE export progress
  useEffect(() => {
    const unsubscribe = window.api.onNleExportProgress((data) => {
      setNleProgress(`Exporting ${data.format}...`);
    });
    return unsubscribe;
  }, []);

  // Listen for preview progress
  useEffect(() => {
    const unsubscribe = window.api.onPreviewProgress((data) => {
      setPreviewProgress(data);
    });
    return unsubscribe;
  }, [setPreviewProgress]);

  // Cleanup preview file on unmount
  useEffect(() => {
    return () => {
      if (previewFilePath) {
        window.api.cleanupPreview(previewFilePath);
        setPreviewFilePath(null);
      }
    };
  }, [previewFilePath, setPreviewFilePath]);

  // Update sequence name and frame rate when project changes
  useEffect(() => {
    if (project) {
      setSequenceName(project.fileName.replace(/\.[^/.]+$/, ''));
      if (project.fps) setFrameRate(project.fps);
    }
  }, [project]);

  // Memoized calculations
  const { acceptedClips, deadSpacesToRemove, totalClipDuration, deadSpaceTime } = useMemo(() => {
    const accepted = clips.filter((c) => c.status === 'accepted');
    const toRemove = deadSpaces.filter((ds) => ds.remove);
    const clipDuration = accepted.reduce((sum, c) => {
      const actualDuration = (c.endTime + c.trimEndOffset) - (c.startTime + c.trimStartOffset);
      return sum + actualDuration;
    }, 0);
    const dsTime = toRemove.reduce((sum, ds) => sum + ds.duration, 0);

    return {
      acceptedClips: accepted,
      deadSpacesToRemove: toRemove,
      totalClipDuration: clipDuration,
      deadSpaceTime: dsTime,
    };
  }, [clips, deadSpaces]);

  const handleSelectOutputDir = useCallback(async () => {
    const dir = await window.api.selectOutputDir();
    if (dir) {
      setOutputDir(dir);
    }
  }, []);

  const handleExport = useCallback(async () => {
    if (!outputDir || !project) return;

    setExporting(true);
    setExportComplete(false);
    setExportError(null);

    try {
      const result = await window.api.exportClips({
        sourceFile: project.filePath,
        clips: acceptedClips.map((c) => ({
          id: c.id,
          startTime: c.startTime,
          endTime: c.endTime,
          trimStartOffset: c.trimStartOffset,
          trimEndOffset: c.trimEndOffset,
          title: c.title,
          hookText: c.hookText,
          category: c.category,
        })),
        deadSpaces: deadSpacesToRemove.map((ds) => ({
          id: ds.id,
          startTime: ds.startTime,
          endTime: ds.endTime,
          remove: ds.remove,
        })),
        outputDir,
        settings: exportSettings,
      });

      if (result.success) {
        setExportComplete(true);
      } else {
        setExportError(result.error || 'Export failed');
      }
    } catch (err) {
      setExportError(String(err));
    } finally {
      setExporting(false);
    }
  }, [outputDir, project, acceptedClips, deadSpacesToRemove, exportSettings, setExporting]);

  const handleOpenFolder = useCallback(async () => {
    if (outputDir) {
      await window.api.openFolder(outputDir);
    }
  }, [outputDir]);

  // Handle preview
  const handlePreview = useCallback(async () => {
    if (!project || acceptedClips.length === 0) return;

    // Clean up previous preview
    if (previewFilePath) {
      await window.api.cleanupPreview(previewFilePath);
      setPreviewFilePath(null);
    }

    setPreviewRendering(true);
    setPreviewProgress({ percent: 0, message: 'Starting preview render...' });

    try {
      const result = await window.api.previewClipsCompilation({
        sourceFile: project.filePath,
        clips: acceptedClips.map((c) => ({
          id: c.id,
          startTime: c.startTime,
          endTime: c.endTime,
          trimStartOffset: c.trimStartOffset,
          trimEndOffset: c.trimEndOffset,
          title: c.title,
        })),
        transition: exportSettings.transition,
      });

      if (result.success && result.previewFile) {
        setPreviewFilePath(result.previewFile);
        setShowPreviewModal(true);
      } else {
        setExportError(result.error || 'Preview failed');
      }
    } catch (err) {
      setExportError(String(err));
    } finally {
      setPreviewRendering(false);
      setPreviewProgress(null);
    }
  }, [project, acceptedClips, exportSettings.transition, previewFilePath, setPreviewRendering, setPreviewProgress, setPreviewFilePath]);

  // Close preview modal
  const handleClosePreview = useCallback(async () => {
    setShowPreviewModal(false);
    if (previewFilePath) {
      await window.api.cleanupPreview(previewFilePath);
      setPreviewFilePath(null);
    }
  }, [previewFilePath, setPreviewFilePath]);

  // Handle Premiere Pro / NLE export
  const handleNleExport = useCallback(async () => {
    if (!outputDir || !project) return;

    setNleExporting(true);
    setNleComplete(false);
    setNleResults([]);
    setNleProgress('Preparing export...');

    const nleClips = acceptedClips.map((c) => ({
      id: c.id,
      name: c.title || `Clip ${c.id}`,
      startTime: c.startTime,
      endTime: c.endTime,
      duration: c.duration,
      pattern: c.pattern,
      finalScore: c.finalScore,
      category: c.category,
      hookText: c.hookText,
      trimStartOffset: c.trimStartOffset,
      trimEndOffset: c.trimEndOffset,
    }));

    const nleDeadSpaces = deadSpacesToRemove.map((ds) => ({
      id: ds.id,
      startTime: ds.startTime,
      endTime: ds.endTime,
      duration: ds.duration,
      remove: ds.remove,
    }));

    const exportData = {
      sourceFile: project.filePath,
      sequenceName,
      clips: nleClips,
      deadSpaces: nleDeadSpaces,
      outputDir,
      frameRate,
      dropFrame: frameRate === 29.97 || frameRate === 59.94,
      videoDuration: project.duration,
      videoWidth: project.width,
      videoHeight: project.height,
    };

    try {
      let result;

      if (nleFormat === 'all') {
        result = await window.api.exportAllNleFormats(exportData);
        if (result.results) {
          setNleResults(result.results);
        }
      } else if (nleFormat === 'fcp-xml') {
        result = await window.api.exportFcpXml(exportData);
        setNleResults([{ format: 'FCP XML', success: result.success, path: result.path, error: result.error }]);
      } else if (nleFormat === 'edl') {
        result = await window.api.exportEdl(exportData);
        setNleResults([{ format: 'EDL', success: result.success, path: result.path, error: result.error }]);
      } else if (nleFormat === 'markers-csv') {
        result = await window.api.exportMarkersCsv(exportData);
        setNleResults([{ format: 'Markers CSV', success: result.success, path: result.path, error: result.error }]);
      } else if (nleFormat === 'premiere-markers') {
        result = await window.api.exportPremiereMarkers(exportData);
        setNleResults([{ format: 'Premiere Markers', success: result.success, path: result.path, error: result.error }]);
      }

      setNleComplete(true);
    } catch (err) {
      setNleResults([{ format: nleFormat, success: false, error: String(err) }]);
    } finally {
      setNleExporting(false);
      setNleProgress(null);
    }
  }, [outputDir, project, acceptedClips, deadSpacesToRemove, sequenceName, frameRate, nleFormat]);

  if (!project) return null;

  const canExport = outputDir && (
    (exportSettings.exportClips && acceptedClips.length > 0) ||
    (exportSettings.exportClipsCompilation && acceptedClips.length > 0) ||
    (exportSettings.exportFullVideo)
  );

  return (
    <div className="min-h-full bg-sz-bg flex flex-col">
      <PageHeader
        title="Export"
        subtitle={project.fileName}
        icon={<Download className="w-4 h-4" />}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Export Complete State */}
          {exportComplete && (
            <SuccessState
              title="Export Complete!"
              message="Your files have been exported successfully."
              action={{
                label: 'Open Folder',
                onClick: handleOpenFolder,
              }}
            />
          )}

          {/* Export Error State */}
          {exportError && (
            <ErrorState
              title="Export Failed"
              message={exportError}
            />
          )}

          {/* Export Progress */}
          {isExporting && exportProgress && (
            <ProgressLoader
              percent={(exportProgress.current / exportProgress.total) * 100}
              message={`Exporting ${exportProgress.current} of ${exportProgress.total}`}
              subMessage={exportProgress.clipName}
            />
          )}

          {/* What to Export */}
          {!isExporting && (
            <>
              <Card noPadding>
                <CardContent className="p-4">
                  <h2 className="text-xs font-semibold text-sz-text-muted uppercase tracking-wider mb-4">
                    What to Export
                  </h2>

                  {/* Export Clips Option */}
                  <ExportOption
                    checked={exportSettings.exportClips}
                    onChange={(checked) => updateExportSettings({ exportClips: checked })}
                    icon={<Film className="w-4 h-4 text-sz-accent" />}
                    title="Export Individual Clips"
                    description={`${acceptedClips.length} clip${acceptedClips.length !== 1 ? 's' : ''} • ${formatDuration(totalClipDuration)} total`}
                    warning={acceptedClips.length === 0 ? 'No clips accepted yet' : undefined}
                  />

                  {/* Export Clips Compilation Option */}
                  <ExportOption
                    checked={exportSettings.exportClipsCompilation}
                    onChange={(checked) => updateExportSettings({ exportClipsCompilation: checked })}
                    icon={<Clapperboard className="w-4 h-4 text-violet-400" />}
                    title="Export Clips Compilation"
                    description={`Join ${acceptedClips.length} clips with transitions into a single video`}
                    warning={acceptedClips.length === 0 ? 'No clips accepted yet' : undefined}
                  />

                  {/* Export Full Video Option */}
                  <ExportOption
                    checked={exportSettings.exportFullVideo}
                    onChange={(checked) => updateExportSettings({ exportFullVideo: checked })}
                    icon={<Scissors className="w-4 h-4 text-sz-success" />}
                    title="Export Full Video (Dead Space Removed)"
                    description={`Removes ${deadSpacesToRemove.length} dead space${deadSpacesToRemove.length !== 1 ? 's' : ''} • ${formatDuration(deadSpaceTime)} cut`}
                    subdescription={deadSpacesToRemove.length === 0 ? 'No dead spaces marked' : undefined}
                  />
                </CardContent>
              </Card>

              {/* Export Settings */}
              <Card noPadding>
                <CardContent className="p-4">
                  <h2 className="text-xs font-semibold text-sz-text-muted uppercase tracking-wider mb-4">
                    Settings
                  </h2>

                  {/* Format */}
                  <div className="mb-4">
                    <label className="text-xs text-sz-text-secondary mb-2 block">Format</label>
                    <div className="flex gap-2">
                      <FormatButton
                        active={exportSettings.format === 'mp4'}
                        onClick={() => updateExportSettings({ format: 'mp4' })}
                        label="MP4"
                      />
                      <FormatButton
                        active={exportSettings.format === 'mov'}
                        onClick={() => updateExportSettings({ format: 'mov' })}
                        label="MOV"
                      />
                    </div>
                  </div>

                  {/* Mode */}
                  <div>
                    <label className="text-xs text-sz-text-secondary mb-2 block">Export Mode</label>
                    <div className="flex gap-2">
                      <ModeButton
                        active={exportSettings.mode === 'fast'}
                        onClick={() => updateExportSettings({ mode: 'fast' })}
                        icon={<Zap className="w-4 h-4" />}
                        title="Fast"
                        description="Quick keyframe cuts"
                      />
                      <ModeButton
                        active={exportSettings.mode === 'accurate'}
                        onClick={() => updateExportSettings({ mode: 'accurate' })}
                        icon={<CheckCircle2 className="w-4 h-4" />}
                        title="Accurate"
                        description="Frame-perfect cuts"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Transition Settings (for Clips Compilation) */}
              {exportSettings.exportClipsCompilation && (
                <Card noPadding>
                  <CardContent className="p-4">
                    <h2 className="text-xs font-semibold text-sz-text-muted uppercase tracking-wider mb-4">
                      Transition Settings
                    </h2>

                    {/* Transition Type */}
                    <div className="mb-4">
                      <label className="text-xs text-sz-text-secondary mb-2 block">Transition Type</label>
                      <div className="grid grid-cols-3 gap-2">
                        <TransitionButton
                          active={exportSettings.transition.type === 'none'}
                          onClick={() => updateExportSettings({ transition: { ...exportSettings.transition, type: 'none' } })}
                          title="None"
                          description="Hard cut"
                        />
                        <TransitionButton
                          active={exportSettings.transition.type === 'crossfade'}
                          onClick={() => updateExportSettings({ transition: { ...exportSettings.transition, type: 'crossfade' } })}
                          title="Crossfade"
                          description="Smooth blend"
                        />
                        <TransitionButton
                          active={exportSettings.transition.type === 'dip-to-black'}
                          onClick={() => updateExportSettings({ transition: { ...exportSettings.transition, type: 'dip-to-black' } })}
                          title="Dip to Black"
                          description="Fade out/in"
                        />
                      </div>
                    </div>

                    {/* Transition Duration */}
                    {exportSettings.transition.type !== 'none' && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-sz-text-secondary">Transition Duration</label>
                          <span className="text-xs text-sz-text font-medium">{exportSettings.transition.duration.toFixed(1)}s</span>
                        </div>
                        <input
                          type="range"
                          min="0.3"
                          max="2.0"
                          step="0.1"
                          value={exportSettings.transition.duration}
                          onChange={(e) => updateExportSettings({ 
                            transition: { ...exportSettings.transition, duration: parseFloat(e.target.value) } 
                          })}
                          className="w-full h-2 bg-sz-bg-tertiary rounded-lg appearance-none cursor-pointer accent-violet-500"
                        />
                        <div className="flex justify-between text-[10px] text-sz-text-muted mt-1">
                          <span>0.3s</span>
                          <span>2.0s</span>
                        </div>
                      </div>
                    )}

                    {/* Preview Button */}
                    <div className="pt-2 border-t border-sz-border/50">
                      <Button
                        variant="secondary"
                        size="md"
                        fullWidth
                        disabled={acceptedClips.length < 2 || isPreviewRendering}
                        isLoading={isPreviewRendering}
                        onClick={handlePreview}
                        leftIcon={!isPreviewRendering ? <Play className="w-4 h-4" /> : undefined}
                      >
                        {isPreviewRendering ? 'Rendering Preview...' : 'Preview Compilation'}
                      </Button>
                      {acceptedClips.length < 2 && (
                        <p className="text-center text-xs text-sz-text-muted mt-2">
                          Need at least 2 clips to preview transitions
                        </p>
                      )}
                      {isPreviewRendering && previewProgress && (
                        <div className="mt-3">
                          <div className="h-1 bg-sz-bg-tertiary rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-violet-500 transition-all duration-300"
                              style={{ width: `${previewProgress.percent}%` }}
                            />
                          </div>
                          <p className="text-xs text-sz-text-muted text-center mt-1">{previewProgress.message}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Output Directory */}
              <Card noPadding>
                <CardContent className="p-4">
                  <h2 className="text-xs font-semibold text-sz-text-muted uppercase tracking-wider mb-3">
                    Output Location
                  </h2>

                  <button
                    onClick={handleSelectOutputDir}
                    className="w-full p-4 border border-dashed border-sz-border-light hover:border-sz-accent/50 rounded-sz text-left transition-all hover:bg-sz-bg-hover"
                  >
                    {outputDir ? (
                      <div>
                        <p className="text-sm text-sz-text font-medium">Selected folder:</p>
                        <p className="text-xs text-sz-text-muted mt-1 truncate">{outputDir}</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <FolderOpen className="w-5 h-5 text-sz-text-muted" />
                        <div>
                          <p className="text-sm text-sz-text">Choose output folder</p>
                          <p className="text-xs text-sz-text-muted">Click to select destination</p>
                        </div>
                      </div>
                    )}
                  </button>
                </CardContent>
              </Card>

              {/* Premiere Pro / NLE Export Section */}
              <Card noPadding>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Monitor className="w-4 h-4 text-violet-400" />
                    <h2 className="text-xs font-semibold text-sz-text-muted uppercase tracking-wider">
                      Premiere Pro / NLE Export
                    </h2>
                  </div>

                  <p className="text-xs text-sz-text-muted mb-4">
                    Export timeline data for professional video editing software. Compatible with Adobe Premiere Pro, DaVinci Resolve, Final Cut Pro, and Avid Media Composer.
                  </p>

                  {/* Sequence Name */}
                  <div className="mb-4">
                    <label className="text-xs text-sz-text-secondary mb-2 block">Sequence Name</label>
                    <input
                      type="text"
                      value={sequenceName}
                      onChange={(e) => setSequenceName(e.target.value)}
                      className="w-full px-3 py-2 bg-sz-bg-tertiary border border-sz-border rounded-sz text-sm text-sz-text focus:outline-none focus:border-sz-accent/50"
                      placeholder="Enter sequence name..."
                    />
                  </div>

                  {/* Frame Rate */}
                  <div className="mb-4">
                    <label className="text-xs text-sz-text-secondary mb-2 block">Frame Rate</label>
                    <div className="flex gap-2 flex-wrap">
                      {[23.976, 24, 25, 29.97, 30, 50, 59.94, 60].map((fps) => (
                        <button
                          key={fps}
                          onClick={() => setFrameRate(fps)}
                          className={`px-3 py-1.5 rounded-sz text-xs font-medium transition-all ${
                            frameRate === fps
                              ? 'bg-sz-accent text-sz-bg'
                              : 'bg-sz-bg-tertiary text-sz-text-secondary hover:bg-sz-bg-hover hover:text-sz-text border border-sz-border'
                          }`}
                        >
                          {fps}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Export Format */}
                  <div className="mb-4">
                    <label className="text-xs text-sz-text-secondary mb-2 block">Export Format</label>
                    <div className="grid grid-cols-2 gap-2">
                      <NleFormatButton
                        active={nleFormat === 'all'}
                        onClick={() => setNleFormat('all')}
                        icon={<Layers className="w-4 h-4" />}
                        title="All Formats"
                        description="Export all formats at once"
                      />
                      <NleFormatButton
                        active={nleFormat === 'fcp-xml'}
                        onClick={() => setNleFormat('fcp-xml')}
                        icon={<FileVideo className="w-4 h-4" />}
                        title="FCP XML"
                        description="Premiere, Resolve, FCP"
                      />
                      <NleFormatButton
                        active={nleFormat === 'edl'}
                        onClick={() => setNleFormat('edl')}
                        icon={<FileText className="w-4 h-4" />}
                        title="EDL"
                        description="Universal NLE format"
                      />
                      <NleFormatButton
                        active={nleFormat === 'markers-csv'}
                        onClick={() => setNleFormat('markers-csv')}
                        icon={<FileSpreadsheet className="w-4 h-4" />}
                        title="Markers CSV"
                        description="Import as markers"
                      />
                    </div>
                  </div>

                  {/* NLE Export Progress */}
                  {nleExporting && (
                    <div className="mb-4 p-3 bg-sz-bg-secondary rounded-sz">
                      <p className="text-xs text-sz-text-secondary">{nleProgress}</p>
                    </div>
                  )}

                  {/* NLE Export Results */}
                  {nleComplete && nleResults.length > 0 && (
                    <div className="mb-4">
                      <div className="p-3 bg-sz-bg-secondary rounded-sz space-y-2">
                        {nleResults.map((result, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            {result.success ? (
                              <CheckCircle2 className="w-4 h-4 text-sz-success flex-shrink-0" />
                            ) : (
                              <span className="w-4 h-4 text-sz-danger flex-shrink-0">✗</span>
                            )}
                            <span className={result.success ? 'text-sz-text' : 'text-sz-danger'}>
                              {result.format}: {result.success ? 'Exported' : result.error}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* NLE Export Button */}
                  <Button
                    variant="secondary"
                    size="md"
                    fullWidth
                    disabled={!outputDir || nleExporting || acceptedClips.length === 0}
                    isLoading={nleExporting}
                    onClick={handleNleExport}
                    leftIcon={!nleExporting ? <Monitor className="w-4 h-4" /> : undefined}
                  >
                    {nleExporting ? 'Exporting...' : `Export for ${nleFormat === 'all' ? 'All NLEs' : nleFormat.toUpperCase()}`}
                  </Button>

                  {acceptedClips.length === 0 && (
                    <p className="text-center text-xs text-sz-text-muted mt-2">
                      Accept some clips first to export timeline data
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Export Button */}
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={!canExport || isExporting}
                isLoading={isExporting}
                onClick={handleExport}
                leftIcon={!isExporting ? <Package className="w-5 h-5" /> : undefined}
              >
                {isExporting ? 'Exporting...' : 'Export'}
              </Button>

              {!canExport && !isExporting && (
                <p className="text-center text-xs text-sz-text-muted">
                  {!outputDir
                    ? 'Select an output folder to continue'
                    : 'Select at least one export option'
                  }
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreviewModal && previewFilePath && (
        <PreviewModal
          previewFile={previewFilePath}
          onClose={handleClosePreview}
        />
      )}
    </div>
  );
}

// Memoized sub-components
interface ExportOptionProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  warning?: string;
  subdescription?: string;
}

const ExportOption = memo(function ExportOption({
  checked,
  onChange,
  icon,
  title,
  description,
  warning,
  subdescription,
}: ExportOptionProps) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-sz hover:bg-sz-bg-hover cursor-pointer mb-2 last:mb-0 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 mt-0.5 rounded border-sz-border bg-sz-bg text-sz-accent focus:ring-sz-accent/30 focus:ring-offset-sz-bg"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-sz-text">{title}</span>
        </div>
        <p className="text-xs text-sz-text-muted mt-1">{description}</p>
        {warning && (
          <p className="text-xs text-sz-warning mt-1">{warning}</p>
        )}
        {subdescription && (
          <p className="text-xs text-sz-text-muted mt-1">{subdescription}</p>
        )}
      </div>
    </label>
  );
});

interface FormatButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
}

const FormatButton = memo(function FormatButton({ active, onClick, label }: FormatButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 rounded-sz font-medium text-sm transition-all ${
        active
          ? 'bg-sz-accent text-sz-bg'
          : 'bg-sz-bg-tertiary text-sz-text-secondary hover:bg-sz-bg-hover hover:text-sz-text border border-sz-border'
      }`}
    >
      {label}
    </button>
  );
});

interface ModeButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const ModeButton = memo(function ModeButton({ active, onClick, icon, title, description }: ModeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 p-3 rounded-sz text-left transition-all ${
        active
          ? 'bg-sz-accent-muted border border-sz-accent/50'
          : 'bg-sz-bg-tertiary border border-sz-border hover:bg-sz-bg-hover'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={active ? 'text-sz-accent' : 'text-sz-text-muted'}>{icon}</span>
        <span className={`text-sm font-medium ${active ? 'text-sz-accent' : 'text-sz-text-secondary'}`}>
          {title}
        </span>
      </div>
      <p className="text-[10px] text-sz-text-muted">{description}</p>
    </button>
  );
});

// NLE Format Button Component
interface NleFormatButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const NleFormatButton = memo(function NleFormatButton({ active, onClick, icon, title, description }: NleFormatButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-sz text-left transition-all ${
        active
          ? 'bg-violet-500/20 border border-violet-500/50'
          : 'bg-sz-bg-tertiary border border-sz-border hover:bg-sz-bg-hover'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={active ? 'text-violet-400' : 'text-sz-text-muted'}>{icon}</span>
        <span className={`text-sm font-medium ${active ? 'text-violet-400' : 'text-sz-text-secondary'}`}>
          {title}
        </span>
      </div>
      <p className="text-[10px] text-sz-text-muted">{description}</p>
    </button>
  );
});

// Transition Button Component
interface TransitionButtonProps {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
}

const TransitionButton = memo(function TransitionButton({ active, onClick, title, description }: TransitionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-sz text-center transition-all ${
        active
          ? 'bg-violet-500/20 border border-violet-500/50'
          : 'bg-sz-bg-tertiary border border-sz-border hover:bg-sz-bg-hover'
      }`}
    >
      <span className={`text-sm font-medium block ${active ? 'text-violet-400' : 'text-sz-text-secondary'}`}>
        {title}
      </span>
      <p className="text-[10px] text-sz-text-muted mt-0.5">{description}</p>
    </button>
  );
});

// Preview Modal Component
interface PreviewModalProps {
  previewFile: string;
  onClose: () => void;
}

const PreviewModal = memo(function PreviewModal({ previewFile, onClose }: PreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl mx-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        
        {/* Video Player */}
        <div className="bg-sz-bg rounded-lg overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-sz-border">
            <h3 className="text-sm font-medium text-sz-text">Preview - Clips Compilation</h3>
            <p className="text-xs text-sz-text-muted mt-1">480p preview render</p>
          </div>
          <div className="aspect-video bg-black">
            <video
              src={`file://${previewFile}`}
              controls
              autoPlay
              className="w-full h-full"
            />
          </div>
          <div className="p-4 flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
            >
              Close Preview
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default memo(Export);
