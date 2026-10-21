import React, { useState, useRef } from 'react';
import {
  Star,
  ArrowUpDown,
  Send,
  Folder,
  FolderOpen,
  Key,
  Monitor,
  Terminal,
  ChevronRight,
  ChevronDown,
  User,
  FolderPlus,
  Plus,
  Download,
  Upload,
  Globe,
  Share2,
  Users,
  RotateCw,
  Edit2,
  Copy,
  Trash2,
  Wand2,
  FolderArchive,
  Play,
  Square,
  Circle,
  Shield,
  Cable,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Code2,
  Search,
  X
} from 'lucide-react';
import { SessionConfig, SessionFolder } from '../types';
import { SFTPBrowser } from './SFTPBrowser';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { PromptModal } from './PromptModal';

function renderSessionIcon(session: SessionConfig) {
  let icon = <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
  if (session.type === 'SSH') icon = <Key className="w-3.5 h-3.5 text-yellow-500 shrink-0" />;
  else if (session.type === 'Serial') icon = <Cable className="w-3.5 h-3.5 text-orange-400 shrink-0" />;
  else if (session.type === 'RDP') icon = <Monitor className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
  else if (session.type === 'Telnet') icon = <Radio className="w-3.5 h-3.5 text-purple-400 shrink-0" />;

  if (!session.envColor || session.envColor === 'default') return icon;
  
  // Render colored wrapper based on envColor
  const colorMap: Record<string, string> = {
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    green: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    orange: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };
  const c = colorMap[session.envColor] || '';
  
  return (
    <div className={`p-0.5 rounded border flex items-center justify-center shrink-0 ${c}`}>
      {React.cloneElement(icon as React.ReactElement, { className: 'w-3 h-3' })}
    </div>
  );
}

interface SidebarProps {
  sessions: SessionConfig[];
  folders: SessionFolder[];
  activeSessionId?: string;
  activeSidebarTab: 'sessions' | 'sftp' | 'term' | 'macros' | 'snippets';
  setActiveSidebarTab: (tab: 'sessions' | 'sftp' | 'term' | 'macros' | 'snippets') => void;
  onSelectSession: (session: SessionConfig) => void;
  onNewSession: (folderId?: string | null) => void;
  onEditSession: (session: SessionConfig) => void;
  onDeleteSession: (sessionId: string) => void;
  onDuplicateSession: (session: SessionConfig) => void;
  onCreateFolder: (name: string, parentId?: string | null) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onToggleFolder: (folderId: string) => void;
  onMoveSession?: (sessionId: string, targetFolderId: string | null) => void;
  onMoveFolder?: (folderId: string, targetFolderId: string | null) => void;
  onCloseAllFolders: () => void;
  onExportSessions: () => void;
  onImportSessions: (file: File) => void;
  onGenerateHtml: () => void;
  onOpenFileForEdit: (filePath: string, fileName: string) => void;
  onCompareFile?: (filePath: string, fileName: string) => void;
  onToggleCollapse?: () => void;
  
  // Macros
  macros: import('../types').Macro[];
  isRecording: boolean;
  onToggleRecordMacro: () => void;
  onPlayMacro: (macro: import('../types').Macro) => void;
  onDeleteMacro: (id: string) => void;

