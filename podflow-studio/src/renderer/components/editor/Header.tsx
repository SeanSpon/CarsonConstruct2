import { memo } from 'react';
import { 
  Settings, 
  HelpCircle, 
  Minus, 
  Square, 
  X,
  FolderOpen,
  Sparkles,
  MessageSquare,
  CheckCircle,
  BookOpen
} from 'lucide-react';
import { IconButton } from '../ui';
import MenuBar, { MenuBarProps } from './MenuBar';

interface RecentProject {
  filePath: string;
  name: string;
  modifiedAt: string;
}

interface HeaderProps {
  onSettingsClick: () => void;
  onHelpClick?: () => void;
  onDocsClick?: () => void;
  // Menu bar props
  onNewProject?: () => void;
  onOpenProject?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onImportVideo?: () => void;
  onExit?: () => void;
  recentProjects?: RecentProject[];
  onOpenRecent?: (filePath: string) => void;
  // Edit actions
  onUndo?: () => void;
  onRedo?: () => void;
  onAcceptClip?: () => void;
  onRejectClip?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  hasSelectedClip?: boolean;
  // View actions
  showQAPanel?: boolean;
  onToggleQAPanel?: () => void;
  showEffectsPanel?: boolean;
  onToggleEffectsPanel?: () => void;
  showProjectPanel?: boolean;
  onToggleProjectPanel?: () => void;
  showChatPanel?: boolean;
  onToggleChatPanel?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  // Help actions
  onShowShortcuts?: () => void;
  onShowAbout?: () => void;
}

function Header({
  onSettingsClick,
  onHelpClick,
  onDocsClick,
  // Menu bar props
  onNewProject,
  onOpenProject,
  onSave,
  onSaveAs,
  onImportVideo,
  onExit,
  recentProjects,
  onOpenRecent,
  // Edit
  onUndo,
  onRedo,
  onAcceptClip,
  onRejectClip,
  canUndo,
  canRedo,
  hasSelectedClip,
  // View
  showQAPanel,
  onToggleQAPanel,
  showEffectsPanel,
  onToggleEffectsPanel,
  showProjectPanel,
  onToggleProjectPanel,
  showChatPanel,
  onToggleChatPanel,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  // Help
  onShowShortcuts,
  onShowAbout,
}: HeaderProps) {
  return (
    <header className="h-12 bg-sz-bg-secondary border-b border-sz-border flex items-center justify-between px-4 select-none drag-region">
      {/* Left: Logo + Menu Bar */}
      <div className="flex items-center gap-4 no-drag">
        {/* Logo */}
        <div className="flex items-center gap-0">
          <span className="text-sm font-bold text-sz-text tracking-wide">PodFlow</span>
          <span className="mx-1.5 px-2 py-0.5 bg-sz-accent rounded text-[10px] font-bold text-white tracking-wide">
            STUDIO
          </span>
        </div>

        {/* Menu Bar */}
        <MenuBar
          // File
          onNewProject={onNewProject}
          onOpenProject={onOpenProject}
          onSave={onSave}
          onSaveAs={onSaveAs}
          onImportVideo={onImportVideo}
          onSettings={onSettingsClick}
          onExit={onExit}
          recentProjects={recentProjects}
          onOpenRecent={onOpenRecent}
          // Edit
          onUndo={onUndo}
          onRedo={onRedo}
          onAcceptClip={onAcceptClip}
          onRejectClip={onRejectClip}
          canUndo={canUndo}
          canRedo={canRedo}
          hasSelectedClip={hasSelectedClip}
          // View
          showQAPanel={showQAPanel}
          onToggleQAPanel={onToggleQAPanel}
          showEffectsPanel={showEffectsPanel}
          onToggleEffectsPanel={onToggleEffectsPanel}
          showProjectPanel={showProjectPanel}
          onToggleProjectPanel={onToggleProjectPanel}
          showChatPanel={showChatPanel}
          onToggleChatPanel={onToggleChatPanel}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onResetZoom={onResetZoom}
          // Help
          onShowShortcuts={onShowShortcuts}
          onShowDocs={onHelpClick}
          onShowAbout={onShowAbout}
        />
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1 no-drag">
        {/* Panel Toggle Buttons */}
        <div className="flex items-center gap-0.5 mr-2 px-2 py-1 bg-sz-bg rounded-md border border-sz-border">
          <button
            onClick={onToggleProjectPanel}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
              showProjectPanel 
                ? 'bg-sz-accent text-white' 
                : 'text-sz-text-muted hover:text-sz-text hover:bg-sz-bg-hover'
            }`}
            title="Toggle Project Panel"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Project</span>
          </button>
          
          <button
            onClick={onToggleEffectsPanel}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
              showEffectsPanel 
                ? 'bg-sz-accent text-white' 
                : 'text-sz-text-muted hover:text-sz-text hover:bg-sz-bg-hover'
            }`}
            title="Toggle Effects Panel"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Effects</span>
          </button>
          
          <button
            onClick={onToggleChatPanel}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
              showChatPanel 
                ? 'bg-purple-500 text-white' 
                : 'text-sz-text-muted hover:text-sz-text hover:bg-sz-bg-hover'
            }`}
            title="Toggle AI Chat (Ctrl+J)"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">AI Chat</span>
          </button>
          
          <button
            onClick={onToggleQAPanel}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
              showQAPanel 
                ? 'bg-green-500 text-white' 
                : 'text-sz-text-muted hover:text-sz-text hover:bg-sz-bg-hover'
            }`}
            title="Toggle QA Panel"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">QA</span>
          </button>
        </div>
        
        {/* Divider */}
        <div className="h-6 w-px bg-sz-border mx-1" />
        
        {/* Documentation */}
        <IconButton
          icon={<BookOpen className="w-4 h-4" />}
          variant="ghost"
          size="sm"
          tooltip="Documentation"
          onClick={onDocsClick}
        />
        
        <IconButton
          icon={<Settings className="w-4 h-4" />}
          variant="ghost"
          size="sm"
          tooltip="Settings"
          onClick={onSettingsClick}
        />
        <IconButton
          icon={<HelpCircle className="w-4 h-4" />}
          variant="ghost"
          size="sm"
          tooltip="Help & Shortcuts"
          onClick={onHelpClick}
        />
        
        {/* Window controls - styled but non-functional (Electron handles these) */}
        <div className="ml-2 flex items-center gap-0.5">
          <button className="w-8 h-8 flex items-center justify-center text-sz-text-muted hover:text-sz-text hover:bg-sz-bg-hover transition-colors">
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button className="w-8 h-8 flex items-center justify-center text-sz-text-muted hover:text-sz-text hover:bg-sz-bg-hover transition-colors">
            <Square className="w-3 h-3" />
          </button>
          <button className="w-8 h-8 flex items-center justify-center text-sz-text-muted hover:text-white hover:bg-red-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default memo(Header);
