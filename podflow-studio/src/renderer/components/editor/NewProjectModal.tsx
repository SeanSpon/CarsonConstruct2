import { useState, useEffect, useRef } from 'react';
import { X, Folder, Loader2 } from 'lucide-react';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (name: string, location: string) => Promise<void>;
}

export default function NewProjectModal({ isOpen, onClose, onCreateProject }: NewProjectModalProps) {
  const [projectName, setProjectName] = useState('Untitled Project');
  const [projectLocation, setProjectLocation] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load default projects directory on mount
  useEffect(() => {
    if (isOpen) {
      window.api.getDefaultProjectsDir().then((dir) => {
        setProjectLocation(dir);
      }).catch(() => {
        // Fallback if API fails
      });
      // Select the text in the input for easy editing
      setTimeout(() => {
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setProjectName('Untitled Project');
      setError(null);
      setIsCreating(false);
    }
  }, [isOpen]);

  const handleBrowse = async () => {
    const selectedPath = await window.api.selectProjectLocation(projectLocation);
    if (selectedPath) {
      setProjectLocation(selectedPath);
    }
  };

  const handleCreate = async () => {
    if (!projectName.trim()) {
      setError('Please enter a project name');
      return;
    }
    if (!projectLocation) {
      setError('Please select a project location');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await onCreateProject(projectName.trim(), projectLocation);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCreating) {
      handleCreate();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="relative bg-sz-bg-secondary border border-sz-border rounded-sz-lg shadow-2xl w-full max-w-lg mx-4"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sz-border">
          <h2 className="text-lg font-semibold text-sz-text">New Project</h2>
          <button
            onClick={onClose}
            className="p-1 text-sz-text-muted hover:text-sz-text hover:bg-sz-bg-tertiary rounded-sz transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-sz-text-secondary mb-2">
              Project Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="My Awesome Project"
              className="w-full px-4 py-3 bg-sz-bg border border-sz-border rounded-sz text-sz-text placeholder-sz-text-muted focus:outline-none focus:ring-2 focus:ring-sz-accent focus:border-transparent transition-all"
              disabled={isCreating}
              autoFocus
            />
          </div>

          {/* Project Location */}
          <div>
            <label className="block text-sm font-medium text-sz-text-secondary mb-2">
              Location
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={projectLocation}
                onChange={(e) => setProjectLocation(e.target.value)}
                placeholder="Select a folder..."
                className="flex-1 px-4 py-3 bg-sz-bg border border-sz-border rounded-sz text-sz-text placeholder-sz-text-muted focus:outline-none focus:ring-2 focus:ring-sz-accent focus:border-transparent transition-all text-sm"
                disabled={isCreating}
              />
              <button
                onClick={handleBrowse}
                disabled={isCreating}
                className="px-4 py-3 bg-sz-bg border border-sz-border rounded-sz text-sz-text-secondary hover:bg-sz-bg-tertiary hover:text-sz-text transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Folder className="w-4 h-4" />
                Browse
              </button>
            </div>
            <p className="mt-2 text-xs text-sz-text-muted">
              A folder named "{projectName || 'Untitled Project'}" will be created here
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-sz-danger-muted border border-sz-danger/30 rounded-sz">
              <p className="text-sm text-sz-danger">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-sz-border bg-sz-bg-tertiary/50 rounded-b-sz-lg">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="px-4 py-2 text-sz-text-muted hover:text-sz-text font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !projectName.trim()}
            className="px-5 py-2 bg-sz-accent hover:bg-sz-accent-hover disabled:bg-sz-accent/50 text-white font-semibold rounded-sz transition-colors flex items-center gap-2"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Project'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
