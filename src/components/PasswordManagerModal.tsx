import React, { useState } from 'react';
import { Key, X, Eye, EyeOff, Copy, Trash, ShieldAlert, Shield } from 'lucide-react';
import { SessionConfig } from '../types';
import { decryptPassword, isEncrypted } from '../utils/vault';

interface PasswordManagerModalProps {
  isOpen: boolean;
  sessions: SessionConfig[];
  masterPassword: string | null;
  onClose: () => void;
  onUpdateSessions: (sessions: SessionConfig[]) => void;
  onOpenCredentialManager?: () => void;
}

export const PasswordManagerModal: React.FC<PasswordManagerModalProps> = ({
  isOpen,
  sessions,
  masterPassword,
  onClose,
  onUpdateSessions,
  onOpenCredentialManager
}) => {
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  // Filter only sessions that actually have a password saved
  const passwordSessions = sessions.filter(s => s.type === 'SSH' && s.password);

  const togglePasswordVisibility = (sessionId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }));
  };

  const getDecryptedPassword = (password: string) => {
    if (isEncrypted(password)) {
      return masterPassword ? decryptPassword(password, masterPassword) : '🔒 [Locked]';
    }
    return password;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Simple visual feedback could be added here
  };

  const removePassword = (sessionId: string) => {
    if (confirm('Are you sure you want to remove the saved password for this session?')) {
      const updatedSessions = sessions.map(s => {
        if (s.id === sessionId) {
          return { ...s, password: undefined };
        }
        return s;
      });
      onUpdateSessions(updatedSessions);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] backdrop-blur-sm">
      <div className="bg-[#252528] border border-[#3e3e42] rounded-lg shadow-2xl w-[700px] max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-[#3e3e42] bg-[#2d2d30]">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-semibold text-gray-200">Passwords Management</h2>
          </div>
          <div className="flex items-center gap-3">
            {onOpenCredentialManager && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCredentialManager();
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1e1e20] hover:bg-[#333336] text-amber-300 text-xs rounded border border-[#3e3e44] transition-colors cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Open Credential Store</span>
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#1e1e1e]">
          {passwordSessions.length === 0 ? (
            <div className="text-center text-gray-500 py-10 flex flex-col items-center gap-3">
              <ShieldAlert className="w-10 h-10 opacity-50" />
              <p>No saved passwords found.</p>
            </div>
          ) : (
            <div className="rounded border border-[#3e3e42] overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-[#2d2d30] border-b border-[#3e3e42]">
                    <th className="p-3 text-gray-300 font-medium">Session Name</th>
                    <th className="p-3 text-gray-300 font-medium">Host</th>
                    <th className="p-3 text-gray-300 font-medium">Username</th>
                    <th className="p-3 text-gray-300 font-medium w-48">Password</th>
                    <th className="p-3 text-center text-gray-300 font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3e3e42]">
                  {passwordSessions.map((session) => {
                    const isVisible = visiblePasswords[session.id];
                    const rawPassword = session.password || '';
                    const displayPassword = isVisible ? getDecryptedPassword(rawPassword) : '••••••••••••';
                    
                    return (
                      <tr key={session.id} className="hover:bg-[#252528] transition-colors group">
                        <td className="p-3 text-gray-200">{session.name}</td>
                        <td className="p-3 text-gray-400">{session.host}</td>
                        <td className="p-3 text-gray-400">{session.username || 'root'}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <input 
                              type={isVisible ? "text" : "password"} 
                              readOnly 
                              value={displayPassword}
                              className="bg-transparent border-none outline-none text-emerald-400 w-full font-mono text-xs"
                            />
                            <button 
                              onClick={() => togglePasswordVisibility(session.id)}
                              className="text-gray-500 hover:text-gray-300 transition-colors focus:outline-none"
                              title={isVisible ? "Hide Password" : "Show Password"}
                            >
                              {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => copyToClipboard(getDecryptedPassword(rawPassword))}
                              className="text-gray-400 hover:text-sky-400 transition-colors"
                              title="Copy Password"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => removePassword(session.id)}
                              className="text-gray-400 hover:text-red-400 transition-colors"
                              title="Delete Password"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#3e3e42] bg-[#2d2d30] flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-1.5 text-sm font-medium text-white bg-sky-600 hover:bg-sky-500 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
