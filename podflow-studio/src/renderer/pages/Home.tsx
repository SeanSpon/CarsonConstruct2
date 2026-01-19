import { useState, useCallback, memo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileVideo, Upload, Clock, Trash2, Target, Scissors, Package, ArrowRight, Sparkles } from 'lucide-react';
import { useStore } from '../stores/store';
import { formatFileSize, formatDuration } from '../types';
import { Button, LoadingState } from '../components/ui';

function Home() {
  const navigate = useNavigate();
  const {
    project,
    clips,
    setProject,
    clearProject,
    recentProjects,
    removeRecentProject,
  } = useStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleSelectFile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const file = await window.api.selectFile();

      if (!file) {
        setIsLoading(false);
        return;
      }

      const validation = await window.api.validateFile(file.path);

      if (!validation.valid) {
        setError(validation.error || 'Invalid video file');
        setIsLoading(false);
        return;
      }

      setProject({
        filePath: file.path,
        fileName: file.name,
        size: file.size,
        duration: validation.duration || 0,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [setProject]);

  const handleOpenRecent = useCallback(async (filePath: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const validation = await window.api.validateFile(filePath);

      if (!validation.valid) {
        setError('File no longer exists or is invalid');
        removeRecentProject(filePath);
        setIsLoading(false);
        return;
      }

      const fileName = filePath.split(/[\\/]/).pop() || 'Unknown';

      setProject({
        filePath,
        fileName,
        size: 0,
        duration: validation.duration || 0,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [removeRecentProject, setProject]);

  const handleAnalyze = useCallback(() => {
    if (project) {
      navigate('/clips');
    }
  }, [project, navigate]);

  const handleClear = useCallback(() => {
    clearProject();
    setError(null);
  }, [clearProject]);

  // Auto-restore session: navigate to last route if project exists
  useEffect(() => {
    const state = useStore.getState();
    if (project && state.lastRoute && state.lastRoute !== '/') {
      // Validate project file still exists before navigating
      window.api.validateFile(project.filePath).then((validation) => {
        if (validation.valid) {
          console.log('[Home] Restoring session, navigating to:', state.lastRoute);
          navigate(state.lastRoute);
        } else {
          // File no longer exists, clear project
          useStore.getState().clearProject();
        }
      }).catch(() => {
        // Error validating, clear project
        useStore.getState().clearProject();
      });
    } else if (project && clips.length > 0) {
      // Project has clips, navigate to edit page
      navigate('/edit');
    } else if (project) {
      // Project exists but no clips, navigate to clips page
      navigate('/clips');
    }
  }, [project, navigate]);

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8 bg-sz-bg">
      <div className="w-full max-w-xl">
        {!project ? (
          <>
            {/* Logo & Brand */}
            <div className="text-center mb-10">
              <div className="flex items-center justify-center gap-0 mb-4">
                <span className="text-3xl font-bold text-sz-text tracking-wide">SEE</span>
                <span className="mx-2 px-2.5 py-1 bg-sz-accent rounded text-sm font-bold text-white tracking-wide">
                  STUDIO
                </span>
                <span className="text-3xl font-bold text-sz-text tracking-wide">ZEE</span>
              </div>
              <h2 className="text-xl font-semibold text-sz-text mb-2">Clip Studios</h2>
              <p className="text-sz-text-secondary text-sm">
                AI-powered clip detection for content creators
              </p>
            </div>

            {/* Drop Zone */}
            <button
              onClick={handleSelectFile}
              disabled={isLoading}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                // Handle file drop
              }}
              className={`
                w-full border-2 border-dashed rounded-sz-lg p-10 text-center 
                transition-all duration-200 cursor-pointer group
                ${isLoading
                  ? 'border-sz-border bg-sz-bg-secondary cursor-wait'
                  : isDragOver
                    ? 'border-sz-accent bg-sz-accent-muted'
                    : 'border-sz-border-light hover:border-sz-accent/50 hover:bg-sz-bg-secondary bg-sz-bg'
                }
              `}
            >
              {isLoading ? (
                <div className="flex flex-col items-center gap-4">
                  <LoadingState message="Reading file..." size="lg" />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className={`
                    w-14 h-14 rounded-sz-lg flex items-center justify-center transition-all duration-200
                    ${isDragOver ? 'bg-sz-accent text-sz-bg' : 'bg-sz-bg-tertiary text-sz-text-muted group-hover:bg-sz-bg-hover group-hover:text-sz-accent'}
                  `}>
                    <FileVideo className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-base font-medium text-sz-text mb-1">
                      {isDragOver ? 'Drop your video here' : 'Drop your video or click to browse'}
                    </p>
                    <p className="text-xs text-sz-text-muted">
                      MP4, MOV, WEBM, MKV supported
                    </p>
                  </div>
                  <div className="mt-2 px-5 py-2 bg-sz-accent hover:bg-sz-accent-hover rounded-sz font-medium text-sz-bg text-sm transition-colors flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Select File
                  </div>
                </div>
              )}
            </button>

            {/* Error */}
            {error && (
              <div className="mt-4 bg-sz-danger-muted border border-sz-danger/30 rounded-sz p-3">
                <p className="text-sm text-sz-danger">{error}</p>
              </div>
            )}

            {/* Recent Projects */}
            {recentProjects.length > 0 && (
              <div className="mt-10">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-sz-text-muted" />
                  <span className="text-xs font-medium text-sz-text-muted uppercase tracking-wider">
                    Recent Projects
                  </span>
                </div>
                <div className="space-y-1.5">
                  {recentProjects.slice(0, 5).map((recent) => (
                    <RecentProjectItem
                      key={recent.filePath}
                      recent={recent}
                      onOpen={handleOpenRecent}
                      onRemove={removeRecentProject}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Features */}
            <div className="mt-16 grid grid-cols-3 gap-6 text-center">
              <FeatureCard
                icon={<Target className="w-5 h-5" />}
                title="Find Clips"
                description="AI detection"
              />
              <FeatureCard
                icon={<Scissors className="w-5 h-5" />}
                title="Auto Edit"
                description="Remove dead space"
              />
              <FeatureCard
                icon={<Package className="w-5 h-5" />}
                title="Export"
                description="Ready-to-post clips"
              />
            </div>
          </>
        ) : (
          /* Selected File Card */
          <div className="animate-sz-fade-in">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-0 mb-4">
                <span className="text-lg font-bold text-sz-text tracking-wide">SEE</span>
                <span className="mx-1.5 px-2 py-0.5 bg-sz-accent rounded text-xs font-bold text-white tracking-wide">
                  STUDIO
                </span>
                <span className="text-lg font-bold text-sz-text tracking-wide">ZEE</span>
              </div>
              <h2 className="text-xl font-semibold text-sz-text">Ready to Analyze</h2>
            </div>

            {/* File Card */}
            <div className="bg-sz-bg-secondary border border-sz-border rounded-sz-lg p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-sz bg-sz-accent-muted flex items-center justify-center flex-shrink-0">
                  <FileVideo className="w-6 h-6 text-sz-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sz-text truncate">{project.fileName}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-sz-text-secondary">
                    {project.size > 0 && <span>{formatFileSize(project.size)}</span>}
                    {project.size > 0 && <span className="text-sz-border-light">•</span>}
                    <span>{formatDuration(project.duration)}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  Change
                </Button>
              </div>

              {/* Analyze Button */}
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleAnalyze}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="mt-6"
              >
                <Sparkles className="w-4 h-4" />
                Start Analysis
              </Button>
            </div>

            {/* Quick tip */}
            <p className="text-center text-xs text-sz-text-muted mt-6">
              Tip: You can adjust detection settings on the next screen
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Feature card component
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard = memo(function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="group">
      <div className="w-10 h-10 mx-auto rounded-sz bg-sz-bg-tertiary border border-sz-border flex items-center justify-center mb-3 text-sz-text-muted group-hover:border-sz-accent/30 group-hover:text-sz-accent transition-all duration-200">
        {icon}
      </div>
      <h3 className="text-sm font-medium text-sz-text mb-0.5">{title}</h3>
      <p className="text-xs text-sz-text-muted">{description}</p>
    </div>
  );
});

// Memoized recent project item
interface RecentProjectItemProps {
  recent: {
    filePath: string;
    fileName: string;
    duration: number;
    lastOpened: number;
  };
  onOpen: (filePath: string) => void;
  onRemove: (filePath: string) => void;
}

const RecentProjectItem = memo(function RecentProjectItem({
  recent,
  onOpen,
  onRemove,
}: RecentProjectItemProps) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-sz bg-sz-bg-secondary hover:bg-sz-bg-tertiary transition-colors group border border-transparent hover:border-sz-border">
      <div className="w-9 h-9 rounded-sz bg-sz-bg-tertiary group-hover:bg-sz-bg-hover flex items-center justify-center flex-shrink-0 transition-colors">
        <FileVideo className="w-4 h-4 text-sz-text-muted group-hover:text-sz-accent transition-colors" />
      </div>
      <button
        onClick={() => onOpen(recent.filePath)}
        className="flex-1 text-left min-w-0"
      >
        <p className="text-sm text-sz-text truncate">
          {recent.fileName}
        </p>
        <p className="text-xs text-sz-text-muted">
          {formatDuration(recent.duration)} • {new Date(recent.lastOpened).toLocaleDateString()}
        </p>
      </button>
      <button
        onClick={() => onRemove(recent.filePath)}
        className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-sz-bg-hover rounded-sz transition-all"
      >
        <Trash2 className="w-3.5 h-3.5 text-sz-text-muted hover:text-sz-danger" />
      </button>
    </div>
  );
});

export default memo(Home);
