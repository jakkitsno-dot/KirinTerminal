import React, { useState, useMemo } from 'react';
import { Package, Search, X, Check, Copy, TerminalSquare, ShieldAlert, Cpu, Globe, Braces, Box } from 'lucide-react';

interface PackageManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: (command: string) => void;
}

interface PackageItem {
  id: string;
  name: string;
  description: string;
  category: 'System' | 'Network' | 'DevTools' | 'Containers' | 'Web';
}

const PACKAGES: PackageItem[] = [
  { id: 'htop', name: 'htop', description: 'Interactive process viewer & system monitor', category: 'System' },
  { id: 'btop', name: 'btop', description: 'Modern, aesthetically pleasing resource monitor', category: 'System' },
  { id: 'tmux', name: 'tmux', description: 'Terminal multiplexer for multiple sessions', category: 'System' },
  { id: 'ncdu', name: 'ncdu', description: 'Disk usage analyzer with ncurses interface', category: 'System' },
  
  { id: 'curl', name: 'curl', description: 'Command line tool for transferring data with URLs', category: 'Network' },
  { id: 'wget', name: 'wget', description: 'Network downloader for fetching files', category: 'Network' },
  { id: 'nmap', name: 'nmap', description: 'Network discovery and security auditing tool', category: 'Network' },
  { id: 'net-tools', name: 'net-tools', description: 'Basic networking tools (ifconfig, netstat, etc.)', category: 'Network' },
  
  { id: 'git', name: 'git', description: 'Distributed version control system', category: 'DevTools' },
  { id: 'vim', name: 'vim', description: 'Highly configurable, advanced text editor', category: 'DevTools' },
  { id: 'nano', name: 'nano', description: 'Small, user-friendly text editor', category: 'DevTools' },
  { id: 'jq', name: 'jq', description: 'Lightweight and flexible command-line JSON processor', category: 'DevTools' },
  { id: 'tree', name: 'tree', description: 'Display directories as trees (with optional color)', category: 'DevTools' },
  { id: 'build-essential', name: 'build-essential', description: 'Compiler and basic libraries for C/C++', category: 'DevTools' },
  
  { id: 'docker.io', name: 'docker.io', description: 'Container runtime engine (Docker)', category: 'Containers' },
  { id: 'docker-compose', name: 'docker-compose', description: 'Define and run multi-container applications', category: 'Containers' },
  
  { id: 'nginx', name: 'nginx', description: 'High performance web server and reverse proxy', category: 'Web' },
  { id: 'nodejs', name: 'nodejs', description: 'JavaScript runtime environment', category: 'Web' },
  { id: 'python3', name: 'python3', description: 'Python 3 interpreter and standard libraries', category: 'Web' },
  { id: 'python3-pip', name: 'python3-pip', description: 'Package installer for Python (pip)', category: 'Web' }
];

type PackageManagerType = 'apt' | 'dnf' | 'pacman' | 'apk' | 'brew' | 'winget';

const PACKAGE_MANAGERS: Record<PackageManagerType, { label: string; cmd: string }> = {
  apt: { label: 'APT (Debian / Ubuntu / Kali)', cmd: 'sudo apt update && sudo apt install -y' },
  dnf: { label: 'DNF / YUM (RHEL / CentOS / Fedora)', cmd: 'sudo dnf install -y' },
  pacman: { label: 'Pacman (Arch / Manjaro)', cmd: 'sudo pacman -Sy --noconfirm' },
  apk: { label: 'APK (Alpine Linux)', cmd: 'sudo apk add --no-cache' },
  brew: { label: 'Homebrew (macOS / Linux)', cmd: 'brew install' },
  winget: { label: 'Winget (Windows)', cmd: 'winget install --silent' }
};

