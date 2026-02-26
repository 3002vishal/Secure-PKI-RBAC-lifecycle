const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");
const cors = require("cors");
const forge = require("node-forge");

const app = express();
const PORT = 5000;

const CERT_DIR = path.join(__dirname, "cert");
const INTERMEDIATE_DIR = path.join(__dirname, "demoCA/intermediate");
const CRL_PATH = path.join(INTERMEDIATE_DIR, "intermediate.crl");

if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });

// ==============================
// LOAD CA CERTS (TRUST ANCHORS)
// ==============================
const ROOT_CA_PEM = fs.readFileSync(path.join(__dirname, "demoCA/root/ca.cert.pem"), "utf8");
const INT_CA_PEM = fs.readFileSync(path.join(INTERMEDIATE_DIR, "int.cert.pem"), "utf8");

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(cors({ origin: true, credentials: false }));

const challenges = {};

// ==============================
// NEW: REVOCATION CHECKER
// ==============================
function isCertificateRevoked(certPem) {
  try {
    const userCert = forge.pki.certificateFromPem(certPem);
    const serialNumber = userCert.serialNumber.toLowerCase();

    if (!fs.existsSync(CRL_PATH)) return false;

    // Use OpenSSL to parse the CRL blacklist
    const revokedSerials = execSync(`openssl crl -inform PEM -in "${CRL_PATH}" -text -noout`)
      .toString()
      .toLowerCase();

    return revokedSerials.includes(serialNumber);
  } catch (err) {
    console.error("CRL Check Failed:", err.message);
    return true; // Fail-closed: block if status is uncertain
  }
}

// ==============================
// UPDATED: CERTIFICATE CHAIN VALIDATION
// ==============================
function verifyCertificateChain(certPem) {
  try {
    const userCert = forge.pki.certificateFromPem(certPem);
    const rootCert = forge.pki.certificateFromPem(ROOT_CA_PEM);
    const intCert = forge.pki.certificateFromPem(INT_CA_PEM);

    // 1. Validity check
    const now = new Date();
    if (now < userCert.validity.notBefore || now > userCert.validity.notAfter) {
      throw new Error("Certificate expired or not yet valid");
    }

    // 2. NEW: Revocation check 🔐
    if (isCertificateRevoked(certPem)) {
      throw new Error("CERTIFICATE REVOKED: Access denied by Administrator");
    }

    // 3. Chain validation
    const caStore = forge.pki.createCaStore([rootCert, intCert]);
    forge.pki.verifyCertificateChain(caStore, [userCert]);

    return true;
  } catch (err) {
    console.error("Certificate verification failed:", err.message);
    return false;
  }
}

