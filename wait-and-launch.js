const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const electronBin = `"${path.join(__dirname, 'node_modules', '.bin', 'electron.cmd')}"`;

function checkVite() {
  http.get('http://localhost:5173', (res) => {
    console.log('[Runner] Vite dev server ready! Launching Electron...');
    const electronProcess = spawn(electronBin, ['.'], {
      stdio: 'inherit',
      shell: true,
      windowsVerbatimArguments: true,
      env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' }
    });

    electronProcess.on('exit', () => {
      console.log('[Runner] Electron closed. Exiting...');
      process.exit(0);
    });
  }).on('error', () => {
    setTimeout(checkVite, 600);
  });
}

checkVite();
