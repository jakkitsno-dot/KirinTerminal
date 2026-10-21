const os = require('os');
const net = require('net');
const dgram = require('dgram');
const dns = require('dns');
const { exec } = require('child_process');

// Common MAC OUI prefixes to manufacturer mapping
const OUI_MAP = {
  // Raspberry Pi
  'B8:27:EB': 'Raspberry Pi',
  'DC:A6:32': 'Raspberry Pi',
  'E4:5F:01': 'Raspberry Pi',
  '28:CD:C1': 'Raspberry Pi',
  'D8:3A:DD': 'Raspberry Pi',
  // Espressif (ESP32 / ESP8266)
  '24:0A:C4': 'Espressif (ESP32)',
  '30:AE:A4': 'Espressif (ESP32)',
  'A4:CF:12': 'Espressif (ESP32)',
  '84:F3:EB': 'Espressif (ESP8266)',
  '24:6F:28': 'Espressif (ESP32)',
  'CC:50:E3': 'Espressif (ESP32)',
  '48:55:19': 'Espressif (ESP32)',
  '3C:71:BF': 'Espressif (ESP32)',
  '7C:DF:A1': 'Espressif (ESP32)',
  '94:B9:7E': 'Espressif (ESP32)',
  '54:43:B2': 'Espressif (ESP32)',
  'EC:62:60': 'Espressif (ESP8266)',
  '18:FE:34': 'Espressif (ESP8266)',
  'A0:20:A6': 'Espressif (ESP8266)',
  // Apple
  '00:03:93': 'Apple',
  '00:05:02': 'Apple',
  '00:0A:27': 'Apple',
  '00:10:FA': 'Apple',
  '00:16:CB': 'Apple',
  '00:1B:63': 'Apple',
  '00:1E:52': 'Apple',
  '00:23:12': 'Apple',
  '00:25:BC': 'Apple',
  '00:26:08': 'Apple',
  '00:26:4A': 'Apple',
  '00:26:B0': 'Apple',
  'F0:18:98': 'Apple',
  'AC:DE:48': 'Apple',
  '3C:22:FB': 'Apple',
  'BC:D1:D3': 'Apple',
  'A4:83:E7': 'Apple',
  '78:4F:43': 'Apple',
  '40:A3:CC': 'Apple',
  // Intel
  '00:02:B3': 'Intel',
  '00:03:47': 'Intel',
  '00:0E:0C': 'Intel',
  '00:11:11': 'Intel',
  '00:13:02': 'Intel',
  '00:13:CE': 'Intel',
  '00:15:00': 'Intel',
  '00:16:76': 'Intel',
  '00:19:D1': 'Intel',
  '00:1B:21': 'Intel',
  '00:1E:67': 'Intel',
  '00:21:6A': 'Intel',
  '00:23:14': 'Intel',
  '00:26:C6': 'Intel',
  '00:27:10': 'Intel',
  '34:13:E8': 'Intel',
  '48:51:B7': 'Intel',
  '88:AE:DD': 'Intel',
  'A4:4C:C8': 'Intel',
  // Cisco
  '00:00:0C': 'Cisco',
  '00:01:42': 'Cisco',
  '00:01:43': 'Cisco',
  '00:01:63': 'Cisco',
  '00:01:96': 'Cisco',
  '00:02:16': 'Cisco',
  '00:02:4A': 'Cisco',
  '00:03:6B': 'Cisco',
  '00:04:27': 'Cisco',
  '00:05:00': 'Cisco',
  '00:06:52': 'Cisco',
  '00:07:0E': 'Cisco',
  '00:08:20': 'Cisco',
  // TP-Link
  '00:14:78': 'TP-Link',
  '00:19:E0': 'TP-Link',
  '00:1D:0F': 'TP-Link',
  '00:21:27': 'TP-Link',
  '00:23:CD': 'TP-Link',
  '00:25:86': 'TP-Link',
  '14:CC:20': 'TP-Link',
  '14:CF:92': 'TP-Link',
  '18:A6:F7': 'TP-Link',
  '30:DE:4B': 'TP-Link',
  '50:C7:BF': 'TP-Link',
  '60:32:B1': 'TP-Link',
  '74:EA:3A': 'TP-Link',
  '98:DA:C4': 'TP-Link',
  'B0:48:7A': 'TP-Link',
  'C0:06:C3': 'TP-Link',
  'D8:0D:17': 'TP-Link',
  'E8:48:B8': 'TP-Link',
  'EC:08:6B': 'TP-Link',
  // Ubiquiti
  '00:15:6D': 'Ubiquiti Networks',
  '00:27:22': 'Ubiquiti Networks',
  '24:A4:3C': 'Ubiquiti Networks',
  '68:72:51': 'Ubiquiti Networks',
  '74:83:C2': 'Ubiquiti Networks',
  '78:8A:20': 'Ubiquiti Networks',
  '80:2A:A8': 'Ubiquiti Networks',
  'B4:FB:E4': 'Ubiquiti Networks',
  'DC:9F:DB': 'Ubiquiti Networks',
  'E0:63:DA': 'Ubiquiti Networks',
  'F0:9F:C2': 'Ubiquiti Networks',
  // MikroTik
  '00:0C:42': 'MikroTik',
  '2C:C8:1B': 'MikroTik',
  '48:8F:5A': 'MikroTik',
  '64:D1:54': 'MikroTik',
  '6C:3B:6B': 'MikroTik',
  'B8:69:F4': 'MikroTik',
  'CC:2D:E0': 'MikroTik',
  'D4:01:C3': 'MikroTik',
  // Hikvision
  '44:19:B6': 'Hikvision (IP Camera)',
  'C0:56:E3': 'Hikvision (IP Camera)',
  'BC:54:51': 'Hikvision (IP Camera)',
  '10:DA:43': 'Hikvision (IP Camera)',
  '28:57:BE': 'Hikvision (IP Camera)',
  '40:B4:CD': 'Hikvision (IP Camera)',
  '54:C4:15': 'Hikvision (IP Camera)',
  // Dahua
  '38:AF:29': 'Dahua (IP Camera)',
  'E0:50:8B': 'Dahua (IP Camera)',
  '4C:11:BF': 'Dahua (IP Camera)',
  '58:02:03': 'Dahua (IP Camera)',
  // Dell
  '00:14:22': 'Dell Inc.',
  '18:66:DA': 'Dell Inc.',
  'B8:2A:72': 'Dell Inc.',
  '00:06:5B': 'Dell Inc.',
  '00:11:43': 'Dell Inc.',
  '00:13:72': 'Dell Inc.',
  '00:15:C5': 'Dell Inc.',
  '00:19:B9': 'Dell Inc.',
  '00:21:70': 'Dell Inc.',
  '14:FE:B5': 'Dell Inc.',
  '24:B6:FD': 'Dell Inc.',
  '34:17:EB': 'Dell Inc.',
  'D4:BE:D9': 'Dell Inc.',
  'F8:DB:88': 'Dell Inc.',
  // HP
  '00:01:E6': 'HP',
  '00:08:02': 'HP',
  '00:11:85': 'HP',
  '00:14:C2': 'HP',
  '00:17:08': 'HP',
  '00:1E:0B': 'HP',
  '3C:D9:2B': 'HP',
  '70:5A:0F': 'HP',
  // Huawei
  '00:18:82': 'Huawei',
  '20:F4:78': 'Huawei',
  '48:46:FB': 'Huawei',
  '00:1E:10': 'Huawei',
  '00:25:9E': 'Huawei',
  '10:1B:54': 'Huawei',
  '24:69:68': 'Huawei',
  '34:00:A3': 'Huawei',
  // VMware / VirtualBox
  '00:05:69': 'VMware',
  '00:0C:29': 'VMware',
  '00:50:56': 'VMware',
  '08:00:27': 'Oracle VirtualBox',
  // Microsoft
  '00:03:FF': 'Microsoft Hyper-V',
  '00:15:5D': 'Microsoft Hyper-V',
  '00:1D:D8': 'Microsoft',
  '28:18:78': 'Microsoft Surface',
  // Realtek
  '00:07:70': 'Realtek',
  '00:E0:4C': 'Realtek',
  '52:54:00': 'QEMU / KVM',
  '54:EE:75': 'Realtek',
  // ASUS
  '00:11:2F': 'ASUS',
  '00:1B:FC': 'ASUS',
  '04:D9:F5': 'ASUS',
  '2C:4D:54': 'ASUS',
  'AC:22:0B': 'ASUS',
  // Synology / QNAP
  '00:11:32': 'Synology NAS',
  '00:08:9B': 'QNAP NAS',
  '24:5E:BE': 'QNAP NAS',
  // Samsung
  '00:07:AB': 'Samsung',
  '00:12:FB': 'Samsung',
  '00:15:99': 'Samsung',
  '00:21:D2': 'Samsung',
  '08:37:3D': 'Samsung',
  '14:BB:6E': 'Samsung',
  '40:0E:85': 'Samsung',
  // Amazon
  '00:FC:8B': 'Amazon Echo / Device',
  '18:74:2E': 'Amazon Echo / Device',
  '34:D2:70': 'Amazon Echo / Device',
  '44:65:0D': 'Amazon Echo / Device',
  '50:F5:DA': 'Amazon Echo / Device',
  '68:37:E9': 'Amazon Echo / Device',
  'AC:63:BE': 'Amazon Echo / Device',
  // Google
  '3C:5A:B4': 'Google Nest / Chromecast',
  '54:60:09': 'Google Nest / Chromecast',
  '64:16:66': 'Google Nest / Chromecast',
  '94:EB:CD': 'Google Nest / Chromecast',
  'E4:F0:42': 'Google Nest / Chromecast'
};

