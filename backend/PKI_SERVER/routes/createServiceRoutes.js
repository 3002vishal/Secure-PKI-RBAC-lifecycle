// backend/routes/serviceRoutes.js
const express = require('express');
const router = express.Router();
const { verifyAccess } = require('../middleware/authMiddleware');

// 1. Zero Trust Gateway Console
router.post("/zero-trust", 
    verifyAccess("Zero Trust Gateway"), 
    (req, res) => {
        const userPrincipal = req.body.username || "Authenticated Token";
        const userRole = req.userRole || "Authorized Operator";

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Zero Trust Control Plane</title>
                <style>
                    body { background-color: #0b0f19; color: #00e5ff; font-family: 'Courier New', monospace; padding: 30px; }
                    .container { max-width: 800px; margin: 0 auto; border: 1px solid #00e5ff; padding: 20px; box-shadow: 0 0 15px rgba(0, 229, 255, 0.2); }
                    .meta-box { background: rgba(255,255,255,0.05); padding: 15px; border-left: 3px solid #00e5ff; }
                    h1 { text-transform: uppercase; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🛡️ ZERO TRUST CONTROL GATEWAY</h1>
                    <div class="meta-box">
                        <p><strong>Username </strong> ${userPrincipal.toUpperCase()}</p>
                        <p><strong>ROLE </strong> ${userRole}</p>
                        <p><strong>POLICY STATUS:</strong> POLICY ENFORCED AT EDGE</p>
                    </div>  
                    <p>Dynamic perimeter rules configuration and secure gateway intercept status dashboard.</p>
                </div>
            </body>
            </html>
        `);
    }
);

// 2. PKI Management Console
router.post("/pki", 
    verifyAccess("pki services"), 
    (req, res) => {
        const userPrincipal = req.body.username || "Authenticated Token";
        const userRole = req.userRole || "Authorized Operator";

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>PKI Management Console</title>
                <style>
                    body { background-color: #0a0e27; color: #00ff41; font-family: monospace; padding: 30px; }
                    .container { max-width: 800px; margin: 0 auto; border: 1px solid #00ff41; padding: 20px; box-shadow: 0 0 15px rgba(0, 255, 65, 0.2); }
                    .meta-box { background: rgba(255,255,255,0.05); padding: 15px; border-left: 3px solid #00ff41; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🔒 SECURE PKI EXECUTION BOUNDARY</h1>
                    <div class="meta-box">
                        <p><strong>Username:</strong> ${userPrincipal.toUpperCase()}</p>
                        <p><strong>SECURITY PRIVILEGE:</strong> ${userRole}</p>
                    </div>  
                    <p>Welcome to the isolated PKI Management environment. From here, you can sign certificates, manage keys, and update CRL files dynamically.</p>
                </div>
            </body>
            </html>
        `);
    }
);

// 3. HSM Operations Suite
router.post("/hsm", 
    verifyAccess("Hsm Operation "), 
    (req, res) => {
        const userPrincipal = req.body.username || "Authenticated Token";
        const userRole = req.userRole || "Authorized Operator";

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>HSM Operation Command</title>
                <style>
                    body { background-color: #110d0d; color: #ff3b30; font-family: monospace; padding: 30px; }
                    .container { max-width: 800px; margin: 0 auto; border: 1px solid #ff3b30; padding: 20px; box-shadow: 0 0 15px rgba(255, 59, 48, 0.2); }
                    .meta-box { background: rgba(255,255,255,0.05); padding: 15px; border-left: 3px solid #ff3b30; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>⚡ HARDWARE SECURITY MODULE (HSM) Service</h1>
                    <div class="meta-box">
                        <p><strong>Username:</strong> ${userPrincipal.toUpperCase()}</p>
                        <p><strong>Role:</strong> ${userRole}</p>
                       
                    </div>  
                    <p></p>
                </div>
            </body>
            </html>
        `);
    }
);

// 4. Identity & Access (IAM) Portal
router.post("/identity", 
    verifyAccess("IAM"),  
    (req, res) => {
        const userPrincipal = req.body.username || "Authenticated Token";
        const userRole = req.userRole || "Authorized Operator";

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Identity Management Suite</title>
                <style>
                    body { background-color: #0f172a; color: #38bdf8; font-family: monospace; padding: 30px; }
                    .container { max-width: 800px; margin: 0 auto; border: 1px solid #38bdf8; padding: 20px; box-shadow: 0 0 15px rgba(56, 189, 248, 0.2); }
                    .meta-box { background: rgba(255,255,255,0.05); padding: 15px; border-left: 3px solid #38bdf8; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🆔 IDENTITY & ACCESS MANAGEMENT DIRECTORY</h1>
                    <div class="meta-box">
                        <p><strong>Username :</strong> ${userPrincipal.toUpperCase()}</p>
                        <p><strong>Role :</strong> ${userRole}</p>
                    </div>  
                    <p></p>
                </div>
            </body>
            </html>
        `);
    }
);

// 5. Security Analytics Dashboard
router.post("/security", 
    verifyAccess("Security Analytics"), 
    (req, res) => {
        const userPrincipal = req.body.username || "Authenticated Token";
        const userRole = req.userRole || "Authorized Operator";

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>SOC Operations Control</title>
                <style>
                    body { background-color: #070a12; color: #eab308; font-family: monospace; padding: 30px; }
                    .container { max-width: 800px; margin: 0 auto; border: 1px solid #eab308; padding: 20px; box-shadow: 0 0 15px rgba(234, 179, 8, 0.2); }
                    .meta-box { background: rgba(255,255,255,0.05); padding: 15px; border-left: 3px solid #eab308; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📊 SECURITY ANALYTICS & SIEM COMMAND</h1>
                    <div class="meta-box">
                        <p><strong>Username :</strong> ${userPrincipal.toUpperCase()}</p>
                        <p><strong>Role :</strong> ${userRole}</p>
                        <p><strong>LOG ENGINE:</strong> LISTENING FOR TRAFFIC CHANNELS</p>
                    </div>  
                    <p>Monitoring active cryptographic pipelines and policy validation audit logs in real time.</p>
                </div>
            </body>
            </html>
        `);
    }
);

// 6. Crypto Vault Manager
router.post("/crypto", 
    verifyAccess("Crypto Vault"), 
    (req, res) => {
        const userPrincipal = req.body.username || "Authenticated Token";
        const userRole = req.userRole || "Authorized Operator";

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Secure Crypto Vault</title>
                <style>
                    body { background-color: #0d1b2a; color: #e0e1dd; font-family: monospace; padding: 30px; }
                    .container { max-width: 800px; margin: 0 auto; border: 1px solid #e0e1dd; padding: 20px; box-shadow: 0 0 15px rgba(224, 225, 221, 0.2); }
                    .meta-box { background: rgba(255,255,255,0.05); padding: 15px; border-left: 3px solid #e0e1dd; margin-bottom: 0; }
                    h1 { color: #8d99ae; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🔑 SECURE ENTROPY SECRET VAULT</h1>
                    <div class="meta-box">
                        <p><strong>AUTHENTICATED TRUST:</strong> ${userPrincipal.toUpperCase()}</p>
                        <p><strong>VAULT BOUNDARY ACCESS:</strong> ${userRole}</p>
                    </div>  
                    <hr style="border-color: #8d99ae; margin: 20px 0;" />
                    <p>Encrypted data-at-rest key storage space. Injection of temporary application environment strings authorized.</p>
                </div>
            </body>
            </html>
        `);
    }
);

module.exports = router;