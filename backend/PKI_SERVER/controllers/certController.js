const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const forge = require("node-forge");
const { CERT_DIR, CRL_PATH, OPENSSL_DIR, INTERMEDIATE_DIR } = require("../config/certConfig");
const { verifyCertificateChain } = require("../services/pkiServices");
const {getUserDetails} = require("../services/pkiServices")

// 1. Define the absolute path to the backend root (Two levels up from controllers)
const BACKEND_ROOT = path.join(__dirname, "..", "..");


exports.find = (req, res) => {
    try {
        const { username } = req.body;

        // Validate username
        if (!username || typeof username !== "string") {
            return res.status(400).json({
                success: false,
                message: "Username is required"
            });
        }

        const requestedUsername = username.trim().toLowerCase();

        // Read all files from certificate directory
        const files = fs.readdirSync(CERT_DIR);

        // Check for exact username certificate
        const certificateExists = files.some(file => {
            const extension = path.extname(file).toLowerCase();

            // Only consider certificate files
            if (extension !== ".pem" && extension !== ".crt") {
                return false;
            }

            // Remove extension
            const filename = path.basename(file, extension);

            // Remove "_cert" suffix
            const certUsername = filename
                .replace(/_cert$/i, "")
                .trim()
                .toLowerCase();

            return certUsername === requestedUsername;
        });

        return res.status(200).json({
            success: true,
            username: username,
            exists: certificateExists
        });

    } catch (error) {
        console.error("Error checking username:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to check username"
        });
    }
}; 

