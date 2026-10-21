import React, { useState } from 'react';
import { PlusCircle, RotateCcw, Search, Key, Terminal as TermIcon, HardDrive, Monitor, Server, Cable, Radio } from 'lucide-react';
import { SessionConfig } from '../types';

interface HomeViewProps {
  onStartLocalTerminal: (shell?: 'powershell.exe' | 'cmd.exe') => void;
  onOpenSession: (session: SessionConfig) => void;
  recentSessions: SessionConfig[];
  onOpenTools?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onStartLocalTerminal,
  onOpenSession,
  recentSessions,
  onOpenTools
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSessions = recentSessions.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.host && s.host.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="h-full w-full bg-[#1b1b1c] text-gray-200 overflow-y-auto flex flex-col items-center justify-between p-8 select-none">
      {/* Top spacing */}
      <div className="w-full max-w-3xl flex flex-col items-center pt-8">
        
        {/* Logo and App Title */}
        <div className="flex items-center gap-4 mb-8">
          <div className="relative w-16 h-16 flex items-center justify-center bg-[#252526] rounded-xl border border-[#3e3e42] shadow-lg">
            <span className="text-white font-mono font-bold text-2xl">&gt;_</span>
            <div className="absolute -bottom-1 -right-1 flex gap-0.5">
              <span className="w-3 h-3 rounded-sm bg-red-500"></span>
              <span className="w-3 h-3 rounded-sm bg-green-500"></span>
              <span className="w-3 h-3 rounded-sm bg-blue-500"></span>
              <span className="w-3 h-3 rounded-sm bg-yellow-500"></span>
            </div>
          </div>
          <h1 className="text-4xl font-semibold tracking-wide text-white">KirinTerminal</h1>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-8 w-full">
          <button
            onClick={() => onStartLocalTerminal()}
            className="flex items-center gap-2 bg-[#2d2d30] hover:bg-[#3e3e42] active:bg-[#4a4a4f] text-gray-100 font-medium px-6 py-2.5 rounded border border-[#454545] shadow transition-all cursor-pointer"
          >
            <PlusCircle className="w-5 h-5 text-green-500" />
            <span>Start local terminal</span>
          </button>

          <button
            onClick={() => onStartLocalTerminal('cmd.exe')}
            className="flex items-center gap-2 bg-[#2d2d30] hover:bg-[#3e3e42] active:bg-[#4a4a4f] text-gray-100 font-medium px-6 py-2.5 rounded border border-[#454545] shadow transition-all cursor-pointer"
          >
            <TermIcon className="w-5 h-5 text-blue-400" />
            <span>Start Command Prompt</span>
          </button>

          <button
            onClick={() => {
              if (recentSessions.length > 0) {
                onOpenSession(recentSessions[0]);
              }
            }}
            className="flex items-center gap-2 bg-[#2d2d30] hover:bg-[#3e3e42] active:bg-[#4a4a4f] text-gray-100 font-medium px-6 py-2.5 rounded border border-[#454545] shadow transition-all cursor-pointer"
          >
            <RotateCcw className="w-5 h-5 text-cyan-400" />
            <span>Recover previous sessions</span>
          </button>

          {onOpenTools && (
            <button
              onClick={onOpenTools}
              className="flex items-center gap-2 bg-[#2d2d30] hover:bg-[#3e3e42] active:bg-[#4a4a4f] text-gray-100 font-medium px-6 py-2.5 rounded border border-[#454545] shadow transition-all cursor-pointer"
            >
              <Radio className="w-5 h-5 text-emerald-400" />
              <span>IP Scanner</span>
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative w-full max-w-xl mb-10">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Find existing session or server name..."
            className="w-full bg-[#141414] border border-[#3e3e42] focus:border-[#007acc] text-gray-200 text-sm px-4 py-2 rounded outline-none transition-colors"
          />
          <Search className="w-4 h-4 text-gray-500 absolute right-3 top-2.5" />
        </div>

        {/* Recent Sessions Section */}
        <div className="w-full max-w-2xl">
          <div className="text-center font-medium text-gray-400 text-sm mb-4 border-b border-[#2d2d30] pb-2">
            Recent sessions
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onOpenSession(session)}
                className="flex items-center gap-3 p-3 bg-[#242426] hover:bg-[#2d2d30] border border-[#38383a] hover:border-[#007acc] rounded cursor-pointer transition-all group"
              >
                <div className="p-2 bg-[#1b1b1c] rounded border border-[#333335] group-hover:border-[#007acc]/40">
                  {session.type === 'SSH' ? (
                    <Key className="w-4 h-4 text-yellow-500" />
                  ) : session.type === 'Serial' ? (
                    <Cable className="w-4 h-4 text-orange-400" />
                  ) : session.type === 'RDP' ? (
                    <Monitor className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Server className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-semibold text-gray-200 truncate group-hover:text-blue-300">
                    {session.name}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">
                    {session.type} {session.host ? `• ${session.host}` : session.serialPort ? `• ${session.serialPort} (${session.baudRate || 115200})` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredSessions.length === 0 && (
            <div className="text-center text-xs text-gray-500 py-6">
              No sessions match your search. Click "Start local terminal" to begin!
            </div>
          )}
        </div>
      </div>

      {/* Footer Banner */}
      <div className="text-center text-xs text-gray-500 pt-6">
        <span>KirinTerminal - All-in-One Terminal &amp; Remote Sessions</span>
      </div>
    </div>
  );
};