/**
 * Get active network interfaces with suggested IPv4 subnet range
 */
function getNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const results = [];

  for (const name of Object.keys(interfaces)) {
    for (const netInfo of interfaces[name]) {
      // Look for non-internal IPv4
      if (netInfo.family === 'IPv4' && !netInfo.internal) {
        const parts = netInfo.address.split('.').map(Number);
        if (parts.length === 4) {
          const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
          results.push({
            name,
            ip: netInfo.address,
            netmask: netInfo.netmask,
            mac: netInfo.mac,
            rangeStart: `${prefix}.1`,
            rangeEnd: `${prefix}.254`,
            cidr: `${prefix}.0/24`
          });
        }
      }
    }
  }

  return results;
}

/**
 * Read the current ARP table from Windows
 */
function getArpTable() {
  return new Promise((resolve) => {
    exec('arp -a', (err, stdout) => {
      const map = new Map(); // ip -> mac
      if (err || !stdout) return resolve(map);

      const lines = stdout.split('\n');
      for (const line of lines) {
        const match = line.trim().match(/(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2})/);
        if (match) {
          const ip = match[1];
          const mac = match[2].replace(/-/g, ':').toUpperCase();
          // Filter out multicast and broadcast
          if (!ip.startsWith('224.') && !ip.startsWith('239.') && ip !== '255.255.255.255') {
            map.set(ip, mac);
          }
        }
      }
      resolve(map);
    });
  });
}

