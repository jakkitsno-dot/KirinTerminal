# KirinTerminal 🚀

> **All-in-One Terminal & Remote Sessions Client** — A modern, high-performance terminal workspace and remote desktop suite built with Electron, React, TypeScript, and Tailwind CSS.

---

## ✨ Features

- 💻 **Multi-Protocol Terminal Support**:
  - **Local Shells**: Windows CMD, PowerShell, WSL, and Git Bash.
  - **SSH Sessions**: Secure remote shell with key/password authentication and SFTP file explorer.
  - **Serial Ports**: Hardware debugging and embedded device communication via Serial/COM ports.
  - **Telnet / Raw Sockets**: Legacy protocol and device access.
- 🖥️ **Remote Desktop**:
  - **RDP**: Integrated Windows Remote Desktop Protocol client.
  - **VNC**: Fast Virtual Network Computing display viewer.
- 🔀 **SSH Tunneling & Port Forwarding**:
  - Manage Local, Remote, and Dynamic (SOCKS5) tunnels with one click.
- ⚡ **Multi-Execution Bar**:
  - Broadcast keyboard input and commands across multiple active terminal sessions simultaneously.
- 🔒 **Master Password & Credential Vault**:
  - AES-encrypted credentials and secure session profiles storage.
- 📝 **Built-in Developer Tools**:
  - **Monaco Code/Text Editor**: Edit local or remote files directly inside the app.
  - **Diff Viewer**: Side-by-side file comparison modal.
  - **Network Diagnostics**: Built-in Ping, Port Scanner, Traceroute, and DNS tools.
  - **Terminal Split Grid**: Dynamic tab layout and grid splitting (2x1, 2x2, 1x2).

---

## 🛠️ Tech Stack

- **Framework**: [Electron](https://www.electronjs.org/) + [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Terminal Core**: [xterm.js](https://xtermjs.org/) + [node-pty](https://github.com/microsoft/node-pty)
- **Protocols**: `ssh2`, `serialport`, `ws`
- **Packaging**: [electron-builder](https://www.electron.build/)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- Windows 10/11 (for native node-pty and Windows terminal support)

### Installation

```bash
# Clone the repository
git clone https://github.com/jakkitsno-dot/KirinTerminal.git
cd KirinTerminal

# Install dependencies
npm install
```

### Development

```bash
# Run both Vite dev server and Electron app
npm run dev
```

### Building for Production

```bash
# Build Vite production bundle and create Windows installer / portable executable
npm run dist:win
```

---

## 📄 License

MIT License. Designed and developed by [Jakkit](https://github.com/jakkitsno-dot).
