const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { CERT_DIR, INTERMEDIATE_DIR } = require("../config/certConfig")
const { getServiceRoles } = require("../services/roleServices");
let { challenges } = require("../middleware/authMiddleware");

exports.getChallenge = (req, res) => {
  const challenge = crypto.randomBytes(32).toString("base64");
  challenges[req.params.user] = challenge;
  res.json({ challenge });
};

exports.login = (req, res) => {
  const { username, signature } = req.body;
  const challenge = challenges[username];

  if (!username || !signature || !challenge) return res.status(400).json({ error: "Invalid request" });

  const certPath = path.join(CERT_DIR, `${username}_cert.pem`);
  if (!fs.existsSync(certPath)) return res.status(404).json({ error: "Certificate not found" });

  try {
    const certPem = fs.readFileSync(certPath, "utf8");
    const publicKey = crypto.createPublicKey(certPem);
    const valid = crypto.verify("sha256", Buffer.from(challenge), publicKey, Buffer.from(signature, "base64"));

    if (!valid) return res.status(403).json({ error: "Invalid signature" });

    delete challenges[username];
    res.json({ success: true, user: username, roles: getServiceRoles(username) });
  } catch (err) {
    console.log("error happened");
    return res.status(403).json({ error: err.message });
  }
};