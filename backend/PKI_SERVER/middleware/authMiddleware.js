const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { CERT_DIR } = require("../config/certConfig");
const { verifyCertificateChain } = require("../services/pkiServices");
const { getServiceRoles } = require("../services/roleServices");
const pool = require("../config/db"); // Ensure you import your MySQL database connection pool here

const challenges = {}; // Shared challenge store

// 1. Turned inner middleware execution block into an async function
const verifyAccess = (service) => async (req, res, next) => {
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

    // 2. DYNAMIC DATABASE LOOKUP FOR ROLES MATRIX
    // Queries the allowed roles directly from the matching service row name entry
    const [services] = await pool.query("SELECT roles FROM services WHERE name = ?", [service]);
    
    if (services.length === 0) {
      return res.status(404).json({ error: `Infrastructure Error: Service boundary '${service}' not registered.` });
    }

    // Safely parse the JSON format string column returned by the MySQL driver
    const dbRolesText = services[0].roles;
    const allowedRoles = typeof dbRolesText === "string" ? JSON.parse(dbRolesText) : dbRolesText;

    // 3. Match User claims profile against dynamic allowed roles array
    const role = getServiceRoles(username)[service]; 
    console.log("service",service);
    console.log("roles",getServiceRoles(username));
    

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