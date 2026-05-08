const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const httpProxy = require('http-proxy');

// --- CONFIGURATION ---
const PROXY_PORT = 8888;
const WORKER_PORTS = [8889, 8890]; // We will flip-flop between these two
let currentWorkerIndex = 0;
let activeProcess = null;

// Create the proxy server instance
const proxy = httpProxy.createProxyServer({});

// --- 1. THE PERMANENT PROXY ---
// This server stays alive 24/7. It is the "Front Door".
const mainServer = http.createServer((req, res) => {
    const targetPort = WORKER_PORTS[currentWorkerIndex];
    
    proxy.web(req, res, { target: `http://127.0.0.1:${targetPort}` }, (err) => {
        // If the worker isn't ready yet, show a gateway error
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('OCSP Responder is rotating. Please retry in a moment.');
    });
});

mainServer.listen(PROXY_PORT, () => {
    console.log(`🚀 Proxy Server (Front Door) listening on port ${PROXY_PORT}`);
});

// --- 2. WORKER MANAGEMENT ---
function spawnOpenSSL(port) {
    const indexPath = path.resolve(__dirname, 'demoCA/intermediate/index.txt');
    const signerPath = path.resolve(__dirname, 'demoCA/intermediate/int.cert.pem');
    const keyPath = path.resolve(__dirname, 'demoCA/intermediate/private/int.key.pem');
    const caPath = path.resolve(__dirname, 'demoCA/intermediate/chain.pem');

    const proc = spawn('openssl', [
        'ocsp',
        '-index', indexPath,
        '-port', port.toString(),
        '-rsigner', signerPath,
        '-rkey', keyPath,
        '-CA', caPath,
        '-text'
    ]);

    proc.stdout.on('data', (data) => console.log(`[Worker ${port}] Output: ${data}`));
    proc.stderr.on('data', (data) => console.error(`[Worker ${port}] Error: ${data}`));

    return proc;
}

function rotateWorkers() {
    const oldIndex = currentWorkerIndex;
    const nextIndex = 1 - currentWorkerIndex; // Flips 0 to 1 or 1 to 0
    const nextPort = WORKER_PORTS[nextIndex];
    const oldProcess = activeProcess;

    console.log(`🔄 index.txt updated! Starting new worker on port ${nextPort}...`);

    // Start the new worker
    const newProcess = spawnOpenSSL(nextPort);

    // Give the new worker 500ms to load the file and bind to the port
    setTimeout(() => {
        // SWAP the proxy pointer
        currentWorkerIndex = nextIndex;
        activeProcess = newProcess;
        console.log(`✅ Traffic now routing to port ${nextPort}`);

        // GRACE PERIOD: Wait 5 seconds before killing the old process
        // This allows the "100 older requests" to finish successfully.
        if (oldProcess) {
            console.log(`⌛ Draining old worker on port ${WORKER_PORTS[oldIndex]} for 5s...`);
            setTimeout(() => {
                oldProcess.kill('SIGINT');
                console.log(`💀 Old worker on port ${WORKER_PORTS[oldIndex]} killed.`);
            }, 5000); 
        }
    }, 500);
}

// --- 3. THE WATCHER ---
const watchPath = path.resolve(__dirname, 'demoCA/intermediate/index.txt');
let watchTimeout;

fs.watch(watchPath, (eventType) => {
    if (eventType === 'change') {
        if (watchTimeout) return;
        watchTimeout = setTimeout(() => {
            rotateWorkers(); 
            watchTimeout = null;
        }, 100); 
    }
});

// Initial Startup
activeProcess = spawnOpenSSL(WORKER_PORTS[currentWorkerIndex]);