import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { Copy, Clipboard, CheckSquare, Trash2, AlertTriangle, AlertCircle, X, UploadCloud, FileUp, CheckCircle, FileText, Cable, Zap, RefreshCw, Key, Layers, Radio, Terminal as TerminalIcon, Maximize2, Minimize2, Server, Cpu, Activity, Search, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { TabItem, GlobalSettings } from '../types';
import { THEME_COLORS } from '../utils/settings';

interface TerminalViewProps {
  tab: TabItem;
  isActive: boolean;
  onFocus?: () => void;
  isGridMode?: boolean;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  isVisible?: boolean;
  multiExecMode?: boolean;
  isMultiExecTarget?: boolean;
  onToggleMultiExecTarget?: (tabId: string) => void;
  onStatusChange?: (status: TabItem['status']) => void;
  onSftpReady?: (tabId: string) => void;
  settings?: GlobalSettings;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  tab,
  isActive,
  onFocus,
  isGridMode = false,
  isMaximized = false,
  onToggleMaximize,
  isVisible = false,
  multiExecMode = false,
  isMultiExecTarget = false,
  onToggleMultiExecTarget,
  onStatusChange,
  onSftpReady,
  settings
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const settingsRef = useRef(settings);
  const isMultiExecTargetRef = useRef(isMultiExecTarget);
  const multiExecModeRef = useRef(multiExecMode);
  const monitorIntervalRef = useRef<any>(null);

  useEffect(() => {
    isMultiExecTargetRef.current = isMultiExecTarget;
  }, [isMultiExecTarget]);

  useEffect(() => {
    multiExecModeRef.current = multiExecMode;
  }, [multiExecMode]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Terminal In-Session Search & Logging states
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isSearchOpen]);

  const handleFindNext = (termToSearch?: string) => {
    const q = termToSearch !== undefined ? termToSearch : searchTerm;
    if (!q || !searchAddonRef.current) return;
    searchAddonRef.current.findNext(q, {
      caseSensitive,
      wholeWord,
      regex: useRegex,
      incremental: false
    });
  };

  const handleFindPrevious = () => {
    if (!searchTerm || !searchAddonRef.current) return;
    searchAddonRef.current.findPrevious(searchTerm, {
      caseSensitive,
      wholeWord,
      regex: useRegex
    });
  };

  const handleSearchChange = (val: string) => {
    if (!searchAddonRef.current) return;
    if (!val) {
      searchAddonRef.current.clearDecorations?.();
      return;
    }
    searchAddonRef.current.findNext(val, {
      caseSensitive,
      wholeWord,
      regex: useRegex,
      incremental: true
    });
  };

  const handleSearchOptionToggle = (key: 'caseSensitive' | 'wholeWord' | 'regex') => {
    const newCase = key === 'caseSensitive' ? !caseSensitive : caseSensitive;
    const newWord = key === 'wholeWord' ? !wholeWord : wholeWord;
    const newRegex = key === 'regex' ? !useRegex : useRegex;

    if (key === 'caseSensitive') setCaseSensitive(newCase);
    if (key === 'wholeWord') setWholeWord(newWord);
    if (key === 'regex') setUseRegex(newRegex);

    if (searchTerm && searchAddonRef.current) {
      searchAddonRef.current.findNext(searchTerm, {
        caseSensitive: newCase,
        wholeWord: newWord,
        regex: newRegex,
        incremental: false
      });
    }
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    searchAddonRef.current?.clearDecorations?.();
    termRef.current?.focus();
  };

  const handleExportLog = () => {
    if (!termRef.current) return;
    const term = termRef.current;
    const buffer = term.buffer.active;
    const lines: string[] = [];
    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) {
        lines.push(line.translateToString(true));
      }
    }
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }
    const logContent = lines.join('\r\n');
    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeTitle = (tab.title || tab.host || 'terminal').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.href = url;
    a.download = `${safeTitle}_${timestamp}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Clipboard & Context menu states
  const [pasteConfirmText, setPasteConfirmText] = useState<string | null>(null);
  const [sshMonitorData, setSshMonitorData] = useState<{ cpu: string; ram: string; ramPercent: number; disk: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; hasSelection: boolean } | null>(null);

  // Drag & Drop File Upload states
  const [isDragOver, setIsDragOver] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[] | null>(null);
  const [remoteUploadPath, setRemoteUploadPath] = useState<string>('.');
  const [uploadProgress, setUploadProgress] = useState<{ fileName: string; percent: number; isUploading: boolean } | null>(null);
  const detectedCwdRef = useRef<string>('');

  // Serial Port Hardware Controls State
  const [dtrState, setDtrState] = useState(true);
  const [rtsState, setRtsState] = useState(true);
  const [serialNewline, setSerialNewline] = useState<'crlf' | 'cr' | 'lf'>('crlf');
  const [localEcho, setLocalEcho] = useState(false);
  const [isSerialConnected, setIsSerialConnected] = useState(false);

  const toggleDtr = () => {
    const next = !dtrState;
    setDtrState(next);
    wsRef.current?.send(JSON.stringify({ action: 'serial_set_signals', id: tab.id, dtr: next, rts: rtsState }));
  };

  const toggleRts = () => {
    const next = !rtsState;
    setRtsState(next);
    wsRef.current?.send(JSON.stringify({ action: 'serial_set_signals', id: tab.id, dtr: dtrState, rts: next }));
  };

  const sendSerialBreak = () => {
    wsRef.current?.send(JSON.stringify({ action: 'serial_send_break', id: tab.id }));
    termRef.current?.write('\r\n\x1b[33m[Sent Serial Break (250ms)]\x1b[0m\r\n');
  };

  const reconnectSerial = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    termRef.current?.write(`\r\n\x1b[36mReconnecting to Serial Port ${tab.serialPort || 'COM1'}...\x1b[0m\r\n`);
    wsRef.current.send(
      JSON.stringify({
        action: 'serial_connect',
        id: tab.id,
        portName: tab.serialPort || 'COM1',
        baudRate: tab.baudRate || 115200,
        dataBits: tab.dataBits || 8,
        stopBits: tab.stopBits || 1,
        parity: tab.parity || 'none',
        flowControl: tab.flowControl || 'none',
        title: tab.title,
        logConfig: settings?.general?.logConfig
      })
    );
  };

  const [isSshDisconnected, setIsSshDisconnected] = useState(false);

  const reconnectSsh = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setIsSshDisconnected(false);
    termRef.current?.write(`\r\n\x1b[36mReconnecting to ${tab.username || 'user'}@${tab.host}:${tab.port || 22}...\x1b[0m\r\n`);
    onStatusChange?.('connecting');
    const dims = fitAddonRef.current?.proposeDimensions();
    const cols = dims?.cols || 80;
    const rows = dims?.rows || 24;

    wsRef.current.send(
      JSON.stringify({
        action: 'ssh_connect',
        id: tab.id,
        host: tab.host,
        port: tab.port || 22,
        username: tab.username,
        password: tab.password,
        privateKey: tab.privateKey,
        cols,
        rows,
        title: tab.title,
        logConfig: settings?.general?.logConfig
      })
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Macro Playback State
  const macroPlaybackRef = useRef<{
    isActive: boolean;
    pendingChars: string[];
    waitForPrompt: boolean;
  }>({ isActive: false, pendingChars: [], waitForPrompt: false });
  const outputBufferRef = useRef<string>('');

  const executePaste = (text: string) => {
    if (!text) return;
    if (multiExecModeRef.current && isMultiExecTargetRef.current) {
      window.dispatchEvent(new CustomEvent('multiexec-input', { detail: text }));
    } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'input', id: tab.id, data: text }));
    }
  };

  const handlePasteRequest = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;

      const isMultiLine = text.includes('\n') || text.includes('\r');
      const shouldConfirm = (settingsRef.current?.terminal?.confirmBeforePaste ?? true) && isMultiLine;

      if (shouldConfirm) {
        setPasteConfirmText(text);
      } else {
        executePaste(text);
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  };

  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (!files || files.length === 0) return;

    if (tab.connectionType !== 'ssh') {
      // Local Terminal (PowerShell / CMD / WSL): paste full path directly
      const paths = files.map((f) => {
        const filePath = (f as any).path || f.name;
        return filePath.includes(' ') ? `"${filePath}"` : filePath;
      }).join(' ');
      executePaste(paths + ' ');
      termRef.current?.focus();
    } else {
      // SSH Terminal: Show Confirm Upload Dialog (Option 1)
      setDroppedFiles(files);
      const autoPath = detectedCwdRef.current || (window as any)._sftpCurrentPaths?.[tab.id] || '.';
      setRemoteUploadPath(autoPath);

      // Query realpath from server to resolve '~' or relative '.' to absolute server path
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'sftp_realpath', id: tab.id, path: autoPath }));
      }
    }
  };

  const handleConfirmUpload = () => {
    if (!droppedFiles || droppedFiles.length === 0 || !wsRef.current) return;
    
    let targetDir = remoteUploadPath.trim() || '.';
    if (targetDir.endsWith('/') && targetDir.length > 1) {
      targetDir = targetDir.slice(0, -1);
    }

    droppedFiles.forEach((file) => {
      const fileName = file.name;
      const remotePath = targetDir === '.' ? fileName : `${targetDir}/${fileName}`;
      const localPath = (file as any).path;

      if (localPath) {
        // High-speed direct streaming upload via node-pty / ssh2 fastPut
        setUploadProgress({ fileName, percent: 0, isUploading: true });
        wsRef.current?.send(
          JSON.stringify({
            action: 'sftp_upload',
            id: tab.id,
            localPath,
            remotePath
          })
        );
      } else {
        // Fallback for browser FileReader Base64
        setUploadProgress({ fileName, percent: 0, isUploading: true });
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.includes(',') ? result.split(',')[1] : result;
          wsRef.current?.send(
            JSON.stringify({
              action: 'sftp_upload_buffer',
              id: tab.id,
              remotePath,
              fileDataBase64: base64
            })
          );
        };
        reader.readAsDataURL(file);
      }
    });

    setDroppedFiles(null);
  };

  const handlePastePathOnly = () => {
    if (!droppedFiles) return;
    const paths = droppedFiles.map((f) => {
      const filePath = (f as any).path || f.name;
      return filePath.includes(' ') ? `"${filePath}"` : filePath;
    }).join(' ');
    executePaste(paths + ' ');
    setDroppedFiles(null);
    termRef.current?.focus();
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const termSettings = settings?.terminal;
    const resolvedThemeStr = tab.theme || termSettings?.theme || 'mobaxterm';
    const themeColors = THEME_COLORS[resolvedThemeStr as keyof typeof THEME_COLORS] || THEME_COLORS['mobaxterm'];

    const isSerial = tab.connectionType === 'serial';
    const term = new XTerm({
      convertEol: isSerial,
      scrollback: 10000,
      scrollSensitivity: 1,
      fastScrollSensitivity: 5,
      cursorBlink: termSettings?.cursorBlink ?? true,
      cursorStyle: termSettings?.cursorStyle ?? 'block',
      fontFamily: tab.fontFamily || termSettings?.fontFamily || 'Consolas, "Courier New", monospace, "Segoe UI Emoji"',
      fontSize: tab.fontSize || termSettings?.fontSize || 14,
      lineHeight: 1.2,
      theme: themeColors
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);
    searchAddonRef.current = searchAddon;
    term.open(containerRef.current);

    // Custom Key Event Handler for Tab, Ctrl+C, Ctrl+V, Shift+Insert, Ctrl+F
    term.attachCustomKeyEventHandler((arg: KeyboardEvent) => {
      if (arg.type === 'keydown') {
        // Ctrl+F: open in-terminal search
        if (arg.ctrlKey && !arg.shiftKey && !arg.altKey && arg.key.toLowerCase() === 'f') {
          arg.preventDefault();
          setIsSearchOpen(true);
          return false;
        }

        // Ctrl+C: copy if text is selected, else pass through to process (SIGINT)
        if (arg.ctrlKey && !arg.shiftKey && !arg.altKey && arg.key.toLowerCase() === 'c') {
          if (term.hasSelection()) {
            navigator.clipboard.writeText(term.getSelection());
            return false;
          }
          return true;
        }

        // Ctrl+V or Shift+Insert: paste from clipboard
        if ((arg.ctrlKey && !arg.shiftKey && !arg.altKey && arg.key.toLowerCase() === 'v') || (arg.shiftKey && arg.key === 'Insert')) {
          arg.preventDefault(); // Prevent native browser paste which causes double paste!
          handlePasteRequest();
          return false;
        }

        // We let Tab be handled naturally by xterm.js which correctly sends \t
        if (arg.key === 'Tab') {
          return true;
        }
      }
      return true;
    });

    // Copy on Select (MobaXterm style)
    term.onSelectionChange(() => {
      if (settingsRef.current?.terminal?.copyOnSelect && term.hasSelection()) {
        const sel = term.getSelection();
        if (sel && sel.trim().length > 0) {
          navigator.clipboard.writeText(sel).catch(() => {});
        }
      }
    });

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    fitAddon.fit();

    // Connect to WebSocket PTY/SSH Server
    const ws = new WebSocket('ws://127.0.0.1:9292');
    wsRef.current = ws;

    ws.onopen = () => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      const cols = dims?.cols || 80;
      const rows = dims?.rows || 24;

      if (tab.connectionType === 'ssh') {
        term.write(`\x1b[36mConnecting to ${tab.username || 'user'}@${tab.host}:${tab.port || 22}...\x1b[0m\r\n`);
        onStatusChange?.('connecting');

        ws.send(
          JSON.stringify({
            action: 'ssh_connect',
            id: tab.id,
            host: tab.host,
            port: tab.port || 22,
            username: tab.username,
            password: tab.password,
            privateKey: tab.privateKey,
            cols,
            rows,
            title: tab.title,
            logConfig: settings?.general?.logConfig
          })
        );
        
        // Start monitoring after giving it a few seconds to connect
        setTimeout(() => {
          monitorIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ action: 'ssh_monitor', id: tab.id }));
            }
          }, 3000);
        }, 3000);
        
      } else if (tab.connectionType === 'serial') {
        term.write(`\x1b[36mOpening Serial Port ${tab.serialPort || 'COM1'} (${tab.baudRate || 115200} baud)...\x1b[0m\r\n`);
        onStatusChange?.('connecting');

        ws.send(
          JSON.stringify({
            action: 'serial_connect',
            id: tab.id,
            portName: tab.serialPort || 'COM1',
            baudRate: tab.baudRate || 115200,
            dataBits: tab.dataBits || 8,
            stopBits: tab.stopBits || 1,
            parity: tab.parity || 'none',
            flowControl: tab.flowControl || 'none',
            title: tab.title,
            logConfig: settings?.general?.logConfig
          })
        );
      } else if (tab.connectionType === 'telnet') {
        term.write(`\x1b[36mConnecting to Telnet server ${tab.host}:${tab.port || 23}...\x1b[0m\r\n`);
        onStatusChange?.('connecting');

        ws.send(
          JSON.stringify({
            action: 'telnet_connect',
            id: tab.id,
            host: tab.host,
            port: tab.port || 23,
            cols,
            rows,
            title: tab.title,
            logConfig: settings?.general?.logConfig
          })
        );
      } else if (tab.connectionType === 'wsl') {
        term.write(`\x1b[36mStarting WSL (${tab.wslDistro || 'Default distribution'})...\x1b[0m\r\n`);
        ws.send(
          JSON.stringify({
            action: 'wsl_spawn',
            id: tab.id,
            distro: tab.wslDistro,
            cols,
            rows,
            cwd: tab.cwd,
            title: tab.title,
            logConfig: settings?.general?.logConfig
          })
        );
        onStatusChange?.('connected');
      } else {
        // Local Terminal (PowerShell / CMD)
        ws.send(
          JSON.stringify({
            action: 'spawn',
            id: tab.id,
            shell: tab.shell || 'powershell.exe',
            cols,
            rows,
            cwd: tab.cwd,
            title: tab.title,
            logConfig: settings?.general?.logConfig
          })
        );
        onStatusChange?.('connected');
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.id !== tab.id) return;

        if (msg.action === 'output') {
          term.write(msg.data);

          // Detect current working directory from shell prompt:
          // e.g. "girafeadmin@db-postgres:~/New_Folder$ " -> "~/New_Folder"
          // e.g. "root@ubuntu:/var/www/html# " -> "/var/www/html"
          const cleanChunk = msg.data.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
          const promptMatch = cleanChunk.match(/[:\s]([~/\w\.-]+)\s*[\$#%>\u279c\]]\s*$/);
          if (promptMatch && promptMatch[1]) {
            detectedCwdRef.current = promptMatch[1];
          }

          // Expect Logic: if we are waiting for a prompt during Macro playback
          const mState = macroPlaybackRef.current;
          if (mState.isActive && mState.waitForPrompt) {
            outputBufferRef.current += msg.data;
            if (outputBufferRef.current.length > 1000) {
              outputBufferRef.current = outputBufferRef.current.slice(-1000);
            }

            // Strip ANSI codes for easier regex matching
            // Match typical ANSI escape sequences
            const plainText = outputBufferRef.current.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');

            // Detect typical shell prompts ending characters: >, $, #, %, ➜, ]
            // followed by optional spaces.
            if (/([>#\$%➜\]])\s*$/.test(plainText)) {
              mState.waitForPrompt = false;
              outputBufferRef.current = ''; // Reset for next wait
            }
          }
        } else if (msg.action === 'sftp_realpath_result') {
          if (msg.path) {
            setRemoteUploadPath(msg.path);
          }
        } else if (msg.action === 'sftp_upload_progress') {
          setUploadProgress({
            fileName: msg.remotePath.split('/').pop() || 'file',
            percent: msg.percent,
            isUploading: true
          });
        } else if (msg.action === 'sftp_upload_result') {
          if (msg.success) {
            term.write(`\r\n\x1b[32m✔ File uploaded successfully: ${msg.remotePath}\x1b[0m\r\n`);
            setUploadProgress({
              fileName: msg.remotePath.split('/').pop() || 'file',
              percent: 100,
              isUploading: false
            });
            setTimeout(() => setUploadProgress(null), 3000);
          } else {
            term.write(`\r\n\x1b[31m✘ Upload failed: ${msg.error}\x1b[0m\r\n`);
            setUploadProgress(null);
          }
        } else if (msg.action === 'ssh_ready') {
          term.write(`\r\n\x1b[32m✔ Connected to ${msg.host} successfully!\x1b[0m\r\n\r\n`);
          onStatusChange?.('connected');
          setIsSshDisconnected(false);
        } else if (msg.action === 'telnet_ready') {
          term.write(`\r\n\x1b[32m✔ Connected to Telnet ${msg.host}:${msg.port}!\x1b[0m\r\n\r\n`);
          onStatusChange?.('connected');
        } else if (msg.action === 'telnet_error') {
          term.write(`\r\n\x1b[31m[Telnet Error: ${msg.message}]\x1b[0m\r\n`);
          onStatusChange?.('error');
        } else if (msg.action === 'serial_ready') {
          term.write(`\r\n\x1b[32m✔ Connected to Serial Port ${msg.portName} (${msg.baudRate} baud)!\x1b[0m\r\n\r\n`);
          onStatusChange?.('connected');
          setIsSerialConnected(true);
        } else if (msg.action === 'serial_error') {
          term.write(`\r\n\x1b[31m[Serial Port Error: ${msg.message}]\x1b[0m\r\n`);
          onStatusChange?.('error');
          setIsSerialConnected(false);
        } else if (msg.action === 'sftp_ready') {
          onSftpReady?.(tab.id);
        } else if (msg.action === 'ssh_monitor_result') {
          setSshMonitorData({ cpu: msg.cpu, ram: msg.ram, ramPercent: msg.ramPercent, disk: msg.disk });
        } else if (msg.action === 'ssh_error') {
          term.write(`\r\n\x1b[31m[SSH Connection Failed: ${msg.message}]\x1b[0m\r\n`);
          onStatusChange?.('error');
          setIsSshDisconnected(true);
          setSshMonitorData(null);
        } else if (msg.action === 'ssh_closed') {
          term.write(`\r\n\x1b[33m[SSH Connection closed by remote host]\x1b[0m\r\n`);
          onStatusChange?.('disconnected');
          setIsSshDisconnected(true);
          setSshMonitorData(null);
        } else if (msg.action === 'exit') {
          term.write(`\r\n\x1b[33m[Session closed with exit code ${msg.code}]\x1b[0m\r\n`);
          onStatusChange?.('disconnected');
          setIsSerialConnected(false);
        }
      } catch (e) {
        console.error('Error handling WebSocket message in TerminalView:', e);
      }
    };

    ws.onerror = () => {
      term.write('\r\n\x1b[31m[Cannot connect to internal terminal service on ws://127.0.0.1:9292]\x1b[0m\r\n');
      onStatusChange?.('error');
      setIsSerialConnected(false);
    };

    term.onData((data) => {
      let payload = data;

      // Handle Serial Newline translation and Local Echo
      if (tab.connectionType === 'serial') {
        if (data === '\r') {
          if (serialNewline === 'crlf') payload = '\r\n';
          else if (serialNewline === 'lf') payload = '\n';
          else payload = '\r';
        }

        if (localEcho) {
          term.write(data === '\r' ? '\r\n' : data);
        }
      }

      // Broadcast for macro recording
      window.dispatchEvent(new CustomEvent('macro-record-input', { detail: { data: payload } }));

      // If multiExecMode is on and this terminal is a selected target, dispatch globally for OTHER terminals
      // but ALSO send directly to this terminal (so the "active" terminal never gets skipped)
      if (multiExecModeRef.current && isMultiExecTargetRef.current) {
        // Always send to self directly
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'input', id: tab.id, data: payload }));
        }
        // Dispatch for other terminals (they will check their own tab.id)
        window.dispatchEvent(new CustomEvent('multiexec-input', { detail: { data: payload, sourceId: tab.id } }));
      } else {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'input', id: tab.id, data: payload }));
        }
      }
    });

    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'resize', id: tab.id, cols, rows }));
      }
    });

    const handleResize = () => {
      if (fitAddonRef.current && containerRef.current && containerRef.current.clientHeight > 0) {
        try {
          fitAddonRef.current.fit();
        } catch (e) {}
      }
    };

    window.addEventListener('resize', handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current);
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'close', id: tab.id }));
      }
      ws.close();
      term.dispose();
    };
  }, [tab.id, tab.connectionType, tab.host, tab.port, tab.username, tab.password, tab.shell]);

  // Sync multiExecMode to window so the closure inside useEffect can read the latest value without remounting
  useEffect(() => {
    (window as any)._multiExecModeEnabled = multiExecMode;
  }, [multiExecMode]);

  // Dynamically update terminal settings when they change
  useEffect(() => {
    if (termRef.current && settings?.terminal) {
      const term = termRef.current;
      const ts = settings.terminal;
      term.options.cursorBlink = ts.cursorBlink;
      term.options.cursorStyle = ts.cursorStyle;
      term.options.fontFamily = tab.fontFamily || ts.fontFamily;
      term.options.fontSize = tab.fontSize || ts.fontSize;
      
      const resolvedThemeStr = tab.theme || ts.theme || 'mobaxterm';
      term.options.theme = THEME_COLORS[resolvedThemeStr as keyof typeof THEME_COLORS] || THEME_COLORS['mobaxterm'];
      
      // Force fit refresh immediately and after layout settles
      if (fitAddonRef.current && isVisible) {
        try {
          fitAddonRef.current.fit();
        } catch (e) {}
        setTimeout(() => {
          try {
            fitAddonRef.current?.fit();
          } catch (e) {}
        }, 50);
      }
    }
  }, [settings, isVisible, tab.theme, tab.fontSize, tab.fontFamily]);

  // MultiExec event listener
  useEffect(() => {
    const handleMultiExecInput = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail;
      const dataToSend = typeof detail === 'string' ? detail : detail?.data;
      const targetIds = detail?.targetIds as string[] | undefined;
      const sourceId = detail?.sourceId as string | undefined;

      // Skip if this event was dispatched by THIS terminal's own onData handler
      // (because we already sent it directly to avoid the active terminal being skipped)
      if (sourceId === tab.id) return;

      // Check if this terminal should receive this command:
      // - if targetIds is explicitly specified (e.g. from MultiExecutionBar): check if this terminal is in targetIds
      // - if no targetIds (e.g. from typing inside a terminal): check multiExecModeRef and isMultiExecTargetRef
      const shouldExecute = targetIds
        ? targetIds.includes(tab.id)
        : (multiExecModeRef.current && isMultiExecTargetRef.current);

      if (shouldExecute && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        let finalData = dataToSend;
        if (tab.connectionType === 'serial' && typeof dataToSend === 'string' && dataToSend.endsWith('\r')) {
          if (serialNewline === 'crlf') {
            finalData = dataToSend.slice(0, -1) + '\r\n';
          }
        }
        wsRef.current.send(JSON.stringify({ action: 'input', id: tab.id, data: finalData }));
      }
    };
    
    window.addEventListener('multiexec-input', handleMultiExecInput);
    return () => window.removeEventListener('multiexec-input', handleMultiExecInput);
  }, [isMultiExecTarget, tab.id, multiExecMode, serialNewline]);

  // Macro play event listener
  useEffect(() => {
    const handleMacroPlay = (e: Event) => {
      const customEvent = e as CustomEvent;
      const shouldExecuteMacro = isActive || (multiExecMode && isMultiExecTarget);
      if (shouldExecuteMacro && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const macroString = customEvent.detail.data;
        if (!macroString) return;

        macroPlaybackRef.current = {
          isActive: true,
          pendingChars: macroString.split(''),
          waitForPrompt: false
        };
        outputBufferRef.current = '';
        
        const interval = setInterval(() => {
          const state = macroPlaybackRef.current;
          
          if (!state.isActive || state.pendingChars.length === 0) {
            state.isActive = false;
            clearInterval(interval);
            return;
          }

          // If waiting for prompt, skip this tick
          if (state.waitForPrompt) return;

          const char = state.pendingChars.shift();
          
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ action: 'input', id: tab.id, data: char }));
          } else {
            state.isActive = false;
            clearInterval(interval);
            return;
          }

          // If we typed Enter, enter "Expect" wait state
          if (char === '\r' || char === '\n') {
            state.waitForPrompt = true;
            outputBufferRef.current = '';
            
            // Safety timeout: if prompt is not detected within 15 seconds, resume anyway
            setTimeout(() => {
              if (macroPlaybackRef.current.waitForPrompt) {
                macroPlaybackRef.current.waitForPrompt = false;
              }
            }, 15000);
          }
        }, 20); // 20ms typing speed
      }
    };
    
    window.addEventListener('macro-play', handleMacroPlay);
    return () => window.removeEventListener('macro-play', handleMacroPlay);
  }, [isActive, isVisible, multiExecMode, tab.id]);

  // Snippet execution event listener
  useEffect(() => {
    const handleExecuteSnippet = (e: Event) => {
      const customEvent = e as CustomEvent;
      const command = customEvent.detail;
      const shouldExecute = isActive || (multiExecMode && isMultiExecTarget);
      
      if (shouldExecute && wsRef.current && wsRef.current.readyState === WebSocket.OPEN && typeof command === 'string') {
        const payload = command + (tab.connectionType === 'serial' && serialNewline === 'crlf' ? '\r\n' : '\r');
        wsRef.current.send(JSON.stringify({ action: 'input', id: tab.id, data: payload }));
        
        // Show feedback locally
        if (termRef.current) {
          termRef.current.focus();
        }
      }
    };
    
    window.addEventListener('execute-snippet', handleExecuteSnippet);
    return () => window.removeEventListener('execute-snippet', handleExecuteSnippet);
  }, [isActive, isVisible, multiExecMode, tab.id, tab.connectionType, serialNewline]);

  // Fit again whenever tab becomes visible or maximized
  useEffect(() => {
    if (isVisible && fitAddonRef.current && containerRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
          if (isActive || isMaximized) termRef.current?.focus();
        } catch (e) {}
      }, 50);
    }
  }, [isVisible, isActive, isMaximized]);

  return (
    <div
      onMouseDown={() => {
        onFocus?.();
      }}
      className={`h-full w-full bg-[#121212] overflow-hidden flex flex-col transition-all duration-150 ${
        isVisible ? 'block' : 'hidden'
      } ${
        isMaximized
          ? 'shadow-2xl'
          : isGridMode
            ? isActive
              ? 'ring-2 ring-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.35)] z-10 relative'
              : multiExecMode && isMultiExecTarget
                ? 'ring-1 ring-purple-500/80 border border-purple-900/50 relative'
                : 'border border-[#2d2d30] opacity-90 hover:opacity-100 hover:border-gray-500 relative'
            : multiExecMode && isVisible
              ? isMultiExecTarget
                ? 'border-2 border-purple-500 shadow-[inset_0_0_12px_rgba(168,85,247,0.25)] relative'
                : 'border-2 border-[#383346]/60 opacity-85 relative'
              : 'relative'
      } ${
        tab.envColor === 'red' ? 'border-t-2 border-t-red-500' :
        tab.envColor === 'green' ? 'border-t-2 border-t-emerald-500' :
        tab.envColor === 'orange' ? 'border-t-2 border-t-orange-500' :
        tab.envColor === 'purple' ? 'border-t-2 border-t-purple-500' :
        tab.envColor === 'blue' ? 'border-t-2 border-t-blue-500' : ''
      }`}
      onContextMenu={(e) => {
        e.preventDefault();
        const action = settingsRef.current?.terminal?.rightClickAction || 'menu';
        if (action === 'paste') {
          handlePasteRequest();
        } else {
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            hasSelection: Boolean(termRef.current && termRef.current.hasSelection())
          });
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Grid Mode Header with IP & Status & Focus */}
      {isGridMode && (
        <div
          onClick={() => onFocus?.()}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onToggleMaximize?.();
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
          {/* Left: Status Dot + Icon + IP / Title */}
          <div className="flex items-center gap-2 truncate">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                tab.status === 'connected'
                  ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                  : tab.status === 'connecting'
                  ? 'bg-yellow-400 animate-pulse'
                  : tab.status === 'error'
                  ? 'bg-red-400'
                  : 'bg-gray-500'
              }`}
            />

            {tab.connectionType === 'ssh' ? (
              <Key className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            ) : tab.connectionType === 'serial' ? (
              <Cable className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            ) : tab.connectionType === 'wsl' ? (
              <Layers className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            ) : tab.connectionType === 'telnet' ? (
              <Radio className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            ) : (
              <TerminalIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}

            <span className="font-mono font-semibold truncate text-[11px]">
              {tab.host
                ? `${tab.username ? tab.username + '@' : ''}${tab.host}${tab.port && tab.port !== 22 ? ':' + tab.port : ''}`
                : tab.title}
            </span>
            {tab.title && tab.host && tab.title !== tab.host && (
              <span className="text-[10px] text-gray-400 truncate opacity-75 hidden sm:inline">
                ({tab.title})
              </span>
            )}

            {tab.envColor && tab.envColor !== 'default' && (
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                tab.envColor === 'red' ? 'bg-red-950 text-red-300 border border-red-800/80 shadow-[0_0_6px_rgba(239,68,68,0.3)]' :
                tab.envColor === 'green' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80' :
                tab.envColor === 'orange' ? 'bg-orange-950 text-orange-300 border border-orange-800/80' :
                tab.envColor === 'purple' ? 'bg-purple-950 text-purple-300 border border-purple-800/80' :
                'bg-blue-950 text-blue-300 border border-blue-800/80'
              }`}>
                {tab.envColor === 'red' ? 'PROD' : tab.envColor.toUpperCase()}
              </span>
            )}

            {isMaximized && (
              <span className="px-1.5 py-0.2 bg-sky-500/30 text-sky-200 border border-sky-400/50 rounded text-[9px] font-mono uppercase tracking-wider">
                Maximized
              </span>
            )}
          </div>

          {/* Right Controls: Reconnect Button + Multi-Exec Checkbox + Maximize/Restore Button */}
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {/* SSH Reconnect button if disconnected */}
            {tab.connectionType === 'ssh' && isSshDisconnected && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  reconnectSsh();
                }}
                className="px-2 py-0.5 bg-red-900/90 hover:bg-red-800 text-red-100 rounded text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors border border-red-700/80 shadow-xs"
                title="SSH connection lost. Click to reconnect."
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reconnect</span>
              </button>
            )}

            {/* Multi-Exec Checkbox */}
            {multiExecMode && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMultiExecTarget?.(tab.id);
                }}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-all ${
                  isMultiExecTarget
                    ? 'bg-purple-900/90 text-purple-100 border border-purple-500'
                    : 'bg-[#252230] text-gray-400 border border-[#3e384e] hover:text-gray-200'
                }`}
                title={isMultiExecTarget ? 'Click to exclude from Multi-Exec' : 'Click to include in Multi-Exec'}
              >
                <input
                  type="checkbox"
                  checked={isMultiExecTarget}
                  onChange={() => {}}
                  className="cursor-pointer accent-purple-500 w-3 h-3 pointer-events-none"
                />
                <span>Multi-Exec</span>
              </div>
            )}

            {/* Find in Terminal button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsSearchOpen(prev => !prev);
              }}
              className="p-1 hover:bg-white/10 text-gray-400 hover:text-white rounded transition-colors cursor-pointer"
              title="Find in Terminal (Ctrl+F)"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Export Terminal Log button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleExportLog();
              }}
              className="p-1 hover:bg-white/10 text-gray-400 hover:text-white rounded transition-colors cursor-pointer"
              title="Export Terminal Log (.log)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Maximize / Restore Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMaximize?.();
              }}
              className={`p-1 rounded transition-colors cursor-pointer flex items-center gap-1 text-[11px] ${
                isMaximized
                  ? 'bg-sky-600 hover:bg-sky-500 text-white font-semibold px-2 py-0.5 shadow-sm'
                  : 'hover:bg-white/10 text-gray-400 hover:text-white'
              }`}
              title={isMaximized ? 'Restore Grid View (Esc)' : 'Maximize this window for full monitoring (Double-click header)'}
            >
              {isMaximized ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Restore</span>
                </>
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Floating Tools in Single Terminal Mode (Multi-Exec / Search / Export Log) */}
      {!isGridMode && isVisible && (
        <div className="absolute top-2 right-4 z-20 flex items-center gap-1.5 select-none">
          {multiExecMode && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onToggleMultiExecTarget?.(tab.id);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer shadow-lg transition-all ${
                isMultiExecTarget
                  ? 'bg-purple-900/90 text-purple-100 border border-purple-500 hover:bg-purple-800'
                  : 'bg-[#22202a]/90 text-gray-400 border border-[#3e384e] hover:bg-[#2d2a38] hover:text-gray-200'
              }`}
              title={isMultiExecTarget ? 'Click to exclude this terminal from Multi-Exec' : 'Click to include this terminal in Multi-Exec'}
            >
              <input
                type="checkbox"
                checked={isMultiExecTarget}
                onChange={() => {}}
                className="cursor-pointer accent-purple-500 w-3.5 h-3.5 pointer-events-none"
              />
              <span>{isMultiExecTarget ? 'Multi-Exec: ON' : 'Multi-Exec: OFF'}</span>
            </div>
          )}

          <button
            onClick={() => setIsSearchOpen(prev => !prev)}
            className="p-1.5 bg-[#22202a]/85 hover:bg-[#32303e] border border-[#3e384e] text-gray-400 hover:text-white rounded shadow-md cursor-pointer transition-colors"
            title="Find in Terminal (Ctrl+F)"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleExportLog}
            className="p-1.5 bg-[#22202a]/85 hover:bg-[#32303e] border border-[#3e384e] text-gray-400 hover:text-white rounded shadow-md cursor-pointer transition-colors"
            title="Export Terminal Log (.log)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Floating In-Terminal Search Bar (Ctrl+F) */}
      {isSearchOpen && (
        <div className="absolute top-2 right-4 z-40 bg-[#1e1e22]/95 backdrop-blur-md border border-[#3e3e44] shadow-2xl rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-xs text-gray-200 animate-in fade-in slide-in-from-top-2 duration-150">
          <Search className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              handleSearchChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) handleFindPrevious();
                else handleFindNext();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                closeSearch();
              }
            }}
            placeholder="Find in terminal..."
            className="w-48 bg-[#141416] border border-[#3e3e42] focus:border-sky-500 rounded px-2 py-0.5 text-xs text-white placeholder:text-gray-500 outline-none"
          />

          {/* Previous Match */}
          <button
            onClick={handleFindPrevious}
            className="p-1 hover:bg-[#2d2d32] text-gray-400 hover:text-white rounded cursor-pointer"
            title="Previous Match (Shift+Enter)"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>

          {/* Next Match */}
          <button
            onClick={() => handleFindNext()}
            className="p-1 hover:bg-[#2d2d32] text-gray-400 hover:text-white rounded cursor-pointer"
            title="Next Match (Enter)"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-[#3e3e44] mx-0.5" />

          {/* Case Sensitive Toggle */}
          <button
            onClick={() => handleSearchOptionToggle('caseSensitive')}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors ${
              caseSensitive ? 'bg-sky-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#2d2d32]'
            }`}
            title="Match Case"
          >
            Aa
          </button>

          {/* Whole Word Toggle */}
          <button
            onClick={() => handleSearchOptionToggle('wholeWord')}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors ${
              wholeWord ? 'bg-sky-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#2d2d32]'
            }`}
            title="Match Whole Word"
          >
            \b
          </button>

          {/* Regex Toggle */}
          <button
            onClick={() => handleSearchOptionToggle('regex')}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors ${
              useRegex ? 'bg-sky-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#2d2d32]'
            }`}
            title="Use Regular Expression"
          >
            .*
          </button>

          <div className="w-[1px] h-4 bg-[#3e3e44] mx-0.5" />

          {/* Close button */}
          <button
            onClick={closeSearch}
            className="p-1 hover:bg-[#2d2d32] text-gray-400 hover:text-white rounded cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {/* Serial Hardware Control Bar (MobaXterm style) */}
      {tab.connectionType === 'serial' && (
        <div className="bg-[#1c1c1f] border-b border-[#2d2d32] px-3 py-1 flex items-center justify-between text-xs text-gray-300 z-10 shrink-0 select-none">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-semibold text-orange-400 bg-orange-950/40 px-2 py-0.5 rounded border border-orange-800/40 text-[11px]">
              <Cable className="w-3 h-3" />
              <span>{tab.serialPort || 'COM1'}</span>
              <span className="text-[10px] text-orange-300/70 font-mono font-normal">({tab.baudRate || 115200} bps)</span>
            </span>

            {/* DTR Toggle */}
            <button
              onClick={toggleDtr}
              className={`px-2 py-0.5 rounded border text-[10px] font-mono transition-colors cursor-pointer ${
                dtrState 
                  ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300 font-bold' 
                  : 'bg-[#252528] border-[#3e3e42] text-gray-500'
              }`}
              title="Toggle DTR signal (Data Terminal Ready). Toggling resets Arduino/ESP32 boards."
            >
              DTR: {dtrState ? 'ON' : 'OFF'}
            </button>

            {/* RTS Toggle */}
            <button
              onClick={toggleRts}
              className={`px-2 py-0.5 rounded border text-[10px] font-mono transition-colors cursor-pointer ${
                rtsState 
                  ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300 font-bold' 
                  : 'bg-[#252528] border-[#3e3e42] text-gray-500'
              }`}
              title="Toggle RTS signal (Ready To Send)"
            >
              RTS: {rtsState ? 'ON' : 'OFF'}
            </button>

            {/* Send Break */}
            <button
              onClick={sendSerialBreak}
              className="px-2 py-0.5 bg-[#252528] hover:bg-[#333336] active:bg-[#404045] rounded border border-[#3e3e42] text-[10px] text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
              title="Send 250ms Serial Break signal (used for Cisco ROMmon password recovery)"
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Break</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Newline Mode */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400">Newline:</span>
              <select
                value={serialNewline}
                onChange={(e) => setSerialNewline(e.target.value as any)}
                className="bg-[#141416] border border-[#3e3e42] text-gray-200 text-[10px] px-1.5 py-0.5 rounded outline-none"
              >
                <option value="crlf">CR+LF</option>
                <option value="cr">CR only</option>
                <option value="lf">LF only</option>
              </select>
            </div>

            {/* Local Echo */}
            <label className="flex items-center gap-1 cursor-pointer text-[10px] text-gray-400 hover:text-gray-200">
              <input
                type="checkbox"
                checked={localEcho}
                onChange={(e) => setLocalEcho(e.target.checked)}
                className="rounded border-[#3e3e42] bg-[#141416] text-blue-500 cursor-pointer"
              />
              <span>Echo</span>
            </label>

            {/* Reconnect Button */}
            <button
              onClick={reconnectSerial}
              className="px-2 py-0.5 bg-[#252528] hover:bg-[#333336] rounded border border-[#3e3e42] text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer transition-colors"
              title="Reconnect serial port after cable re-plugged"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reconnect</span>
            </button>
          </div>
        </div>
      )}

      {/* SSH Disconnected Warning & Reconnect Banner */}
      {tab.connectionType === 'ssh' && isSshDisconnected && (
        <div className="bg-red-950/90 border-b border-red-700/80 px-3 py-1.5 flex items-center justify-between text-xs text-red-200 select-none z-10 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
            <span>Connection to SSH server was disconnected or lost.</span>
          </div>
          <button
            onClick={reconnectSsh}
            className="px-2.5 py-0.5 bg-red-700 hover:bg-red-600 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reconnect Now</span>
          </button>
        </div>
      )}

      <div ref={containerRef} className="terminal-container w-full flex-1 min-h-0" />


      {/* Remote SSH Server Status Bar */}
      {tab.connectionType === 'ssh' && sshMonitorData && (
        <div className="h-6 shrink-0 bg-[#007acc] text-white flex items-center px-3 text-[11px] font-mono shadow-inner border-t border-[#005a9e] select-none justify-between animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 opacity-90">
              <Server className="w-3.5 h-3.5" /> Remote Server Status
            </span>
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 opacity-70" /> CPU: <span className="font-semibold">{sshMonitorData.cpu}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 opacity-70" /> RAM: <span className="font-semibold">{sshMonitorData.ramPercent}% ({sshMonitorData.ram})</span>
            </span>
          </div>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 opacity-70" /> Disk: <span className="font-semibold">{sshMonitorData.disk}</span>
            </span>
            <div className="flex items-center gap-2 w-32 shrink-0">
              <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${sshMonitorData.ramPercent > 80 ? 'bg-red-400' : 'bg-emerald-300'}`} 
                  style={{ width: `${sshMonitorData.ramPercent}%` }}
                />
              </div>
              <span className="opacity-80 w-6 text-right">{sshMonitorData.ramPercent}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Visual Drag & Drop Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-[200] bg-blue-950/75 border-2 border-dashed border-blue-400 backdrop-blur-xs flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-100">
          <div className="p-4 bg-blue-600/30 rounded-full mb-3 text-blue-300">
            <UploadCloud className="w-12 h-12 animate-bounce" />
          </div>
          <span className="text-sm font-semibold text-white tracking-wide">
            {tab.connectionType === 'ssh' ? 'Drop files here to upload via SFTP' : 'Drop files here to paste file path'}
          </span>
          <span className="text-xs text-blue-200/70 mt-1">
            {tab.connectionType === 'ssh' ? 'Files will be safely transferred to your remote server' : 'Full Windows paths will be inserted at cursor'}
          </span>
        </div>
      )}

      {/* Floating Upload Progress Indicator */}
      {uploadProgress && (
        <div className="absolute bottom-4 right-4 z-[220] bg-[#1e1e24] border border-[#3e3e46] rounded-lg shadow-2xl p-3 min-w-[280px] max-w-[360px] animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-1.5 truncate pr-2">
              {uploadProgress.percent === 100 ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <UploadCloud className="w-4 h-4 text-blue-400 animate-pulse shrink-0" />
              )}
              <span className="font-medium text-gray-200 truncate">{uploadProgress.fileName}</span>
            </div>
            <span className="font-mono text-[11px] text-gray-400 shrink-0">{uploadProgress.percent}%</span>
          </div>
          <div className="w-full bg-[#2d2d32] h-1.5 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-150 rounded-full ${
                uploadProgress.percent === 100 ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
              style={{ width: `${uploadProgress.percent}%` }}
            />
          </div>
          {uploadProgress.percent === 100 && (
            <div className="text-[11px] text-emerald-400 font-medium mt-1 text-right">
              Upload Complete!
            </div>
          )}
        </div>
      )}

      {/* Drag & Drop Confirm Upload Modal (Option 1: MobaXterm Style) */}
      {droppedFiles && droppedFiles.length > 0 && (
        <div 
          className="fixed inset-0 z-[310] bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setDroppedFiles(null)}
        >
          <div 
            className="bg-[#202023] border border-[#3e3e42] rounded-lg shadow-2xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#3e3e42] pb-3">
              <div className="flex items-center gap-2.5 text-blue-400 font-semibold text-sm">
                <UploadCloud className="w-5 h-5 text-blue-400" />
                <span>Upload to Remote Server (SFTP)</span>
              </div>
              <button 
                onClick={() => setDroppedFiles(null)}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#2d2d30] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-300">
              You dropped <span className="font-bold text-white">{droppedFiles.length} file{droppedFiles.length > 1 ? 's' : ''}</span> into the terminal session. Select how you want to proceed:
            </p>

            {/* File List Preview */}
            <div className="max-h-36 overflow-y-auto bg-black/50 border border-[#333] rounded p-2 space-y-1.5 custom-scrollbar">
              {droppedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs text-gray-300 bg-[#252528] px-2.5 py-1.5 rounded">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate font-mono">{file.name}</span>
                  </div>
                  <span className="text-[11px] text-gray-500 shrink-0 font-mono">
                    {formatFileSize(file.size)}
                  </span>
                </div>
              ))}
            </div>

            {/* Remote Destination Directory */}
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                Destination Directory on Server:
              </label>
              <input
                type="text"
                value={remoteUploadPath}
                onChange={(e) => setRemoteUploadPath(e.target.value)}
                placeholder=". (Current directory)"
                className="w-full bg-[#18181b] border border-[#3e3e42] text-gray-200 text-xs rounded px-3 py-2 outline-none focus:border-blue-500 font-mono"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Enter '.' for current/home folder or an absolute path (e.g. /tmp or /var/www)
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-[#333]">
              <button
                onClick={handlePastePathOnly}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-[#2d2d30] rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Paste local file path into terminal input instead of uploading"
              >
                <FileUp className="w-3.5 h-3.5" />
                Paste Path Only
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setDroppedFiles(null)}
                  className="px-3.5 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-[#333] rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmUpload}
                  className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium rounded shadow transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  Upload via SFTP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Context Menu (Centered as requested) */}
      {contextMenu && (
        <div
          className="fixed z-[250] bg-[#252528] border border-[#3e3e42] rounded shadow-2xl py-1 min-w-[200px] text-xs text-gray-200 select-none animate-in fade-in zoom-in-95 duration-75"
          style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              if (termRef.current) {
                const sel = termRef.current.getSelection();
                if (sel) navigator.clipboard.writeText(sel);
              }
              setContextMenu(null);
            }}
            disabled={!contextMenu.hasSelection}
            className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[#007acc] hover:text-white ${
              !contextMenu.hasSelection ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy</span>
            <span className="ml-auto text-[10px] text-gray-400">Ctrl+C</span>
          </button>

          <button
            onClick={() => {
              handlePasteRequest();
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[#007acc] hover:text-white cursor-pointer"
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span>Paste</span>
            <span className="ml-auto text-[10px] text-gray-400">Ctrl+V</span>
          </button>

          <div className="border-t border-[#3e3e42] my-1" />

          <button
            onClick={() => {
              setIsSearchOpen(true);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[#007acc] hover:text-white cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Find in Terminal...</span>
            <span className="ml-auto text-[10px] text-gray-400">Ctrl+F</span>
          </button>

          <button
            onClick={() => {
              handleExportLog();
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[#007acc] hover:text-white cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Log to File...</span>
          </button>

          <div className="border-t border-[#3e3e42] my-1" />

          <button
            onClick={() => {
              termRef.current?.selectAll();
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[#007acc] hover:text-white cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Select All</span>
            <span className="ml-auto text-[10px] text-gray-400">Ctrl+A</span>
          </button>

          <button
            onClick={() => {
              termRef.current?.clear();
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[#007acc] hover:text-white cursor-pointer text-red-400 hover:text-red-200"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Buffer</span>
          </button>
        </div>
      )}

      {/* Paste Confirmation Modal (MobaXterm style) */}
      {pasteConfirmText !== null && (
        <div 
          className="fixed inset-0 z-[300] bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setPasteConfirmText(null)}
        >
          <div 
            className="bg-[#202023] border border-[#3e3e42] rounded-lg shadow-2xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#3e3e42] pb-3">
              <div className="flex items-center gap-2.5 text-amber-400 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Confirm Multi-Line Paste</span>
              </div>
              <button 
                onClick={() => setPasteConfirmText(null)}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#2d2d30]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              You are about to paste <span className="font-bold text-amber-400">{pasteConfirmText.split(/\r\n|\r|\n/).length} lines</span> ({pasteConfirmText.length} characters) into the active terminal session.
            </p>

            <div className="relative">
              <textarea 
                className="w-full h-40 bg-black/60 border border-[#333] focus:border-blue-500 outline-none rounded p-3 text-xs font-mono text-gray-300 resize-none custom-scrollbar"
                value={pasteConfirmText}
                onChange={(e) => setPasteConfirmText(e.target.value)}
                spellCheck={false}
              />
              <button 
                onClick={() => {
                  const cleaned = pasteConfirmText
                    .split(/\r?\n/)
                    .map(line => line.trimEnd()) // Clear trailing spaces from every line
                    .join('\n')
                    .trim(); // Clear leading/trailing blank lines
                  setPasteConfirmText(cleaned);
                }}
                className="absolute top-2 right-2 px-2 py-1 bg-[#333] hover:bg-[#444] text-[10px] text-gray-300 rounded shadow border border-[#444] transition-colors"
                title="Remove empty spaces at the end of each line, and clear blank lines at start/end"
              >
                Trim Spaces
              </button>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setPasteConfirmText(null)}
                className="px-4 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-[#333] rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  executePaste(pasteConfirmText);
                  setPasteConfirmText(null);
                  termRef.current?.focus();
                }}
                className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium rounded shadow transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Clipboard className="w-3.5 h-3.5" />
                Paste into Terminal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
