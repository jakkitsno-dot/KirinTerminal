import React, { useState, useEffect } from 'react';
import {
  Key,
  Radio,
  Monitor,
  Tv,
  Cable,
  Terminal,
  Layers,
  Check,
  X,
  Lock,
  Folder,
  RotateCw,
  ChevronDown,
  ChevronRight,
  Shield
} from 'lucide-react';
import { SessionConfig, SessionFolder, CredentialConfig } from '../types';

interface SessionModalProps {
  isOpen: boolean;
  folders: SessionFolder[];
  initialFolderId?: string | null;
  editingSession?: SessionConfig | null;
  credentials?: CredentialConfig[];
  onOpenCredentialManager?: () => void;
  onClose: () => void;
  onSaveSession: (session: SessionConfig) => void;
}

export const SessionModal: React.FC<SessionModalProps> = ({
  isOpen,
  folders,
  initialFolderId,
  editingSession,
  credentials = [],
  onOpenCredentialManager,
  onClose,
  onSaveSession
}) => {
  const [sessionType, setSessionType] = useState<SessionConfig['type']>('SSH');
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState<number>(22);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [useSavedCredential, setUseSavedCredential] = useState<boolean>(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [shellChoice, setShellChoice] = useState<'powershell.exe' | 'cmd.exe'>('powershell.exe');

  // Serial States
  const [serialPort, setSerialPort] = useState('COM1');
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [dataBits, setDataBits] = useState<number>(8);
  const [stopBits, setStopBits] = useState<number>(1);
  const [parity, setParity] = useState<'none' | 'even' | 'odd' | 'mark' | 'space'>('none');
  const [flowControl, setFlowControl] = useState<'none' | 'rtscts' | 'xonxoff'>('none');
  const [availablePorts, setAvailablePorts] = useState<Array<{ path: string; manufacturer?: string }>>([]);
  const [isLoadingPorts, setIsLoadingPorts] = useState(false);
  const [showAdvancedSerial, setShowAdvancedSerial] = useState(false);

  const fetchSerialPorts = () => {
    setIsLoadingPorts(true);
    const ws = new WebSocket('ws://127.0.0.1:9292');
    ws.onopen = () => {
      ws.send(JSON.stringify({ action: 'serial_list' }));
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.action === 'serial_list_result') {
          const ports = data.ports || [];
          setAvailablePorts(ports);
          if (ports.length > 0 && (!serialPort || serialPort === 'COM1')) {
            setSerialPort(ports[0].path);
          }
          setIsLoadingPorts(false);
          ws.close();
        }
      } catch (e) {
        setIsLoadingPorts(false);
      }
    };
    ws.onerror = () => {
      setIsLoadingPorts(false);
    };
  };

  // WSL States
  const [wslDistro, setWslDistro] = useState('default');
  const [availableDistros, setAvailableDistros] = useState<string[]>([]);
  const [isLoadingDistros, setIsLoadingDistros] = useState(false);

  // RDP States
  const [rdpResolution, setRdpResolution] = useState('1920x1080');
  const [rdpFullscreen, setRdpFullscreen] = useState(false);
  const [rdpAdmin, setRdpAdmin] = useState(false);

  const fetchWslDistros = () => {
    setIsLoadingDistros(true);
    const ws = new WebSocket('ws://127.0.0.1:9292');
    ws.onopen = () => {
      ws.send(JSON.stringify({ action: 'wsl_list' }));
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.action === 'wsl_list_result') {
          const distros = data.distros || [];
          setAvailableDistros(distros);
          setIsLoadingDistros(false);
          ws.close();
        }
      } catch (e) {
        setIsLoadingDistros(false);
      }
    };
    ws.onerror = () => {
      setIsLoadingDistros(false);
    };
  };

  useEffect(() => {
    if (isOpen && sessionType === 'WSL') {
      fetchWslDistros();
    }
  }, [isOpen, sessionType]);

  useEffect(() => {
    if (isOpen && sessionType === 'Serial') {
      fetchSerialPorts();
    }
  }, [isOpen, sessionType]);

  // Appearance States
  const [theme, setTheme] = useState('mobaxterm');
  const [envColor, setEnvColor] = useState('default');
  const [fontSize, setFontSize] = useState<number>(14);
  const [fontFamily, setFontFamily] = useState('Consolas, "Courier New", monospace');

  useEffect(() => {
    if (editingSession) {
      setSessionType(editingSession.type);
      setName(editingSession.name);
      setHost(editingSession.host || '');
      setPort(editingSession.port || 22);
      setUsername(editingSession.username || '');
      setPassword(editingSession.password || '');
      setPrivateKey(editingSession.privateKey || '');
      setCredentialId(editingSession.credentialId || null);
      setUseSavedCredential(!!editingSession.credentialId);
      setFolderId(editingSession.folderId || null);
      if (editingSession.shellType) setShellChoice(editingSession.shellType as any);
      if (editingSession.serialPort) setSerialPort(editingSession.serialPort);
      if (editingSession.baudRate) setBaudRate(editingSession.baudRate);
      if (editingSession.dataBits) setDataBits(editingSession.dataBits);
      if (editingSession.stopBits) setStopBits(editingSession.stopBits);
      if (editingSession.parity) setParity(editingSession.parity as any);
      if (editingSession.flowControl) setFlowControl(editingSession.flowControl as any);
      if (editingSession.wslDistro) setWslDistro(editingSession.wslDistro);
      if (editingSession.rdpResolution) setRdpResolution(editingSession.rdpResolution);
      if (editingSession.rdpFullscreen !== undefined) setRdpFullscreen(editingSession.rdpFullscreen);
      if (editingSession.rdpAdmin !== undefined) setRdpAdmin(editingSession.rdpAdmin);
      if (editingSession.theme) setTheme(editingSession.theme);
      if (editingSession.envColor) setEnvColor(editingSession.envColor);
      if (editingSession.fontSize) setFontSize(editingSession.fontSize);
      if (editingSession.fontFamily) setFontFamily(editingSession.fontFamily);
    } else {
      setSessionType('SSH');
      setName('');
      setHost('');
      setPort(22);
      setUsername('');
      setPassword('');
      setPrivateKey('');
      setCredentialId(null);
      setUseSavedCredential(false);
      setFolderId(initialFolderId || null);
      setSerialPort('COM1');
      setBaudRate(115200);
      setDataBits(8);
      setStopBits(1);
      setParity('none');
      setFlowControl('none');
      setWslDistro('default');
      setRdpResolution('1920x1080');
      setRdpFullscreen(false);
      setRdpAdmin(false);
      setTheme('mobaxterm');
      setFontSize(14);
      setFontFamily('Consolas, "Courier New", monospace');
    }
  }, [editingSession, initialFolderId, isOpen]);

  // Auto-select latest credential if in saved mode and none selected yet
  useEffect(() => {
    if (useSavedCredential && !credentialId && credentials.length > 0) {
      setCredentialId(credentials[credentials.length - 1].id);
    }
  }, [credentials, useSavedCredential, credentialId]);

  if (!isOpen) return null;

  const sessionTypes = [
    { type: 'SSH' as const, label: 'SSH', icon: <Key className="w-5 h-5 text-yellow-400" /> },
    { type: 'Telnet' as const, label: 'Telnet', icon: <Radio className="w-5 h-5 text-purple-400" /> },
    { type: 'RDP' as const, label: 'RDP', icon: <Monitor className="w-5 h-5 text-sky-400" /> },
    { type: 'VNC' as const, label: 'VNC', icon: <Tv className="w-5 h-5 text-emerald-400" /> },
    { type: 'Serial' as const, label: 'Serial', icon: <Cable className="w-5 h-5 text-orange-400" /> },
    { type: 'Shell' as const, label: 'Shell', icon: <Terminal className="w-5 h-5 text-gray-300" /> },
    { type: 'WSL' as const, label: 'WSL', icon: <Layers className="w-5 h-5 text-blue-400" /> },
  ];

  const handleSave = () => {
    const sessionName = name.trim() || 
      (sessionType === 'Serial' ? `Serial ${serialPort} (${baudRate})` : 
      (sessionType === 'WSL' ? `WSL: ${wslDistro || 'Default'}` :
      (host.trim() || (sessionType === 'Shell' ? shellChoice : `${sessionType} Session`))));

    const selectedCred = useSavedCredential && credentialId ? credentials.find(c => c.id === credentialId) : null;

    const newSession: SessionConfig = {
      id: editingSession ? editingSession.id : Date.now().toString(),
      name: sessionName,
      type: sessionType,
      host: host.trim() || undefined,
      port: port || (sessionType === 'SSH' ? 22 : sessionType === 'Telnet' ? 23 : sessionType === 'RDP' ? 3389 : sessionType === 'VNC' ? 5900 : 22),
      username: selectedCred ? (selectedCred.username || username.trim() || undefined) : (username.trim() || undefined),
      password: useSavedCredential ? undefined : (password || undefined),
      privateKey: useSavedCredential ? undefined : (privateKey.trim() || undefined),
      credentialId: useSavedCredential ? credentialId : undefined,
      shellType: sessionType === 'Shell' ? shellChoice : undefined,
      wslDistro: sessionType === 'WSL' ? wslDistro : undefined,
      rdpResolution: sessionType === 'RDP' ? rdpResolution : undefined,
      rdpFullscreen: sessionType === 'RDP' ? rdpFullscreen : undefined,
      rdpAdmin: sessionType === 'RDP' ? rdpAdmin : undefined,
      serialPort: sessionType === 'Serial' ? serialPort : undefined,
      baudRate: sessionType === 'Serial' ? baudRate : undefined,
      dataBits: sessionType === 'Serial' ? (dataBits as 8 | 7 | 6 | 5) : undefined,
      stopBits: sessionType === 'Serial' ? (stopBits as 1 | 2) : undefined,
      parity: sessionType === 'Serial' ? parity : undefined,
      flowControl: sessionType === 'Serial' ? flowControl : undefined,
      theme,
      envColor: envColor === 'default' ? undefined : envColor,
      fontSize,
      fontFamily,
      folderId: folderId || null,
      lastUsed: new Date().toLocaleDateString()
    };
    onSaveSession(newSession);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs select-none">
      <div className="w-full max-w-2xl bg-[#1e1e20] border border-[#3e3e42] rounded-md shadow-2xl overflow-hidden flex flex-col text-gray-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#252528] border-b border-[#333336]">
          <span className="text-sm font-semibold text-gray-200">
            {editingSession ? 'Edit session settings' : 'Session settings'}
          </span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#38383c] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Session Types Picker */}
        <div className="p-4 border-b border-[#2d2d30] bg-[#1a1a1c]">
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {sessionTypes.map((item) => (
              <button
                key={item.type}
                onClick={() => {
                  setSessionType(item.type);
                  if (item.type === 'SSH') setPort(22);
                  if (item.type === 'Telnet') setPort(23);
                  if (item.type === 'RDP') setPort(3389);
                  if (item.type === 'VNC') setPort(5900);
                }}
                className={`flex flex-col items-center justify-center w-16 h-16 rounded border transition-all cursor-pointer ${
                  sessionType === item.type
                    ? 'bg-[#2b2b30] border-[#007acc] text-white shadow'
                    : 'bg-[#222225] border-[#38383c] text-gray-400 hover:bg-[#28282c] hover:text-gray-200'
                }`}
              >
                {item.icon}
                <span className="text-[11px] mt-1 font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {sessionType === 'Shell' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  Shell Type
                </label>
                <select
                  value={shellChoice}
                  onChange={(e) => setShellChoice(e.target.value as any)}
                  className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                >
                  <option value="powershell.exe">Windows PowerShell</option>
                  <option value="cmd.exe">Command Prompt (cmd.exe)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  Session Display Name (optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Local Terminal"
                  className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                />
              </div>
            </div>
          ) : sessionType === 'Serial' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-gray-400">
                      Serial Port (COM) *
                    </label>
                    <button
                      type="button"
                      onClick={fetchSerialPorts}
                      disabled={isLoadingPorts}
                      className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="Scan for connected COM ports"
                    >
                      <RotateCw className={`w-3 h-3 ${isLoadingPorts ? 'animate-spin' : ''}`} />
                      <span>Rescan</span>
                    </button>
                  </div>
                  
                  {availablePorts.length > 0 ? (
                    <select
                      value={serialPort}
                      onChange={(e) => setSerialPort(e.target.value)}
                      className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                    >
                      {availablePorts.map((p) => (
                        <option key={p.path} value={p.path}>
                          {p.path} {p.manufacturer ? `(${p.manufacturer})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={serialPort}
                      onChange={(e) => setSerialPort(e.target.value)}
                      placeholder="e.g. COM1 or COM3"
                      className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none font-mono"
                    />
                  )}
                  <p className="text-[10px] text-gray-500 mt-1">
                    {availablePorts.length > 0
                      ? `${availablePorts.length} COM port(s) detected`
                      : 'No active COM ports detected. Type COM port manually or plug in your USB cable and click Rescan.'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Speed (Baud rate)
                  </label>
                  <select
                    value={baudRate}
                    onChange={(e) => setBaudRate(Number(e.target.value))}
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                  >
                    <option value={115200}>115200 (Default for ESP32 / Modern)</option>
                    <option value={9600}>9600 (Standard for Arduino / Cisco)</option>
                    <option value={57600}>57600</option>
                    <option value={38400}>38400</option>
                    <option value={19200}>19200</option>
                    <option value={14400}>14400</option>
                    <option value={4800}>4800</option>
                    <option value={2400}>2400</option>
                    <option value={1200}>1200</option>
                  </select>
                </div>
              </div>

              {/* Advanced Settings Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedSerial(!showAdvancedSerial)}
                  className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1 cursor-pointer font-medium"
                >
                  {showAdvancedSerial ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <span>Advanced Serial Settings (Data bits, Parity, Stop bits)</span>
                </button>

                {showAdvancedSerial && (
                  <div className="mt-3 p-3 bg-[#161618] border border-[#2d2d30] rounded-md grid grid-cols-2 md:grid-cols-4 gap-3 animate-in fade-in duration-100">
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">Data Bits</label>
                      <select
                        value={dataBits}
                        onChange={(e) => setDataBits(Number(e.target.value))}
                        className="w-full bg-[#141416] border border-[#3e3e42] text-xs text-gray-200 px-2 py-1.5 rounded outline-none"
                      >
                        <option value={8}>8</option>
                        <option value={7}>7</option>
                        <option value={6}>6</option>
                        <option value={5}>5</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">Stop Bits</label>
                      <select
                        value={stopBits}
                        onChange={(e) => setStopBits(Number(e.target.value))}
                        className="w-full bg-[#141416] border border-[#3e3e42] text-xs text-gray-200 px-2 py-1.5 rounded outline-none"
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">Parity</label>
                      <select
                        value={parity}
                        onChange={(e) => setParity(e.target.value as any)}
                        className="w-full bg-[#141416] border border-[#3e3e42] text-xs text-gray-200 px-2 py-1.5 rounded outline-none"
                      >
                        <option value="none">None</option>
                        <option value="even">Even</option>
                        <option value="odd">Odd</option>
                        <option value="mark">Mark</option>
                        <option value="space">Space</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">Flow Control</label>
                      <select
                        value={flowControl}
                        onChange={(e) => setFlowControl(e.target.value as any)}
                        className="w-full bg-[#141416] border border-[#3e3e42] text-xs text-gray-200 px-2 py-1.5 rounded outline-none"
                      >
                        <option value="none">None</option>
                        <option value="rtscts">RTS/CTS</option>
                        <option value="xonxoff">XON/XOFF</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Name & Folder */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#2d2d30]">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Session Name (optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={`Serial ${serialPort} (${baudRate})`}
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1">
                    <Folder className="w-3 h-3 text-sky-400" />
                    <span>Save in folder</span>
                  </label>
                  <select
                    value={folderId || ''}
                    onChange={(e) => setFolderId(e.target.value || null)}
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                  >
                    <option value="">(Root)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : sessionType === 'WSL' ? (
            <div className="space-y-4">
              <div className="bg-[#17171a] border border-[#2d2d30] rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#262629]">
                  <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    <span>WSL Linux Distribution</span>
                  </label>
                  <button
                    type="button"
                    onClick={fetchWslDistros}
                    disabled={isLoadingDistros}
                    className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="Query installed distributions"
                  >
                    <RotateCw className={`w-3 h-3 ${isLoadingDistros ? 'animate-spin' : ''}`} />
                    <span>Scan Distros</span>
                  </button>
                </div>

                <div>
                  <select
                    value={wslDistro}
                    onChange={(e) => setWslDistro(e.target.value)}
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                  >
                    <option value="default">Default distribution (wsl.exe)</option>
                    {availableDistros.map((d) => (
                      <option key={d} value={d}>
                        🐧 {d}
                      </option>
                    ))}
                    {!availableDistros.includes('Ubuntu') && <option value="Ubuntu">Ubuntu</option>}
                    {!availableDistros.includes('Debian') && <option value="Debian">Debian</option>}
                    {!availableDistros.includes('kali-linux') && <option value="kali-linux">Kali Linux</option>}
                  </select>
                </div>
              </div>

              {/* Name & Folder */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Session Name (optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={`WSL: ${wslDistro || 'Default'}`}
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1">
                    <Folder className="w-3 h-3 text-sky-400" />
                    <span>Save in folder</span>
                  </label>
                  <select
                    value={folderId || ''}
                    onChange={(e) => setFolderId(e.target.value || null)}
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                  >
                    <option value="">User sessions (Root)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        📁 {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : sessionType === 'Telnet' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Telnet Host / IP *
                  </label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="e.g. 192.168.1.1, router.local, or bbs.telehack.com"
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                  />
                </div>
              </div>

              {/* Name & Folder */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Session Name (optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={host ? `Telnet ${host}` : 'Telnet Session'}
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1">
                    <Folder className="w-3 h-3 text-sky-400" />
                    <span>Save in folder</span>
                  </label>
                  <select
                    value={folderId || ''}
                    onChange={(e) => setFolderId(e.target.value || null)}
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                  >
                    <option value="">User sessions (Root)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        📁 {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : sessionType === 'RDP' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Remote Computer / Host *
                  </label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="e.g. 192.168.1.150 or win-server.local"
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  Username (optional)
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Administrator, user, etc."
                  className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                />
              </div>

              {/* RDP Display & Advanced Options */}
              <div className="bg-[#17171a] border border-[#2d2d30] rounded-md p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Screen Resolution</label>
                    <select
                      value={rdpResolution}
                      onChange={(e) => setRdpResolution(e.target.value)}
                      disabled={rdpFullscreen}
                      className="w-full bg-[#141416] border border-[#3e3e42] text-xs text-gray-200 px-2.5 py-1.5 rounded outline-none disabled:opacity-50"
                    >
                      <option value="1920x1080">1920 x 1080 (Full HD)</option>
                      <option value="1600x900">1600 x 900</option>
                      <option value="1366x768">1366 x 768</option>
                      <option value="1280x720">1280 x 720 (HD)</option>
                      <option value="2560x1440">2560 x 1440 (2K)</option>
                      <option value="3840x2160">3840 x 2160 (4K)</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-center space-y-1.5 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                      <input
                        type="checkbox"
                        checked={rdpFullscreen}
                        onChange={(e) => setRdpFullscreen(e.target.checked)}
                        className="accent-[#007acc]"
                      />
                      <span>Fullscreen mode (Multi-monitor)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                      <input
                        type="checkbox"
                        checked={rdpAdmin}
                        onChange={(e) => setRdpAdmin(e.target.checked)}
                        className="accent-[#007acc]"
                      />
                      <span>Connect to Console / Admin session (/admin)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Name & Folder */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Session Name (optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={host ? `RDP: ${host}` : 'Remote Desktop'}
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1">
                    <Folder className="w-3 h-3 text-sky-400" />
                    <span>Save in folder</span>
                  </label>
                  <select
                    value={folderId || ''}
                    onChange={(e) => setFolderId(e.target.value || null)}
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                  >
                    <option value="">User sessions (Root)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        📁 {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : sessionType === 'VNC' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    VNC Server Host *
                  </label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="e.g. 192.168.1.120"
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-gray-400" />
                  <span>VNC Password (optional)</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password if required by server"
                  className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                />
              </div>

              {/* Name & Folder */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Session Name (optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={host ? `VNC: ${host}` : 'VNC Session'}
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1">
                    <Folder className="w-3 h-3 text-sky-400" />
                    <span>Save in folder</span>
                  </label>
                  <select
                    value={folderId || ''}
                    onChange={(e) => setFolderId(e.target.value || null)}
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                  >
                    <option value="">User sessions (Root)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        📁 {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            /* SSH Session Form */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Remote host *
                  </label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="e.g. 192.168.1.100 or server.com"
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                  />
                </div>
              </div>

              {/* Credential Mode Selection */}
              <div className="bg-[#17171a] border border-[#2d2d30] rounded-md p-3 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#262629]">
                  <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <span>Credentials / Login Info</span>
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="cred_mode"
                        checked={!useSavedCredential}
                        onChange={() => setUseSavedCredential(false)}
                        className="accent-[#007acc] cursor-pointer"
                      />
                      <span className={!useSavedCredential ? 'text-gray-200 font-medium' : 'text-gray-500'}>
                        Direct Input
                      </span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="cred_mode"
                        checked={useSavedCredential}
                        onChange={() => {
                          setUseSavedCredential(true);
                          if (!credentialId && credentials.length > 0) {
                            setCredentialId(credentials[0].id);
                          }
                        }}
                        className="accent-[#007acc] cursor-pointer"
                      />
                      <span className={useSavedCredential ? 'text-amber-300 font-medium' : 'text-gray-500'}>
                        Use Saved Credential
                      </span>
                    </label>
                  </div>
                </div>

                {useSavedCredential ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <select
                          value={credentialId || ''}
                          onChange={(e) => setCredentialId(e.target.value || null)}
                          className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-xs px-2.5 py-1.5 rounded outline-none"
                        >
                          <option value="">-- Select a saved credential --</option>
                          {credentials.map((c) => (
                            <option key={c.id} value={c.id}>
                              🔑 {c.name} ({c.username}{c.password ? ' • pwd' : ''}{c.privateKey ? ' • key' : ''})
                            </option>
                          ))}
                        </select>
                      </div>
                      {onOpenCredentialManager && (
                        <button
                          type="button"
                          onClick={onOpenCredentialManager}
                          className="px-2.5 py-1.5 bg-[#252529] hover:bg-[#323238] text-amber-300 text-xs rounded border border-[#3e3e46] cursor-pointer flex items-center gap-1 whitespace-nowrap"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          <span>Manage Credentials</span>
                        </button>
                      )}
                    </div>

                    {credentialId && (() => {
                      const curCred = credentials.find((c) => c.id === credentialId);
                      if (!curCred) return null;
                      return (
                        <div className="text-[11px] bg-[#1f1f23] p-2 rounded border border-[#2e2e34] flex items-center justify-between text-gray-300">
                          <div className="flex items-center gap-3">
                            <span>Username: <strong className="text-amber-300 font-mono">{curCred.username}</strong></span>
                            {curCred.password && (
                              <span className="text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50">
                                🔒 Password
                              </span>
                            )}
                            {curCred.privateKey && (
                              <span className="text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/50">
                                🔑 SSH Key
                              </span>
                            )}
                          </div>
                          {curCred.description && (
                            <span className="text-gray-500 italic truncate max-w-[200px]">{curCred.description}</span>
                          )}
                        </div>
                      );
                    })()}

                    {credentials.length === 0 && (
                      <div className="text-xs text-amber-400/80 bg-amber-950/30 p-2 rounded border border-amber-800/40 flex items-center justify-between">
                        <span>No saved credentials yet. Create one in Credential Manager.</span>
                        {onOpenCredentialManager && (
                          <button
                            type="button"
                            onClick={onOpenCredentialManager}
                            className="underline text-amber-300 hover:text-amber-200 cursor-pointer text-xs ml-2"
                          >
                            + Create Now
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="root, ubuntu, etc."
                        className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-gray-400" />
                        <span>Password (optional)</span>
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Prompt on connect if empty"
                        className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Session Name (optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={host ? host : 'Session Name'}
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1">
                    <Folder className="w-3 h-3 text-sky-400" />
                    <span>Save in folder</span>
                  </label>
                  <select
                    value={folderId || ''}
                    onChange={(e) => setFolderId(e.target.value || null)}
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
                  >
                    <option value="">User sessions (Root)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        📁 {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Terminal Appearance (Applies to Terminal sessions) */}
          {(sessionType !== 'RDP' && sessionType !== 'VNC') && (
            <div className="pt-2">
              <div className="bg-[#17171a] border border-[#2d2d30] rounded-md p-3 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#262629]">
                  <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-sky-400" />
                    <span>Terminal Appearance (Optional)</span>
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Theme</label>
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-xs px-2.5 py-1.5 rounded outline-none"
                    >
                      <option value="mobaxterm">Kirin Dark (Default)</option>
                      <option value="dracula">Dracula</option>
                      <option value="monokai">Monokai</option>
                      <option value="solarized-dark">Solarized Dark</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Env Color</label>
                    <select
                      value={envColor}
                      onChange={(e) => setEnvColor(e.target.value)}
                      className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-xs px-2.5 py-1.5 rounded outline-none"
                    >
                      <option value="default">Default</option>
                      <option value="red">Production (Red)</option>
                      <option value="green">Development (Green)</option>
                      <option value="blue">Testing (Blue)</option>
                      <option value="purple">Staging (Purple)</option>
                      <option value="orange">Warning (Orange)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Font Size</label>
                    <input
                      type="number"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-xs px-2.5 py-1.5 rounded outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Font Family</label>
                    <input
                      type="text"
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                      className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-xs px-2.5 py-1.5 rounded outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Buttons */}
        <div className="flex items-center justify-end gap-3 px-6 py-3 bg-[#242426] border-t border-[#333336]">
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-1.5 bg-[#2d5a3c] hover:bg-[#346845] active:bg-[#3e7c53] text-white rounded border border-[#3d7a4f] text-xs font-medium cursor-pointer shadow"
          >
            <Check className="w-4 h-4 text-green-300" />
            <span>OK</span>
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-5 py-1.5 bg-[#4a2e2e] hover:bg-[#5a3838] active:bg-[#6c4343] text-white rounded border border-[#6b3e3e] text-xs font-medium cursor-pointer shadow"
          >
            <X className="w-4 h-4 text-red-300" />
            <span>Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
};
