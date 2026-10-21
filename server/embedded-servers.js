const http = require('http');
const net = require('net');
const dgram = require('dgram');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Helper to get local network IPv4 addresses
function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ iface: name, address: iface.address });
      }
    }
  }
  return ips;
}

// MIME types dictionary for HTTP
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.bin': 'application/octet-stream',
  '.iso': 'application/octet-stream'
};

class EmbeddedServersManager {
  constructor() {
    this.broadcastWs = new Set();
    this.servers = {
      http: {
        status: 'stopped',
        instance: null,
        port: 8080,
        rootDir: path.join(os.homedir(), 'Downloads'),
        logs: []
      },
      ftp: {
        status: 'stopped',
        instance: null,
        port: 2121,
        rootDir: path.join(os.homedir(), 'Downloads'),
        user: 'anonymous',
        password: '',
        logs: []
      },
      tftp: {
        status: 'stopped',
        instance: null,
        port: 6969,
        rootDir: path.join(os.homedir(), 'Downloads'),
        logs: []
      }
    };
  }

  addClient(ws) {
    this.broadcastWs.add(ws);
  }

  removeClient(ws) {
    this.broadcastWs.delete(ws);
  }

  broadcast(message) {
    const payload = JSON.stringify(message);
    for (const ws of this.broadcastWs) {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(payload);
        } catch (e) {}
      }
    }
  }

  log(serverType, message, type = 'info') {
    const entry = {
      time: new Date().toLocaleTimeString(),
      message,
      type
    };
    const s = this.servers[serverType];
    if (s) {
      s.logs.push(entry);
      if (s.logs.length > 200) s.logs.shift();
      this.broadcast({
        action: 'embedded_server_event',
        serverType,
        event: 'log',
        log: entry
      });
    }
  }

  getStatus() {
    return {
      localIps: getLocalIps(),
      servers: {
        http: {
          status: this.servers.http.status,
          port: this.servers.http.port,
          rootDir: this.servers.http.rootDir,
          logs: this.servers.http.logs
        },
        ftp: {
          status: this.servers.ftp.status,
          port: this.servers.ftp.port,
          rootDir: this.servers.ftp.rootDir,
          user: this.servers.ftp.user,
          logs: this.servers.ftp.logs
        },
        tftp: {
          status: this.servers.tftp.status,
          port: this.servers.tftp.port,
          rootDir: this.servers.tftp.rootDir,
          logs: this.servers.tftp.logs
        }
      }
    };
  }

  // --------------------------------------------------------------------------
  // HTTP FILE SERVER
  // --------------------------------------------------------------------------
  startHttp(config = {}) {
    const s = this.servers.http;
    if (s.status === 'running') return;

    if (config.port) s.port = Number(config.port);
    if (config.rootDir) s.rootDir = config.rootDir;

    if (!fs.existsSync(s.rootDir)) {
      try {
        fs.mkdirSync(s.rootDir, { recursive: true });
      } catch (err) {
        this.log('http', `Failed to create root dir: ${err.message}`, 'error');
        return;
      }
    }

    const server = http.createServer((req, res) => {
      const clientIp = req.socket.remoteAddress || '';
      const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
      const safePath = path.normalize(path.join(s.rootDir, urlPath));

      // Security: Path traversal prevention
      if (!safePath.startsWith(path.normalize(s.rootDir))) {
        res.statusCode = 403;
        res.end('403 Forbidden');
        this.log('http', `[403] Forbidden access attempt: ${urlPath} from ${clientIp}`, 'warn');
        return;
      }

      // Handle simple file upload via POST
      if (req.method === 'POST') {
        const uploadTarget = path.join(safePath, req.headers['x-filename'] || `upload_${Date.now()}`);
        const writeStream = fs.createWriteStream(uploadTarget);
        req.pipe(writeStream);
        writeStream.on('finish', () => {
          res.statusCode = 200;
          res.end('File uploaded successfully');
          this.log('http', `Uploaded file to ${uploadTarget} from ${clientIp}`, 'info');
        });
        writeStream.on('error', (err) => {
          res.statusCode = 500;
          res.end(`Upload error: ${err.message}`);
          this.log('http', `Upload error: ${err.message}`, 'error');
        });
        return;
      }

      fs.stat(safePath, (err, stats) => {
        if (err) {
          res.statusCode = 404;
          res.end('404 Not Found');
          this.log('http', `[404] ${req.method} ${urlPath} (${clientIp})`, 'warn');
          return;
        }

        if (stats.isDirectory()) {
          // Check for index.html
          const indexPath = path.join(safePath, 'index.html');
          if (fs.existsSync(indexPath)) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            fs.createReadStream(indexPath).pipe(res);
            this.log('http', `[200] GET ${urlPath} (index.html) (${clientIp})`, 'info');
            return;
          }

          // Generate HTML Directory Listing
          fs.readdir(safePath, { withFileTypes: true }, (err, items) => {
            if (err) {
              res.statusCode = 500;
              res.end('Failed to read directory');
              return;
            }

            const relativeDir = path.relative(s.rootDir, safePath).replace(/\\/g, '/');
            const parentUrl = relativeDir ? '/' + path.dirname(relativeDir) : null;

            let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Index of /${relativeDir}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #18181b; color: #f4f4f5; margin: 0; padding: 24px; }
              .header-flex { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #27272a; padding-bottom: 12px; }
              h1 { font-size: 20px; font-weight: 600; color: #38bdf8; margin: 0; }
              .upload-btn { background: #0ea5e9; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 14px; }
              .upload-btn:hover { background: #0284c7; }
              table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }
              th, td { text-align: left; padding: 10px 14px; border-bottom: 1px solid #27272a; }
              th { color: #a1a1aa; font-weight: 500; }
              tr:hover { background: #27272a; }
              a { color: #38bdf8; text-decoration: none; }
              a:hover { text-decoration: underline; }
              .size { color: #a1a1aa; font-family: monospace; }
              .icon { margin-right: 8px; }
              .footer { margin-top: 32px; font-size: 12px; color: #71717a; }
            </style>
            </head><body>
            <div class="header-flex">
              <h1>📁 Directory listing for /${relativeDir}</h1>
              <button class="upload-btn" onclick="document.getElementById('file-input').click()">Upload File Here</button>
            </div>
            <input type="file" id="file-input" style="display: none;" onchange="uploadFile(this)">
            <script>
              async function uploadFile(input) {
                const file = input.files[0];
                if (!file) return;
                const btn = document.querySelector('.upload-btn');
                btn.textContent = 'Uploading...';
                btn.disabled = true;
                try {
                  await fetch(window.location.pathname, {
                    method: 'POST',
                    headers: { 'x-filename': encodeURIComponent(file.name) },
                    body: file
                  });
                  window.location.reload();
                } catch(e) {
                  alert('Upload failed: ' + e.message);
                  btn.textContent = 'Upload File Here';
                  btn.disabled = false;
                }
              }
            </script>
            <table>
              <thead><tr><th>Name</th><th>Size</th><th>Type</th></tr></thead>
              <tbody>`;

            if (parentUrl !== null) {
              html += `<tr><td><a href="${parentUrl}">📁 .. [Parent Directory]</a></td><td>-</td><td>Folder</td></tr>`;
            }

            items.sort((a, b) => (b.isDirectory() ? 1 : 0) - (a.isDirectory() ? 1 : 0) || a.name.localeCompare(b.name));

            for (const item of items) {
              const itemRelPath = path.join('/', relativeDir, item.name).replace(/\\/g, '/');
              const isDir = item.isDirectory();
              let sizeStr = '-';
              if (!isDir) {
                try {
                  const s = fs.statSync(path.join(safePath, item.name));
                  sizeStr = formatBytes(s.size);
                } catch (e) {}
              }
              html += `<tr>
                <td><a href="${itemRelPath}">${isDir ? '📁 ' : '📄 '} ${item.name}</a></td>
                <td class="size">${sizeStr}</td>
                <td>${isDir ? 'Folder' : 'File'}</td>
              </tr>`;
            }

            html += `</tbody></table>
            <div class="footer">Served by MobaXterm Clone Embedded HTTP Server</div>
            </body></html>`;

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(html);
            this.log('http', `[200] List directory: /${relativeDir} (${clientIp})`, 'info');
          });
          return;
        }

        // Serve regular file with Range support
        const ext = path.extname(safePath).toLowerCase();
        const mime = MIME_TYPES[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', mime);
        res.setHeader('Accept-Ranges', 'bytes');

        const range = req.headers.range;
        if (range) {
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;

          if (start >= stats.size || end >= stats.size) {
            res.statusCode = 416;
            res.setHeader('Content-Range', `bytes */${stats.size}`);
            return res.end();
          }

          const chunksize = (end - start) + 1;
          res.statusCode = 206;
          res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
          res.setHeader('Content-Length', chunksize);
          fs.createReadStream(safePath, { start, end }).pipe(res);
          this.log('http', `[206] Partial download: ${path.basename(safePath)} (bytes ${start}-${end}) by ${clientIp}`, 'info');
        } else {
          res.statusCode = 200;
          res.setHeader('Content-Length', stats.size);
          fs.createReadStream(safePath).pipe(res);
          this.log('http', `[200] Download file: ${path.basename(safePath)} (${formatBytes(stats.size)}) by ${clientIp}`, 'info');
        }
      });
    });

    server.on('error', (err) => {
      s.status = 'error';
      this.log('http', `Server error: ${err.message}`, 'error');
      this.broadcast({
        action: 'embedded_server_event',
        serverType: 'http',
        event: 'status',
        status: 'error',
        message: err.message
      });
    });

    server.listen(s.port, '0.0.0.0', () => {
      s.status = 'running';
      s.instance = server;
      this.log('http', `HTTP Server started on 0.0.0.0:${s.port} (Serving: ${s.rootDir})`, 'info');
      this.broadcast({
        action: 'embedded_server_event',
        serverType: 'http',
        event: 'status',
        status: 'running',
        port: s.port,
        rootDir: s.rootDir
      });
    });
  }

  stopHttp() {
    const s = this.servers.http;
    if (s.instance) {
      s.instance.close();
      s.instance = null;
    }
    s.status = 'stopped';
    this.log('http', 'HTTP Server stopped', 'info');
    this.broadcast({
      action: 'embedded_server_event',
      serverType: 'http',
      event: 'status',
      status: 'stopped'
    });
  }

  // --------------------------------------------------------------------------
  // FTP SERVER (Lightweight RFC 959 compliant implementation)
  // --------------------------------------------------------------------------
  startFtp(config = {}) {
    const s = this.servers.ftp;
    if (s.status === 'running') return;

    if (config.port) s.port = Number(config.port);
    if (config.rootDir) s.rootDir = config.rootDir;
    if (config.user !== undefined) s.user = config.user;
    if (config.password !== undefined) s.password = config.password;

    if (!fs.existsSync(s.rootDir)) {
      try {
        fs.mkdirSync(s.rootDir, { recursive: true });
      } catch (err) {
        this.log('ftp', `Failed to create root dir: ${err.message}`, 'error');
        return;
      }
    }

    const server = net.createServer((socket) => {
      const clientIp = socket.remoteAddress || '127.0.0.1';
      this.log('ftp', `Client connected from ${clientIp}`, 'info');

      let currentDir = '/';
      let transferType = 'I'; // Binary by default
      let dataServer = null;
      let authenticated = false;
      let username = '';

      const getFullPath = (p) => {
        const combined = path.join(s.rootDir, currentDir, p || '');
        const normalized = path.normalize(combined);
        return normalized.startsWith(path.normalize(s.rootDir)) ? normalized : s.rootDir;
      };

      const send = (code, text) => {
        try {
          socket.write(`${code} ${text}\r\n`);
        } catch (e) {}
      };

      send(220, 'MobaXterm Clone FTP Server Ready');

      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\r\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const [cmd, ...args] = line.trim().split(' ');
          const command = cmd.toUpperCase();
          const arg = args.join(' ');

          switch (command) {
            case 'USER':
              username = arg;
              if (s.user === 'anonymous' || !s.password) {
                authenticated = true;
                send(230, 'User logged in, proceed.');
              } else {
                send(331, 'User name okay, need password.');
              }
              break;

            case 'PASS':
              if (username === s.user && (!s.password || arg === s.password)) {
                authenticated = true;
                send(230, 'User logged in, proceed.');
              } else {
                send(530, 'Login incorrect.');
              }
              break;

            case 'SYST':
              send(215, 'UNIX Type: L8');
              break;

            case 'FEAT':
              send(211, 'Features:\r\n PASV\r\n UTF8\r\n211 End');
              break;

            case 'PWD':
              send(257, `"${currentDir}" is current directory`);
              break;

            case 'TYPE':
              transferType = arg.toUpperCase() === 'A' ? 'A' : 'I';
              send(200, `Type set to ${transferType}`);
              break;

            case 'PASV': {
              if (dataServer) {
                try { dataServer.close(); } catch (e) {}
              }
              dataServer = net.createServer();
              dataServer.listen(0, '0.0.0.0', () => {
                const port = dataServer.address().port;
                const p1 = Math.floor(port / 256);
                const p2 = port % 256;
                let ipStr = socket.localAddress || '127.0.0.1';
                if (ipStr === '0.0.0.0' || ipStr === '::' || ipStr === '::ffff:0.0.0.0') {
                  const localIps = getLocalIps();
                  ipStr = localIps.length > 0 ? localIps[0].address : '127.0.0.1';
                }
                ipStr = ipStr.replace(/^::ffff:/, ''); // Handle IPv4-mapped IPv6
                const parts = ipStr.split('.').join(',');
                send(227, `Entering Passive Mode (${parts},${p1},${p2})`);
              });
              break;
            }

            case 'CWD': {
              const target = path.posix.normalize(path.posix.join(currentDir, arg));
              const fsTarget = getFullPath(arg);
              if (fs.existsSync(fsTarget) && fs.statSync(fsTarget).isDirectory()) {
                currentDir = target;
                send(250, `Directory successfully changed to ${currentDir}`);
              } else {
                send(550, 'Failed to change directory.');
              }
              break;
            }

            case 'CDUP': {
              currentDir = path.posix.dirname(currentDir);
              send(200, `Directory changed to ${currentDir}`);
              break;
            }

            case 'LIST':
            case 'NLST': {
              if (!dataServer) {
                send(425, "Use PASV first.");
                break;
              }
              send(150, 'Here comes the directory listing.');
              dataServer.once('connection', (dataSocket) => {
                try {
                  const targetDir = getFullPath();
                  const files = fs.readdirSync(targetDir);
                  let out = '';
                  const now = new Date();
                  for (const f of files) {
                    try {
                      const stat = fs.statSync(path.join(targetDir, f));
                      const isDir = stat.isDirectory();
                      
                      // Format date properly: MMM DD HH:mm or MMM DD YYYY
                      const mtime = stat.mtime;
                      const isOld = (now.getTime() - mtime.getTime()) > (1000 * 60 * 60 * 24 * 180);
                      const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mtime.getMonth()];
                      const day = mtime.getDate().toString().padStart(2, ' ');
                      const timeOrYear = isOld 
                        ? ` ${mtime.getFullYear()}` 
                        : `${mtime.getHours().toString().padStart(2, '0')}:${mtime.getMinutes().toString().padStart(2, '0')}`;
                      const dateStr = `${month} ${day} ${timeOrYear}`;

                      out += `${isDir ? 'd' : '-'}rwxr-xr-x 1 owner group ${stat.size.toString().padStart(12, ' ')} ${dateStr} ${f}\r\n`;
                    } catch (e) {}
                  }
                  dataSocket.end(out, () => {
                    send(226, 'Directory send OK.');
                  });
                } catch (err) {
                  dataSocket.end();
                  send(550, 'Failed to list directory.');
                }
              });
              break;
            }

            case 'RETR': {
              if (!dataServer) {
                send(425, "Use PASV first.");
                break;
              }
              const filePath = getFullPath(arg);
              if (!fs.existsSync(filePath)) {
                send(550, 'File not found.');
                break;
              }
              send(150, `Opening binary mode data connection for ${arg}`);
              dataServer.once('connection', (dataSocket) => {
                const readStream = fs.createReadStream(filePath);
                readStream.pipe(dataSocket);
                readStream.on('end', () => {
                  send(226, 'Transfer complete.');
                  this.log('ftp', `Downloaded ${arg} (${clientIp})`, 'info');
                });
                readStream.on('error', () => {
                  send(550, 'Failed to read file.');
                });
              });
              break;
            }

            case 'STOR': {
              if (!dataServer) {
                send(425, "Use PASV first.");
                break;
              }
              const filePath = getFullPath(arg);
              send(150, `Ok to send data for ${arg}`);
              dataServer.once('connection', (dataSocket) => {
                const writeStream = fs.createWriteStream(filePath);
                dataSocket.pipe(writeStream);
                writeStream.on('finish', () => {
                  send(226, 'Transfer complete.');
                  this.log('ftp', `Uploaded ${arg} (${clientIp})`, 'info');
                });
                writeStream.on('error', () => {
                  send(550, 'Failed to write file.');
                });
              });
              break;
            }

            case 'QUIT':
              send(221, 'Goodbye.');
              socket.end();
              break;

            case 'NOOP':
              send(200, 'OK');
              break;

            default:
              send(502, `Command ${command} not implemented.`);
              break;
          }
        }
      });

      socket.on('close', () => {
        if (dataServer) {
          try { dataServer.close(); } catch (e) {}
        }
      });
    });

    server.on('error', (err) => {
      s.status = 'error';
      this.log('ftp', `FTP Server error: ${err.message}`, 'error');
      this.broadcast({
        action: 'embedded_server_event',
        serverType: 'ftp',
        event: 'status',
        status: 'error',
        message: err.message
      });
    });

    server.listen(s.port, '0.0.0.0', () => {
      s.status = 'running';
      s.instance = server;
      this.log('ftp', `FTP Server started on port ${s.port} (Serving: ${s.rootDir})`, 'info');
      this.broadcast({
        action: 'embedded_server_event',
        serverType: 'ftp',
        event: 'status',
        status: 'running',
        port: s.port,
        rootDir: s.rootDir
      });
    });
  }

  stopFtp() {
    const s = this.servers.ftp;
    if (s.instance) {
      s.instance.close();
      s.instance = null;
    }
    s.status = 'stopped';
    this.log('ftp', 'FTP Server stopped', 'info');
    this.broadcast({
      action: 'embedded_server_event',
      serverType: 'ftp',
      event: 'status',
      status: 'stopped'
    });
  }

  // --------------------------------------------------------------------------
  // TFTP SERVER (RFC 1350 UDP implementation)
  // --------------------------------------------------------------------------
  startTftp(config = {}) {
    const s = this.servers.tftp;
    if (s.status === 'running') return;

    if (config.port) s.port = Number(config.port);
    if (config.rootDir) s.rootDir = config.rootDir;

    if (!fs.existsSync(s.rootDir)) {
      try {
        fs.mkdirSync(s.rootDir, { recursive: true });
      } catch (err) {
        this.log('tftp', `Failed to create root dir: ${err.message}`, 'error');
        return;
      }
    }

    const socket = dgram.createSocket('udp4');

    socket.on('message', (msg, rinfo) => {
      const opcode = msg.readUInt16BE(0);

      // RRQ (Read Request) - Client wants to download
      if (opcode === 1) {
        let i = 2;
        while (i < msg.length && msg[i] !== 0) i++;
        const filename = msg.toString('utf8', 2, i);
        const safePath = path.normalize(path.join(s.rootDir, filename));

        if (!safePath.startsWith(path.normalize(s.rootDir)) || !fs.existsSync(safePath)) {
          // Send Error Packet (Opcode 5, ErrorCode 1: File not found)
          const errBuf = Buffer.alloc(4 + 16);
          errBuf.writeUInt16BE(5, 0);
          errBuf.writeUInt16BE(1, 2);
          errBuf.write('File not found\0', 4, 'utf8');
          socket.send(errBuf, rinfo.port, rinfo.address);
          this.log('tftp', `[RRQ] File not found: ${filename} from ${rinfo.address}:${rinfo.port}`, 'warn');
          return;
        }

        this.log('tftp', `[RRQ] Client ${rinfo.address}:${rinfo.port} downloading ${filename}`, 'info');
        
        // Spawn ephemeral transfer socket for this client
        const clientSocket = dgram.createSocket('udp4');
        const fileData = fs.readFileSync(safePath);
        const blockSize = 512;
        let blockNum = 1;
        let offset = 0;
        let timeoutId = null;
        let retries = 0;
        let lastPacket = null;

        const sendNextBlock = () => {
          const chunk = fileData.subarray(offset, offset + blockSize);
          lastPacket = Buffer.alloc(4 + chunk.length);
          lastPacket.writeUInt16BE(3, 0); // Opcode 3: DATA
          lastPacket.writeUInt16BE(blockNum, 2);
          chunk.copy(lastPacket, 4);

          sendPacket();
        };

        const sendPacket = () => {
          if (retries > 5) {
            this.log('tftp', `[Error] ${filename} to ${rinfo.address} failed (Timeout)`, 'error');
            clientSocket.close();
            return;
          }
          clientSocket.send(lastPacket, rinfo.port, rinfo.address);
          
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            retries++;
            sendPacket();
          }, 2000); // 2 second timeout
        };

        clientSocket.on('message', (ackMsg) => {
          const ackOp = ackMsg.readUInt16BE(0);
          const ackBlock = ackMsg.readUInt16BE(2);

          if (ackOp === 4 && ackBlock === blockNum) {
            if (timeoutId) clearTimeout(timeoutId);
            retries = 0;
            offset += blockSize;
            blockNum = (blockNum + 1) & 0xffff;
            if (offset <= fileData.length) {
              sendNextBlock();
            } else {
              clientSocket.close();
              this.log('tftp', `[Complete] ${filename} delivered to ${rinfo.address}`, 'info');
            }
          }
        });

        sendNextBlock();
      }
      // WRQ (Write Request) - Client wants to upload
      else if (opcode === 2) {
        let i = 2;
        while (i < msg.length && msg[i] !== 0) i++;
        const filename = msg.toString('utf8', 2, i);
        const safePath = path.normalize(path.join(s.rootDir, filename));

        this.log('tftp', `[WRQ] Client ${rinfo.address}:${rinfo.port} uploading ${filename}`, 'info');

        const clientSocket = dgram.createSocket('udp4');
        const writeStream = fs.createWriteStream(safePath);
        let expectedBlock = 1;
        let timeoutId = null;
        let retries = 0;
        let lastAck = Buffer.alloc(4);
        lastAck.writeUInt16BE(4, 0);
        lastAck.writeUInt16BE(0, 2); // Initial ACK 0

        const sendAck = () => {
          if (retries > 5) {
            this.log('tftp', `[Error] ${filename} upload failed (Timeout)`, 'error');
            writeStream.end();
            clientSocket.close();
            return;
          }
          clientSocket.send(lastAck, rinfo.port, rinfo.address);
          
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            retries++;
            sendAck();
          }, 2000);
        };

        // Start by sending initial ACK 0
        sendAck();

        clientSocket.on('message', (dataMsg) => {
          const op = dataMsg.readUInt16BE(0);
          const blk = dataMsg.readUInt16BE(2);

          if (op === 3 && blk === expectedBlock) {
            if (timeoutId) clearTimeout(timeoutId);
            retries = 0;

            const dataChunk = dataMsg.subarray(4);
            writeStream.write(dataChunk);

            // Prepare next ACK
            lastAck.writeUInt16BE(blk, 2);
            expectedBlock = (expectedBlock + 1) & 0xffff;
            
            sendAck(); // Send ACK and start timeout for next block

            if (dataChunk.length < 512) {
              // Final block received
              if (timeoutId) clearTimeout(timeoutId);
              writeStream.end();
              clientSocket.close();
              this.log('tftp', `[Complete] Upload of ${filename} finished from ${rinfo.address}`, 'info');
            }
          }
        });
      }
    });

    socket.on('error', (err) => {
      s.status = 'error';
      this.log('tftp', `TFTP Server error: ${err.message}`, 'error');
      this.broadcast({
        action: 'embedded_server_event',
        serverType: 'tftp',
        event: 'status',
        status: 'error',
        message: err.message
      });
    });

    socket.bind(s.port, '0.0.0.0', () => {
      s.status = 'running';
      s.instance = socket;
      this.log('tftp', `TFTP Server listening on UDP 0.0.0.0:${s.port} (Serving: ${s.rootDir})`, 'info');
      this.broadcast({
        action: 'embedded_server_event',
        serverType: 'tftp',
        event: 'status',
        status: 'running',
        port: s.port,
        rootDir: s.rootDir
      });
    });
  }

  stopTftp() {
    const s = this.servers.tftp;
    if (s.instance) {
      try { s.instance.close(); } catch (e) {}
      s.instance = null;
    }
    s.status = 'stopped';
    this.log('tftp', 'TFTP Server stopped', 'info');
    this.broadcast({
      action: 'embedded_server_event',
      serverType: 'tftp',
      event: 'status',
      status: 'stopped'
    });
  }

  cleanupAll() {
    this.stopHttp();
    this.stopFtp();
    this.stopTftp();
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const embeddedManager = new EmbeddedServersManager();

module.exports = {
  embeddedManager
};
