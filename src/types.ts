export type ShellType = 'powershell.exe' | 'cmd.exe' | 'wsl.exe' | 'bash.exe';

export type TerminalTheme = 'mobaxterm' | 'dracula' | 'monokai' | 'solarized-dark';

export interface GlobalSettings {
  terminal: {
    theme: TerminalTheme;
    fontSize: number;
    fontFamily: string;
    cursorStyle: 'block' | 'underline' | 'bar';
    cursorBlink: boolean;
    rightClickAction: 'paste' | 'menu';
    copyOnSelect: boolean;
    confirmBeforePaste: boolean;
  };
  general: {
    defaultShell: ShellType;
    defaultCwd: string;
    logConfig?: {
      enabled: boolean;
      directory: string;
      stripAnsi: boolean;
    };
  };
}

export interface TunnelConfig {
  id: string;
  name: string;
  type: 'local' | 'remote' | 'dynamic';
  localPort: number;
  sshHost: string;
  sshPort: number;
  sshUsername: string;
  sshPassword?: string;
  sshPrivateKey?: string;
  destHost?: string;
  destPort?: number;
  status: 'stopped' | 'connecting' | 'running' | 'error';
  statusMessage?: string;
}

export interface ServerLogEntry {
  time: string;
  message: string;
  type: 'info' | 'warn' | 'error';
}

export interface EmbeddedServerState {
  status: 'running' | 'stopped' | 'error';
  port: number;
  rootDir: string;
  user?: string;
  password?: string;
  logs: ServerLogEntry[];
}

export type SessionType = 'SSH' | 'Telnet' | 'RDP' | 'VNC' | 'Serial' | 'Shell' | 'WSL';

export interface SessionFolder {
  id: string;
  name: string;
  parentId?: string | null;
  isExpanded?: boolean;
}

export interface CredentialConfig {
  id: string;
  name: string;
  username: string;
  password?: string;
  privateKey?: string;
  description?: string;
  updatedAt?: number;
}

export interface SessionConfig {
  id: string;
  name: string;
  type: SessionType;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  privateKey?: string;
  credentialId?: string | null;
  shellType?: ShellType;
  folderId?: string | null;
  lastUsed?: string;
  wslDistro?: string;
  rdpResolution?: string;
  rdpFullscreen?: boolean;
  rdpAdmin?: boolean;
  serialPort?: string;
  baudRate?: number;
  dataBits?: 8 | 7 | 6 | 5;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd' | 'mark' | 'space';
  flowControl?: 'none' | 'rtscts' | 'xonxoff';
  theme?: string;
  envColor?: string; // e.g., 'red' for Prod, 'green' for Dev
  fontSize?: number;
  fontFamily?: string;
}

export interface TabItem {
  id: string;
  title: string;
  type: 'home' | 'terminal' | 'network-tools' | 'tunnels' | 'rdp' | 'vnc';
  connectionType?: 'local' | 'ssh' | 'serial' | 'telnet' | 'wsl' | 'rdp' | 'vnc';
  shell?: ShellType;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  privateKey?: string;
  wslDistro?: string;
  rdpResolution?: string;
  rdpFullscreen?: boolean;
  rdpAdmin?: boolean;
  cwd?: string;
  sessionId?: string;
  status?: 'connecting' | 'connected' | 'error' | 'disconnected';
  serialPort?: string;
  baudRate?: number;
  dataBits?: number;
  stopBits?: number;
  parity?: string;
  flowControl?: string;
  theme?: string;
  envColor?: string;
  fontSize?: number;
  fontFamily?: string;
}

export interface SFTPFileItem {
  name: string;
  isDirectory: boolean;
  size: number;
  modifyTime: number;
  mode?: number;
}

export interface Macro {
  id: string;
  name: string;
  data: string;
  createdAt: number;
}

export interface Snippet {
  id: string;
  name: string;
  command: string;
  createdAt: number;
}

export interface NetworkInterfaceInfo {
  name: string;
  ip: string;
  netmask: string;
  mac?: string;
  rangeStart: string;
  rangeEnd: string;
  cidr: string;
}

export interface ScannedHost {
  ip: string;
  alive: boolean;
  latency?: number;
  hostname?: string;
  mac?: string;
  vendor?: string;
  openPorts?: number[];
}

