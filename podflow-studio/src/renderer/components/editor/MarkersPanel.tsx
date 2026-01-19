import { memo, useCallback, useState } from 'react';
import { Plus, Trash2, Edit2, MapPin, Flag, Search, Filter } from 'lucide-react';
import { useStore } from '../../stores/store';
import type { TimelineMarker } from '../../types';
import { formatTimestamp } from '../../types';
import { Button, IconButton, Input } from '../ui';

interface MarkersPanelProps {
  className?: string;
  onJumpToMarker?: (time: number) => void;
}

// Marker color options
const markerColorOptions: Array<{ color: TimelineMarker['color']; label: string; class: string }> = [
  { color: 'green', label: 'Green', class: 'bg-emerald-500' },
  { color: 'red', label: 'Red', class: 'bg-red-500' },
  { color: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { color: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { color: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
  { color: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { color: 'cyan', label: 'Cyan', class: 'bg-cyan-500' },
  { color: 'pink', label: 'Pink', class: 'bg-pink-500' },
];

// Marker type options
const markerTypeOptions: Array<{ type: TimelineMarker['type']; label: string; icon: string }> = [
  { type: 'comment', label: 'Comment', icon: '💬' },
  { type: 'chapter', label: 'Chapter', icon: '📖' },
  { type: 'ad-read', label: 'Ad Read', icon: '💰' },
  { type: 'key-moment', label: 'Key Moment', icon: '⭐' },
  { type: 'segmentation', label: 'Segmentation', icon: '📐' },
];

function MarkersPanel({ className = '', onJumpToMarker }: MarkersPanelProps) {
  const { markers, addMarker, removeMarker, updateMarker, goToMarker, project } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<TimelineMarker['type'] | 'all'>('all');
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state for add/edit
  const [formData, setFormData] = useState<{
    time: number;
    name: string;
    comment: string;
    color: TimelineMarker['color'];
    type: TimelineMarker['type'];
    duration?: number;
  }>({
    time: 0,
    name: '',
    comment: '',
    color: 'blue',
    type: 'comment',
  });

  // Filter markers based on search and filter
  const filteredMarkers = markers
    .filter((m) => {
      if (filterType !== 'all' && m.type !== filterType) return false;
      if (searchQuery && !m.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => a.time - b.time);

  const handleAddMarker = useCallback(() => {
    const newMarker: TimelineMarker = {
      id: `marker_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      time: formData.time,
      name: formData.name || 'Untitled Marker',
      comment: formData.comment,
      color: formData.color,
      type: formData.type,
      duration: formData.duration,
    };
    
    addMarker(newMarker);
    setShowAddModal(false);
    setFormData({
      time: 0,
      name: '',
      comment: '',
      color: 'blue',
      type: 'comment',
    });
  }, [formData, addMarker]);

  const handleEditMarker = useCallback((marker: TimelineMarker) => {
    setEditingMarkerId(marker.id);
    setFormData({
      time: marker.time,
      name: marker.name,
      comment: marker.comment || '',
      color: marker.color,
      type: marker.type,
      duration: marker.duration,
    });
    setShowAddModal(true);
  }, []);

  const handleUpdateMarker = useCallback(() => {
    if (!editingMarkerId) return;
    
    updateMarker(editingMarkerId, {
      time: formData.time,
      name: formData.name,
      comment: formData.comment,
      color: formData.color,
      type: formData.type,
      duration: formData.duration,
    });
    
    setShowAddModal(false);
    setEditingMarkerId(null);
    setFormData({
      time: 0,
      name: '',
      comment: '',
      color: 'blue',
      type: 'comment',
    });
  }, [editingMarkerId, formData, updateMarker]);

  const handleRemoveMarker = useCallback((markerId: string) => {
    removeMarker(markerId);
  }, [removeMarker]);

  const handleJumpToMarker = useCallback((marker: TimelineMarker) => {
    const time = goToMarker(marker.id);
    onJumpToMarker?.(time);
  }, [goToMarker, onJumpToMarker]);

  return (
    <div className={`flex flex-col h-full bg-sz-bg-secondary border border-sz-border rounded-sz overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-sz-border bg-sz-bg">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-sz-text-secondary" />
          <span className="text-sm font-medium text-sz-text">Markers</span>
          <span className="text-xs text-sz-text-muted">({markers.length})</span>
        </div>
        <Button
          variant="primary"
          size="xs"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => {
            setEditingMarkerId(null);
            setFormData({
              time: 0,
              name: '',
              comment: '',
              color: 'blue',
              type: 'comment',
            });
            setShowAddModal(true);
          }}
        >
          Add
        </Button>
      </div>

      {/* Search and filter */}
      <div className="p-2 space-y-2 border-b border-sz-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sz-text-muted" />
          <Input
            type="text"
            placeholder="Search markers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 text-xs"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-sz-text-muted" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as TimelineMarker['type'] | 'all')}
            className="flex-1 px-2 py-1 text-xs bg-sz-bg-tertiary border border-sz-border rounded text-sz-text"
          >
            <option value="all">All Types</option>
            {markerTypeOptions.map((opt) => (
              <option key={opt.type} value={opt.type}>
                {opt.icon} {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Marker list */}
      <div className="flex-1 overflow-y-auto">
        {filteredMarkers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <Flag className="w-12 h-12 text-sz-text-muted/30 mb-2" />
            <p className="text-sm text-sz-text-secondary mb-1">No markers yet</p>
            <p className="text-xs text-sz-text-muted">
              Add markers to organize your timeline
            </p>
          </div>
        ) : (
          <div className="divide-y divide-sz-border">
            {filteredMarkers.map((marker) => {
              const colorClass = markerColorOptions.find((c) => c.color === marker.color)?.class;
              const typeInfo = markerTypeOptions.find((t) => t.type === marker.type);
              
              return (
                <div
                  key={marker.id}
                  className="p-2 hover:bg-sz-bg-tertiary transition-colors group cursor-pointer"
                  onClick={() => handleJumpToMarker(marker)}
                >
                  <div className="flex items-start gap-2">
                    {/* Color indicator */}
                    <div className={`w-1 h-full ${colorClass} rounded-full mt-1`} />
                    
                    {/* Marker info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs">{typeInfo?.icon}</span>
                        <span className="text-xs font-medium text-sz-text truncate">
                          {marker.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-sz-text-muted">
                        <span>{formatTimestamp(marker.time)}</span>
                        {marker.duration && (
                          <span>• {marker.duration.toFixed(1)}s</span>
                        )}
                        <span>• {typeInfo?.label}</span>
                      </div>
                      {marker.comment && (
                        <p className="text-[10px] text-sz-text-secondary mt-1 line-clamp-2">
                          {marker.comment}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconButton
                        icon={<Edit2 className="w-3 h-3" />}
                        variant="ghost"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditMarker(marker);
                        }}
                        tooltip="Edit marker"
                      />
                      <IconButton
                        icon={<Trash2 className="w-3 h-3" />}
                        variant="ghost"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveMarker(marker.id);
                        }}
                        tooltip="Remove marker"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit marker modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-sz-bg-secondary border border-sz-border rounded-lg shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-sz-border">
              <h3 className="text-sm font-medium text-sz-text">
                {editingMarkerId ? 'Edit Marker' : 'Add Marker'}
              </h3>
            </div>

            <div className="p-4 space-y-3">
              {/* Name */}
              <div>
                <label className="block text-xs text-sz-text-secondary mb-1">Name</label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Marker name"
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-xs text-sz-text-secondary mb-1">Time (seconds)</label>
                <Input
                  type="number"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: parseFloat(e.target.value) || 0 })}
                  step="0.1"
                  min="0"
                  max={project?.duration || 3600}
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs text-sz-text-secondary mb-1">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {markerTypeOptions.map((opt) => (
                    <button
                      key={opt.type}
                      onClick={() => setFormData({ ...formData, type: opt.type })}
                      className={`px-3 py-2 rounded border text-xs transition-colors ${
                        formData.type === opt.type
                          ? 'bg-sz-accent text-white border-sz-accent'
                          : 'bg-sz-bg border-sz-border text-sz-text-secondary hover:bg-sz-bg-tertiary'
                      }`}
                    >
                      <span className="mr-1">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs text-sz-text-secondary mb-1">Color</label>
                <div className="flex items-center gap-2">
                  {markerColorOptions.map((opt) => (
                    <button
                      key={opt.color}
                      onClick={() => setFormData({ ...formData, color: opt.color })}
                      className={`w-6 h-6 rounded ${opt.class} border-2 transition-all ${
                        formData.color === opt.color
                          ? 'border-white scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      title={opt.label}
                    />
                  ))}
                </div>
              </div>

              {/* Duration (optional) */}
              <div>
                <label className="block text-xs text-sz-text-secondary mb-1">
                  Duration (optional, for range markers)
                </label>
                <Input
                  type="number"
                  value={formData.duration || ''}
                  onChange={(e) => setFormData({ ...formData, duration: parseFloat(e.target.value) || undefined })}
                  placeholder="Leave empty for point marker"
                  step="0.1"
                  min="0"
                />
              </div>

              {/* Comment */}
              <div>
                <label className="block text-xs text-sz-text-secondary mb-1">Comment (optional)</label>
                <textarea
                  value={formData.comment}
                  onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                  placeholder="Add notes or description..."
                  className="w-full px-3 py-2 bg-sz-bg border border-sz-border rounded text-xs text-sz-text resize-none"
                  rows={3}
                />
              </div>
            </div>

            <div className="p-4 border-t border-sz-border flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={editingMarkerId ? handleUpdateMarker : handleAddMarker}
                disabled={!formData.name}
              >
                {editingMarkerId ? 'Update' : 'Add'} Marker
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(MarkersPanel);
