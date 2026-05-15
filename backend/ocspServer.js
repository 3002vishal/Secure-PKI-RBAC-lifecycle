const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 8888;
const INDEX_PATH = path.resolve(__dirname, 'demoCA/intermediate/index.txt');
const SIGNER_CERT = path.resolve(__dirname, 'demoCA/intermediate/int.cert.pem');
const SIGNER_KEY = path.resolve(__dirname, 'demoCA/intermediate/private/int.key.pem');
const CA_CHAIN = path.resolve(__dirname, 'demoCA/intermediate/chain.pem');

const server = http.createServer((req, res) => {
    if (req.method !== 'POST') {
        res.writeHead(405);
        return res.end('Only OCSP POST requests supported');
    } 

    let body = [];
    req.on('data', (chunk) => body.push(chunk));
    req.on('end', () => {
        const fullBody = Buffer.concat(body);

        
        // -reqin -  means read request from stdin
        // -respout - means write response to stdout
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

            res.writeHead(200, { 'Content-Type': 'application/ocsp-response' });
            res.end(Buffer.concat(responseData));
        });

        // Feed the request body to OpenSSL
        ocsp.stdin.write(fullBody);
        ocsp.stdin.end();
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Real-time OCSP Responder live on port ${PORT}`);
});