import React, { useState, useRef, useEffect } from 'react';
import {
  GitFork,
  CheckSquare,
  Square,
  Send,
  X,
  Terminal,
  Key,
  Cable,
  Slash,
  CornerDownLeft,
  RotateCcw
} from 'lucide-react';
import { TabItem } from '../types';

interface MultiExecutionBarProps {
  terminals: TabItem[];
  activeTabId: string;
  selectedIds: string[];
  onToggleSelect: (tabId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSelectOnlySsh: () => void;
  onSendCommand: (command: string) => void;
  onSendInterrupt: () => void;
  onClose: () => void;
}

export const MultiExecutionBar: React.FC<MultiExecutionBarProps> = ({
  terminals,
  activeTabId,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onSelectOnlySsh,
  onSendCommand,
  onSendInterrupt,
  onClose
}) => {
  const [commandInput, setCommandInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Quick focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    onSendCommand(commandInput);
    setHistory(prev => [commandInput, ...prev.filter(h => h !== commandInput)].slice(0, 30));
    setHistoryIndex(-1);
    setCommandInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setCommandInput(history[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setCommandInput(history[nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommandInput('');
      }
    }
  };

  const allSelected = terminals.length > 0 && terminals.every(t => selectedIds.includes(t.id));
  const noneSelected = selectedIds.length === 0;

  return (
    <div className="bg-[#1e1c24] border-b-2 border-purple-600/70 px-3 py-2 flex flex-col gap-2 select-none shadow-lg z-20 shrink-0 transition-all">
      {/* Top Row: Title, Target Checkboxes, Quick Filters, Close */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Status Label */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-purple-900/60 border border-purple-500/80 px-2 py-0.5 rounded text-xs font-semibold text-purple-200">
            <GitFork className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            <span>Multi-Execution</span>
          </div>
          <span className="text-[11px] text-gray-400">
            Sending to <strong className="text-purple-300 font-mono">{selectedIds.length}</strong> of{' '}
            <span className="font-mono">{terminals.length}</span> terminals
          </span>
        </div>

        {/* Quick Selection Buttons */}
        <div className="flex items-center gap-1 text-[11px]">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="px-2 py-0.5 rounded bg-[#2a2734] hover:bg-[#383346] text-gray-300 hover:text-white border border-[#403b4f] transition-colors cursor-pointer flex items-center gap-1"
            title="Toggle select all terminals"
          >
            {allSelected ? <Square className="w-3 h-3 text-gray-400" /> : <CheckSquare className="w-3 h-3 text-purple-400" />}
            <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
          </button>

          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onSelectOnlySsh}
            className="px-2 py-0.5 rounded bg-[#2a2734] hover:bg-[#383346] text-gray-300 hover:text-white border border-[#403b4f] transition-colors cursor-pointer flex items-center gap-1"
            title="Select all SSH terminals only"
          >
            <Key className="w-3 h-3 text-yellow-400" />
            <span>Only SSH</span>
          </button>

          {/* Close MultiExec Mode */}
          <button
            onClick={onClose}
            title="Exit Multi-Execution Mode"
            className="p-1 rounded hover:bg-red-950/60 text-gray-400 hover:text-red-300 transition-colors cursor-pointer ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Middle Row: Channels Checkbox Badges (Wraps if many terminals) */}
      <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto pb-1 max-w-full scrollbar-thin">
        {terminals.map(term => {
          const isSelected = selectedIds.includes(term.id);
          const isCurrentActive = term.id === activeTabId;

          return (
            <button
              key={term.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onToggleSelect(term.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all border shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-purple-950/80 border-purple-500/80 text-purple-100 font-medium shadow-[0_0_8px_rgba(168,85,247,0.2)]'
                  : 'bg-[#18161e] border-[#34303f] text-gray-500 hover:text-gray-300 hover:border-[#4c475d]'
              } ${isCurrentActive ? 'ring-1 ring-sky-400/60' : ''}`}
              title={`Click to ${isSelected ? 'exclude from' : 'include in'} Multi-Exec`}
            >
              {isSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              ) : (
                <Square className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              )}

              {term.connectionType === 'ssh' ? (
                <Key className="w-3 h-3 text-yellow-400 shrink-0" />
              ) : term.connectionType === 'serial' ? (
                <Cable className="w-3 h-3 text-orange-400 shrink-0" />
              ) : (
                <Terminal className="w-3 h-3 text-emerald-400 shrink-0" />
              )}

              <span className="truncate max-w-[150px] font-mono text-[11px]">{term.title}</span>

              {isCurrentActive && (
                <span className="text-[9px] px-1 py-0.2 bg-sky-900/60 text-sky-300 rounded font-sans">
                  Active
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Row: Direct Broadcast Input Bar */}
      <form onSubmit={handleFormSubmit} className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              noneSelected
                ? '⚠️ No terminals selected. Tick one or more above to send commands...'
                : 'Type command to broadcast to selected terminals (e.g. uptime, ls -la, sudo reboot)...'
            }
            disabled={noneSelected}
            className="w-full bg-[#131118] border border-[#3e384e] focus:border-purple-500 rounded px-3 py-1.5 text-xs text-purple-100 placeholder:text-gray-600 outline-none font-mono disabled:opacity-50"
          />
          {commandInput && (
            <button
              type="button"
              onClick={() => setCommandInput('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Send Button */}
        <button
          type="submit"
          onMouseDown={(e) => e.preventDefault()}
          disabled={noneSelected || !commandInput.trim()}
          className="bg-purple-600 hover:bg-purple-500 disabled:bg-[#2a2734] disabled:text-gray-600 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
          title="Send command with Enter"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send</span>
          <CornerDownLeft className="w-3 h-3 opacity-60 ml-0.5" />
        </button>

        {/* Quick Enter Key Button */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSendCommand('')}
          disabled={noneSelected}
          className="bg-[#2a2734] hover:bg-[#383346] border border-[#403b4f] disabled:opacity-40 text-gray-300 hover:text-white px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          title="Send raw Enter key (\r) directly to selected terminals"
        >
          <CornerDownLeft className="w-3.5 h-3.5 text-purple-300" />
          <span>Enter</span>
        </button>

        {/* Interrupt (Ctrl+C) Button */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onSendInterrupt}
          disabled={noneSelected}
          className="bg-rose-950/70 hover:bg-rose-900 border border-rose-800/60 disabled:opacity-40 text-rose-300 px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          title="Send Ctrl+C (Interrupt) to all selected terminals"
        >
          <Slash className="w-3 h-3" />
          <span>Ctrl+C</span>
        </button>

        {/* Clear Terminal Button */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSendCommand('clear')}
          disabled={noneSelected}
          className="bg-[#2a2734] hover:bg-[#383346] border border-[#403b4f] disabled:opacity-40 text-gray-300 hover:text-white px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          title="Send 'clear' command to all selected terminals"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Clear</span>
        </button>
      </form>
    </div>
  );
};
