import React, { useState, useEffect, useRef } from 'react';
import {
  Tv,
  Play,
  RotateCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  X,
  Info
} from 'lucide-react';
import { TabItem } from '../types';

interface VncViewProps {
  tab: TabItem;
  isActive: boolean;
  onClose?: () => void;
}

export const VncView: React.FC<VncViewProps> = ({ tab, isActive, onClose }) => {
  const [isLaunching, setIsLaunching] = useState(false);
  const [lastLaunched, setLastLaunched] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Initializing VNC Viewer...');
  const [isError, setIsError] = useState(false);
  const [copied, setCopied] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  const launchVnc = () => {
    setIsLaunching(true);
    setIsError(false);
    setStatusMessage('Searching for installed VNC Viewer (TightVNC, UltraVNC, RealVNC, TigerVNC)...');

    const ws = new WebSocket('ws://127.0.0.1:9292');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          action: 'vnc_launch',
          id: tab.id,
          host: tab.host || '127.0.0.1',
          port: tab.port || 5900
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id === tab.id && msg.action === 'vnc_launched') {
          setIsLaunching(false);
          if (msg.success) {
            setStatusMessage('VNC Viewer window launched successfully!');
            setLastLaunched(new Date().toLocaleTimeString());
          } else {
            setIsError(true);
            setStatusMessage(msg.error || 'No installed VNC viewer executable found.');
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
    launchVnc();
    return () => {
      wsRef.current?.close();
    };
  }, [tab.id]);

  const copyAddress = () => {
    navigator.clipboard.writeText(`${tab.host}:${tab.port || 5900}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#18181a] text-gray-200 select-none p-6">
      <div className="max-w-xl w-full bg-[#202024] border border-[#38383e] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#27272c] border-b border-[#38383e]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-950/70 text-emerald-400 rounded-lg border border-emerald-800/60 shadow">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                <span>{tab.title || 'VNC Session'}</span>
                <span className="text-[10px] bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 px-2 py-0.2 rounded-full font-mono">
                  VNC
                </span>
              </h2>
              <p className="text-xs text-gray-400 font-mono">
                {tab.host}:{tab.port || 5900}
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
                ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
            }`}
          >
            {isError ? (
              <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="text-xs font-semibold">{statusMessage}</div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                {isError
                  ? 'To connect via VNC, ensure a VNC viewer (such as TightVNC, UltraVNC, RealVNC, or TigerVNC) is installed on your Windows system.'
                  : 'VNC viewer client has been initiated. You can interact directly with the remote graphical desktop.'}
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
              <span className="text-gray-400">VNC Port:</span>
              <span className="font-mono text-gray-200 font-medium">{tab.port || 5900}</span>
            </div>
            {lastLaunched && (
              <div className="flex justify-between px-3.5 py-2.5">
                <span className="text-gray-400">Last Attempt:</span>
                <span className="text-gray-400 font-mono">{lastLaunched}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] text-gray-500 italic">
              Standard VNC port is 5900 (Display :0 is 5900, Display :1 is 5901).
            </div>

            <button
              onClick={launchVnc}
              disabled={isLaunching}
              className="flex items-center gap-2 px-4 py-2 bg-[#007acc] hover:bg-[#008be6] active:bg-[#006bb3] text-white rounded-lg text-xs font-semibold cursor-pointer shadow transition disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLaunching ? 'animate-spin' : ''}`} />
              <span>{isLaunching ? 'Launching...' : 'Relaunch VNC Viewer'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
