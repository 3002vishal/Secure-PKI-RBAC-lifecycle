const express = require("express");
const cors = require("cors");
const authController = require("./controllers/authController");
const certController = require("./controllers/certController");
const { verifyAccess } = require("./middleware/authMiddleware");

const app = express();
const PORT = 5000;

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

// Protected Service Routes (RBAC)
app.post("/services/zero-trust", 
    verifyAccess("Zero Trust Gateway", ["Gateway Admin", "Policy Admin", "Access Auditor"]), 
    (req, res) => res.json({ data: "ZERO TRUST ACCESS", role: req.userRole })
);

app.post("/services/pki", 
    verifyAccess("PKI Management", ["PKI Admin", "Cert Operator", "PKI Auditor"]), 
    (req, res) => res.json({ data: "PKI ACCESS", role: req.userRole })
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