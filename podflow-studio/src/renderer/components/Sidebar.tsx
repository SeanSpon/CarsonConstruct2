import { NavLink } from 'react-router-dom';
import { Home, Target, Scissors, Package, AudioWaveform } from 'lucide-react';
import { useStore } from '../stores/store';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/clips', icon: Target, label: 'Clip Finder' },
  { path: '/edit', icon: Scissors, label: 'Auto Edit' },
  { path: '/export', icon: Package, label: 'Export' },
];

export default function Sidebar() {
  const { project, clips, deadSpaces } = useStore();
  
  const acceptedClips = clips.filter(c => c.status === 'accepted').length;
  const deadSpacesToRemove = deadSpaces.filter(ds => ds.remove).length;

  return (
    <aside className="w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center">
            <AudioWaveform className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">PodFlow</h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Studio</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3">
        <ul className="space-y-1">
          {navItems.map(({ path, icon: Icon, label }) => {
            // Show badges for Clip Finder and Auto Edit
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
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-lg
                    text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-violet-600/20 text-violet-400' 
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }
                  `}
                >
                  <Icon className="w-4.5 h-4.5" />
                  <span className="flex-1">{label}</span>
                  {badge !== null && (
                    <span className="px-1.5 py-0.5 text-xs font-semibold bg-violet-600 text-white rounded">
                      {badge}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Project Status (bottom) */}
      {project && (
        <div className="p-4 border-t border-zinc-800">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1.5">
            Current Project
          </div>
          <div className="text-sm text-zinc-300 font-medium truncate">
            {project.fileName}
          </div>
        </div>
      )}
    </aside>
  );
}
