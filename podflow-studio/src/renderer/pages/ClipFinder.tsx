import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Check, X, Filter, ArrowRight, Sparkles, Search } from 'lucide-react';
import { useStore } from '../stores/store';
import { PageHeader } from '../components/layout';
import { Button, EmptyState, ErrorState, ProgressLoader, Badge } from '../components/ui';
import { SettingsPanel } from '../components/settings';
import { ClipCard } from '../components/clip';
import { estimateAiCost, formatCost } from '../types';

type FilterStatus = 'all' | 'pending' | 'accepted' | 'rejected';

function ClipFinder() {
  const navigate = useNavigate();
  const {
    project,
    clips,
    isDetecting,
    detectionProgress,
    detectionError,
    settings,
    setDetecting,
    setDetectionError,
    setCurrentJobId,
    currentJobId,
  } = useStore();

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [hasStartedDetection, setHasStartedDetection] = useState(false);

  // Redirect if no project
  useEffect(() => {
    if (!project) {
      navigate('/');
    }
  }, [project, navigate]);

  const handleStartDetection = useCallback(async () => {
    if (!project) return;

    setDetecting(true);
    setDetectionError(null);
    setHasStartedDetection(true);

    if (settings.useAiEnhancement && project.duration > 0) {
      const estimate = estimateAiCost(project.duration, settings.targetCount);
      const confirmed = window.confirm(
        `🚀 Ready to analyze your video with AI?\n\nEstimated cost: ${formatCost(estimate.total)}\n  • Transcription (Whisper): ${formatCost(estimate.whisperCost)}\n  • Content analysis (GPT): ${formatCost(estimate.gptCost)}\n\nProceed with AI-powered detection?`
      );
      if (!confirmed) {
        setDetecting(false);
        return;
      }
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setCurrentJobId(jobId);

    try {
      const result = await window.api.startDetection(
        jobId,
        project.filePath,
        settings,
        project.duration
      );

      if (!result.success) {
        setDetectionError(result.error || 'Failed to start detection');
      }
    } catch (err) {
      setDetectionError(String(err));
      setDetecting(false);
    }
  }, [project, settings, setDetecting, setDetectionError, setCurrentJobId]);

  const handleCancelDetection = useCallback(async () => {
    if (!currentJobId) return;
    await window.api.cancelDetection(currentJobId);
    setDetecting(false);
  }, [currentJobId, setDetecting]);

  // Memoized filter calculations
  const { filteredClips, acceptedCount, rejectedCount, pendingCount } = useMemo(() => {
    const accepted = clips.filter((c) => c.status === 'accepted').length;
    const rejected = clips.filter((c) => c.status === 'rejected').length;
    const pending = clips.filter((c) => c.status === 'pending').length;

    const filtered = clips.filter((clip) => {
      if (filterStatus === 'all') return true;
      return clip.status === filterStatus;
    });

    return {
      filteredClips: filtered,
      acceptedCount: accepted,
      rejectedCount: rejected,
      pendingCount: pending,
    };
  }, [clips, filterStatus]);

  if (!project) return null;

  const showInitialState = !hasStartedDetection && clips.length === 0 && !isDetecting;

  return (
    <div className="min-h-full bg-sz-bg flex flex-col">
      <PageHeader
        title="Find Clips"
        subtitle={project.fileName}
        icon={<Search className="w-4 h-4" />}
        actions={
          clips.length > 0 && !isDetecting ? (
            <>
              <Button variant="ghost" size="sm" onClick={handleStartDetection}>
                Re-analyze
              </Button>
              <Button
                variant="primary"
                size="sm"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                onClick={() => navigate('/edit')}
              >
                Continue to Edit
              </Button>
            </>
          ) : null
        }
      >
        {/* Filter tabs */}
        {clips.length > 0 && (
          <div className="flex items-center gap-1 mt-4">
            <FilterTab
              active={filterStatus === 'all'}
              onClick={() => setFilterStatus('all')}
              label="All"
              count={clips.length}
            />
            <FilterTab
              active={filterStatus === 'accepted'}
              onClick={() => setFilterStatus('accepted')}
              label="Accepted"
              count={acceptedCount}
              variant="success"
            />
            <FilterTab
              active={filterStatus === 'rejected'}
              onClick={() => setFilterStatus('rejected')}
              label="Rejected"
              count={rejectedCount}
              variant="danger"
            />
            <FilterTab
              active={filterStatus === 'pending'}
              onClick={() => setFilterStatus('pending')}
              label="Pending"
              count={pendingCount}
            />
          </div>
        )}
      </PageHeader>

      <div className="flex-1 p-6 overflow-auto">
        {/* Initial state - Settings */}
        {showInitialState && (
          <div className="max-w-lg mx-auto space-y-6 animate-sz-fade-in">
            <div className="text-center mb-8">
              <div className="w-14 h-14 mx-auto rounded-sz-lg bg-sz-accent-muted border border-sz-accent/20 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-sz-accent" />
              </div>
              <h2 className="text-xl font-semibold text-sz-text mb-2">Find Viral Clips</h2>
              <p className="text-sm text-sz-text-secondary">
                Configure settings and let AI find the best moments
              </p>
            </div>

            <SettingsPanel />

            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleStartDetection}
              leftIcon={<Play className="w-5 h-5" />}
            >
              Start Analysis
            </Button>
          </div>
        )}

        {/* Detection in progress */}
        {isDetecting && detectionProgress && (
          <div className="max-w-lg mx-auto animate-sz-fade-in">
            <ProgressLoader
              percent={detectionProgress.percent}
              message={detectionProgress.message}
              subMessage="This may take a few minutes for longer videos"
              onCancel={handleCancelDetection}
            />
          </div>
        )}

        {/* Error state */}
        {detectionError && !isDetecting && (
          <div className="max-w-lg mx-auto mb-6 animate-sz-fade-in">
            <ErrorState
              title="Detection Failed"
              message={detectionError}
              onRetry={handleStartDetection}
            />
          </div>
        )}

        {/* Clips grid */}
        {clips.length > 0 && !isDetecting && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-sz-fade-in">
            {filteredClips.map((clip) => (
              <ClipCard key={clip.id} clip={clip} videoPath={project.filePath} />
            ))}
          </div>
        )}

        {/* Empty state after filtering */}
        {clips.length > 0 && filteredClips.length === 0 && (
          <EmptyState
            title="No clips match this filter"
            action={{
              label: 'Show all clips',
              onClick: () => setFilterStatus('all'),
              variant: 'secondary',
            }}
          />
        )}

        {/* No clips found state */}
        {hasStartedDetection && clips.length === 0 && !isDetecting && !detectionError && (
          <EmptyState
            title="No clips detected"
            description="Try adjusting the settings and run detection again"
            action={{
              label: 'Adjust Settings',
              onClick: () => setHasStartedDetection(false),
              variant: 'secondary',
            }}
          />
        )}
      </div>
    </div>
  );
}

// Filter tab component
interface FilterTabProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  variant?: 'default' | 'success' | 'danger';
}

const FilterTab = memo(function FilterTab({
  active,
  onClick,
  label,
  count,
  variant = 'default',
}: FilterTabProps) {
  const variantStyles = {
    default: active ? 'text-sz-text bg-sz-bg-hover' : 'text-sz-text-secondary hover:text-sz-text',
    success: active ? 'text-sz-success bg-sz-success-muted' : 'text-sz-text-secondary hover:text-sz-success',
    danger: active ? 'text-sz-danger bg-sz-danger-muted' : 'text-sz-text-secondary hover:text-sz-danger',
  };

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-sz text-sm font-medium
        transition-colors duration-sz-fast
        ${variantStyles[variant]}
      `}
    >
      {label}
      <span className={`
        text-xs px-1.5 py-0.5 rounded
        ${active ? 'bg-sz-bg' : 'bg-sz-bg-hover'}
      `}>
        {count}
      </span>
    </button>
  );
});

export default memo(ClipFinder);
