const { WebSocketServer } = require('ws');
const pty = require('node-pty');
const { Client: SSHClient } = require('ssh2');
const os = require('os');
const path = require('path');
const net = require('net');
const fs = require('fs');
const { spawn } = require('child_process');
const { SerialPort } = require('serialport');
const { embeddedManager } = require('./embedded-servers');
const networkScanner = require('./network-scanner');

const PORT = process.env.PTY_PORT || 9292;
let wss;

const activeLoggers = new Map(); // id -> WriteStream
const activeIpScans = new Map(); // id -> scanHandle

const setupLogging = (id, title, logConfig) => {
  if (!logConfig || !logConfig.enabled || !logConfig.directory) return;
  
  try {
    if (!fs.existsSync(logConfig.directory)) {
      fs.mkdirSync(logConfig.directory, { recursive: true });
    }
    
    // Sanitize title for filename
    const safeTitle = (title || 'Session').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${safeTitle}_${timestamp}.log`;
    const filepath = path.join(logConfig.directory, filename);
    
    const stream = fs.createWriteStream(filepath, { flags: 'a' });
    activeLoggers.set(id, {
      stream,
      stripAnsi: logConfig.stripAnsi !== false
    });
    console.log(`[Logger] Started logging session ${id} to ${filepath}`);
  } catch (err) {
    console.error(`[Logger] Failed to setup logging for ${id}:`, err.message);
  }
};

const writeLog = (id, data) => {
  const logger = activeLoggers.get(id);
  if (logger && logger.stream) {
    let output = data;
    if (logger.stripAnsi) {
      // Basic ANSI strip regex
      output = output.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
    }
    logger.stream.write(output);
  }
};

const closeLogger = (id) => {
  const logger = activeLoggers.get(id);
  if (logger && logger.stream) {
    logger.stream.end();
    activeLoggers.delete(id);
    console.log(`[Logger] Stopped logging session ${id}`);
  }
};

// Active sessions maps
const localTerminals = new Map();
const sshSessions = new Map();
const activeTunnels = new Map();
const serialSessions = new Map();
const telnetSessions = new Map();

function initServer(wss) {
  wss.on('connection', (ws) => {
    console.log('[PTY/SSH Server] Client connected');
    embeddedManager.addClient(ws);

    ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      const { action, id } = data;

      // ----------------- LOCAL PTY ACTIONS -----------------
      if (action === 'spawn') {
        const shell = data.shell || (os.platform() === 'win32' ? 'powershell.exe' : 'bash');
        const cols = data.cols || 80;
        const rows = data.rows || 24;
        const cwd = data.cwd || process.env.USERPROFILE || process.cwd();

        console.log(`[PTY Server] Spawning local terminal ${id} (${shell})`);

        // If there was an existing session with this id, kill it cleanly first
        const existing = localTerminals.get(id);
        if (existing && existing.pty) {
          try { existing.pty.kill(); } catch (e) {}
          localTerminals.delete(id);
        }

        setupLogging(id, data.title, data.logConfig);

        const ptyProcess = pty.spawn(shell, [], {
          name: 'xterm-256color',
          cols: cols,
          rows: rows,
          cwd: cwd,
          env: process.env
        });

        localTerminals.set(id, { pty: ptyProcess, ws });

        ptyProcess.onData((output) => {
          writeLog(id, output);
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ action: 'output', id, data: output }));
          }
        });

        ptyProcess.onExit(({ exitCode }) => {
          console.log(`[PTY Server] Local terminal ${id} exited (${exitCode})`);
          // Only delete and close logger if this process is STILL the active process for this id
          const current = localTerminals.get(id);
          if (current && current.pty === ptyProcess) {
            closeLogger(id);
            localTerminals.delete(id);
          }
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ action: 'exit', id, code: exitCode }));
          }
        });

        ws.send(JSON.stringify({ action: 'spawned', id, shell }));

      } else if (action === 'input') {
        // Route input to either local PTY, SSH stream, Telnet socket, or Serial port
        const local = localTerminals.get(id);
        if (local && local.pty) {
          local.pty.write(data.data);
          return;
        }

        const ssh = sshSessions.get(id);
        if (ssh && ssh.stream) {
          ssh.stream.write(data.data);
          return;
        }

        const telnet = telnetSessions.get(id);
        if (telnet && telnet.socket && !telnet.socket.destroyed) {
          telnet.socket.write(data.data);
          return;
        }

        const serial = serialSessions.get(id);
        if (serial && serial.port && serial.port.isOpen) {
          serial.port.write(data.data);
        }

      } else if (action === 'resize') {
        const local = localTerminals.get(id);
        if (local && local.pty && data.cols > 0 && data.rows > 0) {
          local.pty.resize(data.cols, data.rows);
          return;
        }

        const ssh = sshSessions.get(id);
        if (ssh && ssh.stream && data.cols > 0 && data.rows > 0) {
          ssh.stream.setWindow(data.rows, data.cols, 0, 0);
        }

      } else if (action === 'close') {
        const local = localTerminals.get(id);
        if (local && (local.ws === ws || !local.ws)) {
          closeLogger(id);
          if (local.pty) {
            try { local.pty.kill(); } catch (e) {}
          }
          localTerminals.delete(id);
        }

        const ssh = sshSessions.get(id);
        if (ssh && (ssh.ws === ws || !ssh.ws)) {
          closeLogger(id);
          try { ssh.client.end(); } catch (e) {}
          sshSessions.delete(id);
        }

        const telnet = telnetSessions.get(id);
        if (telnet && (telnet.ws === ws || !telnet.ws)) {
          closeLogger(id);
          try { telnet.socket.destroy(); } catch (e) {}
          telnetSessions.delete(id);
        }

        const serial = serialSessions.get(id);
        if (serial && (serial.ws === ws || !serial.ws)) {
          closeLogger(id);
          try { serial.port.close(); } catch (e) {}
          serialSessions.delete(id);
        }

      // ----------------- SSH ACTIONS -----------------
      } else if (action === 'ssh_connect') {
        const { host, port = 22, username, password, privateKey, cols = 80, rows = 24 } = data;
        console.log(`[SSH Server] Connecting to ${username}@${host}:${port} for session ${id}`);

        setupLogging(id, data.title || `${username}@${host}`, data.logConfig);

        const conn = new SSHClient();
        sshSessions.set(id, { client: conn, stream: null, sftp: null, ws, host, username });

        conn.on('ready', () => {
          console.log(`[SSH Server] Session ${id} connected successfully!`);
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ action: 'ssh_ready', id, host, username }));
          }

          // 1. Open Interactive Shell
          conn.shell({ term: 'xterm-256color', cols, rows }, (err, stream) => {
            if (err) {
              console.error(`[SSH Server] Shell error on session ${id}:`, err);
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ action: 'output', id, data: `\r\n\x1b[31m[Error opening remote shell: ${err.message}]\x1b[0m\r\n` }));
              }
              return;
            }

            const current = sshSessions.get(id);
            if (current) current.stream = stream;

            stream.on('data', (chunk) => {
              const strData = chunk.toString('utf-8');
              writeLog(id, strData);
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ action: 'output', id, data: strData }));
              }
            });

            stream.on('close', () => {
              console.log(`[SSH Server] Shell stream closed for ${id}`);
              closeLogger(id);
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ action: 'exit', id, code: 0 }));
              }
              sshSessions.delete(id);
            });
          });

          // 2. Open SFTP Session automatically!
          conn.sftp((err, sftp) => {
            if (err) {
              console.error(`[SFTP Server] SFTP init error on session ${id}:`, err);
              return;
            }
            console.log(`[SFTP Server] SFTP initialized for session ${id}`);
            const current = sshSessions.get(id);
            if (current) current.sftp = sftp;

            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ action: 'sftp_ready', id }));
            }
          });
        });

        conn.on('error', (err) => {
          console.error(`[SSH Server] Connection error on session ${id}:`, err.message);
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ action: 'ssh_error', id, message: err.message }));
          }
          sshSessions.delete(id);
        });

        conn.on('close', () => {
          console.log(`[SSH Server] Connection closed for session ${id}`);
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ action: 'ssh_closed', id }));
          }
          sshSessions.delete(id);
        });

        // Start connection
        try {
          conn.connect({
            host,
            port: Number(port) || 22,
            username,
            password: password || undefined,
            privateKey: privateKey ? Buffer.from(privateKey) : undefined,
            readyTimeout: 20000,
            keepaliveInterval: 10000,
            keepaliveCountMax: 5
          });
        } catch (connErr) {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ action: 'ssh_error', id, message: connErr.message }));
          }
        }

      // ----------------- REMOTE SERVER MONITOR -----------------
      } else if (action === 'ssh_monitor') {
        const ssh = sshSessions.get(id);
        if (ssh && ssh.client) {
          const cmd = "CPU=$(top -bn1 | grep -i 'cpu(s)' | awk '{print $2 + $4}' | cut -d. -f1); if [ -z \"$CPU\" ]; then CPU=$(cat /proc/loadavg | awk '{print $1}'); else CPU=\"${CPU}%\"; fi; echo $CPU; free -m | awk 'NR==2{print $3,$2}'; df -h / | awk 'NR==2{print $5}'";
          ssh.client.exec(cmd, (err, stream) => {
            if (err) return; // Silent fail if exec is not available
            let output = '';
            stream.on('data', (data) => output += data.toString());
            stream.on('close', () => {
              const lines = output.trim().split('\n');
              if (lines.length >= 3 && ws.readyState === ws.OPEN) {
                const loadAvg = lines[0].trim();
                const memParts = lines[1].trim().split(/\s+/);
                const usedMem = parseInt(memParts[0] || '0', 10);
                const totalMem = parseInt(memParts[1] || '0', 10);
                const diskUsage = lines[2].trim();
                
                ws.send(JSON.stringify({
                  action: 'ssh_monitor_result',
                  id,
                  cpu: loadAvg,
                  ram: totalMem > 0 ? `${usedMem}M / ${totalMem}M` : 'N/A',
                  ramPercent: totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0,
                  disk: diskUsage
                }));
              }
            });
          });
        }

      // ----------------- SFTP ACTIONS -----------------
      } else if (action === 'sftp_list') {
        const ssh = sshSessions.get(id);
        if (!ssh || !ssh.sftp) {
          ws.send(JSON.stringify({ action: 'sftp_list_result', id, error: 'SFTP not connected', files: [] }));
          return;
        }

        const targetPath = data.path || '.';
        console.log(`[SFTP Server] Listing path: ${targetPath} for session ${id}`);

        // First resolve real path if relative
        ssh.sftp.realpath(targetPath, (err, resolvedPath) => {
          const currentPath = err ? targetPath : resolvedPath;

          ssh.sftp.readdir(currentPath, (readErr, list) => {
            if (readErr) {
              ws.send(JSON.stringify({
                action: 'sftp_list_result',
                id,
                path: currentPath,
                error: readErr.message,
                files: []
              }));
              return;
            }

            const files = list.map((item) => ({
              name: item.filename,
              isDirectory: (item.attrs.mode & 0o040000) === 0o040000,
              size: item.attrs.size,
              modifyTime: item.attrs.mtime * 1000,
              mode: item.attrs.mode
            })).sort((a, b) => {
              if (a.isDirectory === b.isDirectory) {
                return a.name.localeCompare(b.name);
              }
              return a.isDirectory ? -1 : 1;
            });

            ws.send(JSON.stringify({
              action: 'sftp_list_result',
              id,
              path: currentPath,
              files
            }));
          });
        });

      } else if (action === 'sftp_realpath') {
        const ssh = sshSessions.get(id);
        if (!ssh || !ssh.sftp) return;

        const targetPath = data.path || '.';
        ssh.sftp.realpath(targetPath, (err, resolvedPath) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
              action: 'sftp_realpath_result',
              id,
              path: err ? targetPath : resolvedPath
            }));
          }
        });

      } else if (action === 'sftp_read') {
        const ssh = sshSessions.get(id);
        if (!ssh || !ssh.sftp) return;

        const { filePath } = data;
        console.log(`[SFTP Server] Reading file: ${filePath}`);

        ssh.sftp.readFile(filePath, 'utf-8', (err, content) => {
          ws.send(JSON.stringify({
            action: 'sftp_read_result',
            id,
            filePath,
            success: !err,
            content: err ? '' : content,
            error: err ? err.message : null
          }));
        });

      } else if (action === 'sftp_write') {
        const ssh = sshSessions.get(id);
        if (!ssh || !ssh.sftp) return;

        const { filePath, content } = data;
        console.log(`[SFTP Server] Writing file: ${filePath}`);

        ssh.sftp.writeFile(filePath, content, 'utf-8', (err) => {
          ws.send(JSON.stringify({
            action: 'sftp_write_result',
            id,
            filePath,
            success: !err,
            error: err ? err.message : null
          }));
        });


      } else if (action === 'sftp_upload') {
        const ssh = sshSessions.get(id);
        if (!ssh || !ssh.sftp) return;

        const { localPath, remotePath } = data;
        console.log(`[SFTP Server] Uploading file from ${localPath} to ${remotePath}`);

        const uploadOptions = {
          step: (transferred, chunk, total) => {
            if (ws.readyState === ws.OPEN) {
              const percent = total > 0 ? Math.round((transferred / total) * 100) : 0;
              ws.send(JSON.stringify({
                action: 'sftp_upload_progress',
                id,
                remotePath,
                transferred,
                total,
                percent
              }));
            }
          }
        };

        ssh.sftp.fastPut(localPath, remotePath, uploadOptions, (err) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
              action: 'sftp_upload_result',
              id,
              remotePath,
              success: !err,
              error: err ? err.message : null
            }));
          }
        });

      } else if (action === 'sftp_upload_dir') {
        const ssh = sshSessions.get(id);
        if (!ssh || !ssh.sftp) return;

        const { localPath, remotePath } = data;
        console.log(`[SFTP Server] Uploading directory from ${localPath} to ${remotePath}`);

        const ensureRemoteDir = (sftp, dirPath) => {
          return new Promise((resolve, reject) => {
            sftp.stat(dirPath, (err, stats) => {
              if (err) {
                sftp.mkdir(dirPath, (errMkdir) => {
                  if (errMkdir) reject(errMkdir);
                  else resolve();
                });
              } else if (stats.isDirectory()) {
                resolve();
              } else {
                reject(new Error(`Remote path ${dirPath} exists and is not a directory`));
              }
            });
          });
        };

        const uploadRecursive = async (localBase, remoteBase) => {
          try {
            await ensureRemoteDir(ssh.sftp, remoteBase);
            const items = fs.readdirSync(localBase, { withFileTypes: true });
            for (const item of items) {
              const itemLocal = path.join(localBase, item.name);
              const itemRemote = `${remoteBase}/${item.name}`;

              if (item.isDirectory()) {
                await uploadRecursive(itemLocal, itemRemote);
              } else {
                await new Promise((resolve, reject) => {
                  ssh.sftp.fastPut(itemLocal, itemRemote, {
                    step: (transferred, chunk, total) => {
                      if (ws.readyState === ws.OPEN) {
                        const percent = total > 0 ? Math.round((transferred / total) * 100) : 0;
                        ws.send(JSON.stringify({
                          action: 'sftp_upload_progress',
                          id,
                          remotePath: itemRemote,
                          transferred,
                          total,
                          percent
                        }));
                      }
                    }
                  }, (errPut) => {
                    if (errPut) reject(errPut);
                    else {
                      if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({
                          action: 'sftp_upload_result',
                          id,
                          remotePath: itemRemote,
                          success: true
                        }));
                      }
                      resolve();
                    }
                  });
                });
              }
            }
          } catch (err) {
            throw err;
          }
        };

        uploadRecursive(localPath, remotePath)
          .then(() => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                action: 'sftp_upload_dir_result',
                id,
                remotePath,
                success: true
              }));
            }
          })
          .catch((err) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                action: 'sftp_upload_dir_result',
                id,
                remotePath,
                success: false,
                error: err.message
              }));
            }
          });

      } else if (action === 'sftp_upload_buffer') {
        const ssh = sshSessions.get(id);
        if (!ssh || !ssh.sftp) return;

        const { remotePath, fileDataBase64 } = data;
        console.log(`[SFTP Server] Uploading buffer to ${remotePath}`);

        try {
          const buffer = Buffer.from(fileDataBase64, 'base64');
          ssh.sftp.writeFile(remotePath, buffer, (err) => {
            ws.send(JSON.stringify({
              action: 'sftp_upload_result',
              id,
              remotePath,
              success: !err,
              error: err ? err.message : null
            }));
          });
        } catch (e) {
          ws.send(JSON.stringify({
            action: 'sftp_upload_result',
            id,
            remotePath,
            success: false,
            error: e.message
          }));
        }

      } else if (action === 'sftp_download') {
        const ssh = sshSessions.get(id);
        if (!ssh || !ssh.sftp) return;

        const { filePath } = data;
        console.log(`[SFTP Server] Downloading file: ${filePath}`);

        ssh.sftp.readFile(filePath, (err, buffer) => {
          ws.send(JSON.stringify({
            action: 'sftp_download_result',
            id,
            filePath,
            fileName: path.basename(filePath),
            success: !err,
            dataBase64: err ? null : buffer.toString('base64'),
            error: err ? err.message : null
          }));
        });

      } else if (action === 'sftp_touch') {
        const ssh = sshSessions.get(id);
        if (!ssh || !ssh.sftp) return;

        const { filePath } = data;
        console.log(`[SFTP Server] Creating new file: ${filePath}`);

        ssh.sftp.writeFile(filePath, Buffer.from(''), (err) => {
          ws.send(JSON.stringify({
            action: 'sftp_touch_result',
            id,
            filePath,
            success: !err,
            error: err ? err.message : null
          }));
        });

      } else if (action === 'sftp_write') {
        const ssh = sshSessions.get(id);
        if (!ssh || !ssh.sftp) return;

        const { filePath, content } = data;
        console.log(`[SFTP Server] Writing file: ${filePath}`);

        ssh.sftp.writeFile(filePath, content, 'utf-8', (err) => {
          ws.send(JSON.stringify({
            action: 'sftp_write_result',
            id,
            filePath,
            success: !err,
            error: err ? err.message : null
          }));
        });

      } else if (action === 'sftp_mkdir') {
        const ssh = sshSessions.get(id);
        if (!ssh || !ssh.sftp) return;

        ssh.sftp.mkdir(data.dirPath, (err) => {
          ws.send(JSON.stringify({
            action: 'sftp_mkdir_result',
            id,
            dirPath: data.dirPath,
            success: !err,
            error: err ? err.message : null
          }));
        });

      } else if (action === 'sftp_delete') {
        const ssh = sshSessions.get(id);
        if (!ssh || !ssh.sftp) return;

        const { targetPath, isDirectory } = data;
        const removeFn = isDirectory ? ssh.sftp.rmdir.bind(ssh.sftp) : ssh.sftp.unlink.bind(ssh.sftp);

        removeFn(targetPath, (err) => {
          ws.send(JSON.stringify({
            action: 'sftp_delete_result',
            id,
            targetPath,
            success: !err,
            error: err ? err.message : null
          }));
        });

      } else if (action === 'sftp_rename') {
        const ssh = sshSessions.get(id);
        if (!ssh || !ssh.sftp) return;

        ssh.sftp.rename(data.oldPath, data.newPath, (err) => {
          ws.send(JSON.stringify({
            action: 'sftp_rename_result',
            id,
            success: !err,
            error: err ? err.message : null
          }));
        });
      }
      
      // ----------------- NETWORK TOOLS -----------------
      else if (action === 'net_ping' || action === 'net_traceroute') {
        const { target } = data;
        const isWin = os.platform() === 'win32';
        
        let cmd = '';
        let args = [];
        
        if (action === 'net_ping') {
          cmd = 'ping';
          args = isWin ? ['-n', '4', target] : ['-c', '4', target];
        } else {
          cmd = isWin ? 'tracert' : 'traceroute';
          args = [target];
        }

        const child = spawn(cmd, args);
        
        child.stdout.on('data', (chunk) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ action: 'net_output', id, data: chunk.toString() }));
          }
        });
        
        child.stderr.on('data', (chunk) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ action: 'net_output', id, data: chunk.toString() }));
          }
        });
        
        child.on('close', (code) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ action: 'net_done', id, code }));
          }
        });
      }
      
      else if (action === 'net_portscan') {
        const { target, ports } = data; // ports is an array of numbers
        
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ action: 'net_output', id, data: `Starting Port Scan on ${target}...\r\n` }));
        }

        let completed = 0;
        
        ports.forEach(port => {
          const socket = new net.Socket();
          socket.setTimeout(2000); // 2 second timeout per port
          
          socket.on('connect', () => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ action: 'net_output', id, data: `[+] Port ${port} is OPEN\r\n` }));
            }
            socket.destroy();
            checkDone();
          });
          
          socket.on('timeout', () => {
            socket.destroy();
            checkDone();
          });
          
          socket.on('error', () => {
            socket.destroy();
            checkDone();
          });
          
          const checkDone = () => {
            completed++;
            if (completed === ports.length) {
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ action: 'net_output', id, data: `Scan Complete.\r\n` }));
                ws.send(JSON.stringify({ action: 'net_done', id, code: 0 }));
              }
            }
          };
          
          socket.connect(port, target);
        });
      }

      // ----------------- IP SCANNER ACTIONS -----------------
      else if (action === 'net_get_interfaces') {
        try {
          const interfaces = networkScanner.getNetworkInterfaces();
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
              action: 'net_interfaces_result',
              id,
              interfaces
            }));
          }
        } catch (err) {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
              action: 'net_interfaces_result',
              id,
              interfaces: [],
              error: err.message
            }));
          }
        }
      }

      else if (action === 'net_ipscan_start') {
        const scanData = data.data || {};
        const { rangeStart, rangeEnd, ports = [21, 22, 80, 443, 445, 3389, 8080], concurrency = 30 } = scanData;
        const scanId = id || 'ip_scanner';

        // Cancel previous scan if still running
        if (activeIpScans.has(scanId)) {
          try {
            activeIpScans.get(scanId).cancel();
          } catch (e) {}
          activeIpScans.delete(scanId);
        }

        console.log(`[IP Scanner] Starting scan from ${rangeStart} to ${rangeEnd}`);

        const scanHandle = networkScanner.scanSubnet(
          { rangeStart, rangeEnd, ports, concurrency },
          (host) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                action: 'net_ipscan_host_found',
                id: scanId,
                host
              }));
            }
          },
          (current, total, percent, found) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                action: 'net_ipscan_progress',
                id: scanId,
                current,
                total,
                percent,
                found
              }));
            }
          },
          (totalFound, cancelled, error) => {
            activeIpScans.delete(scanId);
            console.log(`[IP Scanner] Finished scan: ${totalFound} hosts found (cancelled: ${cancelled})`);
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                action: 'net_ipscan_done',
                id: scanId,
                totalFound,
                cancelled,
                error
              }));
            }
          }
        );

        activeIpScans.set(scanId, scanHandle);
      }

      else if (action === 'net_ipscan_stop') {
        const scanId = id || 'ip_scanner';
        if (activeIpScans.has(scanId)) {
          try {
            activeIpScans.get(scanId).cancel();
          } catch (e) {}
          activeIpScans.delete(scanId);
        }
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ action: 'net_ipscan_stopped', id: scanId }));
        }
      }

      else if (action === 'net_wol') {
        const wolData = data.data || {};
        const { mac, broadcastIp = '255.255.255.255', port = 9 } = wolData;
        networkScanner.sendWakeOnLan(mac, broadcastIp, port)
          .then(() => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                action: 'net_wol_result',
                id,
                mac,
                success: true,
                message: `Magic packet sent successfully to ${mac}`
              }));
            }
          })
          .catch((err) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                action: 'net_wol_result',
                id,
                mac,
                success: false,
                error: err.message
              }));
            }
          });
      }
      
      else if (action === 'net_open_smb') {
        const { ip } = data;
        if (require('os').platform() === 'win32' && ip) {
          require('child_process').exec(`explorer \\\\${ip}`, (err) => {
            if (err) console.error(`[SMB] Failed to open explorer for ${ip}:`, err.message);
          });
        }
      }

      else if (action === 'net_open_rdp') {
        const { ip } = data;
        if (require('os').platform() === 'win32' && ip) {
          require('child_process').exec(`mstsc /v:${ip}`, (err) => {
            if (err) console.error(`[RDP] Failed to launch mstsc for ${ip}:`, err.message);
          });
        }
      }

      else if (action === 'net_shutdown') {
        const { ip } = data;
        if (require('os').platform() === 'win32' && ip) {
          require('child_process').exec(`shutdown /m \\\\${ip} /s /t 0`, (err) => {
            if (err) console.error(`[Shutdown] Failed to shutdown ${ip}:`, err.message);
          });
        }
      }

      // ----------------- SYSTEM DASHBOARD -----------------
      else if (action === 'system_dashboard') {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        
        let cpuUsage = 0;
        const cpus = os.cpus();
        if (cpus && cpus.length > 0) {
          let totalIdle = 0, totalTick = 0;
          for(let i = 0, len = cpus.length; i < len; i++) {
            const cpu = cpus[i];
            for(let type in cpu.times) {
              totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
          }
          cpuUsage = 100 - ~~(100 * totalIdle / totalTick);
        }

        // Run netstat to get listening ports (Windows focused for now)
        if (os.platform() === 'win32') {
          require('child_process').exec('tasklist /FO CSV /NH', (errTask, stdoutTask) => {
            const processMap = {};
            if (!errTask && stdoutTask) {
              const taskLines = stdoutTask.split('\n');
              for (const line of taskLines) {
                // "svchost.exe","984","Services","0","23,196 K"
                const cols = line.split('","');
                if (cols.length >= 2) {
                  const pName = cols[0].replace('"', '');
                  const pId = cols[1];
                  processMap[pId] = pName;
                }
              }
            }
            
            require('child_process').exec('netstat -ano | findstr LISTENING', (err, stdout) => {
              let listeningPorts = [];
              if (!err && stdout) {
                const lines = stdout.split('\n');
                const uniquePorts = new Set();
                for(let i=0; i<lines.length && listeningPorts.length < 50; i++) {
                  const line = lines[i].trim().replace(/\s+/g, ' ');
                  if(!line) continue;
                  const parts = line.split(' ');
                  // TCP  0.0.0.0:135  0.0.0.0:0  LISTENING  984
                  if(parts.length >= 4) {
                    const localAddr = parts[1];
                    const port = localAddr.split(':').pop();
                    const pid = parts[parts.length-1];
                    if(port && !uniquePorts.has(port)) {
                      uniquePorts.add(port);
                      listeningPorts.push({ 
                        protocol: parts[0], 
                        address: localAddr, 
                        state: 'LISTENING', 
                        pid: pid,
                        processName: processMap[pid] || 'Unknown'
                      });
                    }
                  }
                }
              }
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ 
                  action: 'system_dashboard_result', 
                  cpuUsage, 
                  totalMem, 
                  usedMem, 
                  freeMem,
                  listeningPorts
                }));
              }
            });
          });
        } else {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ 
              action: 'system_dashboard_result', 
              cpuUsage, totalMem, usedMem, freeMem, listeningPorts: [] 
            }));
          }
        }
      }

      // ----------------- PROCESS KILLER -----------------
      else if (action === 'kill_process') {
        const { pid } = data;
        if (pid) {
          const isWin = os.platform() === 'win32';
          const cmd = isWin ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`;
          require('child_process').exec(cmd, (err) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                action: 'kill_process_result',
                pid,
                success: !err,
                message: err ? err.message : 'Process killed successfully'
              }));
            }
          });
        }
      }

      // ----------------- TUNNEL ACTIONS -----------------
      else if (action === 'tunnel_start') {
        const { tunnelType, localPort, localHost = '127.0.0.1', sshHost, sshPort = 22, sshUsername, sshPassword, sshPrivateKey, destHost, destPort } = data;
        
        if (activeTunnels.has(id)) {
          return; // Already running
        }

        ws.send(JSON.stringify({ action: 'tunnel_status', id, status: 'connecting', message: `Connecting to SSH server ${sshHost}...` }));

        const conn = new SSHClient();
        let localServer = null;

        conn.on('ready', () => {
          ws.send(JSON.stringify({ action: 'tunnel_status', id, status: 'running', message: `SSH connected. Setting up ${tunnelType} forward...` }));

          if (tunnelType === 'local') {
            // Local Port Forwarding: Listen locally, forward to remote destination via SSH
            localServer = net.createServer((socket) => {
              conn.forwardOut(socket.remoteAddress, socket.remotePort, destHost, destPort, (err, stream) => {
                if (err) {
                  socket.end();
                  return;
                }
                socket.pipe(stream);
                stream.pipe(socket);
              });
            });

            localServer.on('error', (err) => {
              ws.send(JSON.stringify({ action: 'tunnel_status', id, status: 'error', message: `Local Server Error: ${err.message}` }));
              conn.end();
            });

            localServer.listen(localPort, localHost, () => {
              ws.send(JSON.stringify({ action: 'tunnel_status', id, status: 'running', message: `Listening on ${localHost}:${localPort}, forwarding to ${destHost}:${destPort}` }));
            });

            activeTunnels.set(id, { conn, localServer, ws });

          } else if (tunnelType === 'remote') {
            // Remote Port Forwarding: Tell SSH to listen remotely, forward to local destination
            conn.forwardIn(destHost === 'localhost' ? '127.0.0.1' : destHost, destPort, (err) => {
              if (err) {
                ws.send(JSON.stringify({ action: 'tunnel_status', id, status: 'error', message: `Remote Forward Error: ${err.message}` }));
                conn.end();
                return;
              }
              ws.send(JSON.stringify({ action: 'tunnel_status', id, status: 'running', message: `SSH Server listening on port ${destPort}, forwarding to ${localHost}:${localPort}` }));
            });

            conn.on('tcp connection', (info, accept, reject) => {
              const remoteSocket = net.connect(localPort, localHost, () => {
                const stream = accept();
                remoteSocket.pipe(stream);
                stream.pipe(remoteSocket);
              });
              remoteSocket.on('error', (err) => {
                reject();
              });
            });

            activeTunnels.set(id, { conn, localServer: null, ws });
          } else if (tunnelType === 'dynamic') {
            // Dynamic Port Forwarding (SOCKS5 proxy over SSH)
            localServer = net.createServer((socket) => {
              socket.once('data', (data) => {
                if (data[0] === 5) {
                  // SOCKS5 handshake
                  socket.write(Buffer.from([5, 0])); // NO AUTH
                  socket.once('data', (req) => {
                    if (req[0] !== 5 || req[1] !== 1) { socket.end(); return; } // CONNECT only
                    let dstAddr, dstPort, cursor;
                    if (req[3] === 1) { // IPv4
                      dstAddr = req.slice(4, 8).join('.');
                      cursor = 8;
                    } else if (req[3] === 3) { // Domain name
                      const len = req[4];
                      dstAddr = req.slice(5, 5 + len).toString();
                      cursor = 5 + len;
                    } else { socket.end(); return; } // IPv6 not implemented here
                    dstPort = req.readUInt16BE(cursor);

                    conn.forwardOut(socket.remoteAddress, socket.remotePort, dstAddr, dstPort, (err, stream) => {
                      if (err) {
                        socket.write(Buffer.from([5, 1, 0, 1, 0, 0, 0, 0, 0, 0])); // Failure
                        socket.end(); return;
                      }
                      socket.write(Buffer.from([5, 0, 0, 1, 0, 0, 0, 0, 0, 0])); // Success
                      socket.pipe(stream);
                      stream.pipe(socket);
                    });
                  });
                } else {
                  socket.end(); // Not SOCKS5
                }
              });
            });

            localServer.on('error', (err) => {
              ws.send(JSON.stringify({ action: 'tunnel_status', id, status: 'error', message: `SOCKS Server Error: ${err.message}` }));
              conn.end();
            });

            localServer.listen(localPort, localHost, () => {
              ws.send(JSON.stringify({ action: 'tunnel_status', id, status: 'running', message: `SOCKS5 Proxy listening on ${localHost}:${localPort}` }));
            });

            activeTunnels.set(id, { conn, localServer, ws });
          }
        });

        conn.on('error', (err) => {
          ws.send(JSON.stringify({ action: 'tunnel_status', id, status: 'error', message: `SSH Error: ${err.message}` }));
          if (localServer) {
            localServer.close();
          }
          activeTunnels.delete(id);
        });

        conn.on('end', () => {
          ws.send(JSON.stringify({ action: 'tunnel_status', id, status: 'stopped', message: 'SSH connection ended.' }));
          if (localServer) {
            localServer.close();
          }
          activeTunnels.delete(id);
        });

        const connectConfig = {
          host: sshHost,
          port: sshPort,
          username: sshUsername,
        };
        if (sshPrivateKey) connectConfig.privateKey = sshPrivateKey;
        if (sshPassword) connectConfig.password = sshPassword;

        try {
          conn.connect(connectConfig);
        } catch (err) {
          ws.send(JSON.stringify({ action: 'tunnel_status', id, status: 'error', message: `Connection Setup Error: ${err.message}` }));
        }
      }
      else if (action === 'tunnel_stop') {
        if (activeTunnels.has(id)) {
          const tunnel = activeTunnels.get(id);
          if (tunnel.localServer) {
            tunnel.localServer.close();
          }
          tunnel.conn.end();
          activeTunnels.delete(id);
          ws.send(JSON.stringify({ action: 'tunnel_status', id, status: 'stopped', message: 'Tunnel stopped manually.' }));
        }
      }

      // ----------------- EMBEDDED SERVERS ACTIONS -----------------
      else if (action === 'embedded_server_status') {
        const status = embeddedManager.getStatus();
        ws.send(JSON.stringify({
          action: 'embedded_server_status_response',
          ...status
        }));
      }
      else if (action === 'embedded_server_start') {
        const { serverType, config } = data;
        if (serverType === 'http') embeddedManager.startHttp(config);
        else if (serverType === 'ftp') embeddedManager.startFtp(config);
        else if (serverType === 'tftp') embeddedManager.startTftp(config);
      }
      else if (action === 'embedded_server_stop') {
        const { serverType } = data;
        if (serverType === 'http') embeddedManager.stopHttp();
        else if (serverType === 'ftp') embeddedManager.stopFtp();
        else if (serverType === 'tftp') embeddedManager.stopTftp();
      }

      // ----------------- SERIAL / COM PORT ACTIONS -----------------
      else if (action === 'serial_list') {
        SerialPort.list().then(ports => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ action: 'serial_list_result', ports }));
          }
        }).catch(err => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ action: 'serial_list_result', ports: [], error: err.message }));
          }
        });
      }
      else if (action === 'serial_connect') {
        const { portName, baudRate = 115200, dataBits = 8, stopBits = 1, parity = 'none', flowControl = 'none' } = data;
        console.log(`[Serial Server] Connecting to ${portName} (${baudRate} baud) for session ${id}`);

        setupLogging(id, data.title || `Serial_${portName}`, data.logConfig);

        try {
          const serialPort = new SerialPort({
            path: portName,
            baudRate: Number(baudRate) || 115200,
            dataBits: Number(dataBits) || 8,
            stopBits: Number(stopBits) || 1,
            parity: parity || 'none',
            rtscts: flowControl === 'rtscts',
            xon: flowControl === 'xonxoff',
            xoff: flowControl === 'xonxoff',
            autoOpen: false
          });

          serialSessions.set(id, { port: serialPort, ws, portName, baudRate });

          serialPort.open((err) => {
            if (err) {
              console.error(`[Serial Server] Error opening port ${portName}:`, err.message);
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ action: 'serial_error', id, message: err.message }));
              }
              serialSessions.delete(id);
              closeLogger(id);
              return;
            }

            console.log(`[Serial Server] Port ${portName} opened successfully for session ${id}`);
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ action: 'serial_ready', id, portName, baudRate }));
            }
          });

          serialPort.on('data', (chunk) => {
            const strData = chunk.toString('utf-8');
            writeLog(id, strData);
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ action: 'output', id, data: strData }));
            }
          });

          serialPort.on('error', (err) => {
            console.error(`[Serial Server] Error on port ${portName}:`, err.message);
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ action: 'serial_error', id, message: err.message }));
            }
          });

          serialPort.on('close', () => {
            console.log(`[Serial Server] Port ${portName} closed for session ${id}`);
            closeLogger(id);
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ action: 'exit', id, code: 0 }));
            }
            serialSessions.delete(id);
          });
        } catch (err) {
          console.error(`[Serial Server] Failed to initialize SerialPort:`, err.message);
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ action: 'serial_error', id, message: err.message }));
          }
          closeLogger(id);
        }
      }
      else if (action === 'serial_set_signals') {
        const serial = serialSessions.get(id);
        if (serial && serial.port && serial.port.isOpen) {
          const { dtr, rts } = data;
          serial.port.set({ dtr: Boolean(dtr), rts: Boolean(rts) }, (err) => {
            if (err) console.error(`[Serial Server] Error setting signals:`, err.message);
          });
        }
      }
      else if (action === 'serial_send_break') {
        const serial = serialSessions.get(id);
        if (serial && serial.port && serial.port.isOpen) {
          console.log(`[Serial Server] Sending BREAK signal for session ${id}`);
          serial.port.set({ brk: true }, (err) => {
            if (!err) {
              setTimeout(() => {
                if (serial.port && serial.port.isOpen) {
                  serial.port.set({ brk: false }, () => {});
                }
              }, 250);
            }
          });
        }
      }

      // ----------------- WSL ACTIONS -----------------
      else if (action === 'wsl_list') {
        if (os.platform() === 'win32') {
          try {
            const child = spawn('wsl.exe', ['--list', '--quiet']);
            let buffer = Buffer.alloc(0);
            child.stdout.on('data', (chunk) => {
              buffer = Buffer.concat([buffer, chunk]);
            });
            child.on('close', () => {
              const text = buffer.toString('utf16le') || buffer.toString('utf8');
              const distros = text
                .split(/\r?\n/)
                .map((s) => s.trim().replace(/\0/g, ''))
                .filter(Boolean);
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ action: 'wsl_list_result', distros }));
              }
            });
            child.on('error', () => {
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ action: 'wsl_list_result', distros: [] }));
              }
            });
          } catch (e) {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ action: 'wsl_list_result', distros: [] }));
            }
          }
        } else {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ action: 'wsl_list_result', distros: [] }));
          }
        }
      }
      else if (action === 'wsl_spawn') {
        const { distro, cols = 80, rows = 24 } = data;
        console.log(`[WSL Server] Spawning WSL session ${id} (distro: ${distro || 'default'})`);
        setupLogging(id, data.title || `WSL_${distro || 'default'}`, data.logConfig);

        // If there was an existing session with this id, kill it cleanly first
        const existing = localTerminals.get(id);
        if (existing && existing.pty) {
          try { existing.pty.kill(); } catch (e) {}
          localTerminals.delete(id);
        }

        const args = [];
        if (distro && distro !== 'default') {
          args.push('-d', distro);
        }

        try {
          const ptyProcess = pty.spawn('wsl.exe', args, {
            name: 'xterm-256color',
            cols,
            rows,
            cwd: process.env.USERPROFILE || process.cwd(),
            env: process.env
          });

          localTerminals.set(id, { pty: ptyProcess, ws });

          ptyProcess.onData((output) => {
            writeLog(id, output);
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ action: 'output', id, data: output }));
            }
          });

          ptyProcess.onExit(({ exitCode }) => {
            console.log(`[WSL Server] WSL session ${id} exited (${exitCode})`);
            const current = localTerminals.get(id);
            if (current && current.pty === ptyProcess) {
              closeLogger(id);
              localTerminals.delete(id);
            }
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ action: 'exit', id, code: exitCode }));
            }
          });

          ws.send(JSON.stringify({ action: 'spawned', id, shell: 'wsl.exe' }));
        } catch (err) {
          console.error(`[WSL Server] Failed to spawn WSL:`, err.message);
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
              action: 'output',
              id,
              data: `\r\n\x1b[31m[Failed to start WSL: ${err.message}. Ensure WSL is installed: 'wsl --install']\x1b[0m\r\n`
            }));
          }
        }
      }

      // ----------------- TELNET ACTIONS -----------------
      else if (action === 'telnet_connect') {
        const { host, port = 23 } = data;
        console.log(`[Telnet Server] Connecting to ${host}:${port} for session ${id}`);
        setupLogging(id, data.title || `Telnet_${host}_${port}`, data.logConfig);

        const socket = net.createConnection({ host, port: Number(port) || 23 }, () => {
          console.log(`[Telnet Server] Connected to ${host}:${port} for session ${id}`);
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ action: 'telnet_ready', id, host, port }));
            ws.send(JSON.stringify({
              action: 'output',
              id,
              data: `\x1b[32m✔ Connected to Telnet server ${host}:${port}\x1b[0m\r\n`
            }));
          }
        });

        telnetSessions.set(id, { socket, ws, host, port });

        socket.on('data', (chunk) => {
          // RFC 854 basic Telnet negotiation filter
          let i = 0;
          const cleanBytes = [];
          while (i < chunk.length) {
            if (chunk[i] === 255) { // IAC
              const cmd = chunk[i + 1];
              if (cmd === 251 || cmd === 252 || cmd === 253 || cmd === 254) { // WILL, WONT, DO, DONT
                const opt = chunk[i + 2];
                if (cmd === 253) { // DO -> reply WONT
                  socket.write(Buffer.from([255, 252, opt]));
                } else if (cmd === 251) { // WILL -> reply DO or DONT
                  if (opt === 1 || opt === 3) { // ECHO or SUPPRESS GO AHEAD
                    socket.write(Buffer.from([255, 253, opt]));
                  } else {
                    socket.write(Buffer.from([255, 254, opt]));
                  }
                }
                i += 3;
              } else if (cmd === 250) { // Subnegotiation SB ... SE
                let end = i + 2;
                while (end < chunk.length && chunk[end] !== 240) end++;
                i = end + 1;
              } else {
                i += 2;
              }
            } else {
              cleanBytes.push(chunk[i]);
              i++;
            }
          }

          if (cleanBytes.length > 0) {
            const strData = Buffer.from(cleanBytes).toString('utf-8');
            writeLog(id, strData);
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ action: 'output', id, data: strData }));
            }
          }
        });

        socket.on('error', (err) => {
          console.error(`[Telnet Server] Error on ${id}:`, err.message);
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ action: 'telnet_error', id, message: err.message }));
            ws.send(JSON.stringify({
              action: 'output',
              id,
              data: `\r\n\x1b[31m[Telnet Connection Error: ${err.message}]\x1b[0m\r\n`
            }));
          }
          telnetSessions.delete(id);
        });

        socket.on('close', () => {
          console.log(`[Telnet Server] Connection closed for ${id}`);
          closeLogger(id);
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ action: 'exit', id, code: 0 }));
            ws.send(JSON.stringify({
              action: 'output',
              id,
              data: `\r\n\x1b[33m[Telnet Connection Closed]\x1b[0m\r\n`
            }));
          }
          telnetSessions.delete(id);
        });
      }

      // ----------------- RDP ACTIONS -----------------
      else if (action === 'rdp_launch') {
        const { host, port = 3389, username, fullscreen, admin, resolution = '1920x1080' } = data;
        console.log(`[RDP Server] Launching MSTSC for ${host}:${port}`);

        const [resW, resH] = resolution.split('x');
        const tempDir = os.tmpdir();
        const rdpFile = path.join(tempDir, `mxt_rdp_${id}.rdp`);
        
        const rdpContent = [
          `full address:s:${host}:${port}`,
          username ? `username:s:${username}` : '',
          `screen mode id:i:${fullscreen ? 2 : 1}`,
          `use multimon:i:${fullscreen ? 1 : 0}`,
          `desktopwidth:i:${resW || 1920}`,
          `desktopheight:i:${resH || 1080}`,
          `session bpp:i:32`,
          `compression:i:1`,
          `keyboardhook:i:2`,
          `audiomode:i:0`,
          `redirectsmartcards:i:1`,
          `redirectclipboard:i:1`,
          admin ? `administrative session:i:1` : ''
        ].filter(Boolean).join('\r\n');

        try {
          fs.writeFileSync(rdpFile, rdpContent, 'utf-8');
          const child = spawn('mstsc.exe', [rdpFile], {
            detached: true,
            stdio: 'ignore'
          });
          child.unref();

          ws.send(JSON.stringify({
            action: 'rdp_launched',
            id,
            success: true,
            host,
            port,
            username
          }));
        } catch (err) {
          console.error(`[RDP Server] Failed to launch RDP:`, err);
          ws.send(JSON.stringify({
            action: 'rdp_launched',
            id,
            success: false,
            error: err.message
          }));
        }
      }

      // ----------------- VNC ACTIONS -----------------
      else if (action === 'vnc_launch') {
        const { host, port = 5900 } = data;
        console.log(`[VNC Server] Launching VNC viewer for ${host}:${port}`);

        const vncViewers = [
          'C:\\Program Files\\RealVNC\\VNC Viewer\\vncviewer.exe',
          'C:\\Program Files (x86)\\RealVNC\\VNC Viewer\\vncviewer.exe',
          'C:\\Program Files\\TightVNC\\tvnviewer.exe',
          'C:\\Program Files (x86)\\TightVNC\\tvnviewer.exe',
          'C:\\Program Files\\uvnc bvba\\UltraVNC\\vncviewer.exe',
          'C:\\Program Files (x86)\\uvnc bvba\\UltraVNC\\vncviewer.exe',
          'C:\\Program Files\\TigerVNC\\vncviewer.exe'
        ];

        let launched = false;
        for (const viewerPath of vncViewers) {
          if (fs.existsSync(viewerPath)) {
            try {
              const child = spawn(viewerPath, [`${host}:${port}`], { detached: true, stdio: 'ignore' });
              child.unref();
              launched = true;
              break;
            } catch (e) {}
          }
        }

        ws.send(JSON.stringify({
          action: 'vnc_launched',
          id,
          success: launched,
          error: launched ? null : 'No installed VNC viewer executable found (TightVNC, UltraVNC, RealVNC, TigerVNC).'
        }));
      }
    } catch (err) {
      console.error('[PTY/SSH Server] Message error:', err);
    }
  });

  ws.on('close', () => {
    console.log('[PTY/SSH Server] Client socket closed. Cleaning up...');
    embeddedManager.removeClient(ws);
    for (const [id, local] of localTerminals.entries()) {
      if (local.ws === ws) {
        closeLogger(id);
        try { local.pty.kill(); } catch (e) {}
        localTerminals.delete(id);
      }
    }
    for (const [id, ssh] of sshSessions.entries()) {
      if (ssh.ws === ws) {
        closeLogger(id);
        try { ssh.client.end(); } catch (e) {}
        sshSessions.delete(id);
      }
    }
    for (const [id, telnet] of telnetSessions.entries()) {
      if (telnet.ws === ws) {
        closeLogger(id);
        try { telnet.socket.destroy(); } catch (e) {}
        telnetSessions.delete(id);
      }
    }
    for (const [id, serial] of serialSessions.entries()) {
      if (serial.ws === ws) {
        closeLogger(id);
        try { serial.port.close(); } catch (e) {}
        serialSessions.delete(id);
      }
    }
    for (const [id, scan] of activeIpScans.entries()) {
      try { scan.cancel(); } catch (e) {}
      activeIpScans.delete(id);
    }
  });
});

}

// Export for external use
module.exports = { initServer };

// Auto-start WebSocket server when this module is loaded
// (works both standalone and when required by Electron main process)
try {
  const wsServer = new WebSocketServer({ port: PORT });
  wsServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[PTY/SSH Server] Port ${PORT} already in use, skipping.`);
    } else {
      console.error('[PTY/SSH Server] WebSocket Server error:', err);
    }
  });
  console.log(`[PTY/SSH Server] Listening on ws://127.0.0.1:${PORT}`);
  initServer(wsServer);
} catch (err) {
  if (err.code === 'EADDRINUSE') {
    console.log(`[PTY/SSH Server] Port ${PORT} already in use, skipping.`);
  } else {
    throw err;
  }
}
