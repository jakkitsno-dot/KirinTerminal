import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FileText,
  FileCode,
  RotateCw,
  FolderPlus,
  FilePlus,
  Trash2,
  Download,
  Upload,
  ChevronDown,
  Terminal,
  CornerLeftUp,
  XCircle,
  Edit,
  Globe,
  FileDiff
} from 'lucide-react';
import { SFTPFileItem } from '../types';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { PromptModal } from './PromptModal';
import { TextEditorModal } from './TextEditorModal';

interface SFTPBrowserProps {
  activeSessionId?: string;
  onOpenFileForEdit: (filePath: string, fileName: string) => void;
  onCompareFile?: (filePath: string, fileName: string) => void;
}

export const SFTPBrowser: React.FC<SFTPBrowserProps> = ({
  activeSessionId,
  onOpenFileForEdit,
  onCompareFile
}) => {
  const [currentPath, setCurrentPath] = useState<string>('.');
  const [pathInput, setPathInput] = useState<string>('.');
  const [files, setFiles] = useState<SFTPFileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<SFTPFileItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showPathHistory, setShowPathHistory] = useState<boolean>(false);
  const [pathHistory, setPathHistory] = useState<string[]>([]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);

  // Prompt modal state (for mkdir, new file, rename)
  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    title: string;
    initialValue: string;
    icon: 'folder' | 'edit' | 'file';
    onSubmit: (value: string) => void;
  }>({
    isOpen: false,
    title: '',
    initialValue: '',
    icon: 'folder',
    onSubmit: () => {}
  });

  // Editor Modal State
  const [editorState, setEditorState] = useState<{
    isOpen: boolean;
    filePath: string;
    fileName: string;
    content: string;
    isSaving: boolean;
  }>({
    isOpen: false,
    filePath: '',
    fileName: '',
    content: '',
    isSaving: false
  });

  const wsRef = useRef<WebSocket | null>(null);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);

  // Queue State
  type QueueItem = {
    id: string;
    name: string;
    type: 'upload' | 'download' | 'upload_dir';
    localPath?: string;
    remotePath: string;
    file?: File;
    status: 'pending' | 'processing' | 'done' | 'error';
    progress: number;
    error?: string;
  };
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isQueueExpanded, setIsQueueExpanded] = useState<boolean>(true);

  // Connect to websocket for SFTP queries
  useEffect(() => {
    if (!activeSessionId) return;

    const ws = new WebSocket('ws://127.0.0.1:9292');
    wsRef.current = ws;

    ws.onopen = () => {
      loadDirectory('.');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id !== activeSessionId) return;

        if (msg.action === 'sftp_list_result') {
          setIsLoading(false);
          if (msg.error) {
            setErrorMsg(msg.error);
          } else {
            setErrorMsg(null);
            const resolved = msg.path || '.';
            const formatted = resolved.endsWith('/') ? resolved : `${resolved}/`;
            setCurrentPath(formatted);
            setPathInput(formatted);
            
            // Sync to window for Terminal Drag & Drop upload
            if (activeSessionId) {
              (window as any)._sftpCurrentPaths = (window as any)._sftpCurrentPaths || {};
              (window as any)._sftpCurrentPaths[activeSessionId] = resolved;
            }

            setFiles(msg.files || []);
            setSelectedFile(null);

            setPathHistory((prev) => {
              if (prev.includes(formatted)) return prev;
              return [formatted, ...prev.slice(0, 7)];
            });
          }
        } else if (
          [
            'sftp_delete_result',
            'sftp_mkdir_result',
            'sftp_touch_result',
            'sftp_rename_result'
          ].includes(msg.action)
        ) {
          if (msg.error) {
            setErrorMsg(msg.error);
            setIsLoading(false);
          } else {
            loadDirectory(currentPath);
          }
        } else if (msg.action === 'sftp_upload_progress') {
          setQueue(prev => prev.map(q => 
            q.status === 'processing' && q.remotePath === msg.remotePath
              ? { ...q, progress: msg.percent }
              : q
          ));
        } else if (msg.action === 'sftp_upload_result' || msg.action === 'sftp_upload_dir_result') {
          if (msg.error) {
            setErrorMsg(msg.error);
            setQueue(prev => prev.map(q => q.status === 'processing' ? { ...q, status: 'error', error: msg.error } : q));
          } else {
            setQueue(prev => prev.map(q => q.status === 'processing' ? { ...q, status: 'done', progress: 100 } : q));
            // reload dir to show new file
            loadDirectory(currentPath);
          }
          setIsLoading(false);
        } else if (msg.action === 'sftp_download_result') {
          setIsLoading(false);
          if (msg.success && msg.dataBase64) {
            setQueue(prev => prev.map(q => q.status === 'processing' && q.type === 'download' ? { ...q, status: 'done', progress: 100 } : q));
            
            const fileName = msg.fileName || 'download';
            if ((window as any).electronIPC) {
              // Desktop App Mode
              (window as any).electronIPC.invoke('sftp-save-file', { fileName, dataBase64: msg.dataBase64 })
                .then((res: any) => {
                  if (!res.success && res.error !== 'Cancelled') {
                    setErrorMsg('Save failed: ' + res.error);
                  }
                });
            } else {
              // Web Browser Mode fallback
              const byteCharacters = atob(msg.dataBase64);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: 'application/octet-stream' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }
          } else {
            setErrorMsg(msg.error || 'Failed to download file');
            setQueue(prev => prev.map(q => q.status === 'processing' && q.type === 'download' ? { ...q, status: 'error', error: msg.error } : q));
          }
        } else if (msg.action === 'sftp_read_result') {
          setIsLoading(false);
          if (msg.success) {
            setEditorState({
              isOpen: true,
              filePath: msg.filePath,
              fileName: msg.filePath.split('/').pop() || 'File',
              content: msg.content,
              isSaving: false
            });
          } else {
            setErrorMsg(msg.error || 'Failed to read file');
          }
        } else if (msg.action === 'sftp_write_result') {
          if (msg.success) {
            setEditorState(prev => ({ ...prev, isSaving: false }));
          } else {
            setEditorState(prev => ({ ...prev, isSaving: false }));
            setErrorMsg(msg.error || 'Failed to save file');
          }
        }
      } catch (err) {
        console.error('SFTP response parsing error:', err);
      }
    };

    return () => {
      ws.close();
    };
  }, [activeSessionId]);

  // Queue Processing Loop
  useEffect(() => {
    const nextItem = queue.find(q => q.status === 'pending');
    const isProcessing = queue.some(q => q.status === 'processing');

    if (nextItem && !isProcessing && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setQueue(prev => prev.map(q => q.id === nextItem.id ? { ...q, status: 'processing' } : q));

      if (nextItem.type === 'upload_dir') {
        wsRef.current.send(JSON.stringify({
          action: 'sftp_upload_dir',
          id: activeSessionId,
          localPath: nextItem.localPath,
          remotePath: nextItem.remotePath
        }));
      } else if (nextItem.type === 'upload') {
        if (nextItem.localPath) {
          wsRef.current.send(JSON.stringify({
            action: 'sftp_upload',
            id: activeSessionId,
            localPath: nextItem.localPath,
            remotePath: nextItem.remotePath
          }));
        } else if (nextItem.file) {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            wsRef.current?.send(JSON.stringify({
              action: 'sftp_upload_buffer',
              id: activeSessionId,
              remotePath: nextItem.remotePath,
              fileDataBase64: base64
            }));
          };
          reader.readAsDataURL(nextItem.file);
        }
      } else if (nextItem.type === 'download') {
        wsRef.current.send(JSON.stringify({
          action: 'sftp_download',
          id: activeSessionId,
          filePath: nextItem.remotePath
        }));
      }
    }
  }, [queue, activeSessionId]);

  const loadDirectory = (dirPath: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !activeSessionId) return;
    setIsLoading(true);
    setErrorMsg(null);
    wsRef.current.send(
      JSON.stringify({
        action: 'sftp_list',
        id: activeSessionId,
        path: dirPath
      })
    );
  };

  const handleNavigateUp = () => {
    if (currentPath === '/' || currentPath === '.') return;
    const clean = currentPath.endsWith('/') ? currentPath.slice(0, -1) : currentPath;
    const parentPath = clean.substring(0, clean.lastIndexOf('/')) || '/';
    loadDirectory(parentPath);
  };

  const handleItemClick = (file: SFTPFileItem) => {
    setSelectedFile(file);
  };

  const handleItemDoubleClick = (file: SFTPFileItem) => {
    const basePath = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;
    if (file.isDirectory) {
      loadDirectory(`${basePath}${file.name}`);
    } else {
      handleEdit(file);
    }
  };

  const enqueueUpload = (file: File | any, remoteBasePath: string) => {
    const localPath = file.path; // Available in Electron/some envs
    const remotePath = `${remoteBasePath}${file.name}`;
    
    // In webkit, we can check if it's a directory via item entry, but if we only have File, we might guess
    // If it's explicitly a directory or has no type/size, we can try to guess, but it's better if we know.
    // We'll rely on the caller to tell us if it's a dir, or we just queue it as file upload and let the backend fail if it's a dir, 
    // BUT we want to support folders!
    
    const newQueueItem: QueueItem = {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name: file.name,
      type: file.isDirectory ? 'upload_dir' : 'upload',
      localPath,
      remotePath,
      file: localPath ? undefined : file,
      status: 'pending',
      progress: 0
    };
    
    setQueue(prev => [...prev, newQueueItem]);
  };

  const handleUploadFiles = (fileList: FileList | File[]) => {
    if (!activeSessionId) return;
    const basePath = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;
    Array.from(fileList).forEach((file) => {
      enqueueUpload(file, basePath);
    });
  };

  const handleTriggerUpload = () => {
    fileUploadInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.items) {
      const basePath = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;
      Array.from(e.dataTransfer.items).forEach((item) => {
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry();
          const file = item.getAsFile();
          if (file) {
            // Check if directory via webkit entry
            if (entry && entry.isDirectory) {
              (file as any).isDirectory = true;
            } else if (!entry && file.type === "" && file.size % 4096 === 0) {
              // fallback guess for electron if webkitGetAsEntry is null
              (file as any).isDirectory = true;
            }
            enqueueUpload(file, basePath);
          }
        }
      });
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  // Download selected file
  const handleDownload = (fileToDownload?: SFTPFileItem) => {
    const target = fileToDownload || selectedFile;
    if (!target || target.isDirectory || !activeSessionId) return;

    const basePath = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;
    const filePath = `${basePath}${target.name}`;
    
    setQueue(prev => [
      ...prev,
      {
        id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: target.name,
        type: 'download',
        remotePath: filePath,
        status: 'pending',
        progress: 0
      }
    ]);
  };

  // Create folder
  const handleCreateFolder = () => {
    setPromptState({
      isOpen: true,
      title: 'Create new directory:',
      initialValue: 'New_Folder',
      icon: 'folder',
      onSubmit: (name) => {
        if (!wsRef.current || !activeSessionId) return;
        const basePath = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;
        wsRef.current.send(
          JSON.stringify({
            action: 'sftp_mkdir',
            id: activeSessionId,
            dirPath: `${basePath}${name}`
          })
        );
      }
    });
  };

  // Create empty file
  const handleCreateFile = () => {
    setPromptState({
      isOpen: true,
      title: 'Create new file:',
      initialValue: 'new_file.txt',
      icon: 'file',
      onSubmit: (name) => {
        if (!wsRef.current || !activeSessionId) return;
        const basePath = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;
        wsRef.current.send(
          JSON.stringify({
            action: 'sftp_touch',
            id: activeSessionId,
            filePath: `${basePath}${name}`
          })
        );
      }
    });
  };

  // Rename file/folder
  const handleRename = (file: SFTPFileItem) => {
    setPromptState({
      isOpen: true,
      title: 'Rename:',
      initialValue: file.name,
      icon: 'edit',
      onSubmit: (newName) => {
        if (!wsRef.current || !activeSessionId || newName === file.name) return;
        const basePath = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;
        wsRef.current.send(
          JSON.stringify({
            action: 'sftp_rename',
            id: activeSessionId,
            oldPath: `${basePath}${file.name}`,
            newPath: `${basePath}${newName}`
          })
        );
      }
    });
  };

  // Delete selected item
  const handleDelete = (fileToDelete?: SFTPFileItem) => {
    const target = fileToDelete || selectedFile;
    if (!target || !wsRef.current || !activeSessionId) return;
    if (!confirm(`Are you sure you want to delete "${target.name}"?`)) return;

    const basePath = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;
    wsRef.current.send(
      JSON.stringify({
        action: 'sftp_delete',
        id: activeSessionId,
        targetPath: `${basePath}${target.name}`,
        isDirectory: target.isDirectory
      })
    );
  };

  // Open terminal in this directory
  const handleOpenTerminalHere = () => {
    if (!wsRef.current || !activeSessionId) return;
    const clean = currentPath.endsWith('/') ? currentPath.slice(0, -1) : currentPath;
    wsRef.current.send(
      JSON.stringify({
        action: 'input',
        id: activeSessionId,
        data: `cd "${clean || '/'}"\r`
      })
    );
  };

  // Open in editor
  const handleEdit = (fileToEdit?: SFTPFileItem) => {
    const target = fileToEdit || selectedFile;
    if (!target || target.isDirectory || !wsRef.current || !activeSessionId) return;
    const basePath = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;
    const filePath = `${basePath}${target.name}`;
    
    setIsLoading(true);
    wsRef.current.send(
      JSON.stringify({
        action: 'sftp_read',
        id: activeSessionId,
        filePath
      })
    );
  };

  // Right-click context menu on file/folder
  const handleItemContextMenu = (e: React.MouseEvent, file: SFTPFileItem) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFile(file);

    const basePath = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;
    const fullPath = `${basePath}${file.name}`;

    const items: ContextMenuItem[] = [
      ...(!file.isDirectory
        ? [
            {
              id: 'edit',
              label: 'Edit with text editor',
              icon: <Edit className="w-3.5 h-3.5 text-blue-400" />,
              action: () => handleEdit(file)
            },
            {
              id: 'compare',
              label: 'Compare with MobaDiff...',
              icon: <FileDiff className="w-3.5 h-3.5 text-teal-400" />,
              action: () => onCompareFile?.(fullPath, file.name)
            },
            {
              id: 'download',
              label: 'Download',
              icon: <Download className="w-3.5 h-3.5 text-sky-400" />,
              action: () => handleDownload(file)
            }
          ]
        : [
            {
              id: 'open',
              label: 'Open directory',
              icon: <Folder className="w-3.5 h-3.5 text-yellow-400" />,
              action: () => loadDirectory(fullPath)
            }
          ]),
      { id: 'sep1', label: '', separator: true },
      {
        id: 'term_here',
        label: 'Open terminal here',
        icon: <Terminal className="w-3.5 h-3.5 text-emerald-400" />,
        action: () => {
          if (!wsRef.current || !activeSessionId) return;
          const targetDir = file.isDirectory ? fullPath : currentPath;
          wsRef.current.send(
            JSON.stringify({
              action: 'input',
              id: activeSessionId,
              data: `cd "${targetDir}"\r`
            })
          );
        }
      },
      {
        id: 'upload_here',
        label: 'Upload files here...',
        icon: <Upload className="w-3.5 h-3.5 text-emerald-400" />,
        action: handleTriggerUpload
      },
      { id: 'sep2', label: '', separator: true },
      {
        id: 'rename',
        label: 'Rename',
        icon: <Edit className="w-3.5 h-3.5 text-gray-300" />,
        action: () => handleRename(file)
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: <Trash2 className="w-3.5 h-3.5 text-red-400" />,
        action: () => handleDelete(file)
      },
      { id: 'sep3', label: '', separator: true },
      {
        id: 'copy_path',
        label: 'Copy path to clipboard',
        icon: <FileText className="w-3.5 h-3.5 text-purple-400" />,
        action: () => navigator.clipboard.writeText(fullPath)
      },
      {
        id: 'refresh',
        label: 'Refresh',
        icon: <RotateCw className="w-3.5 h-3.5 text-green-400" />,
        action: () => loadDirectory(currentPath)
      }
    ];

    setContextMenu({ x: e.clientX, y: e.clientY, items });
  };

  // Right-click context menu on blank background
  const handleBackgroundContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const items: ContextMenuItem[] = [
      {
        id: 'new_folder',
        label: 'Create new directory',
        icon: <FolderPlus className="w-3.5 h-3.5 text-yellow-400" />,
        action: handleCreateFolder
      },
      {
        id: 'new_file',
        label: 'Create new file',
        icon: <FilePlus className="w-3.5 h-3.5 text-blue-400" />,
        action: handleCreateFile
      },
      {
        id: 'upload',
        label: 'Upload files here...',
        icon: <Upload className="w-3.5 h-3.5 text-emerald-400" />,
        action: handleTriggerUpload
      },
      { id: 'sep1', label: '', separator: true },
      {
        id: 'term_here',
        label: 'Open terminal here',
        icon: <Terminal className="w-3.5 h-3.5 text-emerald-400" />,
        action: handleOpenTerminalHere
      },
      {
        id: 'refresh',
        label: 'Refresh',
        icon: <RotateCw className="w-3.5 h-3.5 text-green-400" />,
        action: () => loadDirectory(currentPath)
      }
    ];

    setContextMenu({ x: e.clientX, y: e.clientY, items });
  };

  // Format file size in KB matching MobaXterm
  const formatFileSizeKB = (bytes: number) => {
    if (bytes === 0) return '0';
    const kb = Math.ceil(bytes / 1024);
    return kb.toLocaleString();
  };

  const getFileIcon = (file: SFTPFileItem) => {
    if (file.isDirectory) {
      return (
        <div className="w-4 h-3.5 bg-[#d4a017] rounded-xs flex items-center justify-center shrink-0 shadow-xs border border-[#b8860b]">
          <span className="w-3 h-2 bg-[#f3c242] rounded-xs block"></span>
        </div>
      );
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['sh', 'bash', 'zsh'].includes(ext || '')) {
      return (
        <div className="w-3.5 h-3.5 rounded-xs bg-[#2e3b4e] border border-[#486581] flex items-center justify-center shrink-0">
          <span className="text-[8px] font-bold text-emerald-400">&gt;</span>
        </div>
      );
    }
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'json', 'yaml', 'yml', 'html', 'css'].includes(ext || '')) {
      return <FileCode className="w-3.5 h-3.5 text-[#58a6ff] shrink-0" />;
    }
    return <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />;
  };

  if (!activeSessionId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center text-gray-500 text-xs">
        <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center mb-2">
          <Globe className="w-6 h-6 text-orange-400" />
        </div>
        <p className="font-semibold text-gray-300">SSH browser (SFTP)</p>
        <p className="text-[11px] mt-1 text-gray-500">Connect to an SSH session to view remote files graphically</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full bg-[#18181a] text-gray-200 select-none overflow-hidden text-xs relative font-sans"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={handleBackgroundContextMenu}
    >
      {/* Hidden File Picker for Upload Button */}
      <input
        type="file"
        ref={fileUploadInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleUploadFiles(e.target.files);
            e.target.value = '';
          }
        }}
        multiple
        className="hidden"
      />

      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-[#007acc]/20 border-2 border-dashed border-[#0098ff] flex flex-col items-center justify-center backdrop-blur-xs pointer-events-none">
          <Upload className="w-10 h-10 text-[#0098ff] mb-2 animate-bounce" />
          <span className="text-sm font-semibold text-white bg-black/60 px-3 py-1.5 rounded shadow-lg border border-[#0098ff]/50">
            Drop files to upload into {currentPath}
          </span>
        </div>
      )}

      {/* 1. Header (Matching MobaXterm Image 2) */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[#202022] border-b border-[#2d2d30] shrink-0">
        <div className="w-5 h-5 rounded-full bg-[#e67e22] border border-[#d35400] flex items-center justify-center shrink-0 shadow-xs">
          <Globe className="w-3.5 h-3.5 text-yellow-100" />
        </div>
        <span className="font-semibold text-xs text-gray-200 tracking-wide">SSH browser (SFTP)</span>
      </div>

      {/* 2. MobaXterm Authentic Action Toolbar (Matching Image 2 icons exactly) */}
      <div className="flex items-center gap-0.5 px-1 py-1 bg-[#252528] border-b border-[#333336] shrink-0">
        {/* Parent Directory */}
        <button
          onClick={handleNavigateUp}
          title="Parent folder (cd ..)"
          className="p-1 rounded hover:bg-[#38383c] active:bg-[#444448] text-amber-400 hover:text-amber-300 cursor-pointer"
        >
          <CornerLeftUp className="w-4 h-4 text-[#f1c40f]" />
        </button>

        {/* Download Selected */}
        <button
          onClick={() => handleDownload()}
          disabled={!selectedFile || selectedFile.isDirectory}
          title="Download selected file"
          className="p-1 rounded hover:bg-[#38383c] active:bg-[#444448] text-sky-400 hover:text-sky-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Download className="w-4 h-4 text-[#3498db]" />
        </button>

        {/* Upload File(s) */}
        <button
          onClick={handleTriggerUpload}
          title="Upload to current folder"
          className="p-1 rounded hover:bg-[#38383c] active:bg-[#444448] text-emerald-400 hover:text-emerald-300 cursor-pointer"
        >
          <Upload className="w-4 h-4 text-[#2ecc71]" />
        </button>

        {/* Refresh */}
        <button
          onClick={() => loadDirectory(currentPath)}
          title="Refresh current folder"
          className="p-1 rounded hover:bg-[#38383c] active:bg-[#444448] text-emerald-400 hover:text-emerald-300 cursor-pointer"
        >
          <RotateCw className={`w-3.5 h-3.5 text-[#2ecc71] ${isLoading ? 'animate-spin' : ''}`} />
        </button>

        {/* Create Directory */}
        <button
          onClick={handleCreateFolder}
          title="Create new directory"
          className="p-1 rounded hover:bg-[#38383c] active:bg-[#444448] text-amber-400 hover:text-amber-300 cursor-pointer"
        >
          <FolderPlus className="w-4 h-4 text-[#f39c12]" />
        </button>

        {/* Create File */}
        <button
          onClick={handleCreateFile}
          title="Create new file"
          className="p-1 rounded hover:bg-[#38383c] active:bg-[#444448] text-sky-300 hover:text-sky-200 cursor-pointer"
        >
          <FilePlus className="w-4 h-4 text-[#5dade2]" />
        </button>

        {/* Delete */}
        <button
          onClick={() => handleDelete()}
          disabled={!selectedFile}
          title="Delete selected item"
          className="p-1 rounded hover:bg-red-950/60 active:bg-red-900/80 text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <XCircle className="w-4 h-4 text-[#e74c3c]" />
        </button>

        {/* Edit in Text Editor */}
        <button
          onClick={() => handleEdit()}
          disabled={!selectedFile || selectedFile.isDirectory}
          title="Edit with text editor"
          className="p-1 rounded hover:bg-[#38383c] active:bg-[#444448] text-purple-400 hover:text-purple-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <div className="w-4 h-4 rounded bg-[#8e44ad] text-white flex items-center justify-center text-[10px] font-bold">
            A
          </div>
        </button>

        {/* Open Terminal in this Directory */}
        <button
          onClick={handleOpenTerminalHere}
          title="Open terminal in this directory"
          className="p-1 rounded hover:bg-[#38383c] active:bg-[#444448] text-gray-300 hover:text-white cursor-pointer ml-auto"
        >
          <div className="w-4 h-4 bg-black border border-gray-600 rounded-xs flex items-center justify-center text-[9px] font-mono text-emerald-400">
            &gt;_
          </div>
        </button>
      </div>

      {/* 3. Path Input Bar with History Dropdown (Matching Image 2) */}
      <div className="relative px-1.5 py-1 bg-[#161618] border-b border-[#2d2d30] flex items-center gap-1 shrink-0">
        <input
          type="text"
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              loadDirectory(pathInput.trim());
            }
          }}
          className="flex-1 bg-[#0f0f11] border border-[#3e3e42] focus:border-[#007acc] text-[11px] text-[#5dade2] font-mono px-2 py-0.5 rounded outline-none selection:bg-[#264f78]"
        />
        <button
          onClick={() => setShowPathHistory(!showPathHistory)}
          title="Recent paths"
          className="p-1 hover:bg-[#2a2a2e] rounded text-gray-400 hover:text-white cursor-pointer"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {/* History Dropdown */}
        {showPathHistory && (
          <div className="absolute top-full left-1.5 right-1.5 mt-0.5 bg-[#252528] border border-[#3e3e42] rounded shadow-2xl py-1 z-50 text-[11px] font-mono max-h-48 overflow-y-auto">
            {pathHistory.map((hist, i) => (
              <div
                key={i}
                onClick={() => {
                  loadDirectory(hist);
                  setShowPathHistory(false);
                }}
                className="px-2.5 py-1 hover:bg-[#007acc] hover:text-white text-gray-300 cursor-pointer truncate"
              >
                {hist}
              </div>
            ))}
            {pathHistory.length === 0 && (
              <div className="px-2 py-1 text-gray-500 italic">No history yet</div>
            )}
          </div>
        )}
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="px-2 py-1 bg-red-950/70 text-red-300 text-[11px] border-b border-red-900/60 truncate flex items-center justify-between shrink-0">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white ml-2">
            ×
          </button>
        </div>
      )}

      {/* 4. File List Table Header (Matching Image 2: "Name" | "Size (KB)") */}
      <div className="grid grid-cols-12 px-2 py-1 bg-[#1e1e22] border-b border-[#2d2d30] text-[11px] font-medium text-gray-400 shrink-0">
        <span className="col-span-9 flex items-center gap-1">
          <ChevronDown className="w-3 h-3 text-sky-400" /> Name
        </span>
        <span className="col-span-3 text-right">Size (KB)</span>
      </div>

      {/* 5. File Items List */}
      <div className="flex-1 overflow-y-auto p-0.5 divide-y divide-[#222225] bg-[#121214]">
        {/* Parent Directory ".." item (Matching Image 2 top row!) */}
        {currentPath !== '/' && currentPath !== '.' && (
          <div
            onDoubleClick={handleNavigateUp}
            className="grid grid-cols-12 items-center px-2 py-1 rounded-xs cursor-pointer hover:bg-[#25252a] text-emerald-400 transition-colors"
          >
            <div className="col-span-9 flex items-center gap-2 overflow-hidden">
              <div className="w-4 h-3.5 bg-[#1b4332] rounded-xs flex items-center justify-center shrink-0 border border-[#2d6a4f]">
                <CornerLeftUp className="w-3 h-3 text-[#52b788]" />
              </div>
              <span className="truncate font-semibold text-xs text-gray-200">..</span>
            </div>
            <div className="col-span-3 text-right text-[11px] opacity-40"></div>
          </div>
        )}

        {/* Directory & File entries */}
        {files.map((file, idx) => {
          const isSelected = selectedFile?.name === file.name;
          return (
            <div
              key={idx}
              onClick={() => handleItemClick(file)}
              onDoubleClick={() => handleItemDoubleClick(file)}
              onContextMenu={(e) => handleItemContextMenu(e, file)}
              className={`grid grid-cols-12 items-center px-2 py-0.5 rounded-xs cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-[#007acc] text-white font-medium'
                  : 'hover:bg-[#202026] text-gray-300'
              }`}
            >
              <div className="col-span-9 flex items-center gap-2 overflow-hidden">
                {getFileIcon(file)}
                <span className="truncate text-xs">{file.name}</span>
              </div>
              <div className="col-span-3 text-right text-[11px] opacity-80 font-mono">
                {file.isDirectory ? '' : formatFileSizeKB(file.size)}
              </div>
            </div>
          );
        })}

        {files.length === 0 && !isLoading && (
          <div className="text-center text-gray-500 py-8 text-[11px]">
            Directory is empty
          </div>
        )}
      </div>

      {/* SFTP Transfer Queue */}
      {queue.length > 0 && (
        <div className="bg-[#141416] border-t border-[#2d2d30] flex flex-col shrink-0">
          <div
            className="flex items-center justify-between px-2 py-1 cursor-pointer bg-[#1c1c20] hover:bg-[#25252a] text-[10px] font-semibold text-gray-300"
            onClick={() => setIsQueueExpanded(!isQueueExpanded)}
          >
            <span className="flex items-center gap-1.5">
              <span className={`transition-transform ${isQueueExpanded ? '' : 'rotate-180'}`}>
                <ChevronDown className="w-3 h-3" />
              </span>
              SFTP Transfers ({queue.filter(q => q.status === 'pending' || q.status === 'processing').length} active)
            </span>
            <button
              className="text-gray-500 hover:text-gray-300 px-1"
              onClick={(e) => {
                e.stopPropagation();
                setQueue(queue.filter(q => q.status === 'pending' || q.status === 'processing'));
              }}
              title="Clear completed/failed"
            >
              Clear
            </button>
          </div>
          {isQueueExpanded && (
            <div className="max-h-32 overflow-y-auto divide-y divide-[#222225] p-1">
              {queue.map(q => (
                <div key={q.id} className="flex flex-col py-1 px-1.5 text-[10px]">
                  <div className="flex items-center justify-between text-gray-300">
                    <span className="truncate flex-1 font-medium" title={q.name}>
                      {q.type === 'download' ? '↓' : '↑'} {q.name}
                    </span>
                    <span className={`shrink-0 ml-2 ${
                      q.status === 'done' ? 'text-emerald-400' :
                      q.status === 'error' ? 'text-red-400' :
                      q.status === 'processing' ? 'text-blue-400' : 'text-gray-500'
                    }`}>
                      {q.status === 'done' ? 'Done' :
                       q.status === 'error' ? 'Error' :
                       q.status === 'processing' ? `${q.progress}%` : 'Pending'}
                    </span>
                  </div>
                  {q.status === 'processing' && (
                    <div className="w-full bg-[#2a2a2f] h-1.5 mt-1 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${q.progress}%` }} />
                    </div>
                  )}
                  {q.error && (
                    <span className="text-red-400 mt-0.5 truncate">{q.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. Bottom Status Bar */}
      <div className="px-2.5 py-1 bg-[#1a1a1d] border-t border-[#2d2d30] text-[10px] text-gray-400 flex justify-between shrink-0 font-mono">
        <span>{files.length} items</span>
        {selectedFile && (
          <span className="truncate max-w-[150px] text-sky-400">
            {selectedFile.name} {selectedFile.isDirectory ? '<DIR>' : `(${formatFileSizeKB(selectedFile.size)} KB)`}
          </span>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Prompt Modal for Folder / File / Rename */}
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

      <TextEditorModal
        isOpen={editorState.isOpen}
        fileName={editorState.fileName}
        filePath={editorState.filePath}
        initialContent={editorState.content}
        isSaving={editorState.isSaving}
        onClose={() => setEditorState((prev) => ({ ...prev, isOpen: false }))}
        onSave={(newContent) => {
          if (!wsRef.current || !activeSessionId) return;
          setEditorState((prev) => ({ ...prev, isSaving: true }));
          wsRef.current.send(
            JSON.stringify({
              action: 'sftp_write',
              id: activeSessionId,
              filePath: editorState.filePath,
              content: newContent
            })
          );
        }}
      />
    </div>
  );
};