exports.enroll = (req, res) => {

    // ============================================================
    // 1. READ REQUEST BODY
    // ============================================================

    const {
        username,
        csr,
        serviceRoles
    } = req.body;


    console.log("\n========================================");
    console.log("        CERTIFICATE ENROLLMENT");
    console.log("========================================");

    console.log("Username:", username);

    console.log(
        "Service Roles:",
        JSON.stringify(serviceRoles, null, 2)
    );


    // ============================================================
    // 2. VALIDATE REQUIRED FIELDS
    // ============================================================

    if (!username) {

        return res.status(400).json({
            success: false,
            error: "Missing username"
        });

    }


    if (!csr) {

        return res.status(400).json({
            success: false,
            error: "Missing CSR"
        });

    }


    if (
        serviceRoles === undefined ||
        serviceRoles === null
    ) {

        return res.status(400).json({
            success: false,
            error: "Missing serviceRoles"
        });

    }


    // ============================================================
    // 3. CREATE CERTIFICATE DIRECTORY
    // ============================================================

    try {

        if (!fs.existsSync(CERT_DIR)) {

            fs.mkdirSync(
                CERT_DIR,
                {
                    recursive: true
                }
            );

        }

    } catch (err) {

        return res.status(500).json({
            success: false,
            error: "Could not create certificate directory",
            details: err.message
        });

    }


    // ============================================================
    // 4. CREATE FILE PATHS
    // ============================================================

    const safeUsername =
        username.replace(
            /[^a-zA-Z0-9_-]/g,
            "_"
        );


    const csrPath =
        path.join(
            CERT_DIR,
            `${safeUsername}_req.csr`
        );


    const certPath =
        path.join(
            CERT_DIR,
            `${safeUsername}_cert.pem`
        );


    // ============================================================
    // 5. PREPARE CSR
    // ============================================================

    try {

        /*
         * CSR can arrive as:
         *
         * String
         *
         * OR
         *
         * Array of strings
         */

        const csrData =
            Array.isArray(csr)
                ? csr.join("\n")
                : String(csr);


        fs.writeFileSync(
            csrPath,
            csrData,
            "utf8"
        );


        console.log(
            "CSR written to:",
            csrPath
        );


    } catch (err) {

        return res.status(500).json({
            success: false,
            error: "CSR file system error",
            details: err.message
        });

    }


    // ============================================================
    // 6. PREPARE SERVICE ROLES
    // ============================================================

    /*
     * IMPORTANT:
     *
     * serviceRoles from your React request is an OBJECT:
     *
     * {
     *     "Crypto Vault": "NA",
     *     "dummy service": "doaremon",
     *     "pki services": "NA",
     *     "Hsm Operation": "c"
     * }
     *
     * We MUST NOT do:
     *
     * SERVICE_ROLES: serviceRoles
     *
     * because that becomes:
     *
     * [object Object]
     *
     * Instead we convert it to JSON.
     */


    let serviceRolesString;


    try {

        if (
            typeof serviceRoles === "object" &&
            serviceRoles !== null
        ) {

            /*
             * Remove roles whose value is "NA".
             *
             * If you want to keep NA entries, remove this
             * filtering section and simply use JSON.stringify().
             */

            const filteredRoles =
                Object.fromEntries(

                    Object.entries(serviceRoles)
                        .filter(
                            ([service, role]) =>
                                role !== "NA"
                        )

                );


            serviceRolesString =
                JSON.stringify(filteredRoles);

        } else {

            /*
             * If serviceRoles is already a string,
             * use it directly.
             */

            serviceRolesString =
                String(serviceRoles);

        }


    } catch (err) {

        // Remove CSR if conversion fails

        if (fs.existsSync(csrPath)) {
            fs.unlinkSync(csrPath);
        }


        return res.status(400).json({
            success: false,
            error: "Invalid serviceRoles",
            details: err.message
        });

    }


    console.log(
        "SERVICE_ROLES passed to OpenSSL:"
    );

    console.log(
        serviceRolesString
    );


    // ============================================================
    // 7. OPENSSL COMMAND
    // ============================================================

    const args = [

        "ca",

        "-batch",

        "-notext",

        "-config",
        OPENSSL_DIR,

        "-name",
        "intermediate_ca",

        "-in",
        csrPath,

        "-out",
        certPath,

        "-extensions",
        "usr_cert_dynamic"

    ];


    console.log("\nOpenSSL command:");

    console.log(
        "openssl",
        args.join(" ")
    );


    // ============================================================
    // 8. OPENSSL ENVIRONMENT
    // ============================================================

    const opensslEnv = {

        ...process.env,

        /*
         * THIS IS THE IMPORTANT FIX.
         *
         * Do NOT pass the JavaScript object directly.
         */

        SERVICE_ROLES:
            serviceRolesString

    };


    console.log(
        "\nOpenSSL SERVICE_ROLES:"
    );

    console.log(
        opensslEnv.SERVICE_ROLES
    );


    // ============================================================
    // 9. START OPENSSL
    // ============================================================

    let openssl;


    try {

        openssl =
            spawn(
                "openssl",
                args,
                {
                    cwd: BACKEND_ROOT,
                    env: opensslEnv
                }
            );

    } catch (err) {

        if (fs.existsSync(csrPath)) {
            fs.unlinkSync(csrPath);
        }

        return res.status(500).json({
            success: false,
            error: "OpenSSL execution failed",
            details: err.message
        });

    }


    // ============================================================
    // 10. COLLECT STDERR
    // ============================================================

    let stderrData = "";

    let stdoutData = "";


    openssl.stderr.on(
        "data",
        (data) => {

            const text =
                data.toString();

            stderrData += text;

            console.log(
                "[OpenSSL STDERR]",
                text
            );

        }
    );


    openssl.stdout.on(
        "data",
        (data) => {

            const text =
                data.toString();

            stdoutData += text;

            console.log(
                "[OpenSSL STDOUT]",
                text
            );

        }
    );


    // ============================================================
    // 11. HANDLE PROCESS ERROR
    // ============================================================

    openssl.on(
        "error",
        (err) => {

            console.error(
                "OpenSSL process error:",
                err
            );


            // Delete CSR

            if (fs.existsSync(csrPath)) {

                try {
                    fs.unlinkSync(csrPath);
                } catch (e) {
                    console.error(
                        "Could not delete CSR:",
                        e
                    );
                }

            }


            // Delete certificate if partially created

            if (fs.existsSync(certPath)) {

                try {
                    fs.unlinkSync(certPath);
                } catch (e) {
                    console.error(
                        "Could not delete certificate:",
                        e
                    );
                }

            }


            if (!res.headersSent) {

                return res.status(500).json({

                    success: false,

                    error:
                        "OpenSSL execution failed",

                    details:
                        err.message

                });

            }

        }
    );


    // ============================================================
    // 12. HANDLE OPENSSL EXIT
    // ============================================================

    openssl.on(
        "close",
        (code) => {

            console.log(
                `OpenSSL exited with code: ${code}`
            );


            // ====================================================
            // DELETE CSR
            // ====================================================

            if (fs.existsSync(csrPath)) {

                try {

                    fs.unlinkSync(csrPath);

                    console.log(
                        "Temporary CSR deleted."
                    );

                } catch (err) {

                    console.error(
                        "Could not delete CSR:",
                        err
                    );

                }

            }


            // ====================================================
            // OPENSSL FAILED
            // ====================================================

            if (code !== 0) {

                console.error(
                    "OpenSSL signing failed."
                );

                console.error(
                    "OpenSSL stderr:",
                    stderrData
                );


                // Delete failed certificate

                if (fs.existsSync(certPath)) {

                    try {

                        fs.unlinkSync(certPath);

                    } catch (err) {

                        console.error(
                            "Could not delete failed certificate:",
                            err
                        );

                    }

                }


                return res.status(500).json({

                    success: false,

                    error:
                        "Certificate signing failed",

                    details:
                        stderrData ||
                        "OpenSSL returned a non-zero exit code."

                });

            }


            // ====================================================
            // 13. CHECK CERTIFICATE EXISTS
            // ====================================================

            if (!fs.existsSync(certPath)) {

                console.error(
                    "OpenSSL completed successfully but certificate was not created."
                );


                return res.status(500).json({

                    success: false,

                    error:
                        "Certificate file was not generated"

                });

            }


            // ====================================================
            // 14. READ CERTIFICATE
            // ====================================================

            try {

                const certificate =
                    fs.readFileSync(
                        certPath,
                        "utf8"
                    );


                console.log(
                    "\nCertificate generated successfully."
                );


                console.log(
                    "Certificate path:",
                    certPath
                );


                // =================================================
                // 15. RETURN RESPONSE
                // =================================================

                return res.json({

                    success: true,

                    username: username,

                    serviceRoles:
                        serviceRolesString,

                    certificate:
                        certificate

                });


            } catch (err) {

                console.error(
                    "Certificate read error:",
                    err
                );


                return res.status(500).json({

                    success: false,

                    error:
                        "Could not read generated certificate",

                    details:
                        err.message

                });

            }

        }
    );

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




