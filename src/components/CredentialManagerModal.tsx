import React, { useState } from 'react';
import {
  Shield,
  Key,
  Lock,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  Eye,
  EyeOff,
  X,
  FileKey,
  Search,
  FolderOpen,
  Info,
  Server
} from 'lucide-react';
import { CredentialConfig, SessionConfig } from '../types';
import { encryptPassword, decryptPassword, isEncrypted } from '../utils/vault';

interface CredentialManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: CredentialConfig[];
  onSaveCredentials: (credentials: CredentialConfig[]) => void;
  sessions: SessionConfig[];
  masterPassword: string | null;
  onRequireVault?: () => void;
}

export const CredentialManagerModal: React.FC<CredentialManagerModalProps> = ({
  isOpen,
  onClose,
  credentials,
  onSaveCredentials,
  sessions,
  masterPassword,
  onRequireVault
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCred, setEditingCred] = useState<CredentialConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPrivateKey, setFormPrivateKey] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingCred(null);
    setFormName('');
    setFormUsername('');
    setFormPassword('');
    setFormPrivateKey('');
    setFormDescription('');
    setShowPassword(false);
    setIsCreating(true);
  };

  const handleStartEdit = (cred: CredentialConfig) => {
    setEditingCred(cred);
    setFormName(cred.name);
    setFormUsername(cred.username);
    
    // Decrypt if encrypted and masterPassword available
    let plainPassword = cred.password || '';
    if (plainPassword && isEncrypted(plainPassword)) {
      if (masterPassword) {
        plainPassword = decryptPassword(plainPassword, masterPassword);
      } else if (onRequireVault) {
        onRequireVault();
      }
    }
    setFormPassword(plainPassword);
    setFormPrivateKey(cred.privateKey || '');
    setFormDescription(cred.description || '');
    setShowPassword(false);
    setIsCreating(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formUsername.trim()) {
      alert('Please provide both a Name and Username.');
      return;
    }

    // Encrypt password if masterPassword is set
    let finalPassword = formPassword;
    if (formPassword && masterPassword) {
      finalPassword = encryptPassword(formPassword, masterPassword);
    }

    const newCred: CredentialConfig = {
      id: editingCred ? editingCred.id : 'cred_' + Date.now(),
      name: formName.trim(),
      username: formUsername.trim(),
      password: finalPassword || undefined,
      privateKey: formPrivateKey.trim() || undefined,
      description: formDescription.trim() || undefined,
      updatedAt: Date.now()
    };

    if (editingCred) {
      onSaveCredentials(credentials.map((c) => (c.id === editingCred.id ? newCred : c)));
    } else {
      onSaveCredentials([...credentials, newCred]);
    }

    setIsCreating(false);
    setEditingCred(null);
  };

  const handleDelete = (id: string, name: string) => {
    const linkedSessions = sessions.filter((s) => s.credentialId === id);
    let confirmMsg = `Are you sure you want to delete credential "${name}"?`;
    if (linkedSessions.length > 0) {
      confirmMsg += `\nWarning: It is currently linked to ${linkedSessions.length} session(s): ${linkedSessions
        .map((s) => s.name)
        .join(', ')}.`;
    }

    if (window.confirm(confirmMsg)) {
      onSaveCredentials(credentials.filter((c) => c.id !== id));
      if (editingCred?.id === id) {
        setIsCreating(false);
        setEditingCred(null);
      }
    }
  };

  const handleKeyFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFormPrivateKey(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const filteredCredentials = credentials.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] backdrop-blur-sm select-none">
      <div className="bg-[#202023] border border-[#3e3e42] rounded-lg shadow-2xl w-[820px] max-h-[85vh] flex flex-col overflow-hidden text-gray-200">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-[#333336] bg-[#27272a]">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-semibold text-gray-100">Saved Credentials Manager</h2>
            <span className="text-xs bg-[#333338] text-gray-400 px-2 py-0.5 rounded-full border border-[#44444a]">
              {credentials.length} credentials
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex flex-1 overflow-hidden min-h-[440px]">
          {/* Left Column: Credentials List & Search */}
          <div className="w-[320px] border-r border-[#333336] flex flex-col bg-[#1a1a1c]">
            {/* Search and Add Header */}
            <div className="p-3 border-b border-[#2d2d30] space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search credentials..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#141416] border border-[#38383c] focus:border-[#007acc] text-xs text-gray-200 pl-8 pr-3 py-1.5 rounded outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleStartCreate}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[#007acc] hover:bg-[#008be6] text-white rounded text-xs font-medium cursor-pointer transition shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Credential</span>
              </button>
            </div>

            {/* Credential List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#262629]">
              {filteredCredentials.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-xs flex flex-col items-center gap-2">
                  <Key className="w-8 h-8 opacity-30 text-amber-400" />
                  <span>No credentials found.</span>
                </div>
              ) : (
                filteredCredentials.map((cred) => {
                  const linkedCount = sessions.filter((s) => s.credentialId === cred.id).length;
                  const isSelected = editingCred?.id === cred.id && isCreating;

                  return (
                    <div
                      key={cred.id}
                      onClick={() => handleStartEdit(cred)}
                      className={`p-3 cursor-pointer transition-colors group flex items-start justify-between ${
                        isSelected ? 'bg-[#2b2b30] border-l-2 border-[#007acc]' : 'hover:bg-[#222225]'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-gray-200 truncate">{cred.name}</span>
                        </div>
                        <div className="text-[11px] text-gray-400 truncate flex items-center gap-1">
                          <span>User:</span>
                          <span className="text-amber-300 font-mono">{cred.username}</span>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-1.5 pt-0.5">
                          {cred.password && (
                            <span className="text-[9px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" /> Password
                            </span>
                          )}
                          {cred.privateKey && (
                            <span className="text-[9px] bg-purple-950/60 text-purple-300 border border-purple-800/60 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                              <FileKey className="w-2.5 h-2.5" /> SSH Key
                            </span>
                          )}
                          {linkedCount > 0 && (
                            <span className="text-[9px] bg-blue-950/60 text-blue-300 border border-blue-800/60 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                              <Server className="w-2.5 h-2.5" /> {linkedCount} session{linkedCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(cred.id, cred.name);
                          }}
                          className="p-1 text-gray-400 hover:text-red-400 rounded hover:bg-[#333336]"
                          title="Delete Credential"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: View / Edit Form */}
          <div className="flex-1 flex flex-col bg-[#1e1e20] overflow-y-auto p-5">
            {isCreating ? (
              <form onSubmit={handleSaveForm} className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#2d2d30]">
                  <h3 className="text-sm font-semibold text-gray-100 flex items-center gap-1.5">
                    {editingCred ? <Edit2 className="w-4 h-4 text-blue-400" /> : <Plus className="w-4 h-4 text-green-400" />}
                    <span>{editingCred ? `Edit "${editingCred.name}"` : 'Create New Credential'}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setEditingCred(null);
                    }}
                    className="text-xs text-gray-400 hover:text-gray-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Credential Name * <span className="text-gray-500 font-normal">(e.g. AWS Production Ubuntu, Root Dev)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="My Server Credential"
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-xs text-gray-200 px-3 py-2 rounded outline-none"
                    autoFocus
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Username * <span className="text-gray-500 font-normal">(e.g. root, ubuntu, ec2-user)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="root"
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-xs text-gray-200 px-3 py-2 rounded outline-none font-mono"
                  />
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-300 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Password (optional)</span>
                    </label>
                    {masterPassword && (
                      <span className="text-[10px] text-emerald-400/80">🔒 Protected by Master Vault</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Leave blank to prompt upon connection"
                      className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-xs text-gray-200 pl-3 pr-16 py-2 rounded outline-none font-mono"
                    />
                    <div className="absolute right-2 top-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-gray-400 hover:text-gray-200 cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      {formPassword && (
                        <button
                          type="button"
                          onClick={() => handleCopy(formPassword, 'form_pwd')}
                          className="text-gray-400 hover:text-sky-300 cursor-pointer"
                          title="Copy Password"
                        >
                          {copiedField === 'form_pwd' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* SSH Private Key */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-300 flex items-center gap-1">
                      <FileKey className="w-3.5 h-3.5 text-purple-400" />
                      <span>SSH Private Key (optional PEM / OpenSSH / RSA)</span>
                    </label>
                    <label className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer">
                      <FolderOpen className="w-3 h-3" />
                      <span>Browse Key File...</span>
                      <input type="file" onChange={handleKeyFileUpload} className="hidden" />
                    </label>
                  </div>
                  <textarea
                    rows={4}
                    value={formPrivateKey}
                    onChange={(e) => setFormPrivateKey(e.target.value)}
                    placeholder="Paste private key content here (-----BEGIN RSA PRIVATE KEY----- ...)"
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-[11px] text-gray-200 p-2.5 rounded outline-none font-mono resize-none"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Description / Notes (optional)</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="e.g. Shared bastion user for dev environment"
                    className="w-full bg-[#141416] border border-[#3e3e42] focus:border-[#007acc] text-xs text-gray-200 px-3 py-2 rounded outline-none"
                  />
                </div>

                {/* Submit button */}
                <div className="pt-3 border-t border-[#2d2d30] flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setEditingCred(null);
                    }}
                    className="px-4 py-1.5 bg-[#333336] hover:bg-[#3d3d42] text-gray-300 rounded text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-1.5 bg-[#007acc] hover:bg-[#008be6] text-white rounded text-xs font-medium cursor-pointer shadow"
                  >
                    {editingCred ? 'Save Changes' : 'Create Credential'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 text-gray-400">
                <div className="p-4 bg-[#27272b] rounded-full border border-[#38383c]">
                  <Shield className="w-10 h-10 text-amber-400 opacity-80" />
                </div>
                <div className="max-w-md space-y-1">
                  <h4 className="text-sm font-semibold text-gray-200">Centralized Credential Store</h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Create reusable credentials with username, password, or SSH private keys. Link them across multiple
                    sessions so when credentials rotate, you only update them here once!
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleStartCreate}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#007acc] hover:bg-[#008be6] text-white rounded text-xs font-medium cursor-pointer shadow transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Your First Credential</span>
                  </button>
                </div>

                {sessions.length > 0 && (
                  <div className="text-[11px] bg-[#252528] border border-[#333336] px-3 py-2 rounded-md text-gray-400 flex items-center gap-2 mt-4 text-left">
                    <Info className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>
                      You have <strong>{sessions.length}</strong> session(s) configured. You can link saved credentials
                      in any session's settings!
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[#333336] bg-[#27272a] flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2 text-[11px]">
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>Master Password Vault: {masterPassword ? 'Unlocked 🔓' : 'Locked 🔒'}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1 bg-[#333336] hover:bg-[#3d3d42] text-gray-200 rounded text-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