const fs = require('fs');
const path = require('path');

// Try to load extensive MAC vendor database
let extendedOuiMap = null;
try {
  const dbPath = path.join(__dirname, 'mac-vendors.json');
  if (fs.existsSync(dbPath)) {
    extendedOuiMap = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    console.log(`[Scanner] Loaded ${Object.keys(extendedOuiMap).length} MAC vendors.`);
  }
} catch (e) {
  console.log('[Scanner] Could not load mac-vendors.json, falling back to basic OUI map.');
}

/**
 * Match MAC address to a known vendor
 */
function lookupVendor(mac) {
  if (!mac) return 'Unknown';
  const cleanMac = mac.replace(/-/g, ':').toUpperCase();
  const prefix = cleanMac.slice(0, 8); // e.g., 'B8:27:EB'
  
  if (extendedOuiMap && extendedOuiMap[prefix]) {
    return extendedOuiMap[prefix];
  }
  
  return OUI_MAP[prefix] || 'Generic / Other';
}

/**
 * Reverse DNS hostname lookup with fallback to NetBIOS/ping -a
 */
function resolveHostname(ip, timeoutMs = 700) {
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve('');
      }
    }, timeoutMs + 300);

    dns.reverse(ip, (err, hostnames) => {
      if (resolved) return;
      
      if (!err && hostnames && hostnames.length > 0) {
        resolved = true;
        clearTimeout(timer);
        resolve(hostnames[0]);
      } else {
        // Fallback to ping -a (Windows) to get NetBIOS/mDNS name
        exec(`ping -a -n 1 -w 200 ${ip}`, (execErr, stdout) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          
          if (!execErr && stdout) {
            const match = stdout.match(/(?:Pinging|กำลังปิง)\s+([^\s]+)\s+\[/i);
            if (match && match[1] && match[1] !== ip) {
              return resolve(match[1]);
            }
          }
          resolve('');
        });
      }
    });
  });
}

