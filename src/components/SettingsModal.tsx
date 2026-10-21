import React, { useState, useEffect, useRef } from 'react';
import { Settings, X, Terminal, Monitor, Save, Download, FolderArchive } from 'lucide-react';
import { GlobalSettings, TerminalTheme, ShellType } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GlobalSettings;
  onSave: (settings: GlobalSettings) => void;
  onExportSessions?: () => void;
  onImportSessions?: (file: File) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  onExportSessions,
  onImportSessions
}) => {
  const [localSettings, setLocalSettings] = useState<GlobalSettings>(settings);
  const [activeTab, setActiveTab] = useState<'terminal' | 'general'>('terminal');
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] backdrop-blur-sm p-4">
      <div className="bg-[#1e1e1e] border border-[#3e3e42] rounded-lg shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-3.5 border-b border-[#3e3e42] bg-[#252528]">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-slate-400" />
            <h2 className="text-sm font-semibold text-gray-200">Global Settings & Themes</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#3e3e42] text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-[400px]">
          {/* Sidebar Tabs */}
          <div className="w-48 bg-[#252528] border-r border-[#3e3e42] flex flex-col p-2 gap-1 shrink-0">
            <button
              onClick={() => setActiveTab('terminal')}
              className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded transition-colors ${
                activeTab === 'terminal' ? 'bg-[#3e3e42] text-white' : 'text-gray-400 hover:bg-[#2d2d30] hover:text-gray-200'
              }`}
            >
              <Terminal className="w-4 h-4" />
              Terminal Settings
            </button>
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded transition-colors ${
                activeTab === 'general' ? 'bg-[#3e3e42] text-white' : 'text-gray-400 hover:bg-[#2d2d30] hover:text-gray-200'
              }`}
            >
              <Monitor className="w-4 h-4" />
              General Settings
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto bg-[#1e1e1e]">
            {activeTab === 'terminal' && (
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-2">Color Scheme / Theme</label>
                  <select
                    value={localSettings.terminal.theme}
                    onChange={(e) => setLocalSettings({
                      ...localSettings,
                      terminal: { ...localSettings.terminal, theme: e.target.value as TerminalTheme }
                    })}
                    className="w-full bg-[#2d2d30] border border-[#3e3e42] text-gray-200 text-xs rounded px-3 py-2 outline-none focus:border-blue-500"
                  >
                    <option value="mobaxterm">Kirin Dark (Default)</option>
                    <option value="dracula">Dracula</option>
                    <option value="monokai">Monokai</option>
                    <option value="solarized-dark">Solarized Dark</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-2">Font Family</label>
                    <select
                      value={localSettings.terminal.fontFamily}
                      onChange={(e) => setLocalSettings({
                        ...localSettings,
                        terminal: { ...localSettings.terminal, fontFamily: e.target.value }
                      })}
                      className="w-full bg-[#2d2d30] border border-[#3e3e42] text-gray-200 text-xs rounded px-3 py-2 outline-none focus:border-blue-500"
                    >
                      <option value="Consolas, 'Courier New', monospace">Consolas</option>
                      <option value="'Fira Code', monospace">Fira Code</option>
                      <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                      <option value="monospace">System Monospace</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-2">Font Size ({localSettings.terminal.fontSize}px)</label>
                    <input
                      type="range"
                      min="10"
                      max="24"
                      value={localSettings.terminal.fontSize}
                      onChange={(e) => setLocalSettings({
                        ...localSettings,
                        terminal: { ...localSettings.terminal, fontSize: parseInt(e.target.value) }
                      })}
                      className="w-full h-2 bg-[#2d2d30] rounded-lg appearance-none cursor-pointer mt-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-2">Cursor Style</label>
                    <select
                      value={localSettings.terminal.cursorStyle}
                      onChange={(e) => setLocalSettings({
                        ...localSettings,
                        terminal: { ...localSettings.terminal, cursorStyle: e.target.value as any }
                      })}
                      className="w-full bg-[#2d2d30] border border-[#3e3e42] text-gray-200 text-xs rounded px-3 py-2 outline-none focus:border-blue-500"
                    >
                      <option value="block">Block ( █ )</option>
                      <option value="underline">Underline ( _ )</option>
                      <option value="bar">Bar ( | )</option>
                    </select>
                  </div>
                  <div className="flex items-center mt-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localSettings.terminal.cursorBlink}
                        onChange={(e) => setLocalSettings({
                          ...localSettings,
                          terminal: { ...localSettings.terminal, cursorBlink: e.target.checked }
                        })}
                        className="w-4 h-4 rounded border-gray-500 text-blue-500 focus:ring-blue-500 bg-[#2d2d30]"
                      />
                      <span className="text-xs text-gray-300 font-medium">Blinking Cursor</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#3e3e42] space-y-3">
                  <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Mouse & Clipboard</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-2">Right-Click Action</label>
                      <select
                        value={localSettings.terminal.rightClickAction || 'menu'}
                        onChange={(e) => setLocalSettings({
                          ...localSettings,
                          terminal: { ...localSettings.terminal, rightClickAction: e.target.value as 'paste' | 'menu' }
                        })}
                        className="w-full bg-[#2d2d30] border border-[#3e3e42] text-gray-200 text-xs rounded px-3 py-2 outline-none focus:border-blue-500"
                      >
                        <option value="menu">Show Context Menu (Copy/Paste/Clear)</option>
                        <option value="paste">Direct Paste on right-click</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-end space-y-2 pb-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={localSettings.terminal.copyOnSelect ?? true}
                          onChange={(e) => setLocalSettings({
                            ...localSettings,
                            terminal: { ...localSettings.terminal, copyOnSelect: e.target.checked }
                          })}
                          className="w-4 h-4 rounded border-gray-500 text-blue-500 focus:ring-blue-500 bg-[#2d2d30]"
                        />
                        <span className="text-xs text-gray-300">Copy text automatically on select</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={localSettings.terminal.confirmBeforePaste ?? true}
                          onChange={(e) => setLocalSettings({
                            ...localSettings,
                            terminal: { ...localSettings.terminal, confirmBeforePaste: e.target.checked }
                          })}
                          className="w-4 h-4 rounded border-gray-500 text-blue-500 focus:ring-blue-500 bg-[#2d2d30]"
                        />
                        <span className="text-xs text-gray-300">Confirm before pasting multi-line text</span>
                      </label>
                    </div>
                  </div>
                </div>
                
                {/* Preview Box */}
                <div className="mt-6 border border-[#3e3e42] rounded-md overflow-hidden bg-black/50 p-4">
                  <div className="text-xs text-gray-500 mb-2 font-semibold uppercase">Preview</div>
                  <div 
                    className="font-mono whitespace-pre" 
                    style={{ 
                      fontFamily: localSettings.terminal.fontFamily, 
                      fontSize: `${localSettings.terminal.fontSize}px`,
                      color: '#d4d4d4'
                    }}
                  >
                    <span className="text-green-400">user@host</span>:<span className="text-blue-400">~/project</span>$ ls -la<br/>
                    drwxr-xr-x 2 user user 4096 Sep 25 10:00 src<br/>
                    -rw-r--r-- 1 user user  128 Sep 25 10:01 main.rs<br/>
                    <span className="text-green-400">user@host</span>:<span className="text-blue-400">~/project</span>$ 
                    <span className={`inline-block ml-1 ${localSettings.terminal.cursorStyle === 'block' ? 'w-[0.5em] h-[1em] bg-white align-middle' : localSettings.terminal.cursorStyle === 'underline' ? 'w-[0.5em] border-b-2 border-white' : 'border-l-2 border-white pl-1'}`}></span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-2">Default Local Shell</label>
                  <select
                    value={localSettings.general.defaultShell}
                    onChange={(e) => setLocalSettings({
                      ...localSettings,
                      general: { ...localSettings.general, defaultShell: e.target.value as ShellType }
                    })}
                    className="w-full bg-[#2d2d30] border border-[#3e3e42] text-gray-200 text-xs rounded px-3 py-2 outline-none focus:border-blue-500"
                  >
                    <option value="powershell.exe">PowerShell</option>
                    <option value="cmd.exe">Command Prompt</option>
                    <option value="wsl.exe">WSL (Windows Subsystem for Linux)</option>
                    <option value="bash.exe">Git Bash (If installed)</option>
                  </select>
                  <p className="text-[11px] text-gray-500 mt-1">This shell will be used when opening a new local terminal.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-2">Default Working Directory</label>
                  <input
                    type="text"
                    value={localSettings.general.defaultCwd}
                    onChange={(e) => setLocalSettings({
                      ...localSettings,
                      general: { ...localSettings.general, defaultCwd: e.target.value }
                    })}
                    placeholder="e.g. C:\Users\Username"
                    className="w-full bg-[#2d2d30] border border-[#3e3e42] text-gray-200 text-xs rounded px-3 py-2 outline-none focus:border-blue-500 font-mono"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Leave empty to use your Home directory.</p>
                </div>

                <div className="pt-4 border-t border-[#3e3e42]">
                  <h3 className="text-sm font-semibold text-gray-200 mb-4">Terminal Session Logging</h3>
                  
                  <label className="flex items-center gap-2 cursor-pointer mb-4">
                    <input
                      type="checkbox"
                      checked={localSettings.general.logConfig?.enabled || false}
                      onChange={(e) => setLocalSettings({
                        ...localSettings,
                        general: {
                          ...localSettings.general,
                          logConfig: {
                            ...(localSettings.general.logConfig || { directory: 'C:\\KirinTerminal_Logs', stripAnsi: true }),
                            enabled: e.target.checked
                          }
                        }
                      })}
                      className="w-4 h-4 rounded border-gray-500 text-blue-500 focus:ring-blue-500 bg-[#2d2d30]"
                    />
                    <span className="text-xs text-gray-300 font-medium">Automatically save terminal output to log files</span>
                  </label>

                  <div className={`space-y-4 transition-opacity ${localSettings.general.logConfig?.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-2">Log Directory</label>
                      <input
                        type="text"
                        value={localSettings.general.logConfig?.directory || ''}
                        onChange={(e) => setLocalSettings({
                          ...localSettings,
                          general: {
                            ...localSettings.general,
                            logConfig: {
                              ...localSettings.general.logConfig!,
                              directory: e.target.value
                            }
                          }
                        })}
                        placeholder="e.g. C:\KirinTerminal_Logs"
                        className="w-full bg-[#2d2d30] border border-[#3e3e42] text-gray-200 text-xs rounded px-3 py-2 outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Backup & Restore Sessions */}
                <div className="pt-4 border-t border-[#3e3e42]">
                  <h3 className="text-sm font-semibold text-gray-200 mb-2">Backup & Restore Sessions (การสำรองข้อมูล)</h3>
                  <p className="text-[11px] text-gray-400 mb-3">
                    ส่งออกรายชื่อเซสชันและโฟลเดอร์เก็บไว้เป็นไฟล์ JSON เพื่อนำไปเปิดบนเครื่องอื่น หรือกู้คืนข้อมูล
                  </p>
                  
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onExportSessions?.()}
                      className="flex items-center gap-2 px-3.5 py-2 bg-[#2d2d32] hover:bg-[#38383e] text-gray-200 rounded-lg border border-[#3e3e44] text-xs font-medium transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-sky-400" />
                      <span>Export Sessions (JSON)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => importInputRef.current?.click()}
                      className="flex items-center gap-2 px-3.5 py-2 bg-[#2d2d32] hover:bg-[#38383e] text-gray-200 rounded-lg border border-[#3e3e44] text-xs font-medium transition-colors cursor-pointer"
                    >
                      <FolderArchive className="w-4 h-4 text-amber-400" />
                      <span>Import Sessions</span>
                    </button>
                    
                    <input
                      ref={importInputRef}
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          onImportSessions?.(file);
                          e.target.value = '';
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#3e3e42] bg-[#252528] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-[#3e3e42] rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors shadow-lg"
          >
            <Save className="w-3.5 h-3.5" />
            Save Changes
          </button>
        </div>

      </div>
    </div>
  );
};
