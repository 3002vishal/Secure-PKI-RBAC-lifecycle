const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const forge = require("node-forge");
const { CERT_DIR, CRL_PATH, OPENSSL_DIR, INTERMEDIATE_DIR } = require("../config/certConfig");
const { verifyCertificateChain } = require("../services/pkiServices");
const {getUserDetails} = require("../services/pkiServices")

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

    // console.log(username);
    // 1. Get the path to the original user cert to find its serial
    const userCertPath = path.join(CERT_DIR, `${username}_cert.pem`);

    if (!fs.existsSync(userCertPath)) {
        return res.status(404).json({ error: "Certificate not found in main directory." });
    }

    try {
        // 2. Calculate Serial Number using node-forge
        const certPem = fs.readFileSync(userCertPath, 'utf8');
        const cert = forge.pki.certificateFromPem(certPem);
        const serialHex = cert.serialNumber.toLowerCase(); // OpenSSL usually saves as lowercase hex (e.g. 1009)
        
        // 3. Point to the "Archive" location inside your demoCA structure
        // Note: Using the exact spelling 'newCErts' from your earlier message
        const archiveCertPath = path.join(BACKEND_ROOT, "demoCA", "intermediate", "newCErts", `${serialHex.toUpperCase()}.pem`);

        console.log(`[REVOKE] Calculated Serial: ${serialHex}`);
        console.log(`[REVOKE] Looking for archive file: ${archiveCertPath}`);

        // Check if the archive file actually exists before calling OpenSSL
        if (!fs.existsSync(archiveCertPath)) {
            console.warn("[WARN] Archive cert not found, falling back to user cert path.");
        }
        
        // Use the archive path if it exists, otherwise fall back to the user cert path
        const finalRevokePath = fs.existsSync(archiveCertPath) ? archiveCertPath : userCertPath;

        // 4. Run OpenSSL Revoke
        const revokeArgs = [
            "ca", "-config", OPENSSL_DIR, 
            "-name", "intermediate_ca", 
            "-revoke", finalRevokePath
        ];

        const revProcess = spawn("openssl", revokeArgs, { 
    cwd: BACKEND_ROOT,
    // ADD THIS ENV OBJECT:
    env: { 
        ...process.env, 
        SERVICE_ROLES: "revocation_mode" // Provide a placeholder value
    } 
});

        let stderr = "";
        revProcess.stderr.on("data", (data) => { stderr += data.toString(); });

        revProcess.on("close", (code) => {
            if (code !== 0) {
                return res.status(500).json({ error: "Revocation failed", details: stderr });
            }

            // 5. Always update the CRL after a successful revocation
            const crlArgs = ["ca", "-config", OPENSSL_DIR, "-name", "intermediate_ca", "-gencrl", "-out", CRL_PATH];
            spawn("openssl", crlArgs, { cwd: BACKEND_ROOT }).on("close", (crlCode) => {
                res.json({ success: true, message: `Revoked serial ${serialHex} and updated CRL.` });
            });
        });

    } catch (err) {
        console.error("Revocation Error:", err);
        res.status(500).json({ error: "Internal processing error", details: err.message });
    }
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

exports.getUserList = (req, res) => {
  try{
    const indexPath = path.join(INTERMEDIATE_DIR, "./index.txt");
    const userdata = getUserDetails(indexPath);
    res.json({success: true, userdetail:userdata});


  }
  catch(err){
    res.status(500).json({error: "Failed to fetch registry", details: err.message});
  }
};



