import React, { useState, useEffect, useRef } from 'react';
import {
  FolderPlus,
  Terminal,
  LayoutGrid,
  GitFork,
  Server,
  Wrench,
  ArrowLeftRight,
  FileDiff,
  Package,
  Settings,
  Lock,
  Shield,
  HelpCircle,
  PanelLeft,
  XSquare,
  Info
} from 'lucide-react';

interface MenuBarProps {
  onNewSession: () => void;
  onNewTerminal: (shell?: 'powershell.exe' | 'cmd.exe') => void;
  onToggleSidebar?: () => void;
  onToggleSplit?: (layout?: 'auto' | '2-vertical' | '2-horizontal' | '4-grid') => void;
  onToggleMultiExec?: () => void;
  onOpenServers?: () => void;
  onOpenTools?: () => void;
  onOpenTunnels?: () => void;
  onOpenDiff?: () => void;
  onOpenPackages?: () => void;
  onOpenSettings?: () => void;
  onOpenVault?: () => void;
  onOpenCredentials?: () => void;
  onOpenMacros?: () => void;
  onOpenHelp?: () => void;
  onExit?: () => void;
}

interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  action?: () => void;
  separator?: boolean;
}

interface MenuGroup {
  id: string;
  label: string;
  items: MenuItem[];
}

