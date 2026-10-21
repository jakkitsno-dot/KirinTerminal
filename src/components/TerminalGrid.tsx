import React, { useState, useEffect } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { TabItem, GlobalSettings, SessionConfig } from '../types';
import { TerminalView } from './TerminalView';
import { RdpView } from './RdpView';
import { VncView } from './VncView';
import { NetworkToolsView } from './NetworkToolsView';
import { TunnelsView } from './TunnelsView';
import {
  Monitor,
  Tv,
  Wrench,
  ArrowLeftRight,
  Maximize2,
  Minimize2,
  X,
  Key,
  Cable,
  Layers,
  Radio,
  Terminal as TerminalIcon
} from 'lucide-react';

interface TerminalGridProps {
  terminals: TabItem[]; // All session tabs (Terminals, RDP, VNC, Network Tools, Tunnels)
  activeTabId: string;
  onSelectTab?: (id: string) => void;
  onCloseTab?: (id: string) => void;
  multiExecMode: boolean;
  multiExecTargetIds: string[];
  onToggleMultiExecTarget: (id: string) => void;
  onSftpReady: (id: string) => void;
  settings: GlobalSettings;
  isGridVisible?: boolean;
  masterPassword?: string | null;
  onConnectSSH?: (host: string, port?: number, username?: string) => void;
  onConnectSFTP?: (host: string, port?: number, username?: string) => void;
  onAddSession?: (session: Partial<SessionConfig>) => void;
  splitLayout?: 'auto' | '2-vertical' | '2-horizontal' | '4-grid';
}

