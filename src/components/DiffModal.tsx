import React, { useState, useEffect, useRef } from 'react';
import {
  FileDiff,
  X,
  Upload,
  ArrowLeftRight,
  Maximize2,
  Minimize2,
  ChevronUp,
  ChevronDown,
  Download,
  Copy,
  Check,
  RotateCcw,
  Sliders,
  FileCode,
  Save,
  AlertCircle,
  FolderOpen,
  Globe
} from 'lucide-react';
import { DiffEditor } from '@monaco-editor/react';

export interface DiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSessionId?: string;
  initialLeftContent?: string;
  initialRightContent?: string;
  initialLeftTitle?: string;
  initialRightTitle?: string;
  initialLeftPath?: string;
  initialRightPath?: string;
}

export const DiffModal: React.FC<DiffModalProps> = ({
  isOpen,
  onClose,
  activeSessionId,
  initialLeftContent = '',
  initialRightContent = '',
  initialLeftTitle = 'Original',
  initialRightTitle = 'Modified',
  initialLeftPath,
  initialRightPath
}) => {
  const [leftContent, setLeftContent] = useState<string>(initialLeftContent);
  const [rightContent, setRightContent] = useState<string>(initialRightContent);
  const [leftTitle, setLeftTitle] = useState<string>(initialLeftTitle);
  const [rightTitle, setRightTitle] = useState<string>(initialRightTitle);
  const [leftPath, setLeftPath] = useState<string | undefined>(initialLeftPath);
  const [rightPath, setRightPath] = useState<string | undefined>(initialRightPath);

  const [isSideBySide, setIsSideBySide] = useState<boolean>(true);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState<boolean>(false);
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
  const [language, setLanguage] = useState<string>('plaintext');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Stats & Navigation
  const [diffCount, setDiffCount] = useState<number>(0);
  const [currentDiffIndex, setCurrentDiffIndex] = useState<number>(0);
  const [copiedSide, setCopiedSide] = useState<'left' | 'right' | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const diffEditorRef = useRef<any>(null);
  const leftFileInputRef = useRef<HTMLInputElement>(null);
  const rightFileInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingSftpTargetRef = useRef<'left' | 'right' | null>(null);

  // Sync initial props when opened
  useEffect(() => {
    if (isOpen) {
      setLeftContent(initialLeftContent);
      setRightContent(initialRightContent);
      setLeftTitle(initialLeftTitle);
      setRightTitle(initialRightTitle);
      setLeftPath(initialLeftPath);
      setRightPath(initialRightPath);

      const detectedLang = detectLanguage(initialRightTitle || initialLeftTitle || '');
      setLanguage(detectedLang);
    }
  }, [isOpen, initialLeftContent, initialRightContent, initialLeftTitle, initialRightTitle, initialLeftPath, initialRightPath]);

  // Load from SFTP if path provided and content is empty
  useEffect(() => {
    if (!isOpen || !activeSessionId) return;

    const ws = new WebSocket('ws://127.0.0.1:9292');
    wsRef.current = ws;

    ws.onopen = () => {
      if (initialLeftPath && !initialLeftContent) {
        ws.send(JSON.stringify({ action: 'sftp_read', id: activeSessionId, filePath: initialLeftPath }));
      }
      if (initialRightPath && !initialRightContent) {
        ws.send(JSON.stringify({ action: 'sftp_read', id: activeSessionId, filePath: initialRightPath }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id !== activeSessionId) return;

        if (msg.action === 'sftp_read_result') {
          if (msg.success) {
            setSaveStatus(null);
            const targetSide = pendingSftpTargetRef.current || (msg.filePath === initialLeftPath || (!initialRightPath && initialLeftPath) ? 'left' : 'right');
            const fileName = msg.filePath.split('/').pop() || msg.filePath;
            if (targetSide === 'left') {
              setLeftContent(msg.content);
              setLeftTitle(fileName);
              setLeftPath(msg.filePath);
            } else {
              setRightContent(msg.content);
              setRightTitle(fileName);
              setRightPath(msg.filePath);
            }
            setLanguage(detectLanguage(fileName));
          } else {
            setSaveStatus('Failed to load: ' + (msg.error || 'File not found'));
            setTimeout(() => setSaveStatus(null), 4000);
          }
          pendingSftpTargetRef.current = null;
        } else if (msg.action === 'sftp_write_result') {
          if (msg.success) {
            setSaveStatus('Saved to server!');
            setTimeout(() => setSaveStatus(null), 3000);
          } else {
            setSaveStatus('Error saving: ' + (msg.error || 'Failed'));
          }
        }
      } catch (err) {
        console.error('DiffModal WS parse error:', err);
      }
    };

    return () => {
      ws.close();
    };
  }, [isOpen, activeSessionId, initialLeftPath, initialRightPath, initialLeftContent, initialRightContent]);

  // Keyboard Shortcuts (F7: Next Diff, Shift+F7: Prev Diff, Ctrl+S: Save, Escape: Close)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'F7') {
        e.preventDefault();
        if (e.shiftKey) {
          handlePrevDiff();
        } else {
          handleNextDiff();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (rightPath) {
          handleSaveToRemote('right');
        } else if (leftPath) {
          handleSaveToRemote('left');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, rightPath, leftPath, activeSessionId, diffCount, currentDiffIndex]);

  // Handle Monaco onMount
  const handleEditorMount = (editor: any) => {
    diffEditorRef.current = editor;

    // Listen to diff updates to count changes
    editor.onDidUpdateDiff(() => {
      try {
        const lineChanges = editor.getLineChanges() || [];
        setDiffCount(lineChanges.length);
        if (lineChanges.length === 0) {
          setCurrentDiffIndex(0);
        }
      } catch (e) {}
    });
  };

  const handleNextDiff = () => {
    if (!diffEditorRef.current) return;
    const editor = diffEditorRef.current;
    const lineChanges = editor.getLineChanges() || [];
    if (lineChanges.length === 0) return;

    const nextIndex = (currentDiffIndex + 1) % lineChanges.length;
    setCurrentDiffIndex(nextIndex);

    const change = lineChanges[nextIndex];
    if (change) {
      const targetModified = Math.max(1, change.modifiedStartLineNumber || 1);
      const targetOriginal = Math.max(1, change.originalStartLineNumber || 1);
      editor.getModifiedEditor().revealLineInCenter(targetModified);
      editor.getModifiedEditor().setPosition({ lineNumber: targetModified, column: 1 });
      editor.getOriginalEditor().revealLineInCenter(targetOriginal);
      editor.getModifiedEditor().focus();
    }
  };

  const handlePrevDiff = () => {
    if (!diffEditorRef.current) return;
    const editor = diffEditorRef.current;
    const lineChanges = editor.getLineChanges() || [];
    if (lineChanges.length === 0) return;

    const prevIndex = (currentDiffIndex - 1 + lineChanges.length) % lineChanges.length;
    setCurrentDiffIndex(prevIndex);

    const change = lineChanges[prevIndex];
    if (change) {
      const targetModified = Math.max(1, change.modifiedStartLineNumber || 1);
      const targetOriginal = Math.max(1, change.originalStartLineNumber || 1);
      editor.getModifiedEditor().revealLineInCenter(targetModified);
      editor.getModifiedEditor().setPosition({ lineNumber: targetModified, column: 1 });
      editor.getOriginalEditor().revealLineInCenter(targetOriginal);
      editor.getModifiedEditor().focus();
    }
  };

  // Swap Left and Right
  const handleSwap = () => {
    const currentLeft = diffEditorRef.current?.getOriginalEditor()?.getValue() ?? leftContent;
    const currentRight = diffEditorRef.current?.getModifiedEditor()?.getValue() ?? rightContent;

    const tempTitle = leftTitle;
    const tempPath = leftPath;

    setLeftContent(currentRight);
    setLeftTitle(rightTitle);
    setLeftPath(rightPath);

    setRightContent(currentLeft);
    setRightTitle(tempTitle);
    setRightPath(tempPath);
  };

  // Local File Upload Handlers
  const handleLeftFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setLeftContent(text);
      setLeftTitle(file.name);
      setLeftPath(undefined);
      setLanguage(detectLanguage(file.name));
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset so the same file can be selected again
  };

  const handleRightFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRightContent(text);
      setRightTitle(file.name);
      setRightPath(undefined);
      setLanguage(detectLanguage(file.name));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Drag and Drop File Handlers
  const handleDrop = (e: React.DragEvent, side: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (side === 'left') {
        setLeftContent(text);
        setLeftTitle(file.name);
        setLeftPath(undefined);
      } else {
        setRightContent(text);
        setRightTitle(file.name);
        setRightPath(undefined);
      }
      setLanguage(detectLanguage(file.name));
    };
    reader.readAsText(file);
  };

  // Remote SFTP File Loader
  const handleLoadRemoteFile = (side: 'left' | 'right') => {
    if (!activeSessionId) {
      alert('No active SSH/SFTP session. Please open an SSH session to load remote server files.');
      return;
    }
    const defaultPath = side === 'left' ? (leftPath || '/etc/') : (rightPath || '/etc/');
    const path = prompt(`Enter remote SFTP file path to compare on ${side === 'left' ? 'Left (Original)' : 'Right (Modified)'} pane:`, defaultPath);
    if (!path || !path.trim()) return;

    const cleanPath = path.trim();
    pendingSftpTargetRef.current = side;
    setSaveStatus(`Loading ${cleanPath}...`);

    wsRef.current?.send(JSON.stringify({
      action: 'sftp_read',
      id: activeSessionId,
      filePath: cleanPath
    }));
  };

  // Copy to clipboard
  const handleCopy = (side: 'left' | 'right') => {
    const textToCopy = side === 'left'
      ? (diffEditorRef.current?.getOriginalEditor()?.getValue() ?? leftContent)
      : (diffEditorRef.current?.getModifiedEditor()?.getValue() ?? rightContent);

    navigator.clipboard.writeText(textToCopy);
    setCopiedSide(side);
    setTimeout(() => setCopiedSide(null), 2000);
  };

  // Download File
  const handleDownload = (side: 'left' | 'right') => {
    const text = side === 'left'
      ? (diffEditorRef.current?.getOriginalEditor()?.getValue() ?? leftContent)
      : (diffEditorRef.current?.getModifiedEditor()?.getValue() ?? rightContent);

    const filename = side === 'left' ? leftTitle : rightTitle;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'diff-output.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Save back to remote SFTP if applicable
  const handleSaveToRemote = (side: 'left' | 'right') => {
    const targetPath = side === 'left' ? leftPath : rightPath;
    const targetContent = side === 'left'
      ? (diffEditorRef.current?.getOriginalEditor()?.getValue() ?? leftContent)
      : (diffEditorRef.current?.getModifiedEditor()?.getValue() ?? rightContent);

    if (!targetPath || !activeSessionId || !wsRef.current) {
      alert('Cannot save: This file was not loaded from an active SFTP session.');
      return;
    }

    setSaveStatus('Saving to server...');
    wsRef.current.send(JSON.stringify({
      action: 'sftp_write',
      id: activeSessionId,
      filePath: targetPath,
      content: targetContent
    }));
  };

  // Language Detection
  const detectLanguage = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      json: 'json',
      html: 'html',
      css: 'css',
      scss: 'scss',
      less: 'less',
      md: 'markdown',
      py: 'python',
      sh: 'shell',
      bash: 'shell',
      zsh: 'shell',
      yml: 'yaml',
      yaml: 'yaml',
      xml: 'xml',
      sql: 'sql',
      php: 'php',
      c: 'c',
      cpp: 'cpp',
      h: 'c',
      hpp: 'cpp',
      cs: 'csharp',
      java: 'java',
      go: 'go',
      rs: 'rust',
      rb: 'ruby',
      dockerfile: 'dockerfile',
      ini: 'ini',
      conf: 'shell',
      log: 'plaintext',
      txt: 'plaintext'
    };
    return (ext && map[ext]) || 'plaintext';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs select-none p-3">
      {/* Hidden file inputs */}
      <input
        ref={leftFileInputRef}
        type="file"
        className="hidden"
        onChange={handleLeftFileUpload}
      />
      <input
        ref={rightFileInputRef}
        type="file"
        className="hidden"
        onChange={handleRightFileUpload}
      />

      <div
        className={`bg-[#1e1c24] border border-[#3e384e] rounded-lg shadow-2xl flex flex-col text-gray-200 overflow-hidden transition-all ${
          isFullscreen ? 'w-full h-full' : 'w-[95vw] h-[92vh] max-w-[1700px]'
        }`}
      >
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-[#25232d] border-b border-[#353043] gap-2 shrink-0">
          {/* Left: Brand & Diff Status */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-teal-950/70 border border-teal-600/70 px-2.5 py-1 rounded text-xs font-semibold text-teal-300">
              <FileDiff className="w-4 h-4 text-teal-400" />
              <span>MobaDiff</span>
            </div>

            {/* Differences Count Badge */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-[#191720] border border-[#393448] font-mono">
              {diffCount === 0 ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Files are identical
                </span>
              ) : (
                <span className="text-amber-300">
                  <strong>{diffCount}</strong> {diffCount === 1 ? 'difference' : 'differences'} found
                </span>
              )}
            </div>

            {saveStatus && (
              <span className={`text-xs px-2.5 py-1 rounded font-mono ${saveStatus.includes('Error') || saveStatus.includes('Failed') ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'}`}>
                {saveStatus}
              </span>
            )}
          </div>

          {/* Center: Diff Navigation & View Options */}
          <div className="flex items-center gap-1 text-xs">
            {/* Diff Jumper */}
            <div className="flex items-center bg-[#18161f] border border-[#383346] rounded p-0.5 mr-2">
              <button
                onClick={handlePrevDiff}
                disabled={diffCount === 0}
                className="px-2 py-1 rounded hover:bg-[#2d2938] text-gray-300 hover:text-white disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                title="Go to previous difference (Shift+F7)"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                <span className="text-[11px]">Prev</span>
              </button>
              <div className="w-[1px] h-3 bg-[#383346]" />
              <button
                onClick={handleNextDiff}
                disabled={diffCount === 0}
                className="px-2 py-1 rounded hover:bg-[#2d2938] text-gray-300 hover:text-white disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                title="Go to next difference (F7)"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                <span className="text-[11px]">Next</span>
              </button>
            </div>

            {/* Swap Sides Button */}
            <button
              onClick={handleSwap}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#2c2838] hover:bg-[#383347] border border-[#443e56] rounded text-gray-200 transition-colors cursor-pointer mr-2"
              title="Swap Left and Right panes"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-purple-300" />
              <span>Swap</span>
            </button>

            {/* View Mode: Side-by-side vs Inline */}
            <button
              onClick={() => setIsSideBySide(!isSideBySide)}
              className={`px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                isSideBySide
                  ? 'bg-purple-950/70 border-purple-500/80 text-purple-200'
                  : 'bg-[#221f2c] border-[#383346] text-gray-400'
              }`}
              title="Toggle between Split view and Inline diff"
            >
              {isSideBySide ? 'Side-by-side' : 'Inline Diff'}
            </button>

            {/* Ignore Whitespace Toggle */}
            <button
              onClick={() => setIgnoreWhitespace(!ignoreWhitespace)}
              className={`px-2.5 py-1 rounded border text-[11px] transition-colors cursor-pointer ${
                ignoreWhitespace
                  ? 'bg-teal-950/60 border-teal-500/80 text-teal-300'
                  : 'bg-[#221f2c] border-[#383346] text-gray-400'
              }`}
              title="Ignore leading/trailing whitespace differences"
            >
              Ignore Whitespace
            </button>

            {/* Language Selector */}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-[#18161f] border border-[#383346] rounded px-2 py-1 text-xs text-gray-300 outline-none cursor-pointer"
            >
              <option value="plaintext">Plain Text</option>
              <option value="shell">Shell / Bash</option>
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="json">JSON</option>
              <option value="yaml">YAML</option>
              <option value="html">HTML</option>
              <option value="css">CSS</option>
              <option value="sql">SQL</option>
              <option value="c">C / C++</option>
            </select>
          </div>

          {/* Right: Window Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded hover:bg-[#383347] text-gray-400 hover:text-white transition-colors cursor-pointer"
              title={isFullscreen ? 'Restore window size' : 'Maximize window'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-red-950/70 text-gray-400 hover:text-red-300 transition-colors cursor-pointer"
              title="Close MobaDiff (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dual Panes File Info & Action Bar */}
        <div className="grid grid-cols-2 bg-[#1b1922] border-b border-[#322e3f] text-xs divide-x divide-[#322e3f] shrink-0 select-none">
          {/* Left Pane Bar */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, 'left')}
            className="px-3 py-1.5 flex items-center justify-between gap-2 overflow-hidden"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="font-semibold text-rose-400 flex items-center gap-1 shrink-0">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                Original (Left):
              </span>
              <span className="font-mono text-gray-200 truncate text-[11px]" title={leftPath || leftTitle}>
                {leftTitle} {leftPath ? `(${leftPath})` : ''}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => leftFileInputRef.current?.click()}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#282533] hover:bg-[#343043] border border-[#403b50] text-gray-300 hover:text-white transition-colors cursor-pointer text-[11px]"
                title="Browse local file for Left pane"
              >
                <FolderOpen className="w-3 h-3 text-amber-400" />
                <span>Open...</span>
              </button>

              {activeSessionId && (
                <button
                  onClick={() => handleLoadRemoteFile('left')}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#282533] hover:bg-[#343043] border border-[#403b50] text-teal-300 hover:text-white transition-colors cursor-pointer text-[11px]"
                  title="Load remote SFTP file for Left pane"
                >
                  <Globe className="w-3 h-3 text-teal-400" />
                  <span>SFTP...</span>
                </button>
              )}

              <button
                onClick={() => handleCopy('left')}
                className="p-1 rounded hover:bg-[#2e2a3b] text-gray-400 hover:text-white transition-colors cursor-pointer"
                title="Copy Left content to clipboard"
              >
                {copiedSide === 'left' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => handleDownload('left')}
                className="p-1 rounded hover:bg-[#2e2a3b] text-gray-400 hover:text-white transition-colors cursor-pointer"
                title="Download Left content"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
              </button>

              {leftPath && activeSessionId && (
                <button
                  onClick={() => handleSaveToRemote('left')}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#0e639c] hover:bg-[#1177bb] text-white text-[11px] font-medium cursor-pointer"
                  title="Save Left content back to remote SFTP server"
                >
                  <Save className="w-3 h-3" />
                  <span>Save SFTP</span>
                </button>
              )}

              <button
                onClick={() => { setLeftContent(''); setLeftTitle('Untitled (Left)'); setLeftPath(undefined); }}
                className="p-1 rounded hover:bg-red-950/60 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                title="Clear Left content"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Pane Bar */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, 'right')}
            className="px-3 py-1.5 flex items-center justify-between gap-2 overflow-hidden"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="font-semibold text-emerald-400 flex items-center gap-1 shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Modified (Right):
              </span>
              <span className="font-mono text-gray-200 truncate text-[11px]" title={rightPath || rightTitle}>
                {rightTitle} {rightPath ? `(${rightPath})` : ''}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => rightFileInputRef.current?.click()}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#282533] hover:bg-[#343043] border border-[#403b50] text-gray-300 hover:text-white transition-colors cursor-pointer text-[11px]"
                title="Browse local file for Right pane"
              >
                <FolderOpen className="w-3 h-3 text-amber-400" />
                <span>Open...</span>
              </button>

              {activeSessionId && (
                <button
                  onClick={() => handleLoadRemoteFile('right')}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#282533] hover:bg-[#343043] border border-[#403b50] text-teal-300 hover:text-white transition-colors cursor-pointer text-[11px]"
                  title="Load remote SFTP file for Right pane"
                >
                  <Globe className="w-3 h-3 text-teal-400" />
                  <span>SFTP...</span>
                </button>
              )}

              <button
                onClick={() => handleCopy('right')}
                className="p-1 rounded hover:bg-[#2e2a3b] text-gray-400 hover:text-white transition-colors cursor-pointer"
                title="Copy Right content to clipboard"
              >
                {copiedSide === 'right' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => handleDownload('right')}
                className="p-1 rounded hover:bg-[#2e2a3b] text-gray-400 hover:text-white transition-colors cursor-pointer"
                title="Download Right content"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
              </button>

              {rightPath && activeSessionId && (
                <button
                  onClick={() => handleSaveToRemote('right')}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium cursor-pointer"
                  title="Save Right content back to remote SFTP server"
                >
                  <Save className="w-3 h-3" />
                  <span>Save SFTP</span>
                </button>
              )}

              <button
                onClick={() => { setRightContent(''); setRightTitle('Untitled (Right)'); setRightPath(undefined); }}
                className="p-1 rounded hover:bg-red-950/60 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                title="Clear Right content"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Monaco DiffEditor Canvas */}
        <div className="flex-1 w-full h-full relative overflow-hidden bg-[#1e1e1e]">
          <DiffEditor
            height="100%"
            original={leftContent}
            modified={rightContent}
            language={language}
            theme="vs-dark"
            options={{
              renderSideBySide: isSideBySide,
              readOnly: isReadOnly,
              originalEditable: !isReadOnly,
              ignoreTrimWhitespace: ignoreWhitespace,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              fontSize: 13,
              automaticLayout: true,
              diffCodeLens: true,
              renderIndicators: true
            }}
            onMount={handleEditorMount}
            loading={
              <div className="flex items-center justify-center h-full text-sm text-gray-400">
                Loading MobaDiff Editor...
              </div>
            }
          />
        </div>

        {/* Bottom Status Bar */}
        <div className="flex items-center justify-between px-3 py-1 bg-[#18161f] border-t border-[#2e2a3a] text-[11px] text-gray-400 font-mono shrink-0 select-none">
          <div className="flex items-center gap-4">
            <span>Original: <strong className="text-gray-200">{leftContent.split('\n').length}</strong> lines</span>
            <span>Modified: <strong className="text-gray-200">{rightContent.split('\n').length}</strong> lines</span>
            <span>Language: <strong className="text-purple-300 uppercase">{language}</strong></span>
          </div>

          <div className="flex items-center gap-3 text-gray-400">
            <span>💡 Tip: Drag & Drop files directly onto Left/Right headers or paste text</span>
            <span className="text-gray-600">|</span>
            <span>F7: Next Diff • Shift+F7: Prev Diff</span>
          </div>
        </div>
      </div>
    </div>
  );
};
