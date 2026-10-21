import React, { useState, useEffect } from 'react';
import { X, Save, FileCode, Check } from 'lucide-react';
import Editor from '@monaco-editor/react';

interface TextEditorModalProps {
  isOpen: boolean;
  fileName: string;
  filePath: string;
  initialContent: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: (content: string) => void;
}

export const TextEditorModal: React.FC<TextEditorModalProps> = ({
  isOpen,
  fileName,
  filePath,
  initialContent,
  isSaving,
  onClose,
  onSave
}) => {
  const [content, setContent] = useState(initialContent);
  const [showSavedMsg, setShowSavedMsg] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
    }
  }, [isOpen, initialContent]);

  useEffect(() => {
    // Show saved toast when isSaving becomes false and it was open
    if (!isSaving && isOpen) {
      setShowSavedMsg(true);
      const timer = setTimeout(() => setShowSavedMsg(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSaving, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const determineLanguage = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      'js': 'javascript', 'ts': 'typescript', 'jsx': 'javascript', 'tsx': 'typescript',
      'json': 'json', 'py': 'python', 'html': 'html', 'css': 'css',
      'sh': 'shell', 'bash': 'shell', 'yaml': 'yaml', 'yml': 'yaml',
      'md': 'markdown', 'xml': 'xml'
    };
    return map[ext || ''] || 'plaintext';
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] backdrop-blur-sm p-4 sm:p-10"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-[#1e1e1e] border border-[#3e3e42] rounded-lg shadow-2xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-2 bg-[#2d2d30] border-b border-[#3e3e42] select-none">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-[#5dade2]" />
            <div>
              <h2 className="text-sm font-semibold text-gray-200">{fileName}</h2>
              <p className="text-[10px] text-gray-500 font-mono truncate max-w-md">{filePath}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {showSavedMsg && (
              <span className="flex items-center gap-1 text-emerald-400 text-[11px] font-semibold animate-pulse">
                <Check className="w-3.5 h-3.5" /> Saved!
              </span>
            )}
            
            <button
              onClick={handleSave}
              disabled={isSaving}
              title="Save (Ctrl+S)"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#007acc] hover:bg-[#0098ff] disabled:opacity-50 text-white text-xs font-semibold rounded cursor-pointer transition-colors"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <div className="w-px h-6 bg-[#3e3e42] mx-1"></div>
            <button
              onClick={onClose}
              title="Close (Esc)"
              className="p-1.5 text-gray-400 hover:text-white hover:bg-red-500/20 rounded cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Editor Body */}
        <div className="flex-1 w-full bg-[#1e1e1e] relative">
          <Editor
            height="100%"
            language={determineLanguage(fileName)}
            theme="vs-dark"
            value={content}
            onChange={(val) => setContent(val || '')}
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              fontFamily: 'Consolas, "Courier New", monospace',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
            }}
          />
        </div>
        
        {/* Footer */}
        <div className="px-3 py-1 bg-[#007acc] text-white text-[10px] flex justify-between select-none font-mono">
          <span>MobaTextEditor - Editing remote file</span>
          <span>{determineLanguage(fileName).toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
};
