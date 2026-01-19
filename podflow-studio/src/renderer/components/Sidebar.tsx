import { memo, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, 
  Search, 
  Scissors, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  Settings
} from 'lucide-react';
import { useStore } from '../stores/store';

const navItems = [
  { path: '/', icon: Home, label: 'Home', shortcut: '⌘H' },
  { path: '/clips', icon: Search, label: 'Find Clips', shortcut: '⌘F' },
  { path: '/edit', icon: Scissors, label: 'Auto Edit', shortcut: '⌘E' },
  { path: '/export', icon: Download, label: 'Export', shortcut: '⌘X' },
];

function Sidebar() {
  const location = useLocation();
  const { project, clips, deadSpaces } = useStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { acceptedClips, deadSpacesToRemove } = useMemo(() => ({
    acceptedClips: clips.filter(c => c.status === 'accepted').length,
    deadSpacesToRemove: deadSpaces.filter(ds => ds.remove).length,
  }), [clips, deadSpaces]);

  // Don't show sidebar on home page when no project is loaded
  const isHomePage = location.pathname === '/';
  if (isHomePage && !project) {
    return null;
  }

  return (
    <aside 
      className={`
        bg-sz-bg-secondary border-r border-sz-border flex flex-col
        transition-all duration-200 ease-out select-none
        ${isCollapsed ? 'w-14' : 'w-52'}
      `}
    >
      {/* Logo Header */}
      <div className={`h-12 border-b border-sz-border flex items-center ${isCollapsed ? 'justify-center' : 'px-3'}`}>
        {isCollapsed ? (
          <div className="px-1.5 py-0.5 bg-sz-accent rounded text-[10px] font-bold text-white tracking-wide">
            SZ
          </div>
        ) : (
          <div className="flex items-center gap-0">
            <span className="text-sm font-bold text-sz-text tracking-wide">SEE</span>
            <span className="mx-1.5 px-1.5 py-0.5 bg-sz-accent rounded text-[10px] font-bold text-white tracking-wide">
              STUDIO
            </span>
            <span className="text-sm font-bold text-sz-text tracking-wide">ZEE</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3">
        <div className={isCollapsed ? 'px-2' : 'px-2'}>
          {!isCollapsed && (
            <div className="text-[10px] font-medium text-sz-text-muted uppercase tracking-wider px-2 mb-2">
              Workspace
            </div>
          )}
          
          <ul className="space-y-1">
            {navItems.map(({ path, icon: Icon, label, shortcut }) => {
              let badge: number | null = null;
              if (path === '/clips' && acceptedClips > 0) {
                badge = acceptedClips;
              } else if (path === '/edit' && deadSpacesToRemove > 0) {
                badge = deadSpacesToRemove;
              }

              return (
                <li key={path}>
                  <NavLink
                    to={path}
                    title={isCollapsed ? `${label} (${shortcut})` : undefined}
                    className={({ isActive }) => `
                      relative flex items-center gap-2.5 rounded-sz
                      transition-all duration-sz-fast
                      ${isCollapsed ? 'justify-center p-2' : 'px-2.5 py-2'}
                      ${isActive
                        ? 'bg-sz-accent text-sz-bg font-medium'
                        : 'text-sz-text-secondary hover:text-sz-text hover:bg-sz-bg-hover'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!isCollapsed && (
                      <>
                        <span className="text-[13px] flex-1">{label}</span>
                        {badge !== null && (
                          <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-semibold bg-sz-bg text-sz-accent rounded">
                            {badge}
                          </span>
                        )}
                      </>
                    )}
                    {isCollapsed && badge !== null && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-sz-accent rounded-full ring-2 ring-sz-bg-secondary" />
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Project Info Panel */}
      {project && !isCollapsed && (
        <div className="border-t border-sz-border p-3">
          <div className="text-[10px] font-medium text-sz-text-muted uppercase tracking-wider mb-2">
            Current Project
          </div>
          <div className="bg-sz-bg rounded-sz p-2.5 border border-sz-border">
            <p className="text-xs text-sz-text font-medium truncate">
              {project.fileName}
            </p>
            <p className="text-[10px] text-sz-text-muted mt-1">
              {Math.floor(project.duration / 60)}:{String(Math.floor(project.duration % 60)).padStart(2, '0')}
              {clips.length > 0 && ` • ${clips.length} clips`}
            </p>
          </div>
        </div>
      )}

      {/* Settings Link */}
      {!isCollapsed && (
        <div className="px-2 pb-2">
          <button
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-sz text-sz-text-secondary hover:text-sz-text hover:bg-sz-bg-hover transition-colors duration-sz-fast"
            onClick={() => {/* TODO: Open settings modal */}}
          >
            <Settings className="w-4 h-4" />
            <span className="text-[13px]">Settings</span>
          </button>
        </div>
      )}

      {/* Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="h-9 border-t border-sz-border flex items-center justify-center text-sz-text-muted hover:text-sz-text hover:bg-sz-bg-hover transition-colors duration-sz-fast"
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
}

export default memo(Sidebar);
