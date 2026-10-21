import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, ShieldAlert, Globe, Play, Square, Search, RefreshCw, 
  Download, Terminal as TermIcon, FolderPlus, Folder, ExternalLink, Power, PowerOff,
  Cpu, Server, Wifi, Copy, Check, CheckCircle2, AlertCircle, Radio, Monitor
} from 'lucide-react';
import { FitAddon } from 'xterm-addon-fit';
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import { NetworkInterfaceInfo, ScannedHost, SessionConfig } from '../types';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { PromptModal } from './PromptModal';

interface NetworkToolsViewProps {
  isVisible: boolean;
  onConnectSSH?: (host: string, port?: number, username?: string) => void;
  onConnectSFTP?: (host: string, port?: number, username?: string) => void;
  onAddSession?: (session: Partial<SessionConfig>) => void;
}

const getKnownPortInfo = (portStr: string) => {
  const p = parseInt(portStr, 10);
  switch (p) {
    case 20:
    case 21: return { name: 'FTP (ระบบรับส่งไฟล์)', impact: 'File Transfer Protocol (โพรโทคอลรับส่งไฟล์): การปิดโพรเซสนี้จะตัดการเชื่อมต่อของการรับส่งไฟล์ที่กำลังทำงานอยู่ทั้งหมด', critical: false };
    case 22: return { name: 'SSH (ระบบเชื่อมต่อระยะไกล)', impact: 'Secure Shell (โพรโทคอลเครือข่ายเข้ารหัส): การปิดโพรเซสนี้อาจทำให้เซสชันการดูแลระบบหรือ SSH Tunnel ที่เชื่อมต่ออยู่หลุดทันที', critical: false };
    case 80: return { name: 'HTTP (เว็บเซิร์ฟเวอร์)', impact: 'Web Server (เว็บเซิร์ฟเวอร์): การปิดโพรเซสนี้จะทำให้เว็บไซต์ที่รันอยู่บนพอร์ต 80 (เช่น Apache/Nginx) หยุดให้บริการ (Downtime)', critical: false };
    case 443: return { name: 'HTTPS (เว็บเซิร์ฟเวอร์เข้ารหัส)', impact: 'Secure Web Server (เว็บเซิร์ฟเวอร์แบบปลอดภัย): การปิดโพรเซสนี้จะทำให้เว็บไซต์ที่ให้บริการผ่าน SSL/TLS หยุดทำงาน', critical: false };
    case 135: return { name: 'Windows RPC (เซอร์วิสหลักของวินโดวส์)', impact: 'CRITICAL Windows Process (กระบวนการระบบระดับวิกฤต): การปิดโพรเซสนี้อาจทำให้ระบบปฏิบัติการ Windows ทำงานผิดพลาด (System Instability) หรือเกิดจอฟ้าได้!', critical: true };
    case 137:
    case 138:
    case 139:
    case 445: return { name: 'SMB / NetBIOS (ระบบแชร์ไฟล์บนเครือข่าย)', impact: 'Windows File Sharing (ระบบแชร์ไฟล์/เครื่องพิมพ์): การปิดโพรเซสนี้จะตัดการเชื่อมต่อไดรฟ์เครือข่าย (Network Drive) และเครื่องพิมพ์ที่แชร์อยู่', critical: true };
    case 3306: return { name: 'MySQL / MariaDB (ระบบฐานข้อมูล)', impact: 'Database Server (เซิร์ฟเวอร์ฐานข้อมูล): การบังคับปิดอาจทำให้ทรานแซกชัน (Transactions) ที่กำลังบันทึกข้อมูลอยู่เสียหายหรือเกิด Data Corruption ได้!', critical: true };
    case 5432: return { name: 'PostgreSQL (ระบบฐานข้อมูล)', impact: 'Database Server (เซิร์ฟเวอร์ฐานข้อมูล): การบังคับปิดอย่างกะทันหันอาจทำให้ข้อมูลสูญหาย (Data Loss) หรือฐานข้อมูลทำงานผิดปกติ', critical: true };
    case 27017: return { name: 'MongoDB (ระบบฐานข้อมูล)', impact: 'Database Server (เซิร์ฟเวอร์ฐานข้อมูล NoSQL): การปิดโพรเซสนี้จะตัดการเชื่อมต่อของแอปพลิเคชันที่ดึงข้อมูลอยู่', critical: false };
    case 3000:
    case 8080:
    case 8000:
    case 5173: return { name: 'Local Dev Server (เซิร์ฟเวอร์สำหรับนักพัฒนา)', impact: 'Local Development Server (เซิร์ฟเวอร์ทดสอบระบบ เช่น Node.js, React, Vite): สามารถปิดการทำงาน (Kill Process) ได้อย่างปลอดภัยเพื่อเคลียร์พอร์ตที่ค้าง', critical: false };
    case 3389: return { name: 'RDP (ระบบรีโมทหน้าจอ)', impact: 'Remote Desktop Protocol: การปิดโพรเซสนี้จะตัดการเชื่อมต่อของผู้ใช้ที่กำลังรีโมทเข้ามาควบคุมเครื่องนี้อยู่ทันที', critical: false };
    default: return { name: 'Unknown Process (โพรเซสที่ไม่รู้จัก)', impact: 'Unknown Service (เซอร์วิสที่ไม่ระบุ): โปรดระมัดระวัง! การบังคับปิดโพรเซสที่ไม่รู้จักอาจทำให้แอปพลิเคชันที่เกี่ยวข้องเกิดการแครช (Crash) หรือทำงานผิดพลาดได้', critical: false };
  }
};

