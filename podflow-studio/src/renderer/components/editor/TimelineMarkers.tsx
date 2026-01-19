import { memo, useCallback } from 'react';
import { Flag, X, Edit2 } from 'lucide-react';
import type { TimelineMarker } from '../../types';

interface TimelineMarkersProps {
  markers: TimelineMarker[];
  duration: number;
  onMarkerClick: (markerId: string) => void;
  onMarkerEdit?: (markerId: string) => void;
  onMarkerRemove?: (markerId: string) => void;
  onMarkerAdd?: (time: number) => void;
  editable?: boolean;
}

// Marker color mapping (Premiere Pro-style)
const markerColors: Record<TimelineMarker['color'], string> = {
  green: 'bg-emerald-500 border-emerald-400',
  red: 'bg-red-500 border-red-400',
  purple: 'bg-purple-500 border-purple-400',
  orange: 'bg-orange-500 border-orange-400',
  yellow: 'bg-yellow-500 border-yellow-400',
  blue: 'bg-blue-500 border-blue-400',
  cyan: 'bg-cyan-500 border-cyan-400',
  pink: 'bg-pink-500 border-pink-400',
};

// Marker type icons
const markerTypeLabels: Record<TimelineMarker['type'], string> = {
  comment: '💬',
  chapter: '📖',
  'ad-read': '💰',
  'key-moment': '⭐',
  segmentation: '📐',
};

function TimelineMarkers({
  markers,
  duration,
  onMarkerClick,
  onMarkerEdit,
  onMarkerRemove,
  onMarkerAdd,
  editable = true,
}: TimelineMarkersProps) {
  
  const handleMarkerClick = useCallback((e: React.MouseEvent, markerId: string) => {
    e.stopPropagation();
    onMarkerClick(markerId);
  }, [onMarkerClick]);

  const handleMarkerEdit = useCallback((e: React.MouseEvent, markerId: string) => {
    e.stopPropagation();
    onMarkerEdit?.(markerId);
  }, [onMarkerEdit]);

  const handleMarkerRemove = useCallback((e: React.MouseEvent, markerId: string) => {
    e.stopPropagation();
    onMarkerRemove?.(markerId);
  }, [onMarkerRemove]);

  return (
    <div className="relative w-full">
      {/* Render all markers */}
      {markers.map((marker) => {
        const position = (marker.time / duration) * 100;
        const colorClass = markerColors[marker.color];
        const typeIcon = markerTypeLabels[marker.type];
        const isRange = marker.duration && marker.duration > 0;
        const rangeWidth = isRange ? (marker.duration! / duration) * 100 : 0;

        return (
          <div key={marker.id}>
            {/* Range indicator (if range marker) */}
            {isRange && (
              <div
                className={`absolute top-0 h-full opacity-20 ${colorClass}`}
                style={{
                  left: `${position}%`,
                  width: `${rangeWidth}%`,
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Marker flag */}
            <div
              className="absolute top-0 group cursor-pointer z-30"
              style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
              onClick={(e) => handleMarkerClick(e, marker.id)}
            >
              {/* Marker line */}
              <div
                className={`w-0.5 h-full ${colorClass.split(' ')[0]}`}
                style={{ height: '100%' }}
              />
              
              {/* Marker flag at top */}
              <div
                className={`absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-6 ${colorClass} 
                  border rounded-sm shadow-lg flex items-center justify-center
                  group-hover:scale-110 transition-transform`}
                title={marker.name}
              >
                <span className="text-[10px] select-none">{typeIcon}</span>
                
                {/* Triangle pointer */}
                <div
                  className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 
                    border-l-[4px] border-l-transparent 
                    border-r-[4px] border-r-transparent 
                    border-t-[4px] ${colorClass.split(' ')[0].replace('bg-', 'border-t-')}`}
                />
              </div>

              {/* Marker tooltip (on hover) */}
              <div
                className="absolute top-7 left-1/2 -translate-x-1/2 min-w-max 
                  opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none
                  bg-sz-bg-secondary border border-sz-border rounded-md shadow-lg p-2 z-50"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-2 h-2 rounded-full ${colorClass.split(' ')[0]}`} />
                  <span className="text-xs font-medium text-sz-text">{marker.name}</span>
                </div>
                {marker.comment && (
                  <p className="text-[10px] text-sz-text-secondary max-w-xs whitespace-pre-wrap">
                    {marker.comment}
                  </p>
                )}
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[9px] text-sz-text-muted">
                    {marker.type.replace('-', ' ')}
                  </span>
                  {isRange && (
                    <span className="text-[9px] text-sz-text-muted">
                      • {marker.duration?.toFixed(1)}s
                    </span>
                  )}
                </div>

                {/* Edit/Delete buttons */}
                {editable && (
                  <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-sz-border/50">
                    {onMarkerEdit && (
                      <button
                        onClick={(e) => handleMarkerEdit(e, marker.id)}
                        className="p-1 rounded hover:bg-sz-bg-tertiary text-sz-text-secondary hover:text-sz-text transition-colors pointer-events-auto"
                        title="Edit marker"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    )}
                    {onMarkerRemove && (
                      <button
                        onClick={(e) => handleMarkerRemove(e, marker.id)}
                        className="p-1 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors pointer-events-auto"
                        title="Remove marker"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(TimelineMarkers);
