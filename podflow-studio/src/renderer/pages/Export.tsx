import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, FolderOpen, CheckCircle2, Film, Scissors, Zap, Download } from 'lucide-react';
import { useStore } from '../stores/store';
import { formatDuration } from '../types';
import { PageHeader } from '../components/layout';
import { Button, Card, CardContent, SuccessState, ErrorState, ProgressLoader } from '../components/ui';

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
  } = useStore();

  const [outputDir, setOutputDir] = useState<string | null>(lastExportDir);
  const [exportComplete, setExportComplete] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (!project) {
      navigate('/');
    }
  }, [project, navigate]);

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

  if (!project) return null;

  const canExport = outputDir && (
    (exportSettings.exportClips && acceptedClips.length > 0) ||
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
                    title="Export Accepted Clips"
                    description={`${acceptedClips.length} clip${acceptedClips.length !== 1 ? 's' : ''} • ${formatDuration(totalClipDuration)} total`}
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

export default memo(Export);
