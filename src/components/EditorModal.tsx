import React, { useState, useEffect, useRef } from 'react';
import { Save, X, Check, AlertCircle } from 'lucide-react';
import Editor from '@monaco-editor/react';

interface EditorModalProps {
  isOpen: boolean;
  activeSessionId?: string;
  filePath: string;
  fileName: string;
  onClose: () => void;
}

export const EditorModal: React.FC<EditorModalProps> = ({
  isOpen,
  activeSessionId,
  filePath,
  fileName,
  onClose
}) => {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!isOpen || !activeSessionId || !filePath) return;

    setIsLoading(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    const ws = new WebSocket('ws://127.0.0.1:9292');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          action: 'sftp_read',
          id: activeSessionId,
          filePath
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id !== activeSessionId) return;

        if (msg.action === 'sftp_read_result') {
          setIsLoading(false);
          if (msg.success) {
            setContent(msg.content);
          } else {
            setErrorMsg(msg.error || 'Failed to read file');
          }
        } else if (msg.action === 'sftp_write_result') {
          setIsSaving(false);
          if (msg.success) {
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
          } else {
            setErrorMsg(msg.error || 'Failed to save file');
          }
        }
      } catch (e) {
        console.error('Editor websocket message parse error:', e);
      }
    };

    return () => {
      ws.close();
    };
  }, [isOpen, activeSessionId, filePath]);

  const handleSave = () => {
    if (!wsRef.current || !activeSessionId || isSaving) return;
    setIsSaving(true);
    setErrorMsg(null);

    wsRef.current.send(
      JSON.stringify({
        action: 'sftp_write',
        id: activeSessionId,
        filePath,
        content
      })
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs select-none">
      <div className="w-[85vw] h-[85vh] bg-[#1e1e20] border border-[#3e3e42] rounded-md shadow-2xl flex flex-col text-gray-200 overflow-hidden">
        
        {/* Editor Title Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#252528] border-b border-[#333336]">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="font-semibold text-sm text-gray-100">{fileName}</span>
            <span className="text-xs text-gray-400 font-mono truncate">({filePath})</span>
          </div>

          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            {errorMsg && (
              <span className="flex items-center gap-1 text-xs text-red-400 font-medium truncate max-w-xs">
                <AlertCircle className="w-3.5 h-3.5" /> {errorMsg}
              </span>
            )}

            <button
              onClick={handleSave}
              disabled={isLoading || isSaving}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 text-white rounded text-xs font-medium cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[#38383c] text-gray-400 hover:text-white cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Text Area */}
        <div className="flex-1 w-full bg-[#18181a] p-2 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              Loading file from remote server...
            </div>
          ) : (
            <Editor
              height="100%"
              theme="vs-dark"
              path={fileName}
              value={content}
              onChange={(val) => setContent(val || '')}
              onMount={(editor, monaco) => {
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                  handleSave();
                });
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                wordWrap: 'on',
                fontFamily: "'Consolas', 'Courier New', monospace"
              }}
            />
          )}
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-3 py-1 bg-[#161618] border-t border-[#2d2d30] text-[11px] text-gray-500 font-mono">
          <span>UTF-8</span>
          <span>{content.split('\n').length} lines | {content.length} characters</span>
        </div>
      </div>
    </div>
  );
};
