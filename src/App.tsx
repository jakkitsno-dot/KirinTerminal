import React, { useState, useEffect, lazy, Suspense } from 'react';
import { MenuBar } from './components/MenuBar';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { HomeView } from './components/HomeView';
import { TerminalView } from './components/TerminalView';
import { TerminalGrid } from './components/TerminalGrid';
import { RdpView } from './components/RdpView';
import { VncView } from './components/VncView';
import { SessionModal } from './components/SessionModal';
import { PasswordPromptModal } from './components/PasswordPromptModal';
import { PromptModal } from './components/PromptModal';
import { NetworkToolsView } from './components/NetworkToolsView';
import { MasterPasswordModal } from './components/MasterPasswordModal';
import { PasswordManagerModal } from './components/PasswordManagerModal';
import { TunnelsView } from './components/TunnelsView';
import { SettingsModal } from './components/SettingsModal';
import { MultiExecutionBar } from './components/MultiExecutionBar';

// Lazy-loaded heavy components (loaded only on demand when user opens them)
const EditorModal = lazy(() => import('./components/EditorModal').then(m => ({ default: m.EditorModal })));
const DiffModal = lazy(() => import('./components/DiffModal').then(m => ({ default: m.DiffModal })));
const ServersModal = lazy(() => import('./components/ServersModal').then(m => ({ default: m.ServersModal })));
const CredentialManagerModal = lazy(() => import('./components/CredentialManagerModal').then(m => ({ default: m.CredentialManagerModal })));
const PackageManagerModal = lazy(() => import('./components/PackageManagerModal').then(m => ({ default: m.PackageManagerModal })));
const HelpModal = lazy(() => import('./components/HelpModal').then(m => ({ default: m.HelpModal })));

import { TabItem, SessionConfig, SessionFolder, ShellType, Macro, GlobalSettings, CredentialConfig } from './types';
import { Home, Plus, X, Terminal, Key, Activity, Cable, Layers, Radio, Monitor, Tv, PanelLeftOpen, PanelLeftClose, Globe, Star } from 'lucide-react';
import { isEncrypted, encryptPassword, decryptPassword, isVaultSetup } from './utils/vault';
import { loadSettings, saveSettings } from './utils/settings';

const DEFAULT_FOLDERS: SessionFolder[] = [];

const DEFAULT_SESSIONS: SessionConfig[] = [
  { id: '1', name: 'Example SSH Server', type: 'SSH', host: '192.168.1.100', port: 22, username: 'admin' },
  { id: '2', name: 'Example Local CMD', type: 'Shell', shellType: 'cmd.exe' }
];

