import React, { useState } from 'react';
import { Key, X, Check } from 'lucide-react';

interface PasswordPromptModalProps {
  isOpen: boolean;
  host: string;
  username: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

export const PasswordPromptModal: React.FC<PasswordPromptModalProps> = ({
  isOpen,
  host,
  username,
  onSubmit,
  onCancel
}) => {
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(password);
    setPassword('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs select-none">
      <div className="w-full max-w-md bg-[#1e1e20] border border-[#3e3e42] rounded-md shadow-2xl overflow-hidden flex flex-col text-gray-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#252528] border-b border-[#333336]">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-semibold">SSH Authentication</span>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#38383c] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-gray-300">
            Please enter password for <strong className="text-white">{username}@{host}</strong>:
          </p>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-3 py-2 rounded outline-none"
            autoFocus
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#0e639c] hover:bg-[#1177bb] text-white rounded text-xs font-medium cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Connect</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-1.5 bg-[#2d2d30] hover:bg-[#38383c] text-gray-300 rounded text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
