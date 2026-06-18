const express = require("express");
const cors = require("cors");
const authController = require("./controllers/authController");
const certController = require("./controllers/certController");
const { verifyAccess } = require("./middleware/authMiddleware");
// top of server.js
const adminController = require('./controllers/adminController'); // Added the 'r'
require('dotenv').config();
const serviceRoutes = require('./routes/serviceRoutes')

// route line

const app = express();
const PORT = process.env.PORT;

// Middleware
app.use(express.json());
app.use(cors({ origin: true, credentials: false }));

// Authentication Routes
app.get("/auth/challenge/:user", authController.getChallenge);
app.post("/api/login", authController.login);

// Certificate Management Routes
app.post("/api/enroll", certController.enroll);
app.post("/api/admin/revoke", certController.revoke);
app.post("/api/verify-certificate", certController.verify);
app.get("/api/admin/get-user-detail",certController.getUserList);
app.post("/api/modify", certController.modify);
app.get("/api/admin/user-details/:username",adminController.getUserDetailsForEdit);

app.use('/api/services',serviceRoutes);

// Protected Service Routes (RBAC)
app.post("/services/zero-trust", 
    verifyAccess("Zero Trust Gateway", ["Gateway Admin", "Policy Admin", "Access Auditor"]), 
    (req, res) => res.json({ data: "ZERO TRUST ACCESS", role: req.userRole })
);

app.post("/services/pki", 
    verifyAccess("pki services", ["PKI Admin", "Cert Operator", "PKI Auditor"]), 
    (req, res) => {
        // Optional: Get the user identity passed from req.body
        const userPrincipal = req.body.username || "Authenticated Token";
        const userRole = req.userRole || "Authorized Operator";

        // Send a complete raw HTML page string back
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>PKI Management Console</title>
                <style>
                    body {
                        background-color: #0a0e27;
                        color: #00ff41;
                        font-family: 'Courier New', Courier, monospace;
                        margin: 0;
                        padding: 30px;
                    }
                    .container {
                        max-width: 800px;
                        margin: 0 auto;
                        border: 1px solid #00ff41;
                        padding: 20px;
                        box-shadow: 0 0 15px rgba(0, 255, 65, 0.2);
                        border-radius: 4px;
                    }
                    h1 {
                        border-bottom: 2px solid #00ff41;
                        padding-bottom: 10px;
                        font-size: 1.8rem;
                        letter-spacing: 1px;
                    }
                    .meta-box {
                        background-color: rgba(255, 255, 255, 0.05);
                        padding: 15px;
                        border-left: 3px solid #00ff41;
                        margin: 20px 0;
                    }
                    .btn {
                        background-color: #00ff41;
                        color: #0a0e27;
                        border: none;
                        padding: 10px 20px;
                        font-weight: bold;
                        cursor: pointer;
                        font-family: monospace;
                        border-radius: 2px;
                    }
                    .btn:hover {
                        background-color: #00cc33;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🔒 SECURE PKI EXECUTION BOUNDARY</h1>
                    
                    <div class="meta-box">
                        <p><strong>PRINCIPAL IDENTITY:</strong> ${userPrincipal.toUpperCase()}</p>
                        <p><strong>SECURITY PRIVILEGE:</strong> ${userRole}</p>
                        <p><strong>STATUS:</strong> MUTUAL TLS HANDSHAKE SUCCESSFUL</p>
                    </div>

                    <p>Welcome to the isolated PKI Management environment. From here, you can sign certificates, manage keys, and update CRL files dynamically.</p>
                    
                    <button class="btn" onclick="alert('Executing cryptographic operation...')">
                        Initialize CA Operations
                    </button>
                </div>
            </body>
            </html>
        `);
    }
);

app.post("/services/hsm", 
    verifyAccess("HSM Operation", ["HSM Admin", "Crypto Operator", "HSM Auditor"]), 
    (req, res) => res.json({ data: "HSM ACCESS", role: req.userRole })
);

app.post("/services/identity", 
    verifyAccess("IAM", ["IAM Admin", "Access Operator", "IAM Auditor"]), 
    (req, res) => res.json({ data: "IAM ACCESS", role: req.userRole })
);

app.post("/services/security", 
    verifyAccess("Security Analytics", ["SOC Admin", "SOC Analyst", "Compliance Auditor"]), 
    (req, res) => res.json({ data: "SECURITY ACCESS", role: req.userRole })
);

app.post("/services/crypto", 
    verifyAccess("Crypto Vault", ["Vault Admin", "Secret Operator", "Vault Auditor"]), 
    (req, res) => res.json({ data: "VAULT ACCESS", role: req.userRole })
);

app.listen(PORT, () => console.log(`✅ Zero Trust Server running on http://localhost:${PORT}`));