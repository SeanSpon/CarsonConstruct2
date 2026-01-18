import { Loader2 } from 'lucide-react';

interface ProgressBarProps {
  percent: number;
  message: string;
  onCancel?: () => void;
}

export default function ProgressBar({ percent, message, onCancel }: ProgressBarProps) {
  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
        <span className="font-medium text-zinc-200">Analyzing video...</span>
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-zinc-800 rounded-full overflow-hidden mb-3">
        <div 
          className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Progress info */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">{message}</p>
        <span className="text-sm font-medium text-violet-400">{percent}%</span>
      </div>

      {/* Cancel button */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-4 px-4 py-2 text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
