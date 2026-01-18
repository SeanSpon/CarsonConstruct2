import { Play, Trash2, Undo2 } from 'lucide-react';
import type { DeadSpace } from '../types';
import { formatTimestamp } from '../types';
import { useStore } from '../stores/store';

interface DeadSpaceItemProps {
  deadSpace: DeadSpace;
}

export default function DeadSpaceItem({ deadSpace }: DeadSpaceItemProps) {
  const { updateDeadSpaceRemove } = useStore();

  const handleToggle = () => {
    updateDeadSpaceRemove(deadSpace.id, !deadSpace.remove);
  };

  return (
    <div 
      className={`
        flex items-center gap-4 p-4 rounded-lg border transition-colors
        ${deadSpace.remove 
          ? 'bg-red-500/5 border-red-500/20' 
          : 'bg-zinc-900 border-zinc-800'
        }
      `}
    >
      {/* Status indicator */}
      <div 
        className={`
          w-3 h-3 rounded-full flex-shrink-0
          ${deadSpace.remove ? 'bg-red-500' : 'bg-zinc-600'}
        `}
      />

      {/* Time info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-zinc-300">
            {formatTimestamp(deadSpace.startTime)}
          </span>
          <span className="text-zinc-600">→</span>
          <span className="font-mono text-sm text-zinc-300">
            {formatTimestamp(deadSpace.endTime)}
          </span>
        </div>
        <p className="text-xs text-zinc-500 mt-0.5">
          {deadSpace.duration.toFixed(1)}s of silence
        </p>
      </div>

      {/* Preview button (placeholder - would need video player integration) */}
      <button 
        className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
        title="Preview"
      >
        <Play className="w-4 h-4 text-zinc-500" />
      </button>

      {/* Toggle button */}
      <button
        onClick={handleToggle}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
          ${deadSpace.remove
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }
        `}
      >
        {deadSpace.remove ? (
          <>
            <Trash2 className="w-4 h-4" />
            Remove
          </>
        ) : (
          <>
            <Undo2 className="w-4 h-4" />
            Keep
          </>
        )}
      </button>
    </div>
  );
}
