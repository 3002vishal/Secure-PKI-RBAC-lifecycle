const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 8888;
const INDEX_PATH = path.resolve(__dirname, 'demoCA/intermediate/index.txt');
const SIGNER_CERT = path.resolve(__dirname, 'demoCA/intermediate/int.cert.pem');
const SIGNER_KEY = path.resolve(__dirname, 'demoCA/intermediate/private/int.key.pem');
const CA_CHAIN = path.resolve(__dirname, 'demoCA/intermediate/chain.pem');

// Helper to print binary OCSP Request in plain text
function logOcspRequest(buffer) {
    const parser = spawn('openssl', ['ocsp', '-req_text', '-reqin', '-']);
    parser.stdout.on('data', (data) => {
        console.log('\n--- 📥 INCOMING OCSP REQUEST ---');
        console.log(data.toString());
    });
    parser.stdin.write(buffer);
    parser.stdin.end();
}

// Helper to print binary OCSP Response in plain text
function logOcspResponse(buffer) {
    const parser = spawn('openssl', ['ocsp', '-respin', '-', '-text', '-noverify']);
    parser.stdout.on('data', (data) => {
        console.log('\n--- 📤 OUTGOING OCSP RESPONSE ---');
        console.log(data.toString());
    });
    parser.stdin.write(buffer);
    parser.stdin.end();
}

const server = http.createServer((req, res) => {
    if (req.method !== 'POST') {
        res.writeHead(405);
        return res.end('Only OCSP POST requests supported');
    } 

    let body = [];
    req.on('data', (chunk) => body.push(chunk));
    req.on('end', () => {
        const fullBody = Buffer.concat(body);

        // 1. Log the parsed request to terminal
        logOcspRequest(fullBody);

        const ocsp = spawn('openssl', [
            'ocsp',
            '-index', INDEX_PATH,
            '-rsigner', SIGNER_CERT,
            '-rkey', SIGNER_KEY,
            '-CA', CA_CHAIN,
            '-reqin', '-',
            '-respout', '-'
        ]);

        let responseData = [];
        let errorData = [];

        ocsp.stdout.on('data', (data) => responseData.push(data));
        ocsp.stderr.on('data', (data) => errorData.push(data));

        ocsp.on('close', (code) => {
            if (code !== 0) {
                console.error('OpenSSL Error:', Buffer.concat(errorData).toString());
                res.writeHead(500);
                return res.end('OCSP Processing Error');
            }

            const fullResponse = Buffer.concat(responseData);

            // 2. Log the parsed response to terminal
            logOcspResponse(fullResponse);

            res.writeHead(200, { 'Content-Type': 'application/ocsp-response' });
            res.end(fullResponse);
        });

        ocsp.stdin.write(fullBody);
        ocsp.stdin.end();
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Real-time OCSP Responder live on port ${PORT}`);
});