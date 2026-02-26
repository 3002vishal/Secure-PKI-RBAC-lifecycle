const forge = require("node-forge");
const fs = require("fs");
const path = require("path");
const { CERT_DIR } = require("../config/certConfig");

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

module.exports = { getServiceRoles };