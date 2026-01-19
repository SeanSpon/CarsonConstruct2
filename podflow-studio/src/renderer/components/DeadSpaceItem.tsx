import { memo, useCallback } from 'react';
import { Clock, Trash2, Undo2 } from 'lucide-react';
import type { DeadSpace } from '../types';
import { formatTimestamp } from '../types';
import { useStore } from '../stores/store';
import { Button, Badge } from './ui';

interface DeadSpaceItemProps {
  deadSpace: DeadSpace;
}

function DeadSpaceItem({ deadSpace }: DeadSpaceItemProps) {
  const { updateDeadSpaceRemove } = useStore();

  const handleToggle = useCallback(() => {
    updateDeadSpaceRemove(deadSpace.id, !deadSpace.remove);
  }, [deadSpace.id, deadSpace.remove, updateDeadSpaceRemove]);

  return (
    <div
      className={`
        flex items-center gap-4 p-3 rounded-sz border transition-all
        ${deadSpace.remove
          ? 'border-sz-danger/30 bg-sz-danger-muted/30'
          : 'border-sz-border bg-sz-bg-secondary'
        }
      `}
    >
      {/* Icon */}
      <div
        className={`
          w-9 h-9 rounded-sz flex items-center justify-center flex-shrink-0
          ${deadSpace.remove ? 'bg-sz-danger-muted' : 'bg-sz-bg-tertiary'}
        `}
      >
        <Clock
          className={`w-4 h-4 ${deadSpace.remove ? 'text-sz-danger' : 'text-sz-text-muted'}`}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-sz-text tabular-nums">
            {formatTimestamp(deadSpace.startTime)} – {formatTimestamp(deadSpace.endTime)}
          </span>
          <Badge
            variant={deadSpace.remove ? 'danger' : 'muted'}
            size="sm"
          >
            {deadSpace.duration.toFixed(1)}s
          </Badge>
        </div>
        <p className="text-xs text-sz-text-muted mt-0.5">
          {deadSpace.remove ? 'Will be removed' : 'Will be kept'}
        </p>
      </div>

      {/* Action button */}
      <Button
        variant={deadSpace.remove ? 'ghost' : 'danger'}
        size="sm"
        onClick={handleToggle}
        leftIcon={
          deadSpace.remove ? (
            <Undo2 className="w-3.5 h-3.5" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )
        }
      >
        {deadSpace.remove ? 'Keep' : 'Remove'}
      </Button>
    </div>
  );
}

export default memo(DeadSpaceItem);