/**
 * Scan a list of ports on a specific IP
 */
function scanPorts(ip, ports = [21, 22, 80, 443, 445, 3389, 8080], timeoutMs = 800) {
  return new Promise((resolve) => {
    const openPorts = [];
    if (!ports || ports.length === 0) return resolve(openPorts);

    let completed = 0;
    ports.forEach((port) => {
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        openPorts.push(port);
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
          resolve(openPorts.sort((a, b) => a - b));
        }
      };

      try {
        socket.connect(port, ip);
      } catch (e) {
        checkDone();
      }
    });
  });
}

/**
 * Quick ping / probe to test if an IP is alive
 */
function probeHost(ip, timeoutMs = 350) {
  return new Promise((resolve) => {
    const start = Date.now();

    // 1. Try Windows ping
    exec(`ping -n 1 -w ${timeoutMs} ${ip}`, (err, stdout) => {
      const elapsed = Date.now() - start;
      if (!err && stdout && (stdout.includes('Reply from') || stdout.includes('คำตอบจาก')) &&
          !stdout.includes('Destination host unreachable') && !stdout.includes('Request timed out')) {
        return resolve({ alive: true, latency: elapsed });
      }

      // 2. TCP probe fallback (checks ports 80, 445, 135, 22)
      // If server resets (ECONNREFUSED) or connects, it is definitively alive
      const testPorts = [80, 445, 135, 22];
      let resolved = false;
      let completed = 0;

      testPorts.forEach((port) => {
        const sock = new net.Socket();
        sock.setTimeout(timeoutMs);

        sock.on('connect', () => {
          sock.destroy();
          if (!resolved) {
            resolved = true;
            resolve({ alive: true, latency: Date.now() - start });
          }
        });

        sock.on('error', (e) => {
          sock.destroy();
          // ECONNREFUSED means host is online and actively rejected port
          if (e.code === 'ECONNREFUSED' && !resolved) {
            resolved = true;
            resolve({ alive: true, latency: Date.now() - start });
          } else {
            completed++;
            if (completed === testPorts.length && !resolved) {
              resolve({ alive: false });
            }
          }
        });

        sock.on('timeout', () => {
          sock.destroy();
          completed++;
          if (completed === testPorts.length && !resolved) {
            resolve({ alive: false });
          }
        });

        try {
          sock.connect(port, ip);
        } catch (e) {
          completed++;
          if (completed === testPorts.length && !resolved) {
            resolve({ alive: false });
          }
        }
      });
    });
  });
}

/**
 * Convert IP string to 32-bit unsigned number
 */