// ==============================
// Helper: Get Service Roles
// ==============================
function getServiceRoles(username) {
  try {
    const certPath = path.join(CERT_DIR, `${username}_cert.pem`);
    if (!fs.existsSync(certPath)) return {};
    const certPem = fs.readFileSync(certPath, "utf8");
    const cert = forge.pki.certificateFromPem(certPem);
    const roleExt = cert.extensions.find((ext) => ext.id === "1.2.3.4.5.6.7.8.1");
    if (!roleExt || !roleExt.value) return {};
    const raw = roleExt.value.toString("utf8");
    const jsonMatch = raw.match(/\{.*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch { return {}; }
}

// ==============================
// 1. Enrollment (Updated to update index.txt)
// ==============================
app.post("/api/enroll", (req, res) => {
  const { username, csr, serviceRoles } = req.body;
  if (!username || !csr || !serviceRoles) return res.status(400).json({ error: "Missing fields" });

  const csrPath = path.join(CERT_DIR, `${username}_req.csr`);
  const certPath = path.join(CERT_DIR, `${username}_cert.pem`);

  fs.writeFileSync(csrPath, Array.isArray(csr) ? csr.join("\n") : csr);

  // Using 'ca' instead of 'x509' so it updates index.txt correctly
  const args = [
    "ca", "-batch", "-config", "openssl.cnf",
    "-name", "intermediate_ca",
    "-in", csrPath, "-out", certPath,
    "-extensions", "usr_cert_dynamic"
  ];

  spawn("openssl", args, { env: { ...process.env, SERVICE_ROLES: serviceRoles } })
    .on("close", (code) => {
      try { fs.unlinkSync(csrPath); } catch (e) { }
      if (code !== 0) return res.status(500).json({ error: "Signing failed" });
      res.json({ success: true, certificate: fs.readFileSync(certPath, "utf8") });
    });
});

// ==============================
// NEW: 2. Revocation API (Admin Only)
// ==============================
app.post("/api/admin/revoke", (req, res) => {
  const { username } = req.body;
  const certPath = path.join(CERT_DIR, `${username}_cert.pem`);

  if (!fs.existsSync(certPath)) return res.status(404).json({ error: "Certificate file not found" });

  // Step A: Mark as Revoked in OpenSSL Database
  const revokeArgs = ["ca", "-config", "openssl.cnf", "-name", "intermediate_ca", "-revoke", certPath];

  spawn("openssl", revokeArgs).on("close", (code) => {
    if (code !== 0) return res.status(500).json({ error: "Revocation command failed" });

    // Step B: Regenerate the CRL (Blacklist) file
    const crlArgs = ["ca", "-config", "openssl.cnf", "-name", "intermediate_ca", "-gencrl", "-out", CRL_PATH];

    spawn("openssl", crlArgs).on("close", (crlCode) => {
      if (crlCode !== 0) return res.status(500).json({ error: "CRL update failed" });
      res.json({ success: true, message: `User ${username} revoked and CRL updated.` });
    });
  });
});

// ==============================
// 3. Challenge
// ==============================
app.get("/auth/challenge/:user", (req, res) => {
  const challenge = crypto.randomBytes(32).toString("base64");
  challenges[req.params.user] = challenge;
  res.json({ challenge });
});

// ==============================
// 4. Login (CHAIN + SIGNATURE + REVOCATION)
// ==============================
app.post("/api/login", (req, res) => {
  const { username, signature } = req.body;
  const challenge = challenges[username];
  if (!username || !signature || !challenge) return res.status(400).json({ error: "Invalid request" });

  const certPath = path.join(CERT_DIR, `${username}_cert.pem`);
  if (!fs.existsSync(certPath)) return res.status(404).json({ error: "Certificate not found" });

  try {
    const certPem = fs.readFileSync(certPath, "utf8");
    if (!verifyCertificateChain(certPem)) throw new Error("Verification Failed (Revoked, Expired, or Untrusted)");

    const publicKey = crypto.createPublicKey(certPem);
    const valid = crypto.verify("sha256", Buffer.from(challenge), publicKey, Buffer.from(signature, "base64"));

    if (!valid) return res.status(403).json({ error: "Invalid signature" });

    delete challenges[username];
    res.json({ success: true, user: username, roles: getServiceRoles(username) });
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }
});

// ==============================
// 5. RBAC Middleware (Inherits Revocation Check)
// ==============================
const verifyAccess = (service, allowedRoles) => (req, res, next) => {
  const { username, signature } = req.body;
  const challenge = challenges[username];
  if (!username || !signature || !challenge) return res.status(400).json({ error: "Invalid request" });

  const certPath = path.join(CERT_DIR, `${username}_cert.pem`);
  if (!fs.existsSync(certPath)) return res.status(404).json({ error: "Certificate not found" });

  try {
    const certPem = fs.readFileSync(certPath, "utf8");
    if (!verifyCertificateChain(certPem)) throw new Error("Access Denied: Certificate Revoked or Invalid");

    const publicKey = crypto.createPublicKey(certPem);
    const valid = crypto.verify("sha256", Buffer.from(challenge), publicKey, Buffer.from(signature, "base64"));
    if (!valid) return res.status(403).json({ error: "Invalid signature" });

    delete challenges[username];
    const role = getServiceRoles(username)[service];
    if (!role || role === "NA" || !allowedRoles.includes(role))
      return res.status(403).json({ error: "Access denied : unauthorized role" });

    req.userRole = role;
    next();
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }
};

// ==============================
// 6. Protected Routes & Verification API
// ==============================
app.post("/api/verify-certificate", (req, res) => {
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
      details: { issuer: cert.issuer.getField('CN').value, expiration: cert.validity.notAfter }
    });
  } catch (err) { res.status(500).json({ valid: false, message: "Verification Failed" }); }
});

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


app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));