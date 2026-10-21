import React, { useState, useEffect, useRef } from 'react';
import {
  FolderPlus,
  Server,
  Wrench,
  Star,
  LayoutGrid,
  GitFork,
  ArrowLeftRight,
  Package,
  Settings,
  HelpCircle,
  Power,
  XSquare,
  Lock,
  Key,
  FileDiff,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  Columns,
  Rows,
  Grid2x2,
  Square
} from 'lucide-react';

interface ToolbarProps {
  onNewSession: () => void;
  onNewTerminal: () => void;
  onToggleSplit?: (layout?: 'auto' | '2-vertical' | '2-horizontal' | '4-grid') => void;
  onToggleMultiExec?: () => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  onOpenTools?: () => void;
  onOpenVault?: () => void;
  onOpenPasswords?: () => void;
  onOpenCredentials?: () => void;
  onOpenTunnels?: () => void;
  onOpenServers?: () => void;
  onOpenSettings?: () => void;
  onOpenDiff?: () => void;
  onOpenPackages?: () => void;
  onOpenHelp?: () => void;
  splitMode?: boolean;
  splitLayout?: 'auto' | '2-vertical' | '2-horizontal' | '4-grid';
  multiExecMode?: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onNewSession,
  onNewTerminal,
  onToggleSplit,
  onToggleMultiExec,
  onToggleSidebar,
  isSidebarOpen = true,
  onOpenTools,
  onOpenVault,
  onOpenPasswords,
  onOpenCredentials,
  onOpenTunnels,
  onOpenServers,
  onOpenSettings,
  onOpenDiff,
  onOpenPackages,
  onOpenHelp,
  splitMode = false,
  splitLayout = 'auto',
  multiExecMode = false
}) => {
  const [isSplitMenuOpen, setIsSplitMenuOpen] = useState(false);
  const splitMenuRef = useRef<HTMLDivElement>(null);

  // Close split menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (splitMenuRef.current && !splitMenuRef.current.contains(e.target as Node)) {
        setIsSplitMenuOpen(false);
      }
    };
    if (isSplitMenuOpen) {
      window.addEventListener('click', handleOutsideClick);
    }
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [isSplitMenuOpen]);

  const tools = [
    { id: 'session', label: 'Session', icon: <FolderPlus className="w-5 h-5 text-yellow-400" />, action: onNewSession },
    { id: 'servers', label: 'Servers', icon: <Server className="w-5 h-5 text-blue-400" />, action: onOpenServers || (() => alert('Embedded Servers Manager')) },
    { id: 'tools', label: 'Tools', icon: <Wrench className="w-5 h-5 text-amber-500" />, action: onOpenTools || (() => alert('Network & System Tools')) },
    { id: 'diff', label: 'MobaDiff', icon: <FileDiff className="w-5 h-5 text-teal-400" />, action: onOpenDiff || (() => {}) },
    { id: 'credentials', label: 'Credentials', icon: <Shield className="w-5 h-5 text-amber-400" />, action: onOpenCredentials || (() => {}) },
    { id: 'vault', label: 'Vault', icon: <Lock className="w-5 h-5 text-emerald-400" />, action: onOpenVault || (() => alert('Password Vault')) },
    { id: 'passwords', label: 'Passwords', icon: <Key className="w-5 h-5 text-amber-400" />, action: onOpenPasswords || (() => alert('Password Manager')) },
    { id: 'sessions', label: 'Sessions', icon: <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />, action: onNewSession },
    { 
      id: 'sidebar', 
      label: 'Sidebar', 
      icon: isSidebarOpen ? <PanelLeftClose className="w-5 h-5 text-cyan-400" /> : <PanelLeftOpen className="w-5 h-5 text-cyan-400" />, 
      action: onToggleSidebar || (() => {}), 
      isActive: isSidebarOpen 
    },
    { 
      id: 'multiexec', 
      label: 'MultiExec', 
      icon: <GitFork className="w-5 h-5 text-purple-400" />, 
      action: onToggleMultiExec || (() => {}), 
      isActive: multiExecMode 
    },
    { id: 'tunnel', label: 'Tunneling', icon: <ArrowLeftRight className="w-5 h-5 text-amber-400" />, action: onOpenTunnels || (() => alert('SSH Tunnels / Port Forwarding')) },
    { id: 'packages', label: 'Packages', icon: <Package className="w-5 h-5 text-indigo-400" />, action: onOpenPackages || (() => alert('MobApt Package Manager')) },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5 text-slate-400" />, action: onOpenSettings || (() => alert('Application Settings')) },
    { id: 'help', label: 'Help', icon: <HelpCircle className="w-5 h-5 text-blue-500" />, action: onOpenHelp || (() => alert('KirinTerminal Documentation')) },
  ];

  return (
    <div className="flex items-center justify-between bg-[#202022] border-b border-[#2d2d30] px-3 py-1 select-none relative z-30">
      {/* Left icons row */}
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {tools.slice(0, 8).map((t) => (
          <button
            key={t.id}
            onClick={t.action}
            title={t.label}
            className={`flex flex-col items-center justify-center p-1.5 px-2 rounded hover:bg-[#2d2d30] active:bg-[#38383c] transition-colors text-gray-300 hover:text-white cursor-pointer group ${
              t.isActive ? 'bg-[#38383c] border-[1px] border-sky-500/50' : 'border-[1px] border-transparent'
            }`}
          >
            <div className="group-hover:scale-105 transition-transform">{t.icon}</div>
            <span className="text-[10px] mt-0.5 font-medium">{t.label}</span>
          </button>
        ))}

        {/* Sidebar Toggle */}
        <button
          onClick={tools[8].action}
          title={tools[8].label}
          className={`flex flex-col items-center justify-center p-1.5 px-2 rounded hover:bg-[#2d2d30] active:bg-[#38383c] transition-colors text-gray-300 hover:text-white cursor-pointer group ${
            tools[8].isActive ? 'bg-[#38383c] border-[1px] border-sky-500/50' : 'border-[1px] border-transparent'
          }`}
        >
          <div className="group-hover:scale-105 transition-transform">{tools[8].icon}</div>
          <span className="text-[10px] mt-0.5 font-medium">{tools[8].label}</span>
        </button>

        {/* Split Mode Button with Dropdown Selector */}
        <div ref={splitMenuRef} className="relative flex items-center">
          <div 
            className={`flex items-center rounded transition-colors ${
              splitMode ? 'bg-[#1e3a5f] border border-sky-500/70 text-sky-200' : 'hover:bg-[#2d2d30] border border-transparent text-gray-300'
            }`}
          >
            <button
              onClick={() => onToggleSplit?.()}
              title="Split View (Click to toggle split all open screens)"
              className="flex flex-col items-center justify-center p-1.5 pl-2 pr-1 cursor-pointer group"
            >
              <div className="group-hover:scale-105 transition-transform">
                <LayoutGrid className="w-5 h-5 text-sky-400" />
              </div>
              <span className="text-[10px] mt-0.5 font-medium">Split</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsSplitMenuOpen(prev => !prev);
              }}
              title="Split View Layout Options"
              className="p-1 pr-1.5 hover:bg-white/10 rounded-r h-full flex items-center justify-center cursor-pointer text-gray-400 hover:text-white"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Split Layout Dropdown Menu */}
          {isSplitMenuOpen && (
            <div className="absolute top-full left-0 mt-1 w-52 bg-[#1f1f23] border border-[#3e3e42] rounded-md shadow-2xl py-1 z-50 text-xs">
              <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-[#2d2d30]">
                Split Layout (ทุกหน้าจอ)
              </div>
              
              <button
                onClick={() => {
                  onToggleSplit?.('2-vertical');
                  setIsSplitMenuOpen(false);
                }}
                className={`w-full px-3 py-2 flex items-center gap-2.5 hover:bg-[#2a2a2e] text-left transition-colors cursor-pointer ${
                  splitMode && splitLayout === '2-vertical' ? 'text-sky-300 font-medium bg-[#1e3a5f]/40' : 'text-gray-200'
                }`}
              >
                <Columns className="w-4 h-4 text-sky-400 shrink-0" />
                <div>
                  <div className="font-medium">2 Screens (Vertical)</div>
                  <div className="text-[10px] text-gray-400">Left & Right side-by-side</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onToggleSplit?.('2-horizontal');
                  setIsSplitMenuOpen(false);
                }}
                className={`w-full px-3 py-2 flex items-center gap-2.5 hover:bg-[#2a2a2e] text-left transition-colors cursor-pointer ${
                  splitMode && splitLayout === '2-horizontal' ? 'text-sky-300 font-medium bg-[#1e3a5f]/40' : 'text-gray-200'
                }`}
              >
                <Rows className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-medium">2 Screens (Horizontal)</div>
                  <div className="text-[10px] text-gray-400">Top & Bottom split</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onToggleSplit?.('4-grid');
                  setIsSplitMenuOpen(false);
                }}
                className={`w-full px-3 py-2 flex items-center gap-2.5 hover:bg-[#2a2a2e] text-left transition-colors cursor-pointer ${
                  splitMode && splitLayout === '4-grid' ? 'text-sky-300 font-medium bg-[#1e3a5f]/40' : 'text-gray-200'
                }`}
              >
                <Grid2x2 className="w-4 h-4 text-purple-400 shrink-0" />
                <div>
                  <div className="font-medium">4 Screens (2x2 Grid)</div>
                  <div className="text-[10px] text-gray-400">Four equal panes</div>
                </div>
              </button>

              <div className="border-t border-[#2d2d30] my-1" />

              <button
                onClick={() => {
                  if (splitMode) onToggleSplit?.();
                  setIsSplitMenuOpen(false);
                }}
                className={`w-full px-3 py-2 flex items-center gap-2.5 hover:bg-[#2a2a2e] text-left transition-colors cursor-pointer ${
                  !splitMode ? 'text-sky-300 font-medium bg-[#1e3a5f]/40' : 'text-gray-300'
                }`}
              >
                <Square className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <div className="font-medium">Single Tab Mode</div>
                  <div className="text-[10px] text-gray-400">Normal full-screen tab</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Remaining Tools */}
        {tools.slice(9).map((t) => (
          <button
            key={t.id}
            onClick={t.action}
            title={t.label}
            className={`flex flex-col items-center justify-center p-1.5 px-2 rounded hover:bg-[#2d2d30] active:bg-[#38383c] transition-colors text-gray-300 hover:text-white cursor-pointer group ${
              t.isActive ? 'bg-[#38383c] border-[1px] border-sky-500/50' : 'border-[1px] border-transparent'
            }`}
          >
            <div className="group-hover:scale-105 transition-transform">{t.icon}</div>
            <span className="text-[10px] mt-0.5 font-medium">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 pl-4 border-l border-[#333336]">
        <button
          onClick={() => alert('X Server is running (DISPLAY=:0.0)')}
          title="X11 Server Status"
          className="flex flex-col items-center justify-center p-1.5 px-2 rounded hover:bg-[#2d2d30] text-gray-300 hover:text-white cursor-pointer"
        >
          <XSquare className="w-5 h-5 text-emerald-400" />
          <span className="text-[10px] mt-0.5 font-medium">X server</span>
        </button>

        <button
          onClick={() => window.close()}
          title="Exit Application"
          className="flex flex-col items-center justify-center p-1.5 px-2 rounded hover:bg-red-900/40 text-gray-300 hover:text-red-400 cursor-pointer"
        >
          <Power className="w-5 h-5 text-red-500" />
          <span className="text-[10px] mt-0.5 font-medium">Exit</span>
        </button>
      </div>
    </div>
  );
};
