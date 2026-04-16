const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

let ocspProcess;

function startOCSP() {
  // If a process is already running, kill it before starting a new one
  if (ocspProcess) {
    console.log("Killing old OCSP instance...");
    ocspProcess.kill();
  }

  // Define your paths (using path.resolve to be safe)
  const indexPath = path.resolve(__dirname, 'demoCA/intermediate/index.txt');
  const signerPath = path.resolve(__dirname, 'demoCA/intermediate/int.cert.pem');
  const keyPath = path.resolve(__dirname, 'demoCA/intermediate/private/int.key.pem');
  const caPath = path.resolve(__dirname, 'demoCA/intermediate/chain.pem');

  // Start the OpenSSL OCSP server
  ocspProcess = spawn('openssl', [
    'ocsp',
    '-index', indexPath,
    '-port', '8888',
    '-rsigner', signerPath,
    '-rkey', keyPath,
    '-CA', caPath,
    '-text'
  ]);

  ocspProcess.stdout.on('data', (data) => console.log(`OCSP Output: ${data}`));
  ocspProcess.stderr.on('data', (data) => console.error(`OCSP Error: ${data}`));

  console.log("✅ OCSP Server (Re)started on port 8888");
}

// Path to the file we want to watch
const watchPath = path.resolve(__dirname, 'demoCA/intermediate/index.txt');

// Watch for changes in index.txt
// 'debounce' logic: sometimes fs.watch fires twice, we wrap it in a small check
let watchTimeout;
fs.watch(watchPath, (eventType) => {
  if (eventType === 'change') {
    if (watchTimeout) return;
    watchTimeout = setTimeout(() => {
      console.log("🔄 index.txt updated! Restarting OCSP...");
      startOCSP();
      watchTimeout = null;
    }, 100); 
  }
});

startOCSP();