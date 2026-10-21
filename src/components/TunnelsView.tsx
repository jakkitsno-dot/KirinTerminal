import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeftRight, Play, Square, Plus, Trash, Server, Laptop, Activity, Edit2 } from 'lucide-react';
import { TunnelConfig } from '../types';
import { decryptPassword, isEncrypted } from '../utils/vault';

interface TunnelsViewProps {
  isVisible: boolean;
  masterPassword: string | null;
}

export const TunnelsView: React.FC<TunnelsViewProps> = ({ isVisible, masterPassword }) => {
  const [tunnels, setTunnels] = useState<TunnelConfig[]>(() => {
    try {
      const saved = localStorage.getItem('mobaxterm_tunnels');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  const [ws, setWs] = useState<WebSocket | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTunnel, setEditingTunnel] = useState<Partial<TunnelConfig>>({});

  useEffect(() => {
    localStorage.setItem('mobaxterm_tunnels', JSON.stringify(tunnels));
  }, [tunnels]);

  useEffect(() => {
    const socket = new WebSocket('ws://127.0.0.1:9292');
    
    socket.onopen = () => {
      setWs(socket);
      wsRef.current = socket;
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.action === 'tunnel_status') {
          setTunnels(prev => prev.map(t => {
            if (t.id === data.id) {
              return { ...t, status: data.status, statusMessage: data.message };
            }
            return t;
          }));
        }
      } catch (err) {}
    };

    socket.onclose = () => {
      setWs(null);
      wsRef.current = null;
      // Reset all running to error/stopped on disconnect
      setTunnels(prev => prev.map(t => ({ 
        ...t, 
        status: t.status === 'running' || t.status === 'connecting' ? 'error' : t.status,
        statusMessage: t.status === 'running' || t.status === 'connecting' ? 'WebSocket Disconnected' : t.statusMessage
      })));
    };

    return () => {
      socket.close();
    };
  }, []);

  if (!isVisible) return null;

  const startTunnel = (tunnel: TunnelConfig) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert('WebSocket server not connected');
      return;
    }

    let pwd = tunnel.sshPassword;
    if (pwd && isEncrypted(pwd)) {
      if (!masterPassword) {
        alert('Vault is locked. Please unlock Vault first to start this tunnel.');
        return;
      }
      pwd = decryptPassword(pwd, masterPassword);
    }

    setTunnels(prev => prev.map(t => t.id === tunnel.id ? { ...t, status: 'connecting', statusMessage: 'Initializing...' } : t));

    wsRef.current.send(JSON.stringify({
      action: 'tunnel_start',
      id: tunnel.id,
      tunnelType: tunnel.type,
      localPort: tunnel.localPort,
      localHost: '127.0.0.1',
      sshHost: tunnel.sshHost,
      sshPort: tunnel.sshPort,
      sshUsername: tunnel.sshUsername,
      sshPassword: pwd,
      sshPrivateKey: tunnel.sshPrivateKey,
      destHost: tunnel.destHost,
      destPort: tunnel.destPort
    }));
  };

  const stopTunnel = (id: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'tunnel_stop', id }));
    }
  };

  const deleteTunnel = (id: string) => {
    stopTunnel(id);
    setTunnels(prev => prev.filter(t => t.id !== id));
  };

  const saveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTunnel.name || !editingTunnel.sshHost || !editingTunnel.localPort || (editingTunnel.type !== 'dynamic' && (!editingTunnel.destHost || !editingTunnel.destPort))) {
      alert('Please fill in all required fields.');
      return;
    }

    const newTunnel: TunnelConfig = {
      id: editingTunnel.id || 't_' + Date.now(),
      name: editingTunnel.name,
      type: editingTunnel.type || 'local',
      localPort: Number(editingTunnel.localPort),
      sshHost: editingTunnel.sshHost,
      sshPort: Number(editingTunnel.sshPort || 22),
      sshUsername: editingTunnel.sshUsername || 'root',
      sshPassword: editingTunnel.sshPassword,
      destHost: editingTunnel.destHost,
      destPort: editingTunnel.destPort ? Number(editingTunnel.destPort) : undefined,
      status: 'stopped'
    };

    setTunnels(prev => {
      const exists = prev.find(t => t.id === newTunnel.id);
      if (exists) {
        return prev.map(t => t.id === newTunnel.id ? newTunnel : t);
      }
      return [...prev, newTunnel];
    });
    setIsFormOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#121212] text-gray-200">
      <div className="flex items-center justify-between bg-[#2d2d30] px-4 py-3 border-b border-[#3e3e42]">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-semibold">MobaSSHTunnel - Port Forwarding</h2>
        </div>
        <button
          onClick={() => {
            setEditingTunnel({ type: 'local', sshPort: 22, localPort: 8080, destPort: 80 });
            setIsFormOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Tunnel
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {tunnels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
            <ArrowLeftRight className="w-16 h-16 opacity-20" />
            <p>No SSH tunnels configured.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tunnels.map(tunnel => (
              <div key={tunnel.id} className="bg-[#1e1e1e] border border-[#3e3e42] rounded-lg overflow-hidden flex flex-col">
                <div className="px-3 py-2 bg-[#252528] border-b border-[#3e3e42] flex justify-between items-center">
                  <span className="font-semibold text-sm truncate pr-2" title={tunnel.name}>{tunnel.name}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#3e3e42] text-gray-400">
                    {tunnel.type}
                  </span>
                </div>
                
                <div className="p-3 flex-1 flex flex-col gap-3 text-xs">
                  <div className="flex justify-between items-center bg-[#252528] p-2 rounded border border-[#3e3e42]">
                    <div className="flex flex-col items-center flex-1">
                      <Laptop className="w-5 h-5 text-gray-400 mb-1" />
                      <span className="text-gray-400">Local</span>
                      <span className="font-mono text-emerald-400">{tunnel.localPort}</span>
                    </div>
                    
                    <div className="flex flex-col items-center px-2">
                      <ArrowLeftRight className="w-4 h-4 text-gray-500" />
                    </div>

                    <div className="flex flex-col items-center flex-1">
                      <Server className="w-5 h-5 text-gray-400 mb-1" />
                      <span className="text-gray-400 truncate max-w-[80px]" title={tunnel.sshHost}>{tunnel.sshHost}</span>
                      <span className="font-mono text-amber-400">{tunnel.sshPort}</span>
                    </div>

                    <div className="flex flex-col items-center px-2">
                      <ArrowLeftRight className="w-4 h-4 text-gray-500" />
                    </div>

                    {tunnel.type === 'dynamic' ? (
                      <div className="flex flex-col items-center flex-1">
                        <Activity className="w-5 h-5 text-purple-400 mb-1" />
                        <span className="text-gray-400 text-center leading-tight">Dynamic<br/>(SOCKS5)</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center flex-1">
                        <Server className="w-5 h-5 text-gray-400 mb-1" />
                        <span className="text-gray-400 truncate max-w-[80px]" title={tunnel.destHost}>{tunnel.destHost}</span>
                        <span className="font-mono text-sky-400">{tunnel.destPort}</span>
                      </div>
                    )}
                  </div>

                  {tunnel.statusMessage && (
                    <div className={`p-1.5 rounded text-[11px] truncate ${tunnel.status === 'error' ? 'bg-red-900/30 text-red-400' : 'bg-[#252528] text-gray-400'}`} title={tunnel.statusMessage}>
                      {tunnel.statusMessage}
                    </div>
                  )}
                </div>

                <div className="bg-[#252528] px-3 py-2 border-t border-[#3e3e42] flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${
                      tunnel.status === 'running' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 
                      tunnel.status === 'connecting' ? 'bg-amber-500 animate-pulse' : 
                      tunnel.status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                    }`} />
                    <span className="text-xs text-gray-400 capitalize">{tunnel.status}</span>
                  </div>
                  
                  <div className="flex gap-1.5">
                    {tunnel.status !== 'running' && tunnel.status !== 'connecting' ? (
                      <button onClick={() => startTunnel(tunnel)} className="p-1 rounded bg-[#3e3e42] hover:bg-emerald-600/30 text-emerald-400 transition-colors" title="Start Tunnel">
                        <Play className="w-4 h-4" />
                      </button>
                    ) : (
                      <button onClick={() => stopTunnel(tunnel.id)} className="p-1 rounded bg-[#3e3e42] hover:bg-red-600/30 text-red-400 transition-colors" title="Stop Tunnel">
                        <Square className="w-4 h-4" />
                      </button>
                    )}
                    {tunnel.status !== 'running' && tunnel.status !== 'connecting' && (
                      <button onClick={() => { setEditingTunnel(tunnel); setIsFormOpen(true); }} className="p-1 rounded bg-[#3e3e42] hover:bg-sky-900/30 text-sky-400 transition-colors" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => deleteTunnel(tunnel.id)} className="p-1 rounded bg-[#3e3e42] hover:bg-red-900/30 text-red-400 transition-colors" title="Delete">
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#252528] rounded-lg shadow-xl w-[500px] border border-[#3e3e42]">
            <div className="px-4 py-3 border-b border-[#3e3e42] bg-[#2d2d30] flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-200">Configure SSH Tunnel</h3>
            </div>
            
            <form onSubmit={saveForm} className="p-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 mb-1 block">Tunnel Name</label>
                  <input required value={editingTunnel.name || ''} onChange={e => setEditingTunnel({...editingTunnel, name: e.target.value})} className="w-full bg-[#1e1e1e] border border-[#3e3e42] rounded px-3 py-1.5 text-sm" placeholder="e.g., MySQL via Bastion" />
                </div>
                
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Tunnel Type</label>
                  <select value={editingTunnel.type || 'local'} onChange={e => setEditingTunnel({...editingTunnel, type: e.target.value as any})} className="w-full bg-[#1e1e1e] border border-[#3e3e42] rounded px-3 py-1.5 text-sm">
                    <option value="local">Local Port Forwarding</option>
                    <option value="remote">Remote Port Forwarding</option>
                    <option value="dynamic">Dynamic Port Forwarding (SOCKS5)</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">{editingTunnel.type === 'remote' ? 'Remote Port' : 'Local Port'}</label>
                  <input required type="number" value={editingTunnel.localPort || ''} onChange={e => setEditingTunnel({...editingTunnel, localPort: parseInt(e.target.value)})} className="w-full bg-[#1e1e1e] border border-[#3e3e42] rounded px-3 py-1.5 text-sm" placeholder="e.g., 3306 or 1080" />
                </div>

                <div className="col-span-2 border-t border-[#3e3e42] pt-2 mt-1">
                  <label className="text-xs text-emerald-400 font-semibold mb-2 block uppercase tracking-wider">SSH Gateway (Jump Host)</label>
                </div>

                <div className="col-span-1">
                  <label className="text-xs text-gray-400 mb-1 block">SSH Host</label>
                  <input required value={editingTunnel.sshHost || ''} onChange={e => setEditingTunnel({...editingTunnel, sshHost: e.target.value})} className="w-full bg-[#1e1e1e] border border-[#3e3e42] rounded px-3 py-1.5 text-sm" placeholder="e.g., bastion.example.com" />
                </div>
                <div className="col-span-1">
                  <label className="text-xs text-gray-400 mb-1 block">SSH Port</label>
                  <input required type="number" value={editingTunnel.sshPort || 22} onChange={e => setEditingTunnel({...editingTunnel, sshPort: parseInt(e.target.value)})} className="w-full bg-[#1e1e1e] border border-[#3e3e42] rounded px-3 py-1.5 text-sm" />
                </div>
                
                <div className="col-span-1">
                  <label className="text-xs text-gray-400 mb-1 block">SSH Username</label>
                  <input required value={editingTunnel.sshUsername || ''} onChange={e => setEditingTunnel({...editingTunnel, sshUsername: e.target.value})} className="w-full bg-[#1e1e1e] border border-[#3e3e42] rounded px-3 py-1.5 text-sm" placeholder="root" />
                </div>
                <div className="col-span-1">
                  <label className="text-xs text-gray-400 mb-1 block">SSH Password</label>
                  <input type="password" value={editingTunnel.sshPassword || ''} onChange={e => setEditingTunnel({...editingTunnel, sshPassword: e.target.value})} className="w-full bg-[#1e1e1e] border border-[#3e3e42] rounded px-3 py-1.5 text-sm" placeholder="Optional" />
                </div>

                {editingTunnel.type !== 'dynamic' && (
                  <>
                    <div className="col-span-2 border-t border-[#3e3e42] pt-2 mt-1">
                      <label className="text-xs text-sky-400 font-semibold mb-2 block uppercase tracking-wider">Destination Server</label>
                    </div>

                    <div className="col-span-1">
                      <label className="text-xs text-gray-400 mb-1 block">Dest Host</label>
                      <input required value={editingTunnel.destHost || ''} onChange={e => setEditingTunnel({...editingTunnel, destHost: e.target.value})} className="w-full bg-[#1e1e1e] border border-[#3e3e42] rounded px-3 py-1.5 text-sm" placeholder="e.g., 10.0.0.5" />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs text-gray-400 mb-1 block">Dest Port</label>
                      <input required type="number" value={editingTunnel.destPort || ''} onChange={e => setEditingTunnel({...editingTunnel, destPort: parseInt(e.target.value)})} className="w-full bg-[#1e1e1e] border border-[#3e3e42] rounded px-3 py-1.5 text-sm" placeholder="e.g., 3306" />
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-[#3e3e42]">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-1.5 text-xs text-gray-300 hover:text-white bg-[#3e3e42] hover:bg-[#4a4a4d] rounded">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-500 rounded">
                  Save Tunnel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
