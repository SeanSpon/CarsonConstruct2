import { memo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Card, CardContent } from '../ui';
import type { ClipProject, ExportPreset } from '../../review/clipProject';

const presets: ExportPreset[] = ['9:16', '1:1', '16:9'];

export interface TrimPanelProps {
  clipProject: ClipProject;
  originalIn: number;
  originalOut: number;
  onUpdateInOut: (inTime: number, outTime: number) => void;
  onReset: () => void;
  onPresetChange: (preset: ExportPreset) => void;
}

function TrimPanel({
  clipProject,
  originalIn,
  originalOut,
  onUpdateInOut,
  onReset,
  onPresetChange,
}: TrimPanelProps) {
  const handleInChange = (delta: number) => {
    onUpdateInOut(clipProject.edit.in + delta, clipProject.edit.out);
  };

  const handleOutChange = (delta: number) => {
    onUpdateInOut(clipProject.edit.in, clipProject.edit.out + delta);
  };

  return (
    <Card noPadding>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-sz-text-muted uppercase tracking-wider">Trim Controls</h3>
          <button
            onClick={onReset}
            className="text-xs text-sz-text-secondary hover:text-sz-accent flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* In Control */}
          <div>
            <label className="text-[10px] text-sz-text-muted uppercase tracking-wide">In</label>
            <div className="flex items-center gap-1.5 mt-1">
              <button
                onClick={() => handleInChange(-0.1)}
                className="px-2 py-1 bg-sz-bg-tertiary hover:bg-sz-bg-hover rounded-sz text-sz-text-secondary text-xs transition-colors"
              >
                -0.1
              </button>
              <input
                type="number"
                step="0.1"
                value={clipProject.edit.in.toFixed(2)}
                onChange={(e) => onUpdateInOut(parseFloat(e.target.value), clipProject.edit.out)}
                className="w-20 px-2 py-1 bg-sz-bg text-sz-text rounded-sz border border-sz-border text-xs focus:border-sz-accent focus:outline-none tabular-nums"
              />
              <button
                onClick={() => handleInChange(0.1)}
                className="px-2 py-1 bg-sz-bg-tertiary hover:bg-sz-bg-hover rounded-sz text-sz-text-secondary text-xs transition-colors"
              >
                +0.1
              </button>
            </div>
          </div>

          {/* Out Control */}
          <div>
            <label className="text-[10px] text-sz-text-muted uppercase tracking-wide">Out</label>
            <div className="flex items-center gap-1.5 mt-1">
              <button
                onClick={() => handleOutChange(-0.1)}
                className="px-2 py-1 bg-sz-bg-tertiary hover:bg-sz-bg-hover rounded-sz text-sz-text-secondary text-xs transition-colors"
              >
                -0.1
              </button>
              <input
                type="number"
                step="0.1"
                value={clipProject.edit.out.toFixed(2)}
                onChange={(e) => onUpdateInOut(clipProject.edit.in, parseFloat(e.target.value))}
                className="w-20 px-2 py-1 bg-sz-bg text-sz-text rounded-sz border border-sz-border text-xs focus:border-sz-accent focus:outline-none tabular-nums"
              />
              <button
                onClick={() => handleOutChange(0.1)}
                className="px-2 py-1 bg-sz-bg-tertiary hover:bg-sz-bg-hover rounded-sz text-sz-text-secondary text-xs transition-colors"
              >
                +0.1
              </button>
            </div>
          </div>
        </div>

        {/* Export Presets */}
        <div className="flex items-center gap-2 pt-2 border-t border-sz-border">
          <span className="text-[10px] text-sz-text-muted uppercase tracking-wide">Aspect</span>
          {presets.map((preset) => (
            <button
              key={preset}
              onClick={() => onPresetChange(preset)}
              className={`px-3 py-1 rounded-sz text-xs font-medium transition-colors ${
                clipProject.exportPreset === preset
                  ? 'bg-sz-accent text-sz-bg'
                  : 'bg-sz-bg-tertiary text-sz-text-secondary hover:text-sz-text hover:bg-sz-bg-hover'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default memo(TrimPanel);