export const TerminalGrid: React.FC<TerminalGridProps> = ({
  terminals,
  activeTabId,
  onSelectTab,
  onCloseTab,
  multiExecMode,
  multiExecTargetIds,
  onToggleMultiExecTarget,
  onSftpReady,
  settings,
  isGridVisible = true,
  masterPassword,
  onConnectSSH,
  onConnectSFTP,
  onAddSession,
  splitLayout = 'auto'
}) => {
  if (terminals.length === 0) return null;

  const [maximizedTabId, setMaximizedTabId] = useState<string | null>(null);

  // If the maximized terminal was closed, reset maximizedTabId
  useEffect(() => {
    if (maximizedTabId && !terminals.some(t => t.id === maximizedTabId)) {
      setMaximizedTabId(null);
    }
  }, [terminals, maximizedTabId]);

  // Pressing Escape un-maximizes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && maximizedTabId) {
        setMaximizedTabId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [maximizedTabId]);

  const renderTab = (tab: TabItem) => {
    // 1. Terminal Tabs (Local, SSH, Telnet, Serial, WSL)
    if (tab.type === 'terminal') {
      return (
        <TerminalView
          key={tab.id}
          tab={tab}
          isActive={activeTabId === tab.id}
          onFocus={() => onSelectTab?.(tab.id)}
          isGridMode={true}
          isMaximized={maximizedTabId === tab.id}
          onToggleMaximize={() => {
            setMaximizedTabId(prev => (prev === tab.id ? null : tab.id));
            onSelectTab?.(tab.id);
          }}
          isVisible={isGridVisible && (maximizedTabId ? maximizedTabId === tab.id : true)}
          multiExecMode={multiExecMode}
          isMultiExecTarget={multiExecTargetIds.includes(tab.id)}
          onToggleMultiExecTarget={onToggleMultiExecTarget}
          onSftpReady={onSftpReady}
          settings={settings}
        />
      );
    }

    // 2. Non-terminal tabs (RDP, VNC, Network Tools, Tunnels) wrapped in grid pane with matching header
    const isMaximized = maximizedTabId === tab.id;
    const isActive = activeTabId === tab.id;

    const getTabIcon = () => {
      if (tab.type === 'rdp') return <Monitor className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
      if (tab.type === 'vnc') return <Tv className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      if (tab.type === 'network-tools') return <Wrench className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      if (tab.type === 'tunnels') return <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      return <TerminalIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    };

    return (
      <div 
        key={tab.id}
        onClick={() => onSelectTab?.(tab.id)}
        className={`flex flex-col h-full w-full bg-[#18181b] overflow-hidden border transition-all ${
          isMaximized ? 'shadow-2xl' :
          isActive ? 'border-sky-400 ring-2 ring-sky-400/40 shadow-[0_0_12px_rgba(56,189,248,0.3)]' :
          'border-[#2d2d30] opacity-90 hover:opacity-100 hover:border-gray-500'
        }`}
      >
        {/* Universal Grid Pane Header */}
        <div
          onDoubleClick={(e) => {
            e.stopPropagation();
            setMaximizedTabId(prev => (prev === tab.id ? null : tab.id));
            onSelectTab?.(tab.id);
          }}
          className={`px-2.5 py-1 flex items-center justify-between text-xs select-none cursor-pointer border-b transition-colors shrink-0 ${
            isMaximized
              ? 'bg-[#0f4068] border-sky-400 text-sky-100 font-semibold shadow-md'
              : isActive
                ? 'bg-[#0e3b5e] border-sky-400 text-sky-100 font-medium shadow-xs'
                : 'bg-[#18181b] border-[#2d2d30] text-gray-400 hover:bg-[#202025] hover:text-gray-200'
          }`}
          title="Double-click to Maximize / Restore this window"
        >
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            {getTabIcon()}
            <span className="font-mono font-semibold truncate text-[11px]">{tab.title}</span>
            {isMaximized && (
              <span className="px-1.5 py-0.2 bg-sky-500/30 text-sky-200 border border-sky-400/50 rounded text-[9px] font-mono uppercase tracking-wider">
                Maximized
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMaximizedTabId(prev => (prev === tab.id ? null : tab.id));
                onSelectTab?.(tab.id);
              }}
              className="p-1 rounded hover:bg-white/10 text-gray-300 hover:text-white"
              title={isMaximized ? 'Restore (Esc)' : 'Maximize'}
            >
              {isMaximized ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
            {onCloseTab && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                className="p-1 rounded hover:bg-red-600/80 text-gray-300 hover:text-white"
                title="Close Tab"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Content View */}
        <div className="flex-1 w-full min-h-0 relative overflow-hidden bg-[#121212]">
          {tab.type === 'rdp' && (
            <RdpView tab={tab} isActive={isActive} onClose={() => onCloseTab?.(tab.id)} />
          )}
          {tab.type === 'vnc' && (
            <VncView tab={tab} isActive={isActive} onClose={() => onCloseTab?.(tab.id)} />
          )}
          {tab.type === 'network-tools' && (
            <NetworkToolsView
              isVisible={isGridVisible}
              onConnectSSH={onConnectSSH || (() => {})}
              onConnectSFTP={onConnectSFTP || (() => {})}
              onAddSession={onAddSession || (() => {})}
            />
          )}
          {tab.type === 'tunnels' && (
            <TunnelsView isVisible={isGridVisible} masterPassword={masterPassword} />
          )}
        </div>
      </div>
    );
  };

  const N = terminals.length;

  if (N === 1) {
    return <div className="w-full h-full relative overflow-hidden bg-[#121212]">{renderTab(terminals[0])}</div>;
  }

  // Calculate rows and columns based on splitLayout and N
  let cols = 1;
  let rows = 1;

  if (splitLayout === '2-horizontal') {
    cols = 1;
    rows = Math.min(2, N);
  } else if (splitLayout === '2-vertical') {
    cols = Math.min(2, N);
    rows = 1;
  } else if (splitLayout === '4-grid') {
    cols = 2;
    rows = 2;
  } else {
    // Auto layout
    if (N === 2) {
      cols = 2;
      rows = 1;
    } else if (N <= 4) {
      cols = 2;
      rows = 2;
    } else {
      cols = Math.ceil(Math.sqrt(N));
      rows = Math.ceil(N / cols);
    }
  }

  const gridElements = [];

  for (let r = 0; r < rows; r++) {
    if (r > 0) {
      gridElements.push(
        <PanelResizeHandle
          key={`v-sep-${r}`}
          className={`h-[4px] w-full bg-[#2d2d30] hover:bg-[#007acc] cursor-row-resize relative flex items-center justify-center transition-colors shrink-0 z-10 ${
            maximizedTabId ? 'hidden' : ''
          }`}
        >
          <div className="absolute bg-gray-500 rounded-full w-4 h-0.5" />
        </PanelResizeHandle>
      );
    }

    const rowCols = [];
    let itemsInRow = 0;

    for (let c = 0; c < cols; c++) {
      if (r * cols + c < N) itemsInRow++;
    }

    for (let c = 0; c < itemsInRow; c++) {
      const index = r * cols + c;
      const tabItem = terminals[index];

      if (c > 0) {
        rowCols.push(
          <PanelResizeHandle
            key={`h-sep-${index}`}
            className={`w-[4px] h-full bg-[#2d2d30] hover:bg-[#007acc] cursor-col-resize relative flex items-center justify-center transition-colors shrink-0 z-10 ${
              maximizedTabId ? 'hidden' : ''
            }`}
          >
            <div className="absolute bg-gray-500 rounded-full h-4 w-0.5" />
          </PanelResizeHandle>
        );
      }

      rowCols.push(
        <Panel
          key={`panel-${tabItem.id}`}
          id={`panel-${tabItem.id}`}
          className={`w-full h-full ${maximizedTabId === tabItem.id ? 'z-50' : 'relative overflow-hidden'}`}
        >
          <div 
            data-terminal-id={tabItem.id}
            className={maximizedTabId === tabItem.id ? 'absolute inset-0 z-50 bg-[#121212]' : 'w-full h-full relative'}
          >
            {renderTab(tabItem)}
          </div>
        </Panel>
      );
    }

    gridElements.push(
      <Panel
        key={`row-panel-${r}`}
        id={`row-panel-${r}`}
        className={`w-full h-full ${maximizedTabId ? 'z-40' : 'relative overflow-hidden'}`}
      >
        <PanelGroup
          orientation="horizontal"
          key={`row-group-${r}-${itemsInRow}`}
          className="w-full h-full"
        >
          {rowCols}
        </PanelGroup>
      </Panel>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#1e1e1e]">
      <PanelGroup
        orientation="vertical"
        key={`main-grid-${N}-${cols}-${rows}-${splitLayout}`}
        className="w-full h-full bg-[#1e1e1e]"
      >
        {gridElements}
      </PanelGroup>
    </div>
  );
};
