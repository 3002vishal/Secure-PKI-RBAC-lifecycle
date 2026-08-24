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

    console.log("reached");
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
    "ca",
    "-batch",
    "-notext",
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
    // 1. Get username and reason from request
    const { username, reason } = req.body; 
    
    // Set a default if no reason is provided
    const revocationReason = reason || "unspecified"; 

    const userCertPath = path.join(CERT_DIR, `${username}_cert.pem`);

    if (!fs.existsSync(userCertPath)) {
        return res.status(404).json({ error: "Certificate not found." });
    }

    try {
        const certPem = fs.readFileSync(userCertPath, 'utf8');
        const cert = forge.pki.certificateFromPem(certPem);
        const serialHex = cert.serialNumber.toLowerCase();
        
        const archiveCertPath = path.join(BACKEND_ROOT, "demoCA", "intermediate", "newCErts", `${serialHex.toUpperCase()}.pem`);
        const finalRevokePath = fs.existsSync(archiveCertPath) ? archiveCertPath : userCertPath;

        // 2. Updated Revoke Args with -crl_reason
        const revokeArgs = [
            "ca", "-config", OPENSSL_DIR, 
            "-name", "intermediate_ca", 
            "-revoke", finalRevokePath,
            "-crl_reason", revocationReason // <--- ADD THIS LINE
        ];

        const revProcess = spawn("openssl", revokeArgs, { 
            cwd: BACKEND_ROOT,
            env: { ...process.env, SERVICE_ROLES: "revocation_mode" } 
        });

        let revokeStderr = "";
        revProcess.stderr.on("data", (data) => { revokeStderr += data.toString(); });

        revProcess.on("close", (code) => {
            if (code !== 0) {
                return res.status(500).json({ error: "Revocation failed", details: revokeStderr });
            }

            // 3. Generate CRL (Same as before)
            const crlArgs = ["ca", "-config", OPENSSL_DIR, "-name", "intermediate_ca", "-gencrl", "-out", CRL_PATH];
            const crlProcess = spawn("openssl", crlArgs, { 
                cwd: BACKEND_ROOT,
                env: { ...process.env, SERVICE_ROLES: "revocation_mode" } 
            });

            crlProcess.on("close", (crlCode) => {
                res.json({ 
                    success: true, 
                    message: `Revoked ${username} (Serial: ${serialHex}) for reason: ${revocationReason}` 
                });
            });
        });

    } catch (err) {
        res.status(500).json({ error: "Internal error", details: err.message });
    }
};



exports.verify = (req, res) => {
    const { username } = req.body;
    
    const certPath = path.join(CERT_DIR, `${username}_cert.pem`);
    if (!fs.existsSync(certPath)) return res.status(404).json({ valid: false, message: "Not found" });

    try {
        const certPem = fs.readFileSync(certPath, "utf8");
        const {isValid,message} = verifyCertificateChain(certPem);
        const cert = forge.pki.certificateFromPem(certPem);
        console.log("veriying deatial", verifyCertificateChain(certPem));

        res.json({
            valid: isValid,
            message:  message,
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

exports.modify = async (req, res) => {
    const { username, csr, serviceRoles } = req.body;

    // 1. Validation and Type Checking
    if (!username || !csr || !serviceRoles) {
        return res.status(400).json({ error: "Missing fields for modification" });
    }

    const userCertPath = path.join(CERT_DIR, `${username}_cert.pem`);

    if (!fs.existsSync(userCertPath)) {
        return res.status(404).json({ error: "User certificate not found. Cannot modify/renew." });
    }

    try {
        // --- STEP 1: REVOCATION LOGIC ---
        const certPem = fs.readFileSync(userCertPath, 'utf8');
        const cert = forge.pki.certificateFromPem(certPem);
        const serialHex = cert.serialNumber.toLowerCase();
        
        const archiveCertPath = path.join(BACKEND_ROOT, "demoCA", "intermediate", "newCErts", `${serialHex.toUpperCase()}.pem`);
        const finalRevokePath = fs.existsSync(archiveCertPath) ? archiveCertPath : userCertPath;

        const revokeArgs = [
            "ca", "-config", OPENSSL_DIR, 
            "-name", "intermediate_ca", 
            "-revoke", finalRevokePath
        ];

        const revProcess = spawn("openssl", revokeArgs, { 
            cwd: BACKEND_ROOT,
            env: { ...process.env, SERVICE_ROLES: "revocation_mode" } 
        });

        let revokeStderr = "";
        revProcess.stderr.on("data", (data) => { revokeStderr += data.toString(); });

        revProcess.on("close", (revokeCode) => {
            // FIX: If it's already revoked, OpenSSL returns code 1. 
            // We check the error message to see if we can ignore it and proceed.
            const isAlreadyRevoked = revokeStderr.includes("ERROR:Already revoked");

            if (revokeCode !== 0 && !isAlreadyRevoked) {
                return res.status(500).json({ error: "Revocation stage failed", details: revokeStderr });
            }

            // Update CRL (Certificate Revocation List)
            const crlArgs = ["ca", "-config", OPENSSL_DIR, "-name", "intermediate_ca", "-gencrl", "-out", CRL_PATH];
            spawn("openssl", crlArgs, { cwd: BACKEND_ROOT }).on("close", (crlCode) => {
                
                // --- STEP 2: ENROLLMENT LOGIC (Re-issue) ---
                const csrPath = path.join(CERT_DIR, `${username}_req.csr`);
                const newCertPath = path.join(CERT_DIR, `${username}_cert.pem`);

                // FIX: Ensure CSR is a string. If PowerShell sent an object/array, we normalize it.
                let normalizedCsr = csr;
                if (Array.isArray(csr)) {
                    normalizedCsr = csr.join("\n");
                } else if (typeof csr !== 'string') {
                    // This handles the "Received an instance of Object" error
                    normalizedCsr = String(csr); 
                }

                try {
                    fs.writeFileSync(csrPath, normalizedCsr);
                } catch (fsErr) {
                    return res.status(500).json({ error: "Failed to write CSR file", details: fsErr.message });
                }

                const enrollArgs = [
                    "ca", "-batch", 
                    "-config", OPENSSL_DIR, 
                    "-name", "intermediate_ca",
                    "-in", csrPath, 
                    "-out", newCertPath,
                    "-extensions", "usr_cert_dynamic"
                ];
                console.log("before modify");

                const enrollProcess = spawn("openssl", enrollArgs, { 
                    cwd: BACKEND_ROOT,
                    env: { ...process.env, SERVICE_ROLES: serviceRoles } 
                });
                console.log("after modify");

                let enrollStderr = "";
                enrollProcess.stderr.on("data", (data) => { enrollStderr += data.toString(); });

                enrollProcess.on("close", (enrollCode) => {
                    if (fs.existsSync(csrPath)) fs.unlinkSync(csrPath);

                    if (enrollCode !== 0) {
                        return res.status(500).json({ error: "Re-enrollment failed", details: enrollStderr });
                    }

                    try {
                        const newCertificate = fs.readFileSync(newCertPath, "utf8");
                        res.json({ 
                            success: true, 
                            message: `Successfully rotated certificate for ${username}`,
                            certificate: newCertificate 
                        });
                    } catch (readErr) {
                        res.status(500).json({ error: "Read failed after re-issue", details: readErr.message });
                    }
                });
            });
        });

    } catch (err) {
        console.error("Modification Error:", err);
        res.status(500).json({ error: "Internal processing error during modification", details: err.message });
    }
};




