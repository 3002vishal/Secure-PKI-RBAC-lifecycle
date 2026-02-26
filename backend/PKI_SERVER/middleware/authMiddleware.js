const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { CERT_DIR } = require("../config/certConfig");
const { verifyCertificateChain } = require("../services/pkiServices");
const { getServiceRoles } = require("../services/roleServices");

const challenges = {}; // Shared challenge store

const verifyAccess = (service, allowedRoles) => (req, res, next) => {
  const { username, signature } = req.body;
  const challenge = challenges[username];
  
  if (!username || !signature || !challenge) {
    return res.status(400).json({ error: "Invalid request" });
  }

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
    if (!role || role === "NA" || !allowedRoles.includes(role)) {
      return res.status(403).json({ error: "Access denied : unauthorized role" });
    }

    req.userRole = role;
    next();
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }
};

module.exports = { verifyAccess, challenges };