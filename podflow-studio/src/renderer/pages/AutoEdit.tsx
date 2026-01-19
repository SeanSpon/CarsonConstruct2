import { useEffect, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scissors, Trash2, Clock, AlertCircle, ArrowRight, SkipForward } from 'lucide-react';
import { useStore } from '../stores/store';
import { formatDuration } from '../types';
import { PageHeader } from '../components/layout';
import { Button, Card, CardContent, EmptyState, InfoState } from '../components/ui';
import DeadSpaceItem from '../components/DeadSpaceItem';

function AutoEdit() {
  const navigate = useNavigate();
  const { project, deadSpaces, clips, setAllDeadSpacesRemove } = useStore();

  useEffect(() => {
    if (!project) {
      navigate('/');
    }
  }, [project, navigate]);

  // Memoized calculations
  const { toRemove, totalRemoveTime, totalDeadTime, acceptedClips } = useMemo(() => {
    const remove = deadSpaces.filter((ds) => ds.remove);
    const removeTime = remove.reduce((sum, ds) => sum + ds.duration, 0);
    const deadTime = deadSpaces.reduce((sum, ds) => sum + ds.duration, 0);
    const accepted = clips.filter((c) => c.status === 'accepted');

    return {
      toRemove: remove,
      totalRemoveTime: removeTime,
      totalDeadTime: deadTime,
      acceptedClips: accepted,
    };
  }, [deadSpaces, clips]);

  const handleRemoveAll = useCallback(() => {
    setAllDeadSpacesRemove(true);
  }, [setAllDeadSpacesRemove]);

  const handleKeepAll = useCallback(() => {
    setAllDeadSpacesRemove(false);
  }, [setAllDeadSpacesRemove]);

  if (!project) return null;

  // Show message if no detection has been run
  if (deadSpaces.length === 0 && clips.length === 0) {
    return (
      <div className="min-h-full bg-sz-bg flex items-center justify-center p-8">
        <EmptyState
          icon={<Scissors className="w-8 h-8" />}
          title="No Dead Spaces Detected"
          description="Run clip detection first to analyze your video for dead spaces."
          action={{
            label: 'Go to Clip Finder',
            onClick: () => navigate('/clips'),
          }}
        />
      </div>
    );
  }

  // Show message if detection ran but no dead spaces found
  if (deadSpaces.length === 0) {
    return (
      <div className="min-h-full bg-sz-bg flex items-center justify-center p-8">
        <EmptyState
          icon={<SkipForward className="w-8 h-8 text-sz-success" />}
          title="No Dead Spaces Found"
          description="Your video doesn't have any significant dead spaces. You're good to export!"
          action={{
            label: 'Continue to Export',
            onClick: () => navigate('/export'),
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-sz-bg flex flex-col">
      <PageHeader
        title="Auto Edit"
        subtitle={project.fileName}
        icon={<Scissors className="w-4 h-4" />}
        actions={
          <Button
            variant="primary"
            size="sm"
            rightIcon={<ArrowRight className="w-4 h-4" />}
            onClick={() => navigate('/export')}
          >
            Continue to Export
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto">
          {/* Summary Card */}
          <Card noPadding className="mb-6">
            <CardContent className="p-5">
              <div className="grid grid-cols-3 gap-6">
                {/* Total dead spaces */}
                <StatCard
                  icon={<Clock className="w-4 h-4" />}
                  label="Total Dead Space"
                  value={formatDuration(totalDeadTime)}
                  subtext={`${deadSpaces.length} silence${deadSpaces.length !== 1 ? 's' : ''}`}
                  variant="default"
                />

                {/* To remove */}
                <StatCard
                  icon={<Trash2 className="w-4 h-4" />}
                  label="Removing"
                  value={formatDuration(totalRemoveTime)}
                  subtext={`${toRemove.length} marked`}
                  variant="danger"
                />

                {/* New duration */}
                <StatCard
                  icon={<Clock className="w-4 h-4" />}
                  label="New Duration"
                  value={formatDuration(project.duration - totalRemoveTime)}
                  subtext={`${((totalRemoveTime / project.duration) * 100).toFixed(1)}% shorter`}
                  variant="success"
                />
              </div>

              {/* Bulk actions */}
              <div className="flex items-center gap-2 mt-5 pt-4 border-t border-sz-border">
                <Button variant="danger" size="sm" onClick={handleRemoveAll}>
                  Remove All
                </Button>
                <Button variant="secondary" size="sm" onClick={handleKeepAll}>
                  Keep All
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Info box */}
          {acceptedClips.length > 0 && (
            <InfoState
              title="Note"
              message={`You have ${acceptedClips.length} accepted clip${acceptedClips.length !== 1 ? 's' : ''}. Dead space removal applies to full video export only, not individual clips.`}
              className="mb-6"
            />
          )}

          {/* Dead space list */}
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-sz-text-muted uppercase tracking-wider mb-3">
              Dead Spaces ({deadSpaces.length})
            </h2>
            {deadSpaces.map((ds) => (
              <DeadSpaceItem key={ds.id} deadSpace={ds} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat card component
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
  variant: 'default' | 'danger' | 'success';
}

const StatCard = memo(function StatCard({ icon, label, value, subtext, variant }: StatCardProps) {
  const variantStyles = {
    default: { icon: 'text-sz-text-muted', value: 'text-sz-text' },
    danger: { icon: 'text-sz-danger', value: 'text-sz-danger' },
    success: { icon: 'text-sz-success', value: 'text-sz-success' },
  };

  const styles = variantStyles[variant];

  return (
    <div>
      <div className={`flex items-center gap-1.5 ${styles.icon} mb-1`}>
        {icon}
        <span className="text-xs text-sz-text-secondary">{label}</span>
      </div>
      <p className={`text-xl font-bold ${styles.value} tabular-nums`}>
        {value}
      </p>
      <p className="text-[10px] text-sz-text-muted mt-0.5">{subtext}</p>
    </div>
  );
});

export default memo(AutoEdit);