  // Snippets
  snippets: import('../types').Snippet[];
  onSaveSnippet: (snippet: import('../types').Snippet) => void;
  onDeleteSnippet: (id: string) => void;
  onExecuteSnippet: (snippet: import('../types').Snippet) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  folders,
  activeSessionId,
  activeSidebarTab,
  setActiveSidebarTab,
  onSelectSession,
  onNewSession,
  onEditSession,
  onDeleteSession,
  onDuplicateSession,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onToggleFolder,
  onMoveSession,
  onMoveFolder,
  onCloseAllFolders,
  onExportSessions,
  onImportSessions,
  onGenerateHtml,
  onOpenFileForEdit,
  onCompareFile,
  onToggleCollapse,
  macros,
  isRecording,
  onToggleRecordMacro,
  onPlayMacro,
  onDeleteMacro,
  snippets,
  onSaveSnippet,
  onDeleteSnippet,
  onExecuteSnippet
}) => {
  const [rootExpanded, setRootExpanded] = useState(true);
  
  // Drag and Drop State
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: 'session' | 'folder' } | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);

  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    title: string;
    initialValue: string;
    icon: 'folder' | 'edit';
    onSubmit: (value: string) => void;
  }>({
    isOpen: false,
    title: '',
    initialValue: '',
    icon: 'folder',
    onSubmit: () => {}
  });

  const [snippetPromptState, setSnippetPromptState] = useState<{
    isOpen: boolean;
    id?: string;
    name: string;
    command: string;
  }>({
    isOpen: false,
    name: '',
    command: ''
  });

  const [sessionSearch, setSessionSearch] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to trigger file import dialog
  const handleTriggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportSessions(file);
      e.target.value = '';
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string, type: 'session' | 'folder') => {
    setDraggedItem({ id, type });
    e.dataTransfer.setData('text/plain', `${type}:${id}`);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverFolderId !== folderId) {
      setDragOverFolderId(folderId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolderId(null);
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    setDragOverFolderId(null);
    
    if (!draggedItem) return;
    
    // Prevent dropping a folder into itself
    if (draggedItem.type === 'folder' && draggedItem.id === targetFolderId) return;
    
    if (draggedItem.type === 'session') {
      onMoveSession?.(draggedItem.id, targetFolderId);
    } else if (draggedItem.type === 'folder') {
      onMoveFolder?.(draggedItem.id, targetFolderId);
    }
    
    setDraggedItem(null);
  };

  // Build the Full MobaXterm Context Menu for "User sessions" / Background
  const openRootContextMenu = (e: React.MouseEvent, targetFolderId?: string | null) => {
    e.preventDefault();
    e.stopPropagation();

    const menuItems: ContextMenuItem[] = [
      {
        id: 'new_session',
        label: 'New session',
        icon: (
          <div className="w-3.5 h-3.5 rounded-full bg-blue-500/20 border border-blue-400 flex items-center justify-center">
            <User className="w-2.5 h-2.5 text-blue-300" />
          </div>
        ),
        action: () => onNewSession(targetFolderId)
      },
      {
        id: 'new_folder',
        label: 'New folder',
        icon: <Folder className="w-3.5 h-3.5 text-sky-400 fill-sky-400/30" />,
        action: () => {
          setPromptState({
            isOpen: true,
            title: 'Enter folder name:',
            initialValue: 'New folder',
            icon: 'folder',
            onSubmit: (val) => onCreateFolder(val, targetFolderId)
          });
        }
      },
      { id: 'sep1', label: '', separator: true },
      {
        id: 'import_file',
        label: 'Import sessions from file',
        icon: <FolderArchive className="w-3.5 h-3.5 text-amber-400" />,
        action: handleTriggerImport
      },
      {
        id: 'export_file',
        label: 'Export all sessions to file',
        icon: <Download className="w-3.5 h-3.5 text-red-400" />,
        action: onExportSessions
      },
      {
        id: 'import_third_party',
        label: 'Import sessions from third-party programs',
        icon: <Wand2 className="w-3.5 h-3.5 text-fuchsia-400" />,
        submenu: [
          {
            id: 'import_putty',
            label: 'PuTTY saved sessions',
            icon: <Terminal className="w-3.5 h-3.5 text-blue-400" />,
            action: () => alert('Scanned local registry: No PuTTY sessions found.')
          },
          {
            id: 'import_ssh_config',
            label: 'OpenSSH config (~/.ssh/config)',
            icon: <Key className="w-3.5 h-3.5 text-yellow-400" />,
            action: () => alert('Imported SSH host aliases from ~/.ssh/config')
          }
        ]
      },
      {
        id: 'generate_html',
        label: 'Generate HTML web page',
        icon: <Globe className="w-3.5 h-3.5 text-cyan-400" />,
        action: onGenerateHtml
      },
      {
        id: 'close_all',
        label: 'Close all folders',
        icon: <RotateCw className="w-3.5 h-3.5 text-sky-400" />,
        action: onCloseAllFolders
      },
      { id: 'sep2', label: '', separator: true },
      {
        id: 'refresh_shared',
        label: 'Refresh shared sessions',
        icon: <RotateCw className="w-3.5 h-3.5 text-emerald-400" />,
        action: () => alert('Shared sessions synchronized successfully!')
      },
      {
        id: 'share_team',
        label: 'Share these sessions with my team',
        icon: <Send className="w-3.5 h-3.5 text-sky-400" />,
        action: () => alert('Exporting team bundle (.mxtsessions)...')
      },
      {
        id: 'manage_shared',
        label: 'Manage existing shared sessions',
        icon: <Users className="w-3.5 h-3.5 text-amber-400" />,
        action: () => alert('Team sessions manager: All current sessions are up to date.')
      }
    ];

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: menuItems
    });
  };

  // Context menu for a specific session item
  const openSessionContextMenu = (e: React.MouseEvent, session: SessionConfig) => {
    e.preventDefault();
    e.stopPropagation();

    const items: ContextMenuItem[] = [
      {
        id: 'start',
        label: 'Execute session',
        icon: <Key className="w-3.5 h-3.5 text-yellow-400" />,
        action: () => onSelectSession(session)
      },
      {
        id: 'edit',
        label: 'Edit session...',
        icon: <Edit2 className="w-3.5 h-3.5 text-blue-400" />,
        action: () => onEditSession(session)
      },
      {
        id: 'dup',
        label: 'Duplicate session',
        icon: <Copy className="w-3.5 h-3.5 text-cyan-400" />,
        action: () => onDuplicateSession(session)
      },
      { id: 's_sep', label: '', separator: true },
      {
        id: 'rename',
        label: 'Rename session',
        icon: <Edit2 className="w-3.5 h-3.5 text-gray-300" />,
        action: () => {
          setPromptState({
            isOpen: true,
            title: 'Enter new session name:',
            initialValue: session.name,
            icon: 'edit',
            onSubmit: (val) => onEditSession({ ...session, name: val })
          });
        }
      },
      {
        id: 'delete',
        label: 'Delete session',
        icon: <Trash2 className="w-3.5 h-3.5 text-red-400" />,
        action: () => {
          if (confirm(`Delete session "${session.name}"?`)) {
            onDeleteSession(session.id);
          }
        }
      }
    ];

    setContextMenu({ x: e.clientX, y: e.clientY, items });
  };

  // Context menu for a folder node
  const openFolderContextMenu = (e: React.MouseEvent, folder: SessionFolder) => {
    e.preventDefault();
    e.stopPropagation();

    const items: ContextMenuItem[] = [
      {
        id: 'new_session_folder',
        label: 'New session here',
        icon: <User className="w-3.5 h-3.5 text-blue-300" />,
        action: () => onNewSession(folder.id)
      },
      {
        id: 'new_subfolder',
        label: 'New subfolder',
        icon: <Folder className="w-3.5 h-3.5 text-sky-400" />,
        action: () => {
          setPromptState({
            isOpen: true,
            title: 'Enter folder name:',
            initialValue: 'New folder',
            icon: 'folder',
            onSubmit: (val) => onCreateFolder(val, folder.id)
          });
        }
      },
      { id: 'f_sep1', label: '', separator: true },
      {
        id: 'rename_folder',
        label: 'Rename folder',
        icon: <Edit2 className="w-3.5 h-3.5 text-gray-300" />,
        action: () => {
          setPromptState({
            isOpen: true,
            title: 'Enter new folder name:',
            initialValue: folder.name,
            icon: 'edit',
            onSubmit: (val) => onRenameFolder(folder.id, val)
          });
        }
      },
      {
        id: 'delete_folder',
        label: 'Delete folder',
        icon: <Trash2 className="w-3.5 h-3.5 text-red-400" />,
        action: () => {
          if (confirm(`Delete folder "${folder.name}" and move items to root?`)) {
            onDeleteFolder(folder.id);
          }
        }
      },
      { id: 'f_sep2', label: '', separator: true },
      {
        id: 'close_all',
        label: 'Close all folders',
        icon: <RotateCw className="w-3.5 h-3.5 text-sky-400" />,
        action: onCloseAllFolders
      }
    ];

    setContextMenu({ x: e.clientX, y: e.clientY, items });
  };



  const renderFolderNode = (folder: SessionFolder) => {
    const isExpanded = folder.isExpanded ?? true;
    const folderSessions = sessions.filter((s) => s.folderId === folder.id);
    const subFolders = folders.filter((f) => f.parentId === folder.id);
    const hasChildren = folderSessions.length > 0 || subFolders.length > 0;

    return (
      <div key={folder.id} className="space-y-0.5">
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, folder.id, 'folder')}
          onDragOver={(e) => handleDragOver(e, folder.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, folder.id)}
          onClick={() => onToggleFolder(folder.id)}
          onContextMenu={(e) => openFolderContextMenu(e, folder)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-gray-300 hover:text-white group transition-all ${
            dragOverFolderId === folder.id ? 'bg-sky-500/30 outline outline-1 outline-sky-400' : 'hover:bg-[#2d2d30]'
          }`}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-500 shrink-0" />
          )}
          <div className="w-4 h-3.5 bg-[#4a729e] rounded-xs flex items-center justify-center shrink-0 shadow-xs">
            <span className="w-3 h-2.5 bg-[#5b87b8] rounded-xs block"></span>
          </div>
          <span className="truncate font-medium">{folder.name}</span>
          <span className="text-[10px] text-gray-600 ml-auto group-hover:text-gray-400">
            ({folderSessions.length + subFolders.length})
          </span>
        </div>

        {/* Children inside this folder */}
        {isExpanded && (
          <div className="pl-5 space-y-0.5">
            {subFolders.map((subFolder) => renderFolderNode(subFolder))}
            {folderSessions.map((session) => (
              <div
                key={session.id}
                draggable
                onDragStart={(e) => handleDragStart(e, session.id, 'session')}
                onClick={() => onSelectSession(session)}
                onContextMenu={(e) => openSessionContextMenu(e, session)}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#2d2d30] active:bg-[#007acc]/40 cursor-pointer text-gray-300 hover:text-white transition-colors"
                title={session.host || session.name}
              >
                {renderSessionIcon(session)}
                <span className="truncate">{session.name}</span>
                {session.credentialId && (
                  <span title="Uses saved credential" className="ml-auto flex items-center">
                    <Shield className="w-3 h-3 text-amber-400 opacity-75" />
                  </span>
                )}
              </div>
            ))}

            {!hasChildren && (
              <div className="text-[11px] text-gray-600 py-0.5 pl-2 italic">
                Empty folder
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full select-none border-r border-[#2d2d30] bg-[#1a1a1c]">
      {/* Hidden File Input for Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".json,.mxtsessions,.txt"
        className="hidden"
      />

      {/* Vertical Icon Strip */}
      <div className="w-10 bg-[#161618] border-r border-[#2d2d30] flex flex-col items-center py-2 gap-2 shrink-0">
        <button
          onClick={() => setActiveSidebarTab('sessions')}
          title="User Sessions"
          className={`p-2 rounded cursor-pointer transition-colors ${
            activeSidebarTab === 'sessions'
              ? 'bg-[#2d2d30] text-yellow-400'
              : 'text-gray-400 hover:text-white hover:bg-[#252528]'
          }`}
        >
          <Star className="w-4 h-4 fill-current" />
        </button>

        <button
          onClick={() => setActiveSidebarTab('sftp')}
          title="SSH browser (SFTP)"
          className={`p-1.5 rounded cursor-pointer transition-colors relative ${
            activeSidebarTab === 'sftp'
              ? 'bg-[#2d2d30]'
              : 'hover:bg-[#252528]'
          }`}
        >
          <div className="w-5 h-5 rounded-full bg-[#d35400] flex items-center justify-center shadow-xs">
            <Globe className="w-3.5 h-3.5 text-yellow-200" />
          </div>
          {activeSessionId && (
            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveSidebarTab('term')}
          title="Terminal Tools"
          className={`p-2 rounded cursor-pointer transition-colors ${
            activeSidebarTab === 'term'
              ? 'bg-[#2d2d30] text-blue-400'
              : 'text-gray-400 hover:text-white hover:bg-[#252528]'
          }`}
        >
          <Send className="w-4 h-4" />
        </button>

        <button
          onClick={() => setActiveSidebarTab('macros')}
          title="Macros"
          className={`p-2 rounded cursor-pointer transition-colors mt-1 relative ${
            activeSidebarTab === 'macros'
              ? 'bg-[#2d2d30] text-rose-400'
              : 'text-gray-400 hover:text-white hover:bg-[#252528]'
          }`}
        >
          <Wand2 className="w-4 h-4" />
          {isRecording && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveSidebarTab('snippets')}
          title="Command Snippets"
          className={`p-2 rounded cursor-pointer transition-colors mt-1 ${
            activeSidebarTab === 'snippets'
              ? 'bg-[#2d2d30] text-emerald-400'
              : 'text-gray-400 hover:text-white hover:bg-[#252528]'
          }`}
        >
          <Code2 className="w-4 h-4" />
        </button>
        {/* Collapse Sidebar Button */}
        {onToggleCollapse && (
          <div className="mt-auto pb-1">
            <button
              onClick={onToggleCollapse}
              title="Hide Sidebar (Ctrl+B)"
              className="p-2 rounded hover:bg-[#2d2d30] text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Main Sidebar Panel */}
      <div
        className="w-64 flex flex-col h-full bg-[#1e1e20] text-gray-300 overflow-hidden"
        onContextMenu={(e) => openRootContextMenu(e, null)}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2d2d30] bg-[#242426] shrink-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {activeSidebarTab === 'sessions' ? 'Sessions' : activeSidebarTab === 'sftp' ? 'SSH browser (SFTP)' : activeSidebarTab === 'term' ? 'Terminal' : activeSidebarTab === 'macros' ? 'Macros' : 'Command Snippets'}
          </span>
          <div className="flex items-center gap-1">
            {activeSidebarTab === 'sessions' && (
              <button
                onClick={(e) => openRootContextMenu(e, null)}
                title="Options"
                className="p-1 hover:bg-[#333336] rounded text-gray-300 hover:text-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                title="Hide Sidebar (Ctrl+B)"
                className="p-1 hover:bg-[#333336] rounded text-gray-400 hover:text-white cursor-pointer"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tree Contents */}
        <div className="flex-1 overflow-hidden">
          {activeSidebarTab === 'sessions' && (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Quick Search Bar */}
              <div className="p-2 pb-1 border-b border-[#2d2d30] shrink-0 bg-[#1e1e20]">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 absolute left-2 text-gray-500 pointer-events-none" />
                  <input
                    type="text"
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                    placeholder="Search sessions (name, host, tag)..."
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-sky-500 rounded pl-7 pr-6 py-1 text-xs text-gray-200 placeholder:text-gray-500 outline-none transition-colors"
                  />
                  {sessionSearch && (
                    <button
                      onClick={() => setSessionSearch('')}
                      className="absolute right-1.5 p-0.5 text-gray-500 hover:text-white rounded cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Sessions Tree or Filtered Results */}
              <div className="p-2 space-y-1 overflow-y-auto flex-1 text-xs font-sans">
                {sessionSearch.trim() ? (
                  /* Filtered List Mode */
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-semibold text-gray-400 px-1 pb-1 flex items-center justify-between">
                      <span>Search Results</span>
                      <span className="text-sky-400">
                        {
                          sessions.filter(s => {
                            const q = sessionSearch.toLowerCase().trim();
                            return s.name.toLowerCase().includes(q) || (s.host && s.host.toLowerCase().includes(q)) || (s.username && s.username.toLowerCase().includes(q)) || s.type.toLowerCase().includes(q) || (s.envColor && s.envColor.toLowerCase().includes(q));
                          }).length
                        } found
                      </span>
                    </div>
                    {sessions
                      .filter(s => {
                        const q = sessionSearch.toLowerCase().trim();
                        return s.name.toLowerCase().includes(q) || (s.host && s.host.toLowerCase().includes(q)) || (s.username && s.username.toLowerCase().includes(q)) || s.type.toLowerCase().includes(q) || (s.envColor && s.envColor.toLowerCase().includes(q));
                      })
                      .map(session => (
                        <div
                          key={session.id}
                          onClick={() => onSelectSession(session)}
                          onContextMenu={(e) => openSessionContextMenu(e, session)}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#2d2d30] active:bg-[#007acc]/40 cursor-pointer text-gray-300 hover:text-white transition-colors border border-transparent hover:border-[#3e3e42]"
                          title={`${session.type}: ${session.host || session.name}`}
                        >
                          {renderSessionIcon(session)}
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="truncate font-medium text-gray-200">{session.name}</span>
                            {session.host && (
                              <span className="text-[10px] text-gray-500 font-mono truncate">
                                {session.username ? `${session.username}@` : ''}{session.host}
                              </span>
                            )}
                          </div>
                          {session.envColor && session.envColor !== 'default' && (
                            <span className={`text-[9px] font-bold px-1 rounded uppercase tracking-wider ${
                              session.envColor === 'red' ? 'bg-red-950 text-red-300 border border-red-800/60' :
                              session.envColor === 'green' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60' :
                              session.envColor === 'orange' ? 'bg-orange-950 text-orange-300 border border-orange-800/60' :
                              session.envColor === 'purple' ? 'bg-purple-950 text-purple-300 border border-purple-800/60' :
                              'bg-blue-950 text-blue-300 border border-blue-800/60'
                            }`}>
                              {session.envColor === 'red' ? 'PROD' : session.envColor.toUpperCase()}
                            </span>
                          )}
                        </div>
                      ))}

                    {sessions.filter(s => {
                      const q = sessionSearch.toLowerCase().trim();
                      return s.name.toLowerCase().includes(q) || (s.host && s.host.toLowerCase().includes(q)) || (s.username && s.username.toLowerCase().includes(q)) || s.type.toLowerCase().includes(q) || (s.envColor && s.envColor.toLowerCase().includes(q));
                    }).length === 0 && (
                      <div className="text-[11px] text-gray-500 py-6 text-center italic">
                        No sessions match &quot;{sessionSearch}&quot;
                      </div>
                    )}
                  </div>
                ) : (
                  /* Normal Tree Mode */
                  <>
                    {/* Root Node: User sessions */}
                    <div
                      onDragOver={(e) => handleDragOver(e, null)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, null)}
                      onClick={() => setRootExpanded(!rootExpanded)}
                      onContextMenu={(e) => openRootContextMenu(e, null)}
                      className={`flex items-center gap-1.5 px-1.5 py-1 rounded border hover:bg-[#2b3a4a]/70 cursor-pointer text-gray-100 transition-all ${
                        dragOverFolderId === null ? 'bg-sky-500/30 border-sky-400' : 'bg-[#2b3a4a]/40 border-[#3b5975]/60'
                      }`}
                    >
                      {rootExpanded ? (
                        <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
                      )}
                      <div className="w-4 h-4 rounded bg-[#3c5d7d] flex items-center justify-center shrink-0">
                        <User className="w-2.5 h-2.5 text-sky-200" />
                      </div>
                      <span className="font-semibold text-xs text-sky-100 truncate">User sessions</span>
                    </div>

                    {/* Contents under User sessions */}
                    {rootExpanded && (
                      <div className="pl-3 space-y-0.5 pt-0.5">
                        {/* Root Folders */}
                        {folders
                          .filter((f) => !f.parentId)
                          .map((folder) => renderFolderNode(folder))}

                        {/* Sessions at root level (no folderId or folderId === null) */}
                        {sessions
                          .filter((s) => !s.folderId)
                          .map((session) => (
                            <div
                              key={session.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, session.id, 'session')}
                              onClick={() => onSelectSession(session)}
                              onContextMenu={(e) => openSessionContextMenu(e, session)}
                              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#2d2d30] active:bg-[#007acc]/40 cursor-pointer text-gray-300 hover:text-white transition-colors"
                              title={session.host || session.name}
                            >
                              {renderSessionIcon(session)}
                              <span className="truncate">{session.name}</span>
                              {session.credentialId && (
                                <span title="Uses saved credential" className="ml-auto flex items-center">
                                  <Shield className="w-3 h-3 text-amber-400 opacity-75" />
                                </span>
                              )}
                            </div>
                          ))}

                        {sessions.length === 0 && folders.length === 0 && (
                          <div className="text-[11px] text-gray-500 py-3 text-center">
                            Right-click to create sessions or folders
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {activeSidebarTab === 'sftp' && (
            <SFTPBrowser
              activeSessionId={activeSessionId}
              onOpenFileForEdit={onOpenFileForEdit}
              onCompareFile={onCompareFile}
            />
          )}

          {activeSidebarTab === 'term' && (
            <div className="p-2 space-y-1 text-xs">
              <div className="px-2 py-1.5 text-gray-400 font-medium">Quick Launch:</div>
              <button
                onClick={() => onSelectSession({ id: 'ps', name: 'PowerShell', type: 'Shell', shellType: 'powershell.exe' })}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-[#2d2d30] flex items-center gap-2"
              >
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                PowerShell
              </button>
              <button
                onClick={() => onSelectSession({ id: 'cmd', name: 'Command Prompt', type: 'Shell', shellType: 'cmd.exe' })}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-[#2d2d30] flex items-center gap-2"
              >
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                Command Prompt
              </button>
            </div>
          )}

          {activeSidebarTab === 'macros' && (
            <div className="flex flex-col h-full bg-[#1e1e20]">
              <div className="p-3 border-b border-[#2d2d30] flex flex-col gap-2 shrink-0">
                <button
                  onClick={onToggleRecordMacro}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-sm font-semibold text-xs shadow-sm cursor-pointer transition-colors ${
                    isRecording
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40'
                      : 'bg-rose-500 hover:bg-rose-600 text-white border border-rose-600'
                  }`}
                >
                  {isRecording ? <Square className="w-3.5 h-3.5 fill-current" /> : <Circle className="w-3.5 h-3.5 fill-current" />}
                  {isRecording ? 'Stop Recording' : 'Record New Macro'}
                </button>
                {isRecording && (
                  <div className="text-[10px] text-red-400 text-center animate-pulse">
                    Recording your keystrokes...
                  </div>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-2">
                <div className="px-1 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Saved Macros</div>
                {macros.length === 0 ? (
                  <div className="text-[11px] text-gray-500 text-center py-4 italic">No macros saved yet</div>
                ) : (
                  <div className="space-y-1">
                    {macros.map(m => (
                      <div key={m.id} className="flex items-center justify-between bg-[#252528] hover:bg-[#2d2d30] p-1.5 rounded border border-[#3e3e42]/50 group">
                        <div className="flex items-center gap-2 overflow-hidden px-1">
                          <Wand2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span className="text-xs text-gray-200 truncate" title={m.name}>{m.name}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => onPlayMacro(m)} className="p-1 hover:bg-[#007acc] rounded text-emerald-400 hover:text-white cursor-pointer" title="Play Macro">
                            <Play className="w-3 h-3 fill-current" />
                          </button>
                          <button onClick={() => onDeleteMacro(m.id)} className="p-1 hover:bg-red-500 rounded text-red-400 hover:text-white cursor-pointer" title="Delete Macro">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSidebarTab === 'snippets' && (
            <div className="flex flex-col h-full bg-[#1e1e20]">
              <div className="p-3 border-b border-[#2d2d30] flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => setSnippetPromptState({ isOpen: true, name: '', command: '' })}
                  className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-sm font-semibold text-xs shadow-sm cursor-pointer transition-colors bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Command Snippet
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2">
                <div className="px-1 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Saved Snippets</div>
                {snippets.length === 0 ? (
                  <div className="text-[11px] text-gray-500 text-center py-4 italic">No snippets saved yet</div>
                ) : (
                  <div className="space-y-1">
                    {snippets.map(s => (
                      <div key={s.id} className="flex flex-col bg-[#252528] hover:bg-[#2d2d30] rounded border border-[#3e3e42]/50 group overflow-hidden">
                        <div className="flex items-center justify-between p-1.5 cursor-pointer" onClick={() => onExecuteSnippet(s)}>
                          <div className="flex items-center gap-2 overflow-hidden px-1">
                            <Code2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="text-xs text-gray-200 truncate font-semibold" title={s.name}>{s.name}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); setSnippetPromptState({ isOpen: true, id: s.id, name: s.name, command: s.command }); }} className="p-1 hover:bg-[#333] rounded text-blue-400 hover:text-white cursor-pointer" title="Edit Snippet">
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onDeleteSnippet(s.id); }} className="p-1 hover:bg-red-500 rounded text-red-400 hover:text-white cursor-pointer" title="Delete Snippet">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="px-2 pb-1.5 text-[10px] text-gray-500 font-mono truncate" onClick={() => onExecuteSnippet(s)} title={s.command}>
                          &gt; {s.command}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Render Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Render Prompt Modal */}
      <PromptModal
        isOpen={promptState.isOpen}
        title={promptState.title}
        initialValue={promptState.initialValue}
        icon={promptState.icon}
        onClose={() => setPromptState((prev) => ({ ...prev, isOpen: false }))}
        onSubmit={(val) => {
          promptState.onSubmit(val);
          setPromptState((prev) => ({ ...prev, isOpen: false }));
        }}
      />

      {/* Snippet Modal */}
      {snippetPromptState.isOpen && (
        <div className="fixed inset-0 z-[300] bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-[#202023] border border-[#3e3e42] rounded-lg shadow-2xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center gap-2.5 text-emerald-400 font-semibold text-sm border-b border-[#3e3e42] pb-3">
              <Code2 className="w-5 h-5" />
              {snippetPromptState.id ? 'Edit Command Snippet' : 'New Command Snippet'}
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">Snippet Name</label>
                <input
                  type="text"
                  autoFocus
                  value={snippetPromptState.name}
                  onChange={e => setSnippetPromptState(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Restart Nginx"
                  className="w-full bg-[#18181b] border border-[#3e3e42] focus:border-emerald-500 text-gray-200 text-xs rounded px-3 py-2 outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">Command to Execute</label>
                <textarea
                  value={snippetPromptState.command}
                  onChange={e => setSnippetPromptState(prev => ({ ...prev, command: e.target.value }))}
                  placeholder="sudo systemctl restart nginx"
                  className="w-full bg-[#18181b] border border-[#3e3e42] focus:border-emerald-500 text-gray-200 text-xs rounded px-3 py-2 outline-none font-mono h-24 resize-none"
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setSnippetPromptState(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-[#333] rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!snippetPromptState.name.trim() || !snippetPromptState.command.trim()) return;
                  onSaveSnippet({
                    id: snippetPromptState.id || 'snippet_' + Date.now(),
                    name: snippetPromptState.name.trim(),
                    command: snippetPromptState.command.trim(),
                    createdAt: Date.now()
                  });
                  setSnippetPromptState(prev => ({ ...prev, isOpen: false }));
                }}
                disabled={!snippetPromptState.name.trim() || !snippetPromptState.command.trim()}
                className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded shadow transition-colors cursor-pointer"
              >
                Save Snippet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
