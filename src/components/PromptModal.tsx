import React, { useState, useEffect, useRef } from 'react';
import { Folder, Edit2, FileText, X } from 'lucide-react';

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  initialValue?: string;
  icon?: 'folder' | 'edit' | 'file';
  onClose: () => void;
  onSubmit: (value: string) => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  isOpen,
  title,
  initialValue = '',
  icon = 'folder',
  onClose,
  onSubmit
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div className="bg-[#252528] border border-[#3e3e42] rounded-lg shadow-2xl w-[350px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-[#3e3e42] bg-[#2d2d30]">
          <div className="flex items-center gap-2">
            {icon === 'folder' ? (
              <Folder className="w-4 h-4 text-amber-400" />
            ) : icon === 'file' ? (
              <FileText className="w-4 h-4 text-blue-400" />
            ) : (
              <Edit2 className="w-4 h-4 text-gray-300" />
            )}
            <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full bg-[#1e1e1e] border border-[#3e3e42] focus:border-[#007acc] rounded px-3 py-2 text-sm text-gray-200 outline-none"
            placeholder="Enter value..."
          />

          {/* Footer */}
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-[#3e3e42] hover:bg-[#4a4a4d] rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className="px-4 py-1.5 text-xs font-medium text-white bg-[#007acc] hover:bg-[#0098ff] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              OK
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
