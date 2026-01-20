import { memo, useCallback } from 'react';
import { HelpCircle, Settings, Minus, Square, X, Sparkles } from 'lucide-react';
import { IconButton } from '../ui';
import MenuBar from './MenuBar';

interface RecentProject {
  filePath: string;
  name: string;
  modifiedAt: string;
}

interface HeaderProps {
  onHelpClick?: () => void;
  onSettingsClick?: () => void;
  onNewProject?: () => void;
  onOpenProject?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onImportVideo?: () => void;
  onExit?: () => void;
  recentProjects?: RecentProject[];
  onOpenRecent?: (filePath: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onAcceptClip?: () => void;
  onRejectClip?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  hasSelectedClip?: boolean;
}

function Header({
  onHelpClick,
  onSettingsClick,
  onNewProject,
  onOpenProject,
  onSave,
  onSaveAs,
  onImportVideo,
  onExit,
  recentProjects,
  onOpenRecent,
  onUndo,
  onRedo,
  onAcceptClip,
  onRejectClip,
  canUndo,
  canRedo,
  hasSelectedClip,
}: HeaderProps) {
  // Window control handlers
  const handleMinimize = useCallback(() => {
    window.api.windowMinimize();
  }, []);

  const handleMaximize = useCallback(() => {
    window.api.windowMaximize();
  }, []);

  const handleClose = useCallback(() => {
    window.api.windowClose();
  }, []);

  return (
    <header className="h-12 bg-sz-bg-secondary border-b border-sz-border flex items-center justify-between px-4 select-none drag-region">
      {/* Left: Logo + Menu Bar */}
      <div className="flex items-center gap-4 no-drag">
        {/* Logo */}
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-sz-accent" />
          <span className="text-sm font-bold text-sz-text tracking-wide">Opus</span>
          <span className="px-1.5 py-0.5 bg-gradient-to-r from-sz-accent to-purple-500 rounded text-[10px] font-bold text-white tracking-wide">
            AI
          </span>
        </div>

        {/* Menu Bar */}
        <MenuBar
          onNewProject={onNewProject}
          onOpenProject={onOpenProject}
          onSave={onSave}
          onSaveAs={onSaveAs}
          onImportVideo={onImportVideo}
          onExit={onExit}
          recentProjects={recentProjects}
          onOpenRecent={onOpenRecent}
          onUndo={onUndo}
          onRedo={onRedo}
          onAcceptClip={onAcceptClip}
          onRejectClip={onRejectClip}
          canUndo={canUndo}
          canRedo={canRedo}
          hasSelectedClip={hasSelectedClip}
          onShowShortcuts={onHelpClick}
        />
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1 no-drag">
        <IconButton
          icon={<Settings className="w-4 h-4" />}
          variant="ghost"
          size="sm"
          tooltip="Settings (API Key)"
          onClick={onSettingsClick}
        />
        <IconButton
          icon={<HelpCircle className="w-4 h-4" />}
          variant="ghost"
          size="sm"
          tooltip="Help & Shortcuts"
          onClick={onHelpClick}
        />
        
        {/* Window controls */}
        <div className="ml-2 flex items-center gap-0.5">
          <button 
            onClick={handleMinimize}
            className="w-8 h-8 flex items-center justify-center text-sz-text-muted hover:text-sz-text hover:bg-sz-bg-hover transition-colors"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={handleMaximize}
            className="w-8 h-8 flex items-center justify-center text-sz-text-muted hover:text-sz-text hover:bg-sz-bg-hover transition-colors"
            title="Maximize"
          >
            <Square className="w-3 h-3" />
          </button>
          <button 
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center text-sz-text-muted hover:text-white hover:bg-red-600 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default memo(Header);
