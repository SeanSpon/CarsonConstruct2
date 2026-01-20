import { memo, useState, useRef, useEffect, useCallback } from 'react';
import {
  File,
  FolderOpen,
  Save,
  Download,
  LogOut,
  Undo2,
  Redo2,
  Check,
  X,
  Keyboard,
  Info,
  ChevronRight,
  Clock,
} from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  separator?: boolean;
  submenu?: MenuItem[];
}

interface MenuDefinition {
  id: string;
  label: string;
  items: MenuItem[];
}

interface RecentProject {
  filePath: string;
  name: string;
  modifiedAt: string;
}

export interface MenuBarProps {
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
  onShowShortcuts?: () => void;
}

function MenuBar({
  onNewProject,
  onOpenProject,
  onSave,
  onSaveAs,
  onImportVideo,
  onExit,
  recentProjects = [],
  onOpenRecent,
  onUndo,
  onRedo,
  onAcceptClip,
  onRejectClip,
  canUndo = false,
  canRedo = false,
  hasSelectedClip = false,
  onShowShortcuts,
}: MenuBarProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
        setOpenSubmenuId(null);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuId(null);
        setOpenSubmenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleMenuClick = useCallback((menuId: string) => {
    setOpenMenuId(prev => prev === menuId ? null : menuId);
    setOpenSubmenuId(null);
  }, []);

  const handleMenuHover = useCallback((menuId: string) => {
    if (openMenuId !== null) {
      setOpenMenuId(menuId);
      setOpenSubmenuId(null);
    }
  }, [openMenuId]);

  const handleItemClick = useCallback((item: MenuItem) => {
    if (item.disabled || item.submenu) return;
    item.onClick?.();
    setOpenMenuId(null);
    setOpenSubmenuId(null);
  }, []);

  const recentProjectsSubmenu: MenuItem[] = recentProjects.length > 0
    ? recentProjects.slice(0, 10).map((project) => ({
        id: `recent-${project.filePath}`,
        label: project.name,
        icon: <Clock className="w-4 h-4" />,
        onClick: () => onOpenRecent?.(project.filePath),
      }))
    : [{ id: 'no-recent', label: 'No recent projects', disabled: true }];

  const menus: MenuDefinition[] = [
    {
      id: 'file',
      label: 'File',
      items: [
        { id: 'new', label: 'New Project', icon: <File className="w-4 h-4" />, shortcut: 'Ctrl+N', onClick: onNewProject },
        { id: 'open', label: 'Open Project...', icon: <FolderOpen className="w-4 h-4" />, shortcut: 'Ctrl+O', onClick: onOpenProject },
        { id: 'recent', label: 'Open Recent', icon: <Clock className="w-4 h-4" />, submenu: recentProjectsSubmenu },
        { id: 'sep1', label: '', separator: true },
        { id: 'save', label: 'Save', icon: <Save className="w-4 h-4" />, shortcut: 'Ctrl+S', onClick: onSave },
        { id: 'save-as', label: 'Save As...', icon: <Save className="w-4 h-4" />, shortcut: 'Ctrl+Shift+S', onClick: onSaveAs },
        { id: 'sep2', label: '', separator: true },
        { id: 'import', label: 'Import Video...', icon: <Download className="w-4 h-4" />, shortcut: 'Ctrl+I', onClick: onImportVideo },
        { id: 'sep3', label: '', separator: true },
        { id: 'exit', label: 'Exit', icon: <LogOut className="w-4 h-4" />, shortcut: 'Alt+F4', onClick: onExit },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        { id: 'undo', label: 'Undo', icon: <Undo2 className="w-4 h-4" />, shortcut: 'Ctrl+Z', onClick: onUndo, disabled: !canUndo },
        { id: 'redo', label: 'Redo', icon: <Redo2 className="w-4 h-4" />, shortcut: 'Ctrl+Shift+Z', onClick: onRedo, disabled: !canRedo },
        { id: 'sep1', label: '', separator: true },
        { id: 'accept', label: 'Accept Clip', icon: <Check className="w-4 h-4" />, shortcut: 'A', onClick: onAcceptClip, disabled: !hasSelectedClip },
        { id: 'reject', label: 'Reject Clip', icon: <X className="w-4 h-4" />, shortcut: 'R', onClick: onRejectClip, disabled: !hasSelectedClip },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: <Keyboard className="w-4 h-4" />, onClick: onShowShortcuts },
        { id: 'about', label: 'About', icon: <Info className="w-4 h-4" /> },
      ],
    },
  ];

  return (
    <div ref={menuBarRef} className="flex items-center gap-0 no-drag">
      {menus.map((menu) => (
        <div key={menu.id} className="relative">
          <button
            className={`px-3 py-1.5 text-sm text-sz-text-secondary hover:text-sz-text hover:bg-sz-bg-hover rounded transition-colors ${
              openMenuId === menu.id ? 'bg-sz-bg-hover text-sz-text' : ''
            }`}
            onClick={() => handleMenuClick(menu.id)}
            onMouseEnter={() => handleMenuHover(menu.id)}
          >
            {menu.label}
          </button>

          {openMenuId === menu.id && (
            <div className="absolute top-full left-0 mt-1 min-w-[220px] bg-sz-bg-secondary border border-sz-border rounded-md shadow-lg py-1 z-50">
              {menu.items.map((item) => (
                item.separator ? (
                  <div key={item.id} className="my-1 border-t border-sz-border" />
                ) : (
                  <div
                    key={item.id}
                    className="relative"
                    onMouseEnter={() => item.submenu && setOpenSubmenuId(item.id)}
                    onMouseLeave={() => item.submenu && setOpenSubmenuId(null)}
                  >
                    <button
                      className={`w-full px-3 py-1.5 text-sm text-left flex items-center gap-3 ${
                        item.disabled
                          ? 'text-sz-text-muted cursor-not-allowed'
                          : 'text-sz-text hover:bg-sz-bg-hover'
                      }`}
                      onClick={() => handleItemClick(item)}
                      disabled={item.disabled}
                    >
                      <span className="w-4 h-4 flex items-center justify-center text-sz-text-muted">
                        {item.icon}
                      </span>
                      <span className="flex-1">{item.label}</span>
                      {item.shortcut && (
                        <span className="text-xs text-sz-text-muted ml-4">{item.shortcut}</span>
                      )}
                      {item.submenu && (
                        <ChevronRight className="w-4 h-4 text-sz-text-muted" />
                      )}
                    </button>

                    {item.submenu && openSubmenuId === item.id && (
                      <div className="absolute left-full top-0 ml-0.5 min-w-[200px] bg-sz-bg-secondary border border-sz-border rounded-md shadow-lg py-1 z-50">
                        {item.submenu.map((subItem) => (
                          <button
                            key={subItem.id}
                            className={`w-full px-3 py-1.5 text-sm text-left flex items-center gap-3 ${
                              subItem.disabled
                                ? 'text-sz-text-muted cursor-not-allowed'
                                : 'text-sz-text hover:bg-sz-bg-hover'
                            }`}
                            onClick={() => handleItemClick(subItem)}
                            disabled={subItem.disabled}
                          >
                            <span className="w-4 h-4 flex items-center justify-center text-sz-text-muted">
                              {subItem.icon}
                            </span>
                            <span className="flex-1 truncate">{subItem.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default memo(MenuBar);