function ipToLong(ip) {
  return ip.split('.').reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

/**
 * Convert 32-bit unsigned number to IP string
 */
function longToIp(long) {
  return [
    (long >>> 24) & 255,
    (long >>> 16) & 255,
    (long >>> 8) & 255,
    long & 255
  ].join('.');
}

/**
 * Send Wake-on-LAN Magic Packet
 */
function sendWakeOnLan(macAddress, broadcastIp = '255.255.255.255', port = 9) {
  return new Promise((resolve, reject) => {
    try {
      const cleanMac = macAddress.replace(/[:-]/g, '');
      if (cleanMac.length !== 12) {
        return reject(new Error('Invalid MAC address length'));
      }

      const macBuffer = Buffer.from(cleanMac, 'hex');
      const magicPacket = Buffer.alloc(6 + 16 * 6);
      magicPacket.fill(0xff, 0, 6);
      for (let i = 0; i < 16; i++) {
        macBuffer.copy(magicPacket, 6 + i * 6);
      }

      const client = dgram.createSocket('udp4');
      client.bind(() => {
        client.setBroadcast(true);
        client.send(magicPacket, 0, magicPacket.length, port, broadcastIp, (err) => {
          client.close();
          if (err) reject(err);
          else resolve(true);
        });
      });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Full subnet scanner with streaming progress
 */
function scanSubnet({ rangeStart, rangeEnd, ports = [21, 22, 80, 443, 445, 3389, 8080], concurrency = 25 }, onHostFound, onProgress, onDone) {
  let isCancelled = false;

  const startLong = ipToLong(rangeStart);
  const endLong = ipToLong(rangeEnd);

  if (startLong > endLong) {
    onDone(0, true, 'Start IP cannot be greater than End IP');
    return { cancel: () => {} };
  }

  const totalIps = endLong - startLong + 1;
  if (totalIps > 1024) {
    onDone(0, true, 'Scan range exceeds maximum allowed limit of 1024 IPs');
    return { cancel: () => {} };
  }

  const ipList = [];
  for (let l = startLong; l <= endLong; l++) {
    ipList.push(longToIp(l));
  }

  let index = 0;
  let activeWorkers = 0;
  let completedCount = 0;
  let foundCount = 0;

  const runWorker = async () => {
    while (index < ipList.length && !isCancelled) {
      const currentIp = ipList[index++];
      activeWorkers++;

      try {
        const probeResult = await probeHost(currentIp);

        if (probeResult.alive && !isCancelled) {
          foundCount++;

          // Lookup MAC from ARP table
          const arpTable = await getArpTable();
          const mac = arpTable.get(currentIp) || '';
          const vendor = lookupVendor(mac);

          // In parallel: resolve hostname & scan common ports
          const [hostname, openPorts] = await Promise.all([
            resolveHostname(currentIp),
            scanPorts(currentIp, ports)
          ]);

          if (!isCancelled) {
            onHostFound({
              ip: currentIp,
              alive: true,
              latency: probeResult.latency || 1,
              mac,
              vendor,
              hostname,
              openPorts
            });
          }
        }
      } catch (e) {
        console.error(`[Scanner] Error scanning ${currentIp}:`, e.message);
      } finally {
        completedCount++;
        activeWorkers--;

        if (onProgress && !isCancelled) {
          const percent = Math.round((completedCount / totalIps) * 100);
          onProgress(completedCount, totalIps, percent, foundCount);
        }
      }
    }

    if (activeWorkers === 0 && (index >= ipList.length || isCancelled)) {
      onDone(foundCount, isCancelled);
    }
  };

  // Launch initial concurrent workers
  const workerCount = Math.min(concurrency, ipList.length);
  for (let w = 0; w < workerCount; w++) {
    runWorker();
  }

  return {
    cancel: () => {
      isCancelled = true;
    }
  };
}

module.exports = {
  getNetworkInterfaces,
  getArpTable,
  lookupVendor,
  scanPorts,
  resolveHostname,
  probeHost,
  sendWakeOnLan,
  scanSubnet
};
