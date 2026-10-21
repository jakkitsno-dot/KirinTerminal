import React, { useState, useEffect, useRef } from 'react';
import {
  Server,
  Globe,
  FolderOpen,
  Play,
  Square,
  Copy,
  ExternalLink,
  Trash2,
  Check,
  AlertCircle,
  X,
  FileCode,
  Radio,
  Zap
} from 'lucide-react';
import { EmbeddedServerState, ServerLogEntry } from '../types';

interface LocalIpItem {
  iface: string;
  address: string;
}

interface ServersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ServerKey = 'http' | 'ftp' | 'tftp';

export const ServersModal: React.FC<ServersModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<ServerKey>('http');
  const [localIps, setLocalIps] = useState<LocalIpItem[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const [servers, setServers] = useState<Record<ServerKey, EmbeddedServerState>>({
    http: { status: 'stopped', port: 8080, rootDir: 'C:\\', logs: [] },
    ftp: { status: 'stopped', port: 2121, rootDir: 'C:\\', user: 'anonymous', password: '', logs: [] },
    tftp: { status: 'stopped', port: 6969, rootDir: 'C:\\', logs: [] }
  });

  // Local form inputs so user can edit ports and rootDirs
  const [formInputs, setFormInputs] = useState<Record<ServerKey, { port: number; rootDir: string; user?: string; password?: string }>>({
    http: { port: 8080, rootDir: '' },
    ftp: { port: 2121, rootDir: '', user: 'anonymous', password: '' },
    tftp: { port: 6969, rootDir: '' }
  });

  const wsRef = useRef<WebSocket | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const socket = new WebSocket('ws://127.0.0.1:9292');
    wsRef.current = socket;

    socket.onopen = () => {
      // Query current status
      socket.send(JSON.stringify({ action: 'embedded_server_status' }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.action === 'embedded_server_status_response') {
          if (data.servers) {
            setServers(data.servers);
            setFormInputs({
              http: { port: data.servers.http.port, rootDir: data.servers.http.rootDir },
              ftp: { port: data.servers.ftp.port, rootDir: data.servers.ftp.rootDir, user: data.servers.ftp.user, password: '' },
              tftp: { port: data.servers.tftp.port, rootDir: data.servers.tftp.rootDir }
            });
          }
          if (data.localIps) {
            setLocalIps(data.localIps);
          }
        } else if (data.action === 'embedded_server_event') {
          const { serverType, event: evType, log, status, port, rootDir } = data;
          if (evType === 'status') {
            setServers(prev => ({
              ...prev,
              [serverType]: {
                ...prev[serverType as ServerKey],
                status: status || prev[serverType as ServerKey].status,
                port: port || prev[serverType as ServerKey].port,
                rootDir: rootDir || prev[serverType as ServerKey].rootDir
              }
            }));
          } else if (evType === 'log' && log) {
            setServers(prev => {
              const current = prev[serverType as ServerKey];
              return {
                ...prev,
                [serverType]: {
                  ...current,
                  logs: [...current.logs, log].slice(-200)
                }
              };
            });
          }
        }
      } catch (e) {}
    };

    return () => {
      socket.close();
      wsRef.current = null;
    };
  }, [isOpen]);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [servers[activeTab].logs]);

  if (!isOpen) return null;

  const currentServer = servers[activeTab];
  const currentInputs = formInputs[activeTab];
  const isRunning = currentServer.status === 'running';

  const handleStart = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      action: 'embedded_server_start',
      serverType: activeTab,
      config: currentInputs
    }));
  };

  const handleStop = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      action: 'embedded_server_stop',
      serverType: activeTab
    }));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const clearLogs = () => {
    setServers(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        logs: []
      }
    }));
  };

  // Protocols prefix for URL preview
  const getProtocolPrefix = (type: ServerKey) => {
    if (type === 'http') return 'http://';
    if (type === 'ftp') return 'ftp://';
    return 'tftp://';
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[150] backdrop-blur-sm p-4">
      <div className="bg-[#1e1e1e] border border-[#3e3e42] rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-3.5 border-b border-[#3e3e42] bg-[#252528]">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-sm font-semibold text-gray-200">Embedded Local Servers</h2>
              <p className="text-[11px] text-gray-400">Run lightweight daemons locally for file sharing & network administration</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#3e3e42] text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server Selection Tabs */}
        <div className="flex bg-[#252528] px-4 border-b border-[#3e3e42] gap-2">
          {[
            { id: 'http', label: 'HTTP Web Server', icon: Globe, port: servers.http.port, status: servers.http.status },
            { id: 'ftp', label: 'FTP Server', icon: FolderOpen, port: servers.ftp.port, status: servers.ftp.status },
            { id: 'tftp', label: 'TFTP Server', icon: Zap, port: servers.tftp.port, status: servers.tftp.status }
          ].map(tab => {
            const Icon = tab.icon;
            const isTabActive = activeTab === tab.id;
            const isTabRunning = tab.status === 'running';

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ServerKey)}
                className={`flex items-center gap-2.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                  isTabActive
                    ? 'border-blue-500 text-white bg-[#1e1e1e]'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#2d2d30]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isTabActive ? 'text-blue-400' : 'text-gray-400'}`} />
                <span>{tab.label}</span>
                <span className={`w-2 h-2 rounded-full ${
                  isTabRunning ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-gray-600'
                }`} />
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Status & Control Card */}
          <div className="bg-[#252528] border border-[#3e3e42] rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isRunning ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}>
                {activeTab === 'http' && <Globe className="w-5 h-5" />}
                {activeTab === 'ftp' && <FolderOpen className="w-5 h-5" />}
                {activeTab === 'tftp' && <Zap className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-200 uppercase">{activeTab} Server</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    isRunning ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-gray-800 text-gray-400'
                  }`}>
                    {currentServer.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isRunning 
                    ? `Active on port ${currentServer.port} • Serving ${currentServer.rootDir}`
                    : 'Server is currently stopped. Configure below and press Start.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isRunning ? (
                <button
                  onClick={handleStart}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium text-xs transition-colors shadow-lg cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Start {activeTab.toUpperCase()} Server
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-medium text-xs transition-colors shadow-lg cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Stop Server
                </button>
              )}
            </div>
          </div>

          {/* Configuration Form */}
          <div className="bg-[#252528] border border-[#3e3e42] rounded-lg p-4 space-y-4">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Configuration Settings</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1.5 font-medium">Listen Port</label>
                <input
                  type="number"
                  disabled={isRunning}
                  value={currentInputs.port}
                  onChange={(e) => setFormInputs({
                    ...formInputs,
                    [activeTab]: { ...currentInputs, port: parseInt(e.target.value) || 0 }
                  })}
                  className="w-full bg-[#1e1e1e] border border-[#3e3e42] disabled:opacity-50 rounded px-3 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs text-gray-400 block mb-1.5 font-medium">Root Directory (Files to serve)</label>
                <input
                  type="text"
                  disabled={isRunning}
                  value={currentInputs.rootDir}
                  onChange={(e) => setFormInputs({
                    ...formInputs,
                    [activeTab]: { ...currentInputs, rootDir: e.target.value }
                  })}
                  placeholder="e.g. C:\Users\YourUser\Downloads"
                  className="w-full bg-[#1e1e1e] border border-[#3e3e42] disabled:opacity-50 rounded px-3 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {activeTab === 'ftp' && (
                <>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1.5 font-medium">Username (Optional)</label>
                    <input
                      type="text"
                      disabled={isRunning}
                      value={currentInputs.user || ''}
                      onChange={(e) => setFormInputs({
                        ...formInputs,
                        ftp: { ...currentInputs, user: e.target.value }
                      })}
                      placeholder="anonymous"
                      className="w-full bg-[#1e1e1e] border border-[#3e3e42] disabled:opacity-50 rounded px-3 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1.5 font-medium">Password (Optional)</label>
                    <input
                      type="password"
                      disabled={isRunning}
                      value={currentInputs.password || ''}
                      onChange={(e) => setFormInputs({
                        ...formInputs,
                        ftp: { ...currentInputs, password: e.target.value }
                      })}
                      placeholder="Leave empty for public"
                      className="w-full bg-[#1e1e1e] border border-[#3e3e42] disabled:opacity-50 rounded px-3 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick Access URLs (When Running) */}
          {isRunning && (
            <div className="bg-[#252528] border border-[#3e3e42] rounded-lg p-4 space-y-2.5">
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                Network Access URLs (Share with other devices on your LAN)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  { iface: 'Localhost', address: '127.0.0.1' },
                  ...localIps
                ].map((ip, idx) => {
                  const url = `${getProtocolPrefix(activeTab)}${ip.address}:${currentServer.port}`;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-[#1e1e1e] border border-[#3e3e42] p-2 rounded text-xs"
                    >
                      <div className="truncate mr-2">
                        <span className="text-gray-400 text-[10px] block">{ip.iface}</span>
                        <span className="font-mono text-emerald-400 font-medium select-all">{url}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleCopy(url)}
                          title="Copy URL"
                          className="p-1 rounded hover:bg-[#3e3e42] text-gray-400 hover:text-white transition-colors"
                        >
                          {copiedUrl === url ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        {activeTab === 'http' && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            title="Open in Browser"
                            className="p-1 rounded hover:bg-[#3e3e42] text-gray-400 hover:text-white transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Access & Event Logs */}
          <div className="bg-[#252528] border border-[#3e3e42] rounded-lg p-4 space-y-2 flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <FileCode className="w-3.5 h-3.5 text-blue-400" />
                Live Access & Traffic Logs
              </h3>
              <button
                onClick={clearLogs}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Clear Logs
              </button>
            </div>

            <div
              ref={logContainerRef}
              className="bg-[#121212] border border-[#3e3e42] rounded p-3 font-mono text-[11px] h-44 overflow-y-auto space-y-1"
            >
              {currentServer.logs.length === 0 ? (
                <div className="text-gray-500 text-center py-10 italic">
                  No activity recorded yet. Start the server to see incoming network traffic.
                </div>
              ) : (
                currentServer.logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-gray-500 shrink-0">[{log.time}]</span>
                    <span
                      className={`break-all ${
                        log.type === 'error'
                          ? 'text-red-400 font-semibold'
                          : log.type === 'warn'
                          ? 'text-amber-400'
                          : 'text-gray-300'
                      }`}
                    >
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#3e3e42] bg-[#252528] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
