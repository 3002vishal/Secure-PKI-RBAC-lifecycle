const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const forge = require("node-forge");
const { CERT_DIR, CRL_PATH, OPENSSL_DIR } = require("../config/certConfig");
const { verifyCertificateChain } = require("../services/pkiServices");

// 1. Define the absolute path to the backend root (Two levels up from controllers)
const BACKEND_ROOT = path.join(__dirname, "..", "..");

exports.enroll = (req, res) => {
    const { username, csr, serviceRoles } = req.body;

    if (!username || !csr || !serviceRoles) {
        return res.status(400).json({ error: "Missing fields" });
    }

    if (!fs.existsSync(CERT_DIR)) {
        fs.mkdirSync(CERT_DIR, { recursive: true });
    }

    const csrPath = path.join(CERT_DIR, `${username}_req.csr`);
    const certPath = path.join(CERT_DIR, `${username}_cert.pem`);

    try {
        const csrData = Array.isArray(csr) ? csr.join("\n") : csr;
        fs.writeFileSync(csrPath, csrData);
    } catch (err) {
        return res.status(500).json({ error: "File system error", details: err.message });
    }

    // args use OPENSSL_DIR which should be the path to openssl.cnf
    const args = [
        "ca", "-batch", 
        "-config", OPENSSL_DIR, 
        "-name", "intermediate_ca",
        "-in", csrPath, 
        "-out", certPath,
        "-extensions", "usr_cert_dynamic"
    ];

    // CRITICAL: Added cwd: BACKEND_ROOT so OpenSSL finds ./demoCA
    const openssl = spawn("openssl", args, { 
        cwd: BACKEND_ROOT,
        env: { ...process.env, SERVICE_ROLES: serviceRoles } 
    });

    let stderrData = "";
    openssl.stderr.on("data", (data) => { stderrData += data.toString(); });

    openssl.on("error", (err) => {
        return res.status(500).json({ error: "OpenSSL execution failed", details: err.message });
    });

    openssl.on("close", (code) => {
        if (fs.existsSync(csrPath)) fs.unlinkSync(csrPath);

        if (code !== 0) {
            return res.status(500).json({ error: "Signing failed", details: stderrData });
        }

        try {
            const certificate = fs.readFileSync(certPath, "utf8");
            res.json({ success: true, certificate: certificate });
        } catch (readErr) {
            res.status(500).json({ error: "Read failed", details: readErr.message });
        }
    });
};

exports.revoke = (req, res) => {
    const { username } = req.body;
    const certPath = path.join(CERT_DIR, `${username}_cert.pem`);

    if (!fs.existsSync(certPath)) return res.status(404).json({ error: "Certificate file not found" });

    // FIX: Use OPENSSL_DIR and set cwd so revocation finds the index.txt
    const revokeArgs = ["ca", "-config", OPENSSL_DIR, "-name", "intermediate_ca", "-revoke", certPath];

    const revProcess = spawn("openssl", revokeArgs, { cwd: BACKEND_ROOT });
    
    revProcess.on("close", (code) => {
        if (code !== 0) return res.status(500).json({ error: "Revocation command failed" });

        // FIX: Update CRL and output to the correct CRL_PATH
        const crlArgs = ["ca", "-config", OPENSSL_DIR, "-name", "intermediate_ca", "-gencrl", "-out", CRL_PATH];

        spawn("openssl", crlArgs, { cwd: BACKEND_ROOT }).on("close", (crlCode) => {
            if (crlCode !== 0) return res.status(500).json({ error: "CRL update failed" });
            res.json({ success: true, message: `User ${username} revoked and CRL updated.` });
        });
    });
};

exports.verify = (req, res) => {
    const { username } = req.body;
    const certPath = path.join(CERT_DIR, `${username}_cert.pem`);
    if (!fs.existsSync(certPath)) return res.status(404).json({ valid: false, message: "Not found" });

    try {
        const certPem = fs.readFileSync(certPath, "utf8");
        const isValid = verifyCertificateChain(certPem);
        const cert = forge.pki.certificateFromPem(certPem);

        res.json({
            valid: isValid,
            message: isValid ? "Certificate is Valid & Trusted" : "Certificate is Revoked or Expired",
            details: { 
                issuer: cert.issuer.getField('CN') ? cert.issuer.getField('CN').value : "Unknown", 
                expiration: cert.validity.notAfter 
            }
        });
    } catch (err) { 
        res.status(500).json({ valid: false, message: "Verification Failed" }); 
    }
};