export const PackageManagerModal: React.FC<PackageManagerModalProps> = ({ isOpen, onClose, onInstall }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'System' | 'Network' | 'DevTools' | 'Containers' | 'Web'>('All');
  const [pkgManager, setPkgManager] = useState<PackageManagerType>('apt');
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
  const [customPackage, setCustomPackage] = useState('');
  const [copied, setCopied] = useState(false);

  const filteredPackages = useMemo(() => {
    return PACKAGES.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategory]);

  const togglePackage = (pkgName: string) => {
    const newSet = new Set(selectedPackages);
    if (newSet.has(pkgName)) {
      newSet.delete(pkgName);
    } else {
      newSet.add(pkgName);
    }
    setSelectedPackages(newSet);
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'System': return <Cpu className="w-4 h-4 text-emerald-400" />;
      case 'Network': return <Globe className="w-4 h-4 text-blue-400" />;
      case 'DevTools': return <Braces className="w-4 h-4 text-amber-400" />;
      case 'Containers': return <Box className="w-4 h-4 text-sky-400" />;
      case 'Web': return <Globe className="w-4 h-4 text-purple-400" />;
      default: return <Package className="w-4 h-4 text-gray-400" />;
    }
  };

  const generatedCommand = useMemo(() => {
    let list = Array.from(selectedPackages);
    if (customPackage.trim()) {
      list = [...list, ...customPackage.trim().split(/\s+/)];
    }
    if (list.length === 0) return '';
    return `${PACKAGE_MANAGERS[pkgManager].cmd} ${list.join(' ')}`;
  }, [selectedPackages, customPackage, pkgManager]);

  const handleCopyCommand = () => {
    if (!generatedCommand) return;
    navigator.clipboard.writeText(generatedCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInstallClick = () => {
    if (!generatedCommand) return;
    onInstall(generatedCommand);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#1e1e1e] border border-[#3e3e42] rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-3.5 border-b border-[#3e3e42] bg-[#252528]">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/20 p-1.5 rounded-lg border border-indigo-500/30">
              <Package className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-200">MobApt Quick Installer</h2>
              <p className="text-[11px] text-gray-400">Rapidly deploy standard tools and packages to your active terminal</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#3e3e42] text-gray-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Left Sidebar: Categories & Settings */}
          <div className="w-56 bg-[#252528] border-r border-[#3e3e42] p-4 flex flex-col gap-6 overflow-y-auto">
            <div>
              <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Categories</h3>
              <div className="flex flex-col gap-1">
                {['All', 'System', 'Network', 'DevTools', 'Containers', 'Web'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat as any)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded text-xs transition-colors cursor-pointer ${
                      selectedCategory === cat 
                        ? 'bg-indigo-500/20 text-indigo-300 font-medium border border-indigo-500/30' 
                        : 'text-gray-400 hover:bg-[#2d2d30] hover:text-gray-200 border border-transparent'
                    }`}
                  >
                    {cat === 'All' ? <Package className="w-4 h-4 opacity-70" /> : getCategoryIcon(cat)}
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Target OS / Package Manager</h3>
              <div className="flex flex-col gap-2">
                {(Object.entries(PACKAGE_MANAGERS) as [PackageManagerType, { label: string; cmd: string }][]).map(([key, info]) => (
                  <label key={key} className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="radio"
                      name="pkgManager"
                      value={key}
                      checked={pkgManager === key}
                      onChange={() => setPkgManager(key)}
                      className="mt-0.5 w-3.5 h-3.5 text-indigo-500 bg-[#161618] border-[#3e3e42] focus:ring-indigo-500 focus:ring-offset-0 focus:ring-1"
                    />
                    <span className={`text-xs ${pkgManager === key ? 'text-gray-200' : 'text-gray-400 group-hover:text-gray-300'}`}>
                      {info.label}
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-md flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-yellow-200/80 leading-relaxed">
                  Commands using sudo will prompt for password in the terminal.
                </p>
              </div>
            </div>
          </div>

          {/* Right Main Area: Search & List */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
            {/* Search Bar */}
            <div className="p-4 border-b border-[#2d2d30]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search packages (e.g. htop, curl, docker)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                  className="w-full bg-[#161618] border border-[#3e3e42] focus:border-indigo-500 text-sm text-gray-200 py-2 pl-9 pr-4 rounded-md outline-none placeholder:text-gray-500 transition-colors"
                />
              </div>
            </div>

            {/* Package Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredPackages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-3">
                  <Package className="w-12 h-12 opacity-20" />
                  <p className="text-sm">No packages found matching your criteria</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredPackages.map(pkg => {
                    const isSelected = selectedPackages.has(pkg.name);
                    return (
                      <div 
                        key={pkg.id} 
                        onClick={() => togglePackage(pkg.name)}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-indigo-500/10 border-indigo-500/50' 
                            : 'bg-[#252528] border-[#333336] hover:border-[#4a4a50] hover:bg-[#2a2a2d]'
                        }`}
                      >
                        <div className="pt-0.5">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="w-4 h-4 rounded text-indigo-500 bg-[#161618] border-[#3e3e42]"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className={`text-sm font-semibold truncate ${isSelected ? 'text-indigo-300' : 'text-gray-200'}`}>
                              {pkg.name}
                            </h4>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1e1e1e] border border-[#3e3e42] text-gray-400">
                              {pkg.category}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                            {pkg.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer: Generated Command & Actions */}
        <div className="border-t border-[#3e3e42] bg-[#252528] p-4">
          
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-400 shrink-0">Custom packages:</span>
              <input
                type="text"
                placeholder="Type additional packages separated by spaces..."
                value={customPackage}
                onChange={(e) => setCustomPackage(e.target.value)}
                className="flex-1 bg-[#161618] border border-[#3e3e42] focus:border-indigo-500 text-xs text-gray-200 px-3 py-1.5 rounded outline-none placeholder:text-gray-500"
              />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <TerminalSquare className="w-4 h-4 text-gray-500" />
              </div>
              <input
                type="text"
                readOnly
                value={generatedCommand}
                placeholder="Select packages above to generate install command..."
                className="w-full bg-[#121212] border border-[#3e3e42] text-sm text-green-400 font-mono py-2.5 pl-9 pr-12 rounded-md outline-none"
              />
              <button 
                onClick={handleCopyCommand}
                disabled={!generatedCommand}
                title="Copy Command"
                className="absolute inset-y-0 right-1 px-2 flex items-center text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex justify-between items-center mt-1">
              <div className="text-xs text-gray-400">
                {selectedPackages.size} packages selected
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded text-xs font-medium text-gray-300 hover:bg-[#3e3e42] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInstallClick}
                  disabled={!generatedCommand}
                  className="px-4 py-2 rounded text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <TerminalSquare className="w-3.5 h-3.5" />
                  Install in Active Terminal
                </button>
              </div>
            </div>
          </div>
          
        </div>

      </div>
    </div>
  );
};
