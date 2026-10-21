import React, { useState, useEffect, useRef } from 'react';
import { Lock, ShieldCheck, KeyRound, X, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { verifyMasterPassword, isVaultSetup, setupVault, clearVault } from '../utils/vault';

interface MasterPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (password: string) => void;
  onResetVault?: () => void;
}

export const MasterPasswordModal: React.FC<MasterPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onResetVault
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'unlock' | 'setup' | 'reset-confirm'>('unlock');
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setConfirmPassword('');
      setError('');
      setResetConfirmInput('');
      setMode(isVaultSetup() ? 'unlock' : 'setup');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'setup') {
      if (!password) {
        setError('Password cannot be empty.');
        return;
      }
      if (password.length < 4) {
        setError('Password should be at least 4 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      // Set up the vault
      setupVault(password);
      onSuccess(password);
    } else if (mode === 'unlock') {
      // Unlock mode
      if (verifyMasterPassword(password)) {
        onSuccess(password);
      } else {
        setError('Incorrect Master Password.');
        setPassword('');
        inputRef.current?.focus();
      }
    }
  };

  const handleConfirmReset = () => {
    if (resetConfirmInput.trim().toUpperCase() !== 'RESET') {
      setError('Please type "RESET" in capital letters to confirm.');
      return;
    }

    // 1. Clear Master Vault verification key
    clearVault();

    // 2. Trigger parent wipe callback to remove encrypted passwords
    onResetVault?.();

    // 3. Switch smoothly to 'setup' mode to let user create a new Master Password
    setPassword('');
    setConfirmPassword('');
    setError('');
    setResetConfirmInput('');
    setMode('setup');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[220] backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[#252528] border border-[#3e3e42] rounded-xl shadow-2xl w-full max-w-[420px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-[#3e3e42] bg-[#2d2d30]">
          <div className="flex items-center gap-2">
            {mode === 'setup' ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            ) : mode === 'reset-confirm' ? (
              <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
            ) : (
              <Lock className="w-5 h-5 text-amber-400" />
            )}
            <h2 className="text-sm font-semibold text-gray-200">
              {mode === 'setup' 
                ? 'Set Master Password' 
                : mode === 'reset-confirm'
                  ? 'Reset & Wipe Master Vault'
                  : 'Unlock Secure Vault'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#3e3e42] text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body for Unlock / Setup Modes */}
        {mode !== 'reset-confirm' && (
          <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
            <div className="text-xs text-gray-400 leading-relaxed">
              {mode === 'setup'
                ? 'Create a Master Password to securely encrypt all your saved session credentials with AES-256.'
                : 'Enter your Master Password to decrypt and access your saved session credentials.'}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-300 uppercase tracking-wide">
                Master Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={inputRef}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#1e1e1e] border border-[#3e3e42] focus:border-amber-500 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-200 outline-none transition-colors"
                  placeholder="Enter password"
                  required
                />
              </div>
            </div>

            {mode === 'setup' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-300 uppercase tracking-wide">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-[#3e3e42] focus:border-emerald-500 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-200 outline-none transition-colors"
                    placeholder="Confirm password"
                    required
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-red-400 bg-red-950/40 border border-red-500/40 p-2.5 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between mt-2 pt-4 border-t border-[#3e3e42]">
              {mode === 'unlock' ? (
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setResetConfirmInput('');
                    setMode('reset-confirm');
                  }}
                  className="text-[11px] text-red-400/80 hover:text-red-300 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Forgot / Reset Vault?</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-[#333336] hover:bg-[#3e3e42] rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 text-xs font-medium text-white rounded-lg transition-colors shadow-sm cursor-pointer ${
                    mode === 'setup'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-amber-600 hover:bg-amber-500'
                  }`}
                >
                  {mode === 'setup' ? 'Save & Protect' : 'Unlock'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Body for Reset Confirm Mode */}
        {mode === 'reset-confirm' && (
          <div className="p-5 flex flex-col gap-4 text-xs">
            <div className="bg-red-950/40 border border-red-500/40 p-3 rounded-lg text-red-200 space-y-2">
              <div className="font-semibold flex items-center gap-2 text-red-300">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>Warning: Irreversible Action (ข้อควรระวัง)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-red-200/90">
                Because data is encrypted with AES-256, it cannot be decrypted without the old password. 
                Resetting the Vault will <b>wipe all saved passwords and keys</b>, but your <b>Session list, IPs, and folders will be preserved 100%</b>.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-gray-300 text-[11px] font-medium">
                To confirm, type <span className="font-mono font-bold text-red-400 bg-red-950/60 px-1 py-0.5 rounded border border-red-800">RESET</span> below:
              </label>
              <input
                type="text"
                autoFocus
                value={resetConfirmInput}
                onChange={(e) => setResetConfirmInput(e.target.value)}
                placeholder="Type RESET"
                className="w-full bg-[#18181a] border border-[#3e3e42] focus:border-red-500 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none"
              />
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-950/40 border border-red-500/40 p-2.5 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-[#3e3e42]">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMode('unlock');
                }}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Unlock</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={resetConfirmInput.trim().toUpperCase() !== 'RESET'}
                className="px-4 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:hover:bg-red-600 rounded-lg transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
              >
                Wipe & Set New Password
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