export const NetworkToolsView: React.FC<NetworkToolsViewProps> = ({ 
  isVisible,
  onConnectSSH,
  onConnectSFTP,
  onAddSession
}) => {
  const [activeTool, setActiveTool] = useState<'dashboard' | 'ipscan' | 'ping' | 'traceroute' | 'portscan'>('dashboard');
  
  // Dashboard state
  const [dashboardData, setDashboardData] = useState<{
    cpuUsage: number;
    totalMem: number;
    usedMem: number;
    freeMem: number;
    listeningPorts: { protocol: string; address: string; state: string; pid: string; processName: string }[];
  } | null>(null);
  
  // Polling for dashboard
  useEffect(() => {
    if (activeTool !== 'dashboard' || !isVisible) return;
    const fetchDashboard = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'system_dashboard' }));
      }
    };
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 2000);
    return () => clearInterval(interval);
  }, [activeTool, isVisible]);
  
  // Traditional tools state (Ping, Traceroute, Portscan)
  const [target, setTarget] = useState('1.1.1.1');
  const [ports, setPorts] = useState('21, 22, 80, 443, 3389, 8080');
  const [isTermRunning, setIsTermRunning] = useState(false);
  
  // IP Scanner state
  const [interfaces, setInterfaces] = useState<NetworkInterfaceInfo[]>([]);
  const [selectedInterface, setSelectedInterface] = useState<string>('');
  const [rangeStart, setRangeStart] = useState('192.168.1.1');
  const [rangeEnd, setRangeEnd] = useState('192.168.1.254');
  const [scanPortsInput, setScanPortsInput] = useState('21, 22, 80, 443, 445, 3389, 8080');
  const [hosts, setHosts] = useState<ScannedHost[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; percent: number; found: number }>({
    current: 0,
    total: 0,
    percent: 0,
    found: 0
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Custom Names (MAC -> Name mapping)
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, host: ScannedHost } | null>(null);
  const [renamePrompt, setRenamePrompt] = useState<{ isOpen: boolean, mac: string, initialName: string }>({ isOpen: false, mac: '', initialName: '' });

  useEffect(() => {
    const saved = localStorage.getItem('net_custom_names');
    if (saved) {
      try {
        setCustomNames(JSON.parse(saved));
      } catch(e){}
    }
  }, []);

  const handleRename = (mac: string | undefined) => {
    if (!mac) {
      alert('Cannot assign name without MAC Address.');
      return;
    }
    setRenamePrompt({ isOpen: true, mac, initialName: customNames[mac] || '' });
  };

  const submitRename = (newName: string) => {
    const updated = { ...customNames };
    if (newName.trim() === '') {
      delete updated[renamePrompt.mac];
    } else {
      updated[renamePrompt.mac] = newName.trim();
    }
    setCustomNames(updated);
    localStorage.setItem('net_custom_names', JSON.stringify(updated));
    setRenamePrompt(prev => ({ ...prev, isOpen: false }));
  };

  const [killPrompt, setKillPrompt] = useState<{ isOpen: boolean; pid: string; port: string; protocol: string; processName: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Auto clear status notification after 4s
  useEffect(() => {
    if (statusNotification) {
      const timer = setTimeout(() => setStatusNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [statusNotification]);

  // Connect WebSocket on mount
  useEffect(() => {
    const ws = new WebSocket('ws://127.0.0.1:9292');
    wsRef.current = ws;

    ws.onopen = () => {
      // Request active network interfaces
      ws.send(JSON.stringify({
        action: 'net_get_interfaces',
        id: 'net_init'
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        // 1. Interfaces result
        if (msg.action === 'net_interfaces_result') {
          if (msg.interfaces && msg.interfaces.length > 0) {
            setInterfaces(msg.interfaces);
            // Default to Wi-Fi or first active interface with a /24 subnet
            const preferred = msg.interfaces.find((i: NetworkInterfaceInfo) => i.name.toLowerCase().includes('wi-fi') || i.name.toLowerCase().includes('eth')) || msg.interfaces[0];
            if (preferred) {
              setSelectedInterface(preferred.name);
              setRangeStart(preferred.rangeStart);
              setRangeEnd(preferred.rangeEnd);
            }
          }
        }

        // System Dashboard result
        else if (msg.action === 'system_dashboard_result') {
          setDashboardData({
            cpuUsage: msg.cpuUsage,
            totalMem: msg.totalMem,
            usedMem: msg.usedMem,
            freeMem: msg.freeMem,
            listeningPorts: msg.listeningPorts || []
          });
        }

        // 2. IP Scanner results
        else if (msg.action === 'net_ipscan_host_found') {
          setHosts((prev) => {
            const index = prev.findIndex((h) => h.ip === msg.host.ip);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = { ...updated[index], ...msg.host };
              return updated;
            }
            return [...prev, msg.host];
          });
        }

        else if (msg.action === 'net_ipscan_progress') {
          setProgress({
            current: msg.current,
            total: msg.total,
            percent: msg.percent,
            found: msg.found
          });
        }

        else if (msg.action === 'net_ipscan_done') {
          setIsScanning(false);
          setStatusNotification({
            text: `Scan finished: Found ${msg.totalFound} alive host(s)${msg.cancelled ? ' (Stopped early)' : ''}.`,
            type: 'info'
          });
        }

        else if (msg.action === 'net_ipscan_stopped') {
          setIsScanning(false);
          setStatusNotification({
            text: 'IP Scan stopped by user.',
            type: 'info'
          });
        }

        // 3. Wake-on-LAN result
        else if (msg.action === 'net_wol_result') {
          if (msg.success) {
            setStatusNotification({
              text: `✅ Magic packet sent successfully to ${msg.mac}!`,
              type: 'success'
            });
          } else {
            setStatusNotification({
              text: `❌ WOL failed for ${msg.mac}: ${msg.error}`,
              type: 'error'
            });
          }
        }

        // 3.5 Kill Process result
        else if (msg.action === 'kill_process_result') {
          setStatusNotification({
            text: msg.success ? `✅ ${msg.message}` : `❌ ${msg.message}`,
            type: msg.success ? 'success' : 'error'
          });
        }

        // 4. Terminal tools output (Ping, Traceroute, Portscan)
        else if (msg.action === 'net_output') {
          const formatted = msg.data.replace(/\r?\n/g, '\r\n');
          termRef.current?.write(formatted);
        } else if (msg.action === 'net_done') {
          setIsTermRunning(false);
        }
      } catch (e) {
        console.error('Error handling WebSocket message in NetworkToolsView:', e);
      }
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Initialize Terminal for Ping/Traceroute/Portscan
  useEffect(() => {
    if (!containerRef.current || activeTool === 'ipscan') return;

    if (!termRef.current) {
      const term = new Terminal({
        cursorBlink: false,
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: 13,
        theme: {
          background: '#18181b',
          foreground: '#e4e4e7',
        }
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);
      
      termRef.current = term;
      fitAddonRef.current = fitAddon;

      term.writeln('\x1b[36m=== KirinTerminal Network Diagnostic Tools ===\x1b[0m');
      term.writeln('Configure target host and click Start to begin execution.\r\n');
    }

    if (fitAddonRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
        } catch (e) {}
      }, 50);
    }
  }, [activeTool, isVisible]);

  // Handle switching interface
  const handleInterfaceChange = (name: string) => {
    setSelectedInterface(name);
    const iface = interfaces.find(i => i.name === name);
    if (iface) {
      setRangeStart(iface.rangeStart);
      setRangeEnd(iface.rangeEnd);
    }
  };

  // Start IP Scan
  const handleStartIpScan = () => {
    if (!rangeStart.trim() || !rangeEnd.trim() || isScanning) return;

    setHosts([]);
    setProgress({ current: 0, total: 0, percent: 0, found: 0 });
    setIsScanning(true);
    setStatusNotification(null);

    const portList = scanPortsInput
      .split(',')
      .map(p => parseInt(p.trim(), 10))
      .filter(p => !isNaN(p) && p > 0 && p <= 65535);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'net_ipscan_start',
        id: 'ip_scanner',
        data: {
          rangeStart: rangeStart.trim(),
          rangeEnd: rangeEnd.trim(),
          ports: portList,
          concurrency: 30
        }
      }));
    } else {
      setIsScanning(false);
      setStatusNotification({
        text: 'Cannot connect to backend service. Please check pty-server.',
        type: 'error'
      });
    }
  };

  // Stop IP Scan
  const handleStopIpScan = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'net_ipscan_stop',
        id: 'ip_scanner'
      }));
    }
    setIsScanning(false);
  };

  // Send Wake-on-LAN
  const handleWakeOnLan = (mac?: string) => {
    if (!mac) {
      setStatusNotification({ text: 'No MAC address available for Wake-on-LAN', type: 'error' });
      return;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'net_wol',
        id: 'wol_' + Date.now(),
        data: { mac }
      }));
    }
  };

  // Copy IP to clipboard
  const handleCopyIp = (ip: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 1800);
  };

  // Export results to CSV
  const handleExportCsv = () => {
    if (hosts.length === 0) return;
    const header = ['IP Address', 'Status', 'Latency (ms)', 'Hostname', 'MAC Address', 'Manufacturer', 'Open Ports'];
    const rows = hosts.map(h => [
      `"${h.ip}"`,
      `"Alive"`,
      `"${h.latency || 0}"`,
      `"${h.hostname || ''}"`,
      `"${h.mac || ''}"`,
      `"${h.vendor || ''}"`,
      `"${(h.openPorts || []).join('; ')}"`
    ]);
    const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ip_scan_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export results to JSON
  const handleExportJson = () => {
    if (hosts.length === 0) return;
    const blob = new Blob([JSON.stringify(hosts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ip_scan_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Start Terminal tool (Ping, Traceroute, Portscan)
  const handleStartTermTool = () => {
    if (!target.trim() || isTermRunning) return;
    
    termRef.current?.clear();
    setIsTermRunning(true);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      let payload: any = {
        action: `net_${activeTool}`,
        id: 'network_tool_session',
        target: target.trim()
      };
      
      if (activeTool === 'portscan') {
        const portList = ports.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
        payload.ports = portList;
      }
      
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  // Stop Terminal tool
  const handleStopTermTool = () => {
    if (isTermRunning) {
      termRef.current?.writeln('\r\n\x1b[33m[Stopped by user]\x1b[0m\r\n');
      setIsTermRunning(false);
    }
  };

  // Filtered hosts based on search
  const filteredHosts = hosts.filter(h => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesIp = h.ip.toLowerCase().includes(q);
    const matchesHost = (h.hostname || '').toLowerCase().includes(q);
    const matchesMac = (h.mac || '').toLowerCase().includes(q);
    const matchesVendor = (h.vendor || '').toLowerCase().includes(q);
    const matchesPort = (h.openPorts || []).some(p => p.toString().includes(q));
    return matchesIp || matchesHost || matchesMac || matchesVendor || matchesPort;
  });

  return (
    <div className={`h-full w-full bg-[#1e1e1e] flex flex-row text-gray-200 select-none ${isVisible ? 'block' : 'hidden'}`}>
      
      {/* Sidebar for Network Tools */}
      <div className="w-60 bg-[#252528] border-r border-[#333] flex flex-col shrink-0">
        <div className="p-3 bg-[#2d2d30] border-b border-[#333] font-semibold text-sm flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-400" />
          Network Suite
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <button
            onClick={() => setActiveTool('dashboard')}
            className={`w-full text-left px-3 py-2 text-sm rounded flex items-center justify-between transition-colors ${
              activeTool === 'dashboard' ? 'bg-sky-600 text-white font-medium shadow-sm' : 'hover:bg-[#2d2d30] text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-purple-400" />
              <span>System Dashboard</span>
            </div>
          </button>
          
          <button
            onClick={() => setActiveTool('ipscan')}
            className={`w-full text-left px-3 py-2 text-sm rounded flex items-center justify-between transition-colors ${
              activeTool === 'ipscan' ? 'bg-sky-600 text-white font-medium shadow-sm' : 'hover:bg-[#2d2d30] text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              <span>IP Scanner</span>
            </div>
            {hosts.length > 0 && (
              <span className="text-xs bg-[#1e1e1e] text-emerald-400 px-1.5 py-0.5 rounded-full font-mono">
                {hosts.length}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setActiveTool('ping')}
            className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 transition-colors ${
              activeTool === 'ping' ? 'bg-[#3e3e42] text-white' : 'hover:bg-[#2d2d30] text-gray-400'
            }`}
          >
            <Activity className="w-4 h-4" /> Ping
          </button>
          
          <button
            onClick={() => setActiveTool('traceroute')}
            className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 transition-colors ${
              activeTool === 'traceroute' ? 'bg-[#3e3e42] text-white' : 'hover:bg-[#2d2d30] text-gray-400'
            }`}
          >
            <Globe className="w-4 h-4" /> Traceroute
          </button>
          
          <button
            onClick={() => setActiveTool('portscan')}
            className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 transition-colors ${
              activeTool === 'portscan' ? 'bg-[#3e3e42] text-white' : 'hover:bg-[#2d2d30] text-gray-400'
            }`}
          >
            <ShieldAlert className="w-4 h-4" /> Port Scanner
          </button>
        </div>

        {/* Interface info box */}
        {interfaces.length > 0 && (
          <div className="p-3 bg-[#1e1e20] border-t border-[#333] text-xs text-gray-400">
            <div className="flex items-center gap-1.5 text-gray-300 font-medium mb-1">
              <Wifi className="w-3.5 h-3.5 text-sky-400" /> Active Interfaces ({interfaces.length})
            </div>
            <div className="truncate text-[11px] text-gray-500">
              {interfaces[0].name}: {interfaces[0].ip}
            </div>
          </div>
        )}
      </div>
      
      {/* Main Tool Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#1e1e1e]">

        {/* Status notification toast */}
        {statusNotification && (
          <div className={`px-4 py-2 text-xs flex items-center justify-between border-b ${
            statusNotification.type === 'success' 
              ? 'bg-emerald-950/80 text-emerald-200 border-emerald-800' 
              : statusNotification.type === 'error'
              ? 'bg-red-950/80 text-red-200 border-red-800'
              : 'bg-sky-950/80 text-sky-200 border-sky-800'
          }`}>
            <div className="flex items-center gap-2">
              {statusNotification.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{statusNotification.text}</span>
            </div>
            <button onClick={() => setStatusNotification(null)} className="text-gray-400 hover:text-white text-xs">✕</button>
          </div>
        )}

        {/* -------------------- TOOL 1: ADVANCED IP SCANNER -------------------- */}
        <div className={`flex-1 flex-col h-full overflow-hidden ${activeTool === 'ipscan' ? 'flex' : 'hidden'}`}>
            
            {/* Top Scanner Controls */}
            <div className="p-3.5 bg-[#252528] border-b border-[#333] flex flex-wrap items-center gap-3">
              
              {/* Interface dropdown */}
              {interfaces.length > 0 && (
                <div className="flex flex-col gap-1 min-w-[170px]">
                  <label className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Interface / Subnet</label>
                  <select
                    value={selectedInterface}
                    onChange={(e) => handleInterfaceChange(e.target.value)}
                    disabled={isScanning}
                    className="bg-[#1a1a1c] border border-[#3e3e42] rounded px-2.5 py-1.5 text-xs text-gray-200 outline-none focus:border-sky-500"
                  >
                    {interfaces.map(i => (
                      <option key={i.name} value={i.name}>
                        {i.name} ({i.cidr})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* IP Range Start */}
              <div className="flex flex-col gap-1 w-36">
                <label className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Start IP</label>
                <input
                  type="text"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  disabled={isScanning}
                  className="bg-[#1a1a1c] border border-[#3e3e42] rounded px-2.5 py-1.5 text-xs font-mono outline-none focus:border-sky-500"
                  placeholder="192.168.1.1"
                />
              </div>

              <span className="text-gray-500 pt-5 font-mono text-xs">→</span>

              {/* IP Range End */}
              <div className="flex flex-col gap-1 w-36">
                <label className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">End IP</label>
                <input
                  type="text"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  disabled={isScanning}
                  className="bg-[#1a1a1c] border border-[#3e3e42] rounded px-2.5 py-1.5 text-xs font-mono outline-none focus:border-sky-500"
                  placeholder="192.168.1.254"
                />
              </div>

              {/* Ports */}
              <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                <label className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Probe Ports (SSH, Web, RDP)</label>
                <input
                  type="text"
                  value={scanPortsInput}
                  onChange={(e) => setScanPortsInput(e.target.value)}
                  disabled={isScanning}
                  className="bg-[#1a1a1c] border border-[#3e3e42] rounded px-2.5 py-1.5 text-xs font-mono outline-none focus:border-sky-500"
                  placeholder="21, 22, 80, 443, 445, 3389, 8080"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-4">
                {!isScanning ? (
                  <button
                    onClick={handleStartIpScan}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Scan Network
                  </button>
                ) : (
                  <button
                    onClick={handleStopIpScan}
                    className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    Stop
                  </button>
                )}

                {/* Export Dropdown */}
                {hosts.length > 0 && (
                  <div className="flex gap-1">
                    <button
                      onClick={handleExportCsv}
                      title="Export results to CSV"
                      className="bg-[#333338] hover:bg-[#3e3e44] text-gray-200 px-3 py-1.5 rounded text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-[#444]"
                    >
                      <Download className="w-3.5 h-3.5" /> CSV
                    </button>
                    <button
                      onClick={handleExportJson}
                      title="Export results to JSON"
                      className="bg-[#333338] hover:bg-[#3e3e44] text-gray-200 px-3 py-1.5 rounded text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-[#444]"
                    >
                      JSON
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Progress & Live Filtering Bar */}
            <div className="px-4 py-2.5 bg-[#202022] border-b border-[#333] flex flex-wrap items-center justify-between gap-4">
              {/* Progress info */}
              <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                {isScanning ? (
                  <div className="flex items-center gap-2 text-xs text-sky-400 font-medium">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Scanning {progress.current} / {progress.total} IPs ({progress.percent}%)</span>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">
                    {hosts.length > 0 ? (
                      <span>Found <strong className="text-emerald-400">{hosts.length}</strong> alive devices in network</span>
                    ) : (
                      <span>Ready to scan local network</span>
                    )}
                  </div>
                )}

                {/* Visual Progress Bar */}
                {isScanning && (
                  <div className="w-44 bg-[#111] rounded-full h-2 overflow-hidden border border-[#333]">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-200 ease-out"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Search & Filter */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search IP, name, MAC, vendor..."
                    className="bg-[#18181a] border border-[#333] rounded pl-8 pr-3 py-1 text-xs text-gray-200 outline-none focus:border-sky-500 w-56"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Results Table */}
            <div className="flex-1 overflow-auto bg-[#18181b]">
              {hosts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 p-8 space-y-3">
                  <Radio className="w-12 h-12 text-[#333] stroke-1" />
                  <p className="text-sm">No hosts discovered yet.</p>
                  <p className="text-xs text-gray-600 max-w-sm text-center">
                    Select your network interface or set an IP range above, then click <strong>Scan Network</strong> to find all active computers, IoT boards, routers, and servers.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#202023] text-gray-400 sticky top-0 border-b border-[#333] z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">Status</th>
                      <th className="py-2.5 px-3 font-semibold">IP Address</th>
                      <th className="py-2.5 px-3 font-semibold">Device / Hostname</th>
                      <th className="py-2.5 px-3 font-semibold">MAC Address</th>
                      <th className="py-2.5 px-3 font-semibold">Manufacturer / Vendor</th>
                      <th className="py-2.5 px-2 font-semibold text-center w-16">Latency</th>
                      <th className="py-2.5 px-3 font-semibold">Open Ports</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#26262a]">
                    {filteredHosts.map((host) => {
                      const hasSsh = host.openPorts?.includes(22);
                      const hasWeb = host.openPorts?.includes(80) || host.openPorts?.includes(443) || host.openPorts?.includes(8080);
                      const hasRdp = host.openPorts?.includes(3389);
                      const hasSmb = host.openPorts?.includes(445);

                      return (
                        <tr 
                          key={host.ip} 
                          className="hover:bg-[#232328] transition-colors group"
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenu({ x: e.clientX, y: e.clientY, host });
                          }}
                        >
                          {/* Online status indicator */}
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" title="Host is Online" />
                          </td>

                          {/* IP Address */}
                          <td className="py-2.5 px-3 font-mono font-medium text-sky-400">
                            <div className="flex items-center gap-1.5">
                              <span>{host.ip}</span>
                              <button
                                onClick={() => handleCopyIp(host.ip)}
                                title="Copy IP"
                                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 p-0.5 rounded transition-opacity"
                              >
                                {copiedIp === host.ip ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </td>

                          {/* Hostname */}
                          <td 
                            className="py-2.5 px-3 text-gray-300 font-medium cursor-pointer hover:bg-[#2a2a30] transition-colors"
                            onDoubleClick={() => handleRename(host.mac)}
                            title="Double click to set custom name / note"
                          >
                            {host.mac && customNames[host.mac] ? (
                              <div className="flex flex-col">
                                <span className="text-amber-400">{customNames[host.mac]}</span>
                                {host.hostname && <span className="text-[10px] text-gray-500">{host.hostname}</span>}
                              </div>
                            ) : host.hostname ? (
                              <span className="text-gray-200">{host.hostname}</span>
                            ) : (
                              <span className="text-gray-600 italic">Unknown</span>
                            )}
                          </td>

                          {/* MAC Address */}
                          <td className="py-2.5 px-3 font-mono text-gray-400 text-[11px]">
                            {host.mac ? host.mac : <span className="text-gray-600">-</span>}
                          </td>

                          {/* Manufacturer / Vendor Badge */}
                          <td className="py-2.5 px-3">
                            {host.vendor && host.vendor !== 'Unknown' && host.vendor !== 'Generic / Other' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#2d3748] text-sky-300 border border-[#4a5568]">
                                <Cpu className="w-3 h-3 text-sky-400" />
                                {host.vendor}
                              </span>
                            ) : (
                              <span className="text-gray-600 text-[11px]">Generic / Other</span>
                            )}
                          </td>

                          {/* Latency */}
                          <td className="py-2.5 px-2 text-center font-mono text-gray-400 text-[11px]">
                            {host.latency ? `${host.latency}ms` : '<1ms'}
                          </td>

                          {/* Open Ports Badges */}
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1">
                              {host.openPorts && host.openPorts.length > 0 ? (
                                host.openPorts.map(p => (
                                  <span
                                    key={p}
                                    className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold border ${
                                      p === 22 
                                        ? 'bg-blue-950/80 text-blue-300 border-blue-800' 
                                        : p === 80 || p === 443 || p === 8080
                                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                                        : p === 3389
                                        ? 'bg-purple-950/80 text-purple-300 border-purple-800'
                                        : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                                    }`}
                                    title={`Port ${p} Open`}
                                  >
                                    {p === 22 ? 'SSH:22' : p === 80 ? 'HTTP:80' : p === 443 ? 'HTTPS:443' : p === 3389 ? 'RDP:3389' : p === 445 ? 'SMB:445' : p}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-600 text-[11px]">-</span>
                              )}
                            </div>
                          </td>

                          {/* Action Buttons */}
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* SSH Button */}
                              {onConnectSSH && (
                                <button
                                  onClick={() => onConnectSSH(host.ip, 22, host.vendor?.includes('Raspberry') ? 'pi' : 'root')}
                                  title="Open SSH Terminal session"
                                  className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                                    hasSsh 
                                      ? 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer shadow-sm' 
                                      : 'bg-[#2a2a2e] hover:bg-[#38383e] text-gray-300 cursor-pointer'
                                  }`}
                                >
                                  <TermIcon className="w-3 h-3" /> SSH
                                </button>
                              )}

                              {/* SFTP Button */}
                              {onConnectSFTP && (
                                <button
                                  onClick={() => onConnectSFTP(host.ip, 22, host.vendor?.includes('Raspberry') ? 'pi' : 'root')}
                                  title="Open SFTP Browser"
                                  className="px-2 py-1 rounded text-[11px] font-medium bg-[#2a2a2e] hover:bg-[#38383e] text-gray-300 cursor-pointer flex items-center gap-1 transition-colors"
                                >
                                  SFTP
                                </button>
                              )}

                              {/* RDP Button */}
                              {hasRdp && (
                                <button
                                  onClick={() => {
                                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                                      wsRef.current.send(JSON.stringify({ action: 'net_open_rdp', ip: host.ip }));
                                    }
                                  }}
                                  title="Launch Remote Desktop Connection (RDP)"
                                  className="px-2 py-1 rounded text-[11px] font-medium bg-purple-800/60 hover:bg-purple-700/80 text-purple-200 cursor-pointer flex items-center gap-1 transition-colors"
                                >
                                  <Monitor className="w-3 h-3" /> RDP
                                </button>
                              )}

                              {/* Web Browser Button */}
                              {hasWeb && (
                                <button
                                  onClick={() => window.open(`http://${host.ip}`, '_blank')}
                                  title="Open Web Interface (HTTP)"
                                  className="px-2 py-1 rounded text-[11px] font-medium bg-emerald-800/60 hover:bg-emerald-700/80 text-emerald-200 cursor-pointer flex items-center gap-1 transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" /> Web
                                </button>
                              )}

                              {/* SMB (Shared Folders) Button */}
                              {hasSmb && (
                                <button
                                  onClick={() => {
                                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                                      wsRef.current.send(JSON.stringify({ action: 'net_open_smb', ip: host.ip }));
                                    }
                                  }}
                                  title="Open Shared Folders (SMB)"
                                  className="px-2 py-1 rounded text-[11px] font-medium bg-amber-800/60 hover:bg-amber-700/80 text-amber-200 cursor-pointer flex items-center gap-1 transition-colors"
                                >
                                  <Folder className="w-3 h-3" /> Shares
                                </button>
                              )}

                              {/* Wake-on-LAN Button */}
                              {host.mac && (
                                <button
                                  onClick={() => handleWakeOnLan(host.mac)}
                                  title={`Send Wake-on-LAN magic packet to ${host.mac}`}
                                  className="p-1 rounded text-gray-400 hover:text-amber-400 hover:bg-[#2a2a2e] transition-colors cursor-pointer"
                                >
                                  <Power className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Remote Shutdown Button */}
                              {host.vendor !== 'Apple' && (
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Are you sure you want to attempt remote shutdown for ${host.ip}?`)) {
                                      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                                        wsRef.current.send(JSON.stringify({ action: 'net_shutdown', ip: host.ip }));
                                      }
                                    }
                                  }}
                                  title={`Remote Shutdown ${host.ip} (Windows only)`}
                                  className="p-1 rounded text-gray-400 hover:text-rose-500 hover:bg-[#2a2a2e] transition-colors cursor-pointer"
                                >
                                  <PowerOff className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Add Session Button */}
                              {onAddSession && (
                                <button
                                  onClick={() => onAddSession({
                                    name: host.hostname || host.ip,
                                    host: host.ip,
                                    port: 22,
                                    type: 'SSH',
                                    username: host.vendor?.includes('Raspberry') ? 'pi' : 'root'
                                  })}
                                  title="Save to Sessions list"
                                  className="p-1 rounded text-gray-400 hover:text-sky-400 hover:bg-[#2a2a2e] transition-colors cursor-pointer"
                                >
                                  <FolderPlus className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        
        {/* -------------------- TOOL 0: SYSTEM DASHBOARD -------------------- */}
        <div className={`flex-1 flex-col h-full overflow-y-auto bg-[#1e1e1e] p-6 ${activeTool === 'dashboard' ? 'flex' : 'hidden'}`}>
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-gray-200">
            <Server className="w-5 h-5 text-purple-400" />
            Local System Dashboard
          </h2>
          
          {dashboardData ? (
            <div className="space-y-6 max-w-5xl">
              {/* CPU & RAM Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#252528] border border-[#333] rounded-lg p-4 shadow-sm flex flex-col gap-2">
                  <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-sky-400" />
                    CPU Usage
                  </div>
                  <div className="text-3xl font-light text-white">
                    {dashboardData.cpuUsage}%
                  </div>
                  <div className="w-full bg-[#1e1e1e] h-2 rounded-full mt-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${dashboardData.cpuUsage > 80 ? 'bg-red-500' : dashboardData.cpuUsage > 50 ? 'bg-yellow-500' : 'bg-sky-500'}`} 
                      style={{ width: `${dashboardData.cpuUsage}%` }}
                    />
                  </div>
                </div>

                <div className="bg-[#252528] border border-[#333] rounded-lg p-4 shadow-sm flex flex-col gap-2">
                  <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    RAM Usage
                  </div>
                  <div className="text-3xl font-light text-white">
                    {((dashboardData.usedMem) / (1024 * 1024 * 1024)).toFixed(1)} <span className="text-lg text-gray-500">/ {(dashboardData.totalMem / (1024 * 1024 * 1024)).toFixed(1)} GB</span>
                  </div>
                  <div className="w-full bg-[#1e1e1e] h-2 rounded-full mt-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${((dashboardData.usedMem / dashboardData.totalMem) * 100) > 80 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                      style={{ width: `${(dashboardData.usedMem / dashboardData.totalMem) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Listening Ports Table */}
              <div className="bg-[#252528] border border-[#333] rounded-lg shadow-sm flex flex-col overflow-hidden">
                <div className="p-3 border-b border-[#333] bg-[#2d2d30] font-semibold text-sm text-gray-200">
                  Active Listening Ports
                </div>
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#1e1e1e] text-gray-400">
                        <th className="p-2 font-medium border-b border-[#333]">Protocol</th>
                        <th className="p-2 font-medium border-b border-[#333]">Local Address</th>
                        <th className="p-2 font-medium border-b border-[#333]">State</th>
                        <th className="p-2 font-medium border-b border-[#333]">PID</th>
                        <th className="p-2 font-medium border-b border-[#333]">Process Name</th>
                        <th className="p-2 font-medium border-b border-[#333] text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.listeningPorts.map((port, i) => (
                        <tr key={i} className="border-b border-[#333] hover:bg-[#2d2d30]/50 transition-colors">
                          <td className="p-2 text-gray-300">{port.protocol}</td>
                          <td className="p-2 text-sky-300 font-mono text-xs">{port.address}</td>
                          <td className="p-2">
                            <span className="text-[10px] uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full">
                              {port.state}
                            </span>
                          </td>
                          <td className="p-2 text-gray-400 font-mono text-xs">{port.pid}</td>
                          <td className="p-2 text-purple-300 font-mono text-xs">{port.processName}</td>
                          <td className="p-2 text-right">
                            {port.pid && port.pid !== '0' && (
                              <button
                                onClick={() => {
                                  const p = port.address.split(':').pop() || '';
                                  setKillPrompt({ isOpen: true, pid: port.pid, port: p, protocol: port.protocol, processName: port.processName });
                                }}
                                className="px-2 py-1 bg-red-900/50 hover:bg-red-600 text-red-300 hover:text-white rounded border border-red-800 hover:border-red-500 text-xs transition-colors"
                                title="Kill Process"
                              >
                                Kill
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {dashboardData.listeningPorts.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-gray-500 italic">No listening ports detected or OS not fully supported.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
              Loading system metrics...
            </div>
          )}
        </div>

        {/* -------------------- TOOLS 2, 3, 4: PING, TRACEROUTE, PORTSCAN -------------------- */}
        <div className={`flex-1 flex-col h-full overflow-hidden ${activeTool !== 'ipscan' && activeTool !== 'dashboard' ? 'flex' : 'hidden'}`}>
            {/* Top Controls for Terminal Tools */}
            <div className="p-4 bg-[#252528] border-b border-[#333] flex flex-wrap gap-4 items-end">
              <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Target (IP or Domain)</label>
                <input
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="bg-[#1a1a1c] border border-[#3e3e42] focus:border-sky-500 rounded px-3 py-1.5 text-sm outline-none w-full"
                  placeholder="e.g., 1.1.1.1 or google.com"
                  disabled={isTermRunning}
                />
              </div>
              
              {activeTool === 'portscan' && (
                <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Ports (Comma separated)</label>
                  <input
                    type="text"
                    value={ports}
                    onChange={(e) => setPorts(e.target.value)}
                    className="bg-[#1a1a1c] border border-[#3e3e42] focus:border-sky-500 rounded px-3 py-1.5 text-sm outline-none w-full"
                    placeholder="21, 22, 80, 443..."
                    disabled={isTermRunning}
                  />
                </div>
              )}
              
              <div className="flex gap-2">
                {!isTermRunning ? (
                  <button
                    onClick={handleStartTermTool}
                    className="bg-sky-600 hover:bg-sky-500 text-white px-5 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Start
                  </button>
                ) : (
                  <button
                    onClick={handleStopTermTool}
                    className="bg-red-600 hover:bg-red-500 text-white px-5 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    Stop
                  </button>
                )}
              </div>
            </div>
            
            {/* Terminal Output */}
            <div className="flex-1 relative bg-[#18181b]">
              <div ref={containerRef} className="absolute inset-0 p-2" />
            </div>
          </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              id: 'ping',
              label: `Ping ${contextMenu.host.ip}`,
              icon: <Activity className="w-4 h-4 text-sky-400" />,
              action: () => {
                setTarget(contextMenu.host.ip);
                setActiveTool('ping');
              }
            },
            {
              id: 'traceroute',
              label: `Traceroute ${contextMenu.host.ip}`,
              icon: <Globe className="w-4 h-4 text-emerald-400" />,
              action: () => {
                setTarget(contextMenu.host.ip);
                setActiveTool('traceroute');
              }
            },
            {
              id: 'portscan',
              label: `Deep Port Scan`,
              icon: <Search className="w-4 h-4 text-amber-400" />,
              action: () => {
                setTarget(contextMenu.host.ip);
                setActiveTool('portscan');
              }
            },
            { separator: true, id: 's1', label: '' },
            {
              id: 'rename',
              label: 'Set Custom Name / Note',
              action: () => handleRename(contextMenu.host.mac)
            }
          ]}
        />
      )}

      {renamePrompt.isOpen && (
        <PromptModal
          isOpen={renamePrompt.isOpen}
          title="Set Custom Name / Note (leave empty to reset)"
          initialValue={renamePrompt.initialName}
          icon="edit"
          onClose={() => setRenamePrompt(prev => ({ ...prev, isOpen: false }))}
          onSubmit={submitRename}
        />
      )}

      {killPrompt && killPrompt.isOpen && (() => {
        const portInfo = getKnownPortInfo(killPrompt.port);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-[#1e1e1e] border border-[#333] rounded-lg shadow-xl w-full max-w-md overflow-hidden">
              <div className="p-4 border-b border-[#333] flex justify-between items-center bg-[#252528]">
                <h3 className="font-semibold text-gray-200 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  Kill Process: PID {killPrompt.pid}
                </h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="bg-[#2d2d30] p-3 rounded-lg border border-[#3e3e42]">
                  <p className="text-sm text-gray-300">
                    <span className="font-semibold text-sky-400">Port {killPrompt.port}</span> ({killPrompt.protocol})
                  </p>
                  <p className="text-lg font-bold text-white mt-1">
                    {portInfo.name.includes('Unknown') && killPrompt.processName !== 'Unknown' 
                      ? `${killPrompt.processName} (โปรแกรมที่กำลังทำงานอยู่)` 
                      : portInfo.name}
                  </p>
                </div>
                
                <div className={`p-3 rounded-lg border text-sm ${
                  portInfo.critical 
                    ? 'bg-red-950/30 border-red-900 text-red-200' 
                    : 'bg-yellow-950/30 border-yellow-900 text-yellow-200'
                }`}>
                  <p className="font-semibold mb-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> 
                    Impact of Killing:
                  </p>
                  <p className="opacity-90 leading-relaxed">
                    {portInfo.name.includes('Unknown') && killPrompt.processName !== 'Unknown' 
                      ? `โพรเซสนี้ถูกสร้างโดยโปรแกรม ${killPrompt.processName} การบังคับปิดอาจทำให้โปรแกรมดังกล่าวทำงานผิดพลาด หรือแครช (Crash) ได้`
                      : portInfo.impact}
                  </p>
                </div>

                <p className="text-sm text-gray-400">
                  คุณแน่ใจหรือไม่ว่าต้องการบังคับปิดโพรเซสนี้? ข้อมูลใดๆ ที่ยังไม่ได้บันทึกภายในโพรเซสนี้อาจสูญหายได้ (Any unsaved data will be lost)
                </p>
              </div>
              <div className="p-4 bg-[#252528] border-t border-[#333] flex justify-end gap-2">
                <button
                  onClick={() => setKillPrompt(null)}
                  className="px-4 py-2 text-sm bg-transparent hover:bg-[#333] text-gray-300 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({ action: 'kill_process', pid: killPrompt.pid }));
                    }
                    setKillPrompt(null);
                  }}
                  className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded transition-colors shadow-sm"
                >
                  Force Kill Process
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