export const MenuBar: React.FC<MenuBarProps> = ({
  onNewSession,
  onNewTerminal,
  onToggleSidebar,
  onToggleSplit,
  onToggleMultiExec,
  onOpenServers,
  onOpenTools,
  onOpenTunnels,
  onOpenDiff,
  onOpenPackages,
  onOpenSettings,
  onOpenVault,
  onOpenCredentials,
  onOpenMacros,
  onOpenHelp,
  onExit
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const menuBarRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenu(null);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleMenuClick = (menuId: string) => {
    setActiveMenu(prev => (prev === menuId ? null : menuId));
  };

  const handleMenuHover = (menuId: string) => {
    if (activeMenu !== null) {
      setActiveMenu(menuId);
    }
  };

  const runAction = (action?: () => void) => {
    setActiveMenu(null);
    if (action) action();
  };

  const menuGroups: MenuGroup[] = [
    {
      id: 'sessions',
      label: 'Sessions',
      items: [
        { label: 'New session...', icon: <FolderPlus className="w-4 h-4 text-yellow-400" />, action: onNewSession },
      ]
    },
    {
      id: 'terminal',
      label: 'Terminal',
      items: [
        { label: 'PowerShell terminal', icon: <Terminal className="w-4 h-4 text-blue-400" />, action: () => onNewTerminal('powershell.exe') },
        { label: 'Command Prompt (cmd)', icon: <Terminal className="w-4 h-4 text-green-400" />, action: () => onNewTerminal('cmd.exe') },
        { separator: true, label: '' },
        { label: 'Split view: 2 screens (Vertical)', icon: <LayoutGrid className="w-4 h-4 text-sky-400" />, action: () => onToggleSplit?.('2-vertical') },
        { label: 'Split view: 2 screens (Horizontal)', icon: <LayoutGrid className="w-4 h-4 text-emerald-400" />, action: () => onToggleSplit?.('2-horizontal') },
        { label: 'Split view: 4 screens (2x2 Grid)', icon: <LayoutGrid className="w-4 h-4 text-purple-400" />, action: () => onToggleSplit?.('4-grid') },
        { label: 'Single tab mode (Exit split)', icon: <LayoutGrid className="w-4 h-4 text-gray-400" />, action: () => onToggleSplit?.() },
        { separator: true, label: '' },
        { label: 'Multi-execution mode', icon: <GitFork className="w-4 h-4 text-purple-400" />, action: onToggleMultiExec }
      ]
    },
    {
      id: 'view',
      label: 'View',
      items: [
        { label: 'Toggle Sidebar (Ctrl+B)', icon: <PanelLeft className="w-4 h-4 text-cyan-400" />, action: onToggleSidebar },
        { separator: true, label: '' },
        { label: 'Split View: 2 screens (Vertical)', icon: <LayoutGrid className="w-4 h-4 text-sky-400" />, action: () => onToggleSplit?.('2-vertical') },
        { label: 'Split View: 2 screens (Horizontal)', icon: <LayoutGrid className="w-4 h-4 text-emerald-400" />, action: () => onToggleSplit?.('2-horizontal') },
        { label: 'Split View: 4 screens (2x2 Grid)', icon: <LayoutGrid className="w-4 h-4 text-purple-400" />, action: () => onToggleSplit?.('4-grid') },
        { label: 'Single tab mode (Exit split)', icon: <LayoutGrid className="w-4 h-4 text-gray-400" />, action: () => onToggleSplit?.() }
      ]
    },
    {
      id: 'servers',
      label: 'Servers',
      items: [
        { label: 'Embedded Servers (FTP, HTTP, TFTP...)', icon: <Server className="w-4 h-4 text-blue-400" />, action: onOpenServers }
      ]
    },
    {
      id: 'tools',
      label: 'Tools',
      items: [
        { label: 'Network Scanner & Tools', icon: <Wrench className="w-4 h-4 text-amber-400" />, action: onOpenTools },
        { label: 'SSH Tunnels (Port Forwarding)', icon: <ArrowLeftRight className="w-4 h-4 text-amber-400" />, action: onOpenTunnels },
        { label: 'MobaDiff (File Comparison)', icon: <FileDiff className="w-4 h-4 text-teal-400" />, action: onOpenDiff },
        { label: 'Package Manager (MobApt)', icon: <Package className="w-4 h-4 text-indigo-400" />, action: onOpenPackages }
      ]
    },
    {
      id: 'settings',
      label: 'Settings',
      items: [
        { label: 'Configuration & Settings', icon: <Settings className="w-4 h-4 text-slate-300" />, action: onOpenSettings },
        { separator: true, label: '' },
        { label: 'Password Vault...', icon: <Lock className="w-4 h-4 text-emerald-400" />, action: onOpenVault },
        { label: 'Credential Manager...', icon: <Shield className="w-4 h-4 text-amber-400" />, action: onOpenCredentials }
      ]
    },
    {
      id: 'macros',
      label: 'Macros',
      items: [
        { label: 'Macro Manager (Sidebar)', icon: <GitFork className="w-4 h-4 text-purple-400" />, action: onOpenMacros }
      ]
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        { label: 'Security & Password Guide', icon: <Shield className="w-4 h-4 text-emerald-400" />, action: onOpenHelp || (() => {}) },
        { separator: true, label: '' },
        { label: 'About KirinTerminal', icon: <Info className="w-4 h-4 text-sky-400" />, action: () => setIsAboutOpen(true) }
      ]
    }
  ];

  return (
    <div
      ref={menuBarRef}
      className="relative flex items-center justify-between bg-[#181819] text-gray-300 text-xs px-2 py-0.5 border-b border-[#2d2d30] select-none z-50 font-sans"
    >
      {/* Left Menu Items */}
      <div className="flex items-center gap-0.5">
        {menuGroups.map((group) => {
          const isOpen = activeMenu === group.id;

          return (
            <div key={group.id} className="relative">
              <button
                onClick={() => handleMenuClick(group.id)}
                onMouseEnter={() => handleMenuHover(group.id)}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  isOpen
                    ? 'bg-[#38383c] text-white font-medium'
                    : 'hover:bg-[#2d2d30] hover:text-white'
                }`}
              >
                {group.label}
              </button>

              {/* Dropdown Menu */}
              {isOpen && (
                <div className="absolute left-0 top-full mt-0.5 bg-[#252528] text-gray-200 border border-[#3e3e42] rounded shadow-2xl py-1 min-w-[220px] z-50 animate-in fade-in duration-75">
                  {group.items.map((item, idx) => {
                    if (item.separator) {
                      return <div key={idx} className="my-1 border-t border-[#3a3a3e]" />;
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => runAction(item.action)}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-[#38383c] hover:text-white transition-colors cursor-pointer"
                      >
                        <span className="shrink-0">{item.icon}</span>
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Right Side: Quick Exit / X Server indicator */}
      <div className="flex items-center gap-2 pr-1">
        <button
          onClick={onExit || (() => window.close())}
          title="Exit Application"
          className="flex items-center gap-1 px-2 py-0.5 rounded text-gray-400 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
        >
          <XSquare className="w-3.5 h-3.5 text-red-500" />
          <span className="text-[11px]">Exit</span>
        </button>
      </div>

      {/* About Modal */}
      {isAboutOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-xs">
          <div className="bg-[#252528] rounded-lg shadow-2xl w-[400px] border border-[#3e3e42] p-5 text-gray-200 text-center">
            <div className="w-14 h-14 mx-auto mb-3 flex items-center justify-center bg-[#1e1e1e] rounded-xl border border-[#3e3e42] shadow">
              <span className="text-white font-mono font-bold text-2xl">&gt;_</span>
            </div>
            <h3 className="text-base font-semibold text-white mb-1">KirinTerminal</h3>
            <p className="text-xs text-gray-400 mb-4">Version 1.0.0 (Production Release)</p>
            <div className="text-xs text-gray-300 bg-[#1e1e1e] rounded p-3 mb-4 text-left space-y-1 border border-[#333336]">
              <p>• Multi-protocol: SSH, SFTP, Serial, Telnet, RDP, VNC</p>
              <p>• Built-in Servers & Network Scanner Tools</p>
              <p>• Password Vault AES-256 & Credential Manager</p>
              <p>• Multi-execution & Terminal Split Grid</p>
            </div>
            <button
              onClick={() => setIsAboutOpen(false)}
              className="px-5 py-1.5 bg-[#007acc] hover:bg-[#0069b0] text-white rounded text-xs font-medium cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