export const App: React.FC = () => {
  // Load persisted sessions and folders from localStorage
  const [sessions, setSessions] = useState<SessionConfig[]>(() => {
    try {
      const saved = localStorage.getItem('mobaxterm_sessions');
      return saved ? JSON.parse(saved) : DEFAULT_SESSIONS;
    } catch {
      return DEFAULT_SESSIONS;
    }
  });

  const [folders, setFolders] = useState<SessionFolder[]>(() => {
    try {
      const saved = localStorage.getItem('mobaxterm_folders');
      return saved ? JSON.parse(saved) : DEFAULT_FOLDERS;
    } catch {
      return DEFAULT_FOLDERS;
    }
  });

  // Save to localStorage whenever sessions or folders change
  useEffect(() => {
    localStorage.setItem('mobaxterm_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('mobaxterm_folders', JSON.stringify(folders));
  }, [folders]);

  const [tabs, setTabs] = useState<TabItem[]>([
    { id: 'home', title: 'Home', type: 'home' }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('home');
  const [activeSidebarTab, setActiveSidebarTab] = useState<'sessions' | 'sftp' | 'term' | 'macros' | 'snippets'>('sessions');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Ctrl+B shortcut to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Macros state
  const [macros, setMacros] = useState<Macro[]>(() => {
    try {
      const saved = localStorage.getItem('mobaxterm_macros');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isRecording, setIsRecording] = useState(false);
  const [macroDataBuffer, setMacroDataBuffer] = useState('');
  const [isMacroPromptOpen, setIsMacroPromptOpen] = useState(false);

  // Vault state
  const [masterPassword, setMasterPassword] = useState<string | null>(null);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [pendingVaultAction, setPendingVaultAction] = useState<((pwd: string) => void) | null>(null);
  const [isPasswordManagerOpen, setIsPasswordManagerOpen] = useState(false);
  const [isServersModalOpen, setIsServersModalOpen] = useState(false);

  // Credential Manager state
  const [credentials, setCredentials] = useState<CredentialConfig[]>(() => {
    try {
      const saved = localStorage.getItem('mobaxterm_saved_credentials');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCredentialManagerOpen, setIsCredentialManagerOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('mobaxterm_saved_credentials', JSON.stringify(credentials));
  }, [credentials]);
  
  // Settings state
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(loadSettings());
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPackageManagerOpen, setIsPackageManagerOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  useEffect(() => {
    saveSettings(globalSettings);
  }, [globalSettings]);

  useEffect(() => {
    localStorage.setItem('mobaxterm_macros', JSON.stringify(macros));
  }, [macros]);

  const [snippets, setSnippets] = useState<import('./types').Snippet[]>(() => {
    const saved = localStorage.getItem('mobaxterm_snippets');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('mobaxterm_snippets', JSON.stringify(snippets));
  }, [snippets]);

  const handleSaveSnippet = (snippet: import('./types').Snippet) => {
    setSnippets(prev => {
      const existing = prev.find(s => s.id === snippet.id);
      if (existing) return prev.map(s => s.id === snippet.id ? snippet : s);
      return [...prev, snippet];
    });
  };

  const handleDeleteSnippet = (id: string) => {
    setSnippets(prev => prev.filter(s => s.id !== id));
  };
  
  const handleExecuteSnippet = (snippet: import('./types').Snippet) => {
    window.dispatchEvent(new CustomEvent('execute-snippet', { detail: snippet.command }));
  };

  // Listen for macro-record-input
  useEffect(() => {
    const handleMacroInput = (e: Event) => {
      if (isRecording) {
        const customEvent = e as CustomEvent;
        setMacroDataBuffer(prev => prev + customEvent.detail.data);
      }
    };
    window.addEventListener('macro-record-input', handleMacroInput);
    return () => window.removeEventListener('macro-record-input', handleMacroInput);
  }, [isRecording]);

  const handleToggleRecordMacro = () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      setIsMacroPromptOpen(true); // Always ask for name, even if buffer is empty
    } else {
      // Start recording
      setMacroDataBuffer('');
      setIsRecording(true);
    }
  };

  const handlePlayMacro = (macro: Macro) => {
    window.dispatchEvent(new CustomEvent('macro-play', { detail: { data: macro.data } }));
  };

  const handleDeleteMacro = (id: string) => {
    if (confirm('Are you sure you want to delete this macro?')) {
      setMacros(prev => prev.filter(m => m.id !== id));
    }
  };

  // Modals state
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<SessionConfig | null>(null);

  const [quickConnect, setQuickConnect] = useState('');
  const [showShellDropdown, setShowShellDropdown] = useState(false);

  // Editor Modal
  const [editorState, setEditorState] = useState<{
    isOpen: boolean;
    filePath: string;
    fileName: string;
  }>({
    isOpen: false,
    filePath: '',
    fileName: ''
  });

  // MobaDiff Modal State
  const [diffState, setDiffState] = useState<{
    isOpen: boolean;
    leftPath?: string;
    leftTitle?: string;
    rightPath?: string;
    rightTitle?: string;
    leftContent?: string;
    rightContent?: string;
  }>({
    isOpen: false
  });

  // Password Prompt Modal
  const [pendingSshSession, setPendingSshSession] = useState<SessionConfig | null>(null);

  const [splitMode, setSplitMode] = useState<boolean>(false);
  const [splitLayout, setSplitLayout] = useState<'auto' | '2-vertical' | '2-horizontal' | '4-grid'>('auto');
  const [multiExecMode, setMultiExecMode] = useState<boolean>(false);
  const [multiExecTargetIds, setMultiExecTargetIds] = useState<string[]>([]);

  const handleToggleSplit = (targetLayout?: 'auto' | '2-vertical' | '2-horizontal' | '4-grid') => {
    const sessionTabs = tabs.filter(t => t.type !== 'home');

    if (!splitMode) {
      if (sessionTabs.length === 0) {
        // 0 sessions open: spawn 2 local terminals so screen splits immediately!
        openNewLocalTerminal(undefined, 'Local Terminal 1');
        openNewLocalTerminal(undefined, 'Local Terminal 2');
      } else if (sessionTabs.length === 1) {
        // 1 session open: spawn a 2nd terminal so screen splits into 2 panes!
        openNewLocalTerminal(undefined, 'Local Terminal 2');
      }
      setSplitMode(true);
      if (targetLayout) setSplitLayout(targetLayout);
    } else {
      // If already in splitMode and user chose a specific layout:
      if (targetLayout && targetLayout !== splitLayout) {
        setSplitLayout(targetLayout);
      } else {
        // Turn splitMode OFF
        setSplitMode(false);
      }
    }
  };

  // Folder Operations
  const handleCreateFolder = (name: string, parentId?: string | null) => {
    const newFolder: SessionFolder = {
      id: 'f_' + Date.now(),
      name,
      parentId: parentId || null,
      isExpanded: true
    };
    setFolders((prev) => [...prev, newFolder]);
  };

  const handleRenameFolder = (folderId: string, newName: string) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, name: newName } : f))
    );
  };

  const handleDeleteFolder = (folderId: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    // Move any sessions inside this folder to root
    setSessions((prev) =>
      prev.map((s) => (s.folderId === folderId ? { ...s, folderId: null } : s))
    );
  };

  const handleToggleFolder = (folderId: string) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, isExpanded: !f.isExpanded } : f))
    );
  };

  const handleCloseAllFolders = () => {
    setFolders((prev) => prev.map((f) => ({ ...f, isExpanded: false })));
  };

  // Session Operations
  const handleEditSession = (session: SessionConfig) => {
    setEditingSession(session);
    setIsSessionModalOpen(true);
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const handleDuplicateSession = (session: SessionConfig) => {
    const duplicated: SessionConfig = {
      ...session,
      id: 's_' + Date.now(),
      name: `${session.name} (Copy)`
    };
    setSessions((prev) => [...prev, duplicated]);
  };

  // Export / Import / HTML Generation
  const handleExportSessions = () => {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      folders,
      sessions,
      credentials
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'KirinTerminal_sessions_export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSessions = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed.sessions && Array.isArray(parsed.sessions)) {
          setSessions((prev) => [...prev, ...parsed.sessions]);
        }
        if (parsed.folders && Array.isArray(parsed.folders)) {
          setFolders((prev) => [...prev, ...parsed.folders]);
        }
        if (parsed.credentials && Array.isArray(parsed.credentials)) {
          setCredentials((prev) => {
            const existingIds = new Set(prev.map((c) => c.id));
            const newCreds = parsed.credentials.filter((c: CredentialConfig) => !existingIds.has(c.id));
            return [...prev, ...newCreds];
          });
        }
        alert('Sessions and credentials imported successfully!');
      } catch (err) {
        alert('Failed to parse sessions file. Please ensure it is valid JSON.');
      }
    };
    reader.readAsText(file);
  };

  const handleGenerateHtml = () => {
    const resolveUser = (s: SessionConfig) => {
      if (s.credentialId) {
        const cred = credentials.find((c) => c.id === s.credentialId);
        if (cred?.username) return cred.username;
      }
      return s.username || 'root';
    };

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>KirinTerminal Sessions Bookmarks</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #1e1e1e; color: #ddd; padding: 20px; }
    h1 { color: #58a6ff; }
    .folder { margin-top: 15px; font-weight: bold; color: #79c0ff; }
    .session-list { list-style: none; padding-left: 20px; }
    .session-item { margin: 6px 0; }
    a { color: #f1c40f; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>KirinTerminal Saved Sessions</h1>
  ${folders.map(f => `
    <div class="folder">📁 ${f.name}</div>
    <ul class="session-list">
      ${sessions.filter(s => s.folderId === f.id).map(s => {
        const u = resolveUser(s);
        return `<li class="session-item">🔑 <a href="ssh://${u}@${s.host}:${s.port || 22}">${s.name} (${u}@${s.host || 'localhost'}:${s.port || 22})</a></li>`;
      }).join('')}
    </ul>
  `).join('')}
  <div class="folder">📁 Root Sessions</div>
  <ul class="session-list">
    ${sessions.filter(s => !s.folderId).map(s => {
      const u = resolveUser(s);
      return `<li class="session-item">🔑 <a href="ssh://${u}@${s.host}:${s.port || 22}">${s.name} (${u}@${s.host || 'localhost'}:${s.port || 22})</a></li>`;
    }).join('')}
  </ul>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'KirinTerminal_sessions.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const openPasswordManager = () => {
    if (isVaultSetup() && !masterPassword) {
      setPendingVaultAction(() => (pwd: string) => setIsPasswordManagerOpen(true));
      setIsVaultModalOpen(true);
    } else {
      setIsPasswordManagerOpen(true);
    }
  };

  const openCredentialManager = () => {
    if (isVaultSetup() && !masterPassword) {
      setPendingVaultAction(() => (pwd: string) => setIsCredentialManagerOpen(true));
      setIsVaultModalOpen(true);
    } else {
      setIsCredentialManagerOpen(true);
    }
  };

  const handleSaveCredentials = (newCredentials: CredentialConfig[]) => {
    const validIds = new Set(newCredentials.map((c) => c.id));
    setCredentials(newCredentials);
    // Unlink any sessions that were using a deleted credential
    setSessions((prev) =>
      prev.map((s) => {
        if (s.credentialId && !validIds.has(s.credentialId)) {
          return { ...s, credentialId: null };
        }
        return s;
      })
    );
  };

  const openTunnelsManager = () => {
    const existing = tabs.find(t => t.type === 'tunnels');
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    
    const newId = 'tunnels_' + Date.now();
    const newTab: TabItem = {
      id: newId,
      title: 'Tunnels',
      type: 'tunnels'
    };
    
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const openNetworkTools = () => {
    // Check if it already exists
    const existing = tabs.find(t => t.type === 'network-tools');
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    
    const newId = 'net_tools_' + Date.now();
    const newTab: TabItem = {
      id: newId,
      title: 'Network Tools',
      type: 'network-tools'
    };
    
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const openNewLocalTerminal = (overrideShell?: ShellType, title?: string, envColor?: string) => {
    const shell = overrideShell || globalSettings.general.defaultShell;
    const newId = 'local_' + Date.now();
    const defaultTitle = title || (shell === 'powershell.exe' ? `PowerShell [${tabs.length}]` : shell === 'bash.exe' ? `Bash [${tabs.length}]` : `CMD [${tabs.length}]`);
    const newTab: TabItem = {
      id: newId,
      title: defaultTitle,
      type: 'terminal',
      connectionType: 'local',
      shell,
      cwd: globalSettings.general.defaultCwd,
      envColor
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    if (multiExecMode) {
      setMultiExecTargetIds((prev) => [...prev, newId]);
    }
  };

  const openNewSshTerminal = (session: SessionConfig, passwordOverride?: string) => {
    const newId = 'ssh_' + Date.now();
    const newTab: TabItem = {
      id: newId,
      title: session.name,
      type: 'terminal',
      connectionType: 'ssh',
      host: session.host,
      port: session.port || 22,
      username: session.username || 'root',
      password: passwordOverride || session.password,
      privateKey: session.privateKey,
      sessionId: session.id,
      theme: session.theme,
      fontSize: session.fontSize,
      fontFamily: session.fontFamily,
      envColor: session.envColor,
      status: 'connecting'
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    if (multiExecMode) {
      setMultiExecTargetIds((prev) => [...prev, newId]);
    }
  };

  const openNewSerialTerminal = (session: SessionConfig) => {
    const newId = 'serial_' + Date.now();
    const newTab: TabItem = {
      id: newId,
      title: session.name || `Serial ${session.serialPort || 'COM1'}`,
      type: 'terminal',
      connectionType: 'serial',
      serialPort: session.serialPort || 'COM1',
      baudRate: session.baudRate || 115200,
      dataBits: session.dataBits || 8,
      stopBits: session.stopBits || 1,
      parity: session.parity || 'none',
      flowControl: session.flowControl || 'none',
      sessionId: session.id,
      theme: session.theme,
      fontSize: session.fontSize,
      fontFamily: session.fontFamily,
      envColor: session.envColor,
      status: 'connecting'
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    if (multiExecMode) {
      setMultiExecTargetIds((prev) => [...prev, newId]);
    }
  };

  const openNewWslTerminal = (session: SessionConfig) => {
    const newId = 'wsl_' + Date.now();
    const newTab: TabItem = {
      id: newId,
      title: session.name || session.wslDistro || 'WSL',
      type: 'terminal',
      connectionType: 'wsl',
      wslDistro: session.wslDistro,
      sessionId: session.id,
      theme: session.theme,
      fontSize: session.fontSize,
      fontFamily: session.fontFamily,
      envColor: session.envColor,
      status: 'connecting'
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const openNewTelnetTerminal = (session: SessionConfig) => {
    const newId = 'telnet_' + Date.now();
    const newTab: TabItem = {
      id: newId,
      title: session.name || session.host || 'Telnet',
      type: 'terminal',
      connectionType: 'telnet',
      host: session.host,
      port: session.port || 23,
      sessionId: session.id,
      theme: session.theme,
      fontSize: session.fontSize,
      fontFamily: session.fontFamily,
      envColor: session.envColor,
      status: 'connecting'
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const openNewRdpSession = (session: SessionConfig) => {
    const newId = 'rdp_' + Date.now();
    const newTab: TabItem = {
      id: newId,
      title: session.name || session.host || 'RDP',
      type: 'rdp',
      connectionType: 'rdp',
      host: session.host,
      port: session.port || 3389,
      username: session.username,
      rdpResolution: session.rdpResolution,
      rdpFullscreen: session.rdpFullscreen,
      rdpAdmin: session.rdpAdmin,
      envColor: session.envColor,
      sessionId: session.id
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const openNewVncSession = (session: SessionConfig) => {
    const newId = 'vnc_' + Date.now();
    const newTab: TabItem = {
      id: newId,
      title: session.name || session.host || 'VNC',
      type: 'vnc',
      connectionType: 'vnc',
      host: session.host,
      port: session.port || 5900,
      envColor: session.envColor,
      sessionId: session.id
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const handleOpenSession = (session: SessionConfig) => {
    if (session.type === 'Shell') {
      openNewLocalTerminal(session.shellType || 'powershell.exe', session.name, session.envColor);
    } else if (session.type === 'Serial') {
      openNewSerialTerminal(session);
    } else if (session.type === 'WSL') {
      openNewWslTerminal(session);
    } else if (session.type === 'Telnet') {
      openNewTelnetTerminal(session);
    } else if (session.type === 'RDP') {
      openNewRdpSession(session);
    } else if (session.type === 'VNC') {
      openNewVncSession(session);
    } else if (session.type === 'SSH') {
      // Resolve credentials if linked
      let resolvedUsername = session.username || 'root';
      let resolvedPassword = session.password;
      let resolvedPrivateKey = session.privateKey;

      if (session.credentialId) {
        const cred = credentials.find((c) => c.id === session.credentialId);
        if (cred) {
          if (cred.username) resolvedUsername = cred.username;
          if (cred.password) resolvedPassword = cred.password;
          if (cred.privateKey) resolvedPrivateKey = cred.privateKey;
        }
      }

      const activeSession: SessionConfig = {
        ...session,
        username: resolvedUsername,
        password: resolvedPassword,
        privateKey: resolvedPrivateKey
      };

      if (!activeSession.password && !activeSession.privateKey) {
        setPendingSshSession(activeSession);
      } else if (activeSession.password && isEncrypted(activeSession.password)) {
        if (!masterPassword) {
          setPendingVaultAction(() => (pwd: string) => handleOpenSession(session));
          setIsVaultModalOpen(true);
        } else {
          const decPassword = decryptPassword(activeSession.password, masterPassword);
          openNewSshTerminal(activeSession, decPassword);
        }
      } else {
        openNewSshTerminal(activeSession);
      }
    } else {
      openNewSshTerminal(session);
    }
  };

  const handleQuickConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickConnect.trim()) return;

    const input = quickConnect.trim();
    let username = 'root';
    let host = input;

    if (input.includes('@')) {
      const parts = input.split('@');
      username = parts[0];
      host = parts[1];
    }

    const newSession: SessionConfig = {
      id: Date.now().toString(),
      name: `${username}@${host}`,
      type: 'SSH',
      host,
      username,
      port: 22
    };

    setSessions((prev) => [newSession, ...prev]);
    setQuickConnect('');
    setPendingSshSession(newSession);
  };

  const closeTab = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (tabId === 'home') return;

    const index = tabs.findIndex((t) => t.id === tabId);
    const updatedTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(updatedTabs);
    setMultiExecTargetIds((prev) => prev.filter((id) => id !== tabId));

    const remainingTerminals = updatedTabs.filter((t) => t.type === 'terminal');
    if (remainingTerminals.length === 0 && multiExecMode) {
      setMultiExecMode(false);
    }

    if (activeTabId === tabId) {
      const nextIndex = Math.max(0, index - 1);
      setActiveTabId(updatedTabs[nextIndex]?.id || 'home');
    }
  };

  // Multi-Execution Management Handlers
  const handleToggleMultiExec = () => {
    const nextMode = !multiExecMode;
    setMultiExecMode(nextMode);
    if (nextMode) {
      // By default select all currently open terminals
      const currentTermIds = tabs.filter(t => t.type === 'terminal').map(t => t.id);
      setMultiExecTargetIds(currentTermIds);
    }
  };

  const handleToggleMultiExecTarget = (tabId: string) => {
    setMultiExecTargetIds(prev => 
      prev.includes(tabId) ? prev.filter(id => id !== tabId) : [...prev, tabId]
    );
  };

  const handleSelectAllMultiExec = () => {
    const allIds = tabs.filter(t => t.type === 'terminal').map(t => t.id);
    setMultiExecTargetIds(allIds);
  };

  const handleDeselectAllMultiExec = () => {
    setMultiExecTargetIds([]);
  };

  const handleSelectOnlySshMultiExec = () => {
    const sshIds = tabs.filter(t => t.type === 'terminal' && t.connectionType === 'ssh').map(t => t.id);
    setMultiExecTargetIds(sshIds);
  };

  const handleSendMultiExecCommand = (command: string) => {
    window.dispatchEvent(new CustomEvent('multiexec-input', {
      detail: { data: command + '\r', targetIds: multiExecTargetIds }
    }));
  };

  const handleSendMultiExecInterrupt = () => {
    window.dispatchEvent(new CustomEvent('multiexec-input', {
      detail: { data: '\x03', targetIds: multiExecTargetIds }
    }));
  };

  // Find active SSH session ID for SFTP
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeSshSessionId = activeTab?.connectionType === 'ssh' ? activeTab.id : undefined;

  const handleSftpReady = (tabId: string) => {
    if (activeTabId === tabId) {
      setActiveSidebarTab('sftp');
    }
  };

  const terminalTabs = tabs.filter(t => t.type === 'terminal');
  const cols = splitMode ? Math.ceil(Math.sqrt(terminalTabs.length)) : 1;
  const rows = splitMode ? Math.ceil(terminalTabs.length / cols) : 1;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#1e1e1e] text-[#cccccc] font-sans">
      {/* 1. Top Menu Bar */}
      <MenuBar
        onNewSession={() => {
          setEditingSession(null);
          setTargetFolderId(null);
          setIsSessionModalOpen(true);
        }}
        onNewTerminal={openNewLocalTerminal}
        onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        onToggleSplit={handleToggleSplit}
        onToggleMultiExec={handleToggleMultiExec}
        onOpenServers={() => setIsServersModalOpen(true)}
        onOpenTools={openNetworkTools}
        onOpenTunnels={openTunnelsManager}
        onOpenDiff={() => setDiffState({ isOpen: true })}
        onOpenPackages={() => setIsPackageManagerOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenVault={() => setIsVaultModalOpen(true)}
        onOpenCredentials={openCredentialManager}
        onOpenMacros={() => {
          setIsSidebarOpen(true);
          setActiveSidebarTab('macros');
        }}
        onOpenHelp={() => setIsHelpModalOpen(true)}
      />

      {/* 2. Main Icon Toolbar */}
      <Toolbar
        onNewSession={() => {
          setEditingSession(null);
          setTargetFolderId(null);
          setIsSessionModalOpen(true);
        }}
        onNewTerminal={() => openNewLocalTerminal()}
        onToggleSplit={handleToggleSplit}
        onToggleMultiExec={handleToggleMultiExec}
        onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        isSidebarOpen={isSidebarOpen}
        onOpenTools={openNetworkTools}
        onOpenVault={() => setIsVaultModalOpen(true)}
        onOpenPasswords={openPasswordManager}
        onOpenCredentials={openCredentialManager}
        onOpenTunnels={openTunnelsManager}
        onOpenServers={() => setIsServersModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenDiff={() => setDiffState({ isOpen: true })}
        onOpenPackages={() => setIsPackageManagerOpen(true)}
        onOpenHelp={() => setIsHelpModalOpen(true)}
        splitMode={splitMode}
        splitLayout={splitLayout}
        multiExecMode={multiExecMode}
      />

      {/* 3. Sub-bar: Quick Connect + Tabs */}
      {/* 3. Sub-bar: Quick Connect + Tabs */}
      <div className="flex items-start bg-[#252528] border-b border-[#2d2d30] px-2 py-1 gap-2 select-none shrink-0">
        {/* Quick Connect Input */}
        <form onSubmit={handleQuickConnect} className="w-56 shrink-0 pt-0.5">
          <input
            type="text"
            value={quickConnect}
            onChange={(e) => setQuickConnect(e.target.value)}
            placeholder="Quick connect (e.g. root@192.168.1.1)..."
            className="w-full bg-[#161618] border border-[#3e3e42] focus:border-[#007acc] text-xs text-gray-200 px-2 py-1 rounded outline-none placeholder:text-gray-500"
          />
        </form>

        {/* Tab Strip (wraps to new row if overflowing) */}
        <div className="flex flex-wrap items-center gap-1 flex-1 min-w-0 max-h-36 overflow-y-auto pr-1">
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData('tabIndex', index.toString());
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const dragIndex = parseInt(e.dataTransfer.getData('tabIndex'), 10);
                  if (isNaN(dragIndex) || dragIndex === index) return;
                  setTabs(prev => {
                    const newTabs = [...prev];
                    const [draggedTab] = newTabs.splice(dragIndex, 1);
                    newTabs.splice(index, 0, draggedTab);
                    return newTabs;
                  });
                }}
                onClick={() => {
                  setActiveTabId(tab.id);
                  // In split mode, also scroll-to / focus the terminal panel in the grid
                  if (splitMode && tab.type === 'terminal') {
                    setTimeout(() => {
                      const el = document.querySelector(`[data-terminal-id="${tab.id}"]`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 50);
                  }
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs cursor-pointer border transition-all shrink-0 ${
                  isActive
                    ? 'bg-[#121212] text-white font-medium border-[#007acc] ring-1 ring-[#007acc] shadow-xs'
                    : 'bg-[#2a2a2d] text-gray-400 border-[#3e3e42] hover:bg-[#323236] hover:text-gray-200'
                } ${
                  tab.envColor === 'red' ? 'border-t-2 border-t-red-500' :
                  tab.envColor === 'green' ? 'border-t-2 border-t-emerald-500' :
                  tab.envColor === 'orange' ? 'border-t-2 border-t-orange-500' :
                  tab.envColor === 'purple' ? 'border-t-2 border-t-purple-500' :
                  tab.envColor === 'blue' ? 'border-t-2 border-t-blue-500' : ''
                }`}
              >
                {tab.type === 'home' ? (
                  <Home className="w-3.5 h-3.5 text-red-400" />
                ) : tab.type === 'rdp' ? (
                  <Monitor className="w-3.5 h-3.5 text-sky-400" />
                ) : tab.type === 'vnc' ? (
                  <Tv className="w-3.5 h-3.5 text-emerald-400" />
                ) : tab.connectionType === 'ssh' ? (
                  <Key className="w-3.5 h-3.5 text-yellow-400" />
                ) : tab.connectionType === 'serial' ? (
                  <Cable className="w-3.5 h-3.5 text-orange-400" />
                ) : tab.connectionType === 'wsl' ? (
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                ) : tab.connectionType === 'telnet' ? (
                  <Radio className="w-3.5 h-3.5 text-purple-400" />
                ) : tab.connectionType === 'local' ? (
                  <Terminal className="w-3.5 h-3.5 text-blue-400" />
                ) : (
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span className="truncate max-w-[130px] select-none">{tab.title}</span>
                {tab.envColor && tab.envColor !== 'default' && (
                  <span className={`text-[8px] font-bold px-1 py-0.2 rounded uppercase tracking-wider shrink-0 ${
                    tab.envColor === 'red' ? 'bg-red-950 text-red-300 border border-red-800/60' :
                    tab.envColor === 'green' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60' :
                    tab.envColor === 'orange' ? 'bg-orange-950 text-orange-300 border border-orange-800/60' :
                    tab.envColor === 'purple' ? 'bg-purple-950 text-purple-300 border border-purple-800/60' :
                    'bg-blue-950 text-blue-300 border border-blue-800/60'
                  }`}>
                    {tab.envColor === 'red' ? 'PROD' : tab.envColor.toUpperCase()}
                  </span>
                )}
                {tab.id !== 'home' && (
                  <button
                    onClick={(e) => closeTab(tab.id, e)}
                    className="p-0.5 rounded hover:bg-[#444448] text-gray-400 hover:text-white cursor-pointer ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Tab Button with Dropdown */}
          <div className="relative shrink-0 self-center">
            <button
              onClick={() => setShowShellDropdown(!showShellDropdown)}
              title="New Tab"
              className="p-1 px-1.5 rounded bg-[#2a2a2d] hover:bg-[#3a3a3d] border border-[#3e3e42] text-gray-300 hover:text-white cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            {showShellDropdown && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-[#252528] border border-[#3e3e42] rounded shadow-xl py-1 z-50 text-xs">
                <button
                  onClick={() => {
                    openNewLocalTerminal('powershell.exe');
                    setShowShellDropdown(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#007acc] text-gray-200 hover:text-white flex items-center gap-2 cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5 text-blue-400" />
                  PowerShell
                </button>
                <button
                  onClick={() => {
                    openNewLocalTerminal('cmd.exe');
                    setShowShellDropdown(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#007acc] text-gray-200 hover:text-white flex items-center gap-2 cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  Command Prompt
                </button>
                <div className="border-t border-[#3a3a3d] my-1" />
                <button
                  onClick={() => {
                    setEditingSession(null);
                    setTargetFolderId(null);
                    setIsSessionModalOpen(true);
                    setShowShellDropdown(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#007acc] text-gray-200 hover:text-white flex items-center gap-2 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5 text-yellow-400" />
                  New SSH Session...
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Main Body: Sidebar + Active Tab Content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar (Open or Collapsed) */}
        {isSidebarOpen && (
          <Sidebar
            sessions={sessions}
            folders={folders}
            activeSessionId={activeSshSessionId}
            activeSidebarTab={activeSidebarTab}
            setActiveSidebarTab={setActiveSidebarTab}
            onSelectSession={handleOpenSession}
            onNewSession={(folderId) => {
              setEditingSession(null);
              setTargetFolderId(folderId || null);
              setIsSessionModalOpen(true);
            }}
            onEditSession={handleEditSession}
            onDeleteSession={handleDeleteSession}
            onDuplicateSession={handleDuplicateSession}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onToggleFolder={handleToggleFolder}
            onMoveSession={(sessionId, folderId) => {
              setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, folderId } : s));
            }}
            onMoveFolder={(folderId, targetFolderId) => {
              setFolders(prev => prev.map(f => f.id === folderId ? { ...f, parentId: targetFolderId } : f));
            }}
            onCloseAllFolders={handleCloseAllFolders}
            onExportSessions={handleExportSessions}
            onImportSessions={handleImportSessions}
            onGenerateHtml={handleGenerateHtml}
            onOpenFileForEdit={(filePath, fileName) => {
              setEditorState({ isOpen: true, filePath, fileName });
            }}
            onCompareFile={(filePath, fileName) => {
              setDiffState({
                isOpen: true,
                leftPath: filePath,
                leftTitle: fileName
              });
            }}
            onToggleCollapse={() => setIsSidebarOpen(false)}
            macros={macros}
            isRecording={isRecording}
            onToggleRecordMacro={handleToggleRecordMacro}
            onPlayMacro={handlePlayMacro}
            onDeleteMacro={handleDeleteMacro}
            snippets={snippets}
            onSaveSnippet={handleSaveSnippet}
            onDeleteSnippet={handleDeleteSnippet}
            onExecuteSnippet={handleExecuteSnippet}
          />
        )}

        {/* Right Content Area: MultiExecutionBar + Tab Contents Viewport */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Multi-Execution Control Bar (Shows when MultiExec is ON and there are terminal tabs) */}
          {multiExecMode && terminalTabs.length > 0 && (
            <MultiExecutionBar
              terminals={terminalTabs}
              activeTabId={activeTabId}
              selectedIds={multiExecTargetIds}
              onToggleSelect={handleToggleMultiExecTarget}
              onSelectAll={handleSelectAllMultiExec}
              onDeselectAll={handleDeselectAllMultiExec}
              onSelectOnlySsh={handleSelectOnlySshMultiExec}
              onSendCommand={handleSendMultiExecCommand}
              onSendInterrupt={handleSendMultiExecInterrupt}
              onClose={() => setMultiExecMode(false)}
            />
          )}

          {/* Tab Contents Viewport */}
          <div 
            className="flex-1 h-full w-full relative overflow-hidden bg-[#121212]"
          >
            {/* Home View */}
            {activeTabId === 'home' && (
              <HomeView
                onStartLocalTerminal={openNewLocalTerminal}
                onOpenSession={handleOpenSession}
                recentSessions={sessions}
                onOpenTools={openNetworkTools}
              />
            )}

            {/* Split Mode: Render ALL active session tabs (Terminals, RDP, VNC, Network Tools, Tunnels) in the Resizable Grid */}
            {splitMode && tabs.filter(t => t.type !== 'home').length > 0 ? (
              <div className={`absolute inset-0 z-0 ${activeTabId === 'home' ? 'hidden' : 'block'}`}>
                <TerminalGrid
                  terminals={tabs.filter(t => t.type !== 'home')}
                  activeTabId={activeTabId}
                  onSelectTab={(id) => setActiveTabId(id)}
                  onCloseTab={closeTab}
                  multiExecMode={multiExecMode}
                  multiExecTargetIds={multiExecTargetIds}
                  onToggleMultiExecTarget={handleToggleMultiExecTarget}
                  onSftpReady={handleSftpReady}
                  settings={globalSettings}
                  isGridVisible={activeTabId !== 'home'}
                  masterPassword={masterPassword}
                  onConnectSSH={(host, port, username) => {
                    handleOpenSession({
                      id: 's_' + Date.now(),
                      name: host,
                      type: 'SSH',
                      host,
                      port: port || 22,
                      username: username || 'root'
                    });
                  }}
                  onConnectSFTP={(host, port, username) => {
                    handleOpenSession({
                      id: 's_' + Date.now(),
                      name: host,
                      type: 'SSH',
                      host,
                      port: port || 22,
                      username: username || 'root'
                    });
                    setActiveSidebarTab('sftp');
                  }}
                  onAddSession={(partialSession) => {
                    const newSession: SessionConfig = {
                      id: 's_' + Date.now(),
                      name: partialSession.name || partialSession.host || 'New Host',
                      type: 'SSH',
                      host: partialSession.host || '127.0.0.1',
                      port: partialSession.port || 22,
                      username: partialSession.username || 'root',
                      ...partialSession
                    };
                    setSessions(prev => [...prev, newSession]);
                  }}
                  splitLayout={splitLayout}
                />
              </div>
            ) : (
              /* Normal Single-Tab Mode: individual tabs shown only when active */
              <>
                {/* Active Terminal Views (Local & SSH) */}
                {terminalTabs.map((termTab) => (
                  <div key={termTab.id} className={`absolute inset-0 z-0 ${activeTabId === termTab.id ? 'block' : 'hidden'}`}>
                    <TerminalView
                      tab={termTab}
                      isActive={activeTabId === termTab.id}
                      isVisible={activeTabId === termTab.id}
                      multiExecMode={multiExecMode}
                      isMultiExecTarget={multiExecTargetIds.includes(termTab.id)}
                      onToggleMultiExecTarget={handleToggleMultiExecTarget}
                      onSftpReady={handleSftpReady}
                      settings={globalSettings}
                    />
                  </div>
                ))}

                {/* Network Tools View */}
                {tabs.find(t => t.type === 'network-tools') && (
                  <div className={`absolute inset-0 z-10 ${activeTabId === tabs.find(t => t.type === 'network-tools')?.id ? 'block' : 'hidden'}`}>
                    <NetworkToolsView 
                      isVisible={activeTabId === tabs.find(t => t.type === 'network-tools')?.id}
                      onConnectSSH={(host, port, username) => {
                        const session: SessionConfig = {
                          id: 's_' + Date.now(),
                          name: `${host}`,
                          type: 'SSH',
                          host,
                          port: port || 22,
                          username: username || 'root'
                        };
                        handleOpenSession(session);
                      }}
                      onConnectSFTP={(host, port, username) => {
                        const session: SessionConfig = {
                          id: 's_' + Date.now(),
                          name: `${host}`,
                          type: 'SSH',
                          host,
                          port: port || 22,
                          username: username || 'root'
                        };
                        handleOpenSession(session);
                        setActiveSidebarTab('sftp');
                      }}
                      onAddSession={(partialSession) => {
                        const newSession: SessionConfig = {
                          id: 's_' + Date.now(),
                          name: partialSession.name || partialSession.host || 'New Host',
                          type: 'SSH',
                          host: partialSession.host || '127.0.0.1',
                          port: partialSession.port || 22,
                          username: partialSession.username || 'root',
                          ...partialSession
                        };
                        setSessions(prev => [...prev, newSession]);
                      }}
                    />
                  </div>
                )}

                {/* Tunnels View */}
                {tabs.find(t => t.type === 'tunnels') && (
                  <div className={`absolute inset-0 z-10 ${activeTabId === tabs.find(t => t.type === 'tunnels')?.id ? 'block' : 'hidden'}`}>
                    <TunnelsView isVisible={activeTabId === tabs.find(t => t.type === 'tunnels')?.id} masterPassword={masterPassword} />
                  </div>
                )}

                {/* RDP Views */}
                {tabs.filter(t => t.type === 'rdp').map((tab) => (
                  <div key={tab.id} className={`absolute inset-0 z-10 ${activeTabId === tab.id ? 'block' : 'hidden'}`}>
                    <RdpView tab={tab} isActive={activeTabId === tab.id} onClose={() => closeTab(tab.id)} />
                  </div>
                ))}

                {/* VNC Views */}
                {tabs.filter(t => t.type === 'vnc').map((tab) => (
                  <div key={tab.id} className={`absolute inset-0 z-10 ${activeTabId === tab.id ? 'block' : 'hidden'}`}>
                    <VncView tab={tab} isActive={activeTabId === tab.id} onClose={() => closeTab(tab.id)} />
                  </div>
                ))}
              </>
            )}
        </div>
      </div>
    </div>

      {/* 5. Session Settings Modal */}
      <SessionModal
        isOpen={isSessionModalOpen}
        folders={folders}
        initialFolderId={targetFolderId}
        editingSession={editingSession}
        credentials={credentials}
        onOpenCredentialManager={openCredentialManager}
        onClose={() => {
          setIsSessionModalOpen(false);
          setEditingSession(null);
          setTargetFolderId(null);
        }}
        onSaveSession={(savedSession) => {
          const processSave = (sessionToSave: SessionConfig, currentMasterPass: string | null) => {
            // Encrypt if vault is active and password is provided
            if (isVaultSetup() && sessionToSave.password && !isEncrypted(sessionToSave.password) && currentMasterPass) {
              sessionToSave.password = encryptPassword(sessionToSave.password, currentMasterPass);
            }
            
            if (editingSession) {
              setSessions((prev) =>
                prev.map((s) => (s.id === sessionToSave.id ? sessionToSave : s))
              );
              // Update any currently open tabs that belong to this session
              setTabs((prev) =>
                prev.map((t) => {
                  if (t.sessionId === sessionToSave.id) {
                    return {
                      ...t,
                      theme: sessionToSave.theme,
                      fontSize: sessionToSave.fontSize,
                      fontFamily: sessionToSave.fontFamily,
                      // We don't hot-reload connection info, just appearance
                    };
                  }
                  return t;
                })
              );
            } else {
              setSessions((prev) => [sessionToSave, ...prev]);
              handleOpenSession(sessionToSave);
            }
            setIsSessionModalOpen(false);
          };

          if (isVaultSetup() && savedSession.password && !isEncrypted(savedSession.password)) {
            if (!masterPassword) {
              setPendingVaultAction(() => (pwd: string) => {
                processSave(savedSession, pwd);
              });
              setIsVaultModalOpen(true);
              return;
            } else {
              processSave(savedSession, masterPassword);
            }
          } else {
            processSave(savedSession, masterPassword);
          }
        }}
      />

      {/* 6. Built-in Text Editor Modal */}
      {editorState.isOpen && (
        <Suspense fallback={null}>
          <EditorModal
            isOpen={editorState.isOpen}
            activeSessionId={activeSshSessionId}
            filePath={editorState.filePath}
            fileName={editorState.fileName}
            onClose={() => setEditorState({ isOpen: false, filePath: '', fileName: '' })}
          />
        </Suspense>
      )}

      {/* 7. Password Prompt Modal */}
      <PasswordPromptModal
        isOpen={!!pendingSshSession}
        host={pendingSshSession?.host || ''}
        username={pendingSshSession?.username || 'root'}
        onSubmit={(password) => {
          if (pendingSshSession) {
            openNewSshTerminal(pendingSshSession, password);
            setPendingSshSession(null);
          }
        }}
        onCancel={() => setPendingSshSession(null)}
      />

      {/* 8. Macro Naming Modal */}
      <PromptModal
        isOpen={isMacroPromptOpen}
        title="Enter a name for this Macro:"
        initialValue={`Macro ${new Date().toLocaleTimeString()}`}
        icon="edit"
        onClose={() => {
          setIsMacroPromptOpen(false);
          setMacroDataBuffer('');
        }}
        onSubmit={(name) => {
          const newMacro: Macro = {
            id: 'm_' + Date.now(),
            name,
            data: macroDataBuffer,
            createdAt: Date.now()
          };
          setMacros(prev => [...prev, newMacro]);
          setIsMacroPromptOpen(false);
          setMacroDataBuffer('');
        }}
      />

      {/* 9. Master Password Vault Modal */}
      <MasterPasswordModal
        isOpen={isVaultModalOpen}
        onClose={() => {
          setIsVaultModalOpen(false);
          setPendingVaultAction(null);
        }}
        onSuccess={(password) => {
          setMasterPassword(password);
          setIsVaultModalOpen(false);
          if (pendingVaultAction) {
            pendingVaultAction(password);
            setPendingVaultAction(null);
          }
        }}
        onResetVault={() => {
          // Wipe encrypted passwords from sessions while keeping all IPs, names and folders
          setSessions((prev) =>
            prev.map((s) => ({
              ...s,
              password: s.password && isEncrypted(s.password) ? undefined : s.password
            }))
          );
          // Wipe passwords and private keys from saved credentials
          setCredentials((prev) =>
            prev.map((c) => ({
              ...c,
              password: '',
              privateKey: ''
            }))
          );
          setMasterPassword(null);
        }}
      />

      {/* 10. Password Manager Modal */}
      <PasswordManagerModal
        isOpen={isPasswordManagerOpen}
        sessions={sessions}
        masterPassword={masterPassword}
        onClose={() => setIsPasswordManagerOpen(false)}
        onUpdateSessions={setSessions}
        onOpenCredentialManager={openCredentialManager}
      />

      {/* 11. Embedded Local Servers Modal */}
      {isServersModalOpen && (
        <Suspense fallback={null}>
          <ServersModal
            isOpen={isServersModalOpen}
            onClose={() => setIsServersModalOpen(false)}
          />
        </Suspense>
      )}

      {/* 12. Global Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={globalSettings}
        onSave={(newSettings) => setGlobalSettings(newSettings)}
        onExportSessions={handleExportSessions}
        onImportSessions={handleImportSessions}
      />

      {/* 13. MobaDiff Visual Diff Modal */}
      {diffState.isOpen && (
        <Suspense fallback={null}>
          <DiffModal
            isOpen={diffState.isOpen}
            activeSessionId={activeSshSessionId}
            initialLeftPath={diffState.leftPath}
            initialLeftTitle={diffState.leftTitle}
            initialRightPath={diffState.rightPath}
            initialRightTitle={diffState.rightTitle}
            initialLeftContent={diffState.leftContent}
            initialRightContent={diffState.rightContent}
            onClose={() => setDiffState({ isOpen: false })}
          />
        </Suspense>
      )}

      {/* 14. Credential Manager Modal */}
      {isCredentialManagerOpen && (
        <Suspense fallback={null}>
          <CredentialManagerModal
            isOpen={isCredentialManagerOpen}
            onClose={() => setIsCredentialManagerOpen(false)}
            credentials={credentials}
            onSaveCredentials={handleSaveCredentials}
            sessions={sessions}
            masterPassword={masterPassword}
            onRequireVault={() => {
              setPendingVaultAction(() => () => setIsCredentialManagerOpen(true));
              setIsVaultModalOpen(true);
            }}
          />
        </Suspense>
      )}

      {/* 15. Package Manager Modal */}
      {isPackageManagerOpen && (
        <Suspense fallback={null}>
          <PackageManagerModal
            isOpen={isPackageManagerOpen}
            onClose={() => setIsPackageManagerOpen(false)}
            onInstall={(command) => {
              window.dispatchEvent(new CustomEvent('execute-snippet', { detail: command }));
            }}
          />
        </Suspense>
      )}

      {/* 16. Help & Security Guide Modal */}
      {isHelpModalOpen && (
        <Suspense fallback={null}>
          <HelpModal
            isOpen={isHelpModalOpen}
            onClose={() => setIsHelpModalOpen(false)}
            onOpenVault={() => setIsVaultModalOpen(true)}
            onOpenCredentials={openCredentialManager}
            onOpenPasswords={openPasswordManager}
          />
        </Suspense>
      )}
    </div>
  );
};
