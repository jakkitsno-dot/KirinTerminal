import React, { useState, useEffect, useRef } from 'react';
import {
  Monitor,
  Play,
  RotateCw,
  ExternalLink,
  Shield,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Maximize2,
  Tv,
  Settings2,
  X
} from 'lucide-react';
import { TabItem } from '../types';

interface RdpViewProps {
  tab: TabItem;
  isActive: boolean;
  onClose?: () => void;
}

export const RdpView: React.FC<RdpViewProps> = ({ tab, isActive, onClose }) => {
  const [isLaunching, setIsLaunching] = useState(false);
  const [lastLaunched, setLastLaunched] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Connecting to Windows Remote Desktop...');
  const [isError, setIsError] = useState(false);
  const [copied, setCopied] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  const launchRdp = () => {
    setIsLaunching(true);
    setIsError(false);
    setStatusMessage('Launching native Windows Remote Desktop (mstsc.exe)...');

    const ws = new WebSocket('ws://127.0.0.1:9292');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          action: 'rdp_launch',
          id: tab.id,
          host: tab.host || '127.0.0.1',
          port: tab.port || 3389,
          username: tab.username || '',
          fullscreen: tab.rdpFullscreen ?? false,
          admin: tab.rdpAdmin ?? false,
          resolution: tab.rdpResolution || '1920x1080'
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id === tab.id && msg.action === 'rdp_launched') {
          setIsLaunching(false);
          if (msg.success) {
            setStatusMessage('Active in Windows Remote Desktop (MSTSC)');
            setLastLaunched(new Date().toLocaleTimeString());
          } else {
            setIsError(true);
            setStatusMessage(`Failed to launch RDP: ${msg.error || 'Unknown error'}`);
          }
          ws.close();
        }
      } catch (err) {
        setIsLaunching(false);
        setIsError(true);
      }
    };

    ws.onerror = () => {
      setIsLaunching(false);
      setIsError(true);
      setStatusMessage('WebSocket connection to backend failed.');
    };
  };

  useEffect(() => {
    launchRdp();
    return () => {
      wsRef.current?.close();
    };
  }, [tab.id]);

  const copyAddress = () => {
    navigator.clipboard.writeText(`${tab.host}:${tab.port || 3389}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#18181a] text-gray-200 select-none p-6">
      <div className="max-w-xl w-full bg-[#202024] border border-[#38383e] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#27272c] border-b border-[#38383e]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-950/70 text-sky-400 rounded-lg border border-sky-800/60 shadow">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                <span>{tab.title || 'Remote Desktop Session'}</span>
                <span className="text-[10px] bg-sky-900/60 text-sky-300 border border-sky-700/60 px-2 py-0.2 rounded-full font-mono">
                  RDP
                </span>
              </h2>
              <p className="text-xs text-gray-400 font-mono">
                {tab.host}:{tab.port || 3389} {tab.username ? `• ${tab.username}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyAddress}
              className="p-1.5 hover:bg-[#38383f] text-gray-400 hover:text-white rounded transition cursor-pointer"
              title="Copy Host Address"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-[#38383f] text-gray-400 hover:text-white rounded transition cursor-pointer"
                title="Close Tab"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Status Banner */}
          <div
            className={`p-4 rounded-lg border flex items-start gap-3.5 ${
              isError
                ? 'bg-red-950/40 border-red-800/60 text-red-300'
                : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
            }`}
          >
            {isError ? (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="text-xs font-semibold">{statusMessage}</div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                {isError
                  ? 'Please ensure the remote host has Remote Desktop enabled and port 3389 is open.'
                  : 'The native Windows Remote Desktop client is running in a high-performance external window with full hardware acceleration, sound, clipboard, and multi-monitor redirection.'}
              </p>
            </div>
          </div>

          {/* Details Table */}
          <div className="bg-[#171719] border border-[#2e2e33] rounded-lg divide-y divide-[#26262a] text-xs">
            <div className="flex justify-between px-3.5 py-2.5">
              <span className="text-gray-400">Remote Host:</span>
              <span className="font-mono text-gray-200 font-medium">{tab.host || '127.0.0.1'}</span>
            </div>
            <div className="flex justify-between px-3.5 py-2.5">
              <span className="text-gray-400">RDP Port:</span>
              <span className="font-mono text-gray-200 font-medium">{tab.port || 3389}</span>
            </div>
            {tab.username && (
              <div className="flex justify-between px-3.5 py-2.5">
                <span className="text-gray-400">User Account:</span>
                <span className="font-mono text-amber-300 font-medium">{tab.username}</span>
              </div>
            )}
            <div className="flex justify-between px-3.5 py-2.5">
              <span className="text-gray-400">Display Mode:</span>
              <span className="text-gray-200 font-medium">
                {tab.rdpFullscreen ? 'Fullscreen (All Monitors)' : `${tab.rdpResolution || '1920x1080'} Windowed`}
              </span>
            </div>
            {tab.rdpAdmin && (
              <div className="flex justify-between px-3.5 py-2.5">
                <span className="text-gray-400">Session Type:</span>
                <span className="text-purple-300 font-medium">Console / Administrative Session (/admin)</span>
              </div>
            )}
            {lastLaunched && (
              <div className="flex justify-between px-3.5 py-2.5">
                <span className="text-gray-400">Launched At:</span>
                <span className="text-gray-400 font-mono">{lastLaunched}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] text-gray-500 italic">
              Tip: Press <kbd className="bg-[#2d2d32] text-gray-300 px-1 py-0.5 rounded font-mono text-[10px]">Ctrl+Alt+Break</kbd> to toggle Fullscreen.
            </div>

            <button
              onClick={launchRdp}
              disabled={isLaunching}
              className="flex items-center gap-2 px-4 py-2 bg-[#007acc] hover:bg-[#008be6] active:bg-[#006bb3] text-white rounded-lg text-xs font-semibold cursor-pointer shadow transition disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLaunching ? 'animate-spin' : ''}`} />
              <span>{isLaunching ? 'Launching...' : 'Relaunch Remote Desktop'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
