import { memo } from 'react';
import { Settings, HelpCircle, Minus, Square, X } from 'lucide-react';
import { IconButton } from '../ui';

interface HeaderProps {
  onSettingsClick: () => void;
  onHelpClick?: () => void;
}

function Header({ onSettingsClick, onHelpClick }: HeaderProps) {
  return (
    <header className="h-12 bg-sz-bg-secondary border-b border-sz-border flex items-center justify-between px-4 select-none drag-region">
      {/* Logo */}
      <div className="flex items-center gap-0 no-drag">
        <span className="text-sm font-bold text-sz-text tracking-wide">SEE</span>
        <span className="mx-1.5 px-2 py-0.5 bg-sz-accent rounded text-[10px] font-bold text-white tracking-wide">
          STUDIO
        </span>
        <span className="text-sm font-bold text-sz-text tracking-wide">ZEE</span>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1 no-drag">
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
          tooltip="Help"
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
