const forge = require("node-forge");
const fs = require("fs");
const { execSync } = require("child_process");
const { ROOT_CA_PEM, INT_CA_PEM, CRL_PATH } = require("../config/certConfig");

function isCertificateRevoked(certPem) {
  try {
    const userCert = forge.pki.certificateFromPem(certPem);
    const serialNumber = userCert.serialNumber.toLowerCase();


    if (!fs.existsSync(CRL_PATH)) return false;

    //console.log("crl_path", CRL_PATH);

    const revokedSerials = execSync(`openssl crl -inform PEM -in "${CRL_PATH}" -text -noout`)
      .toString()
      .toLowerCase();
      //console.log("revoked_serial ", revokedSerials);

    return revokedSerials.includes(serialNumber);
  } catch (err) {
    console.error("CRL Check Failed:", err.message);
    return true; // Fail-closed
  }
}

function verifyCertificateChain(certPem) {
  try {
    const userCert = forge.pki.certificateFromPem(certPem);
    const rootCert = forge.pki.certificateFromPem(ROOT_CA_PEM);
    const intCert = forge.pki.certificateFromPem(INT_CA_PEM);

    const now = new Date();
    if (now < userCert.validity.notBefore || now > userCert.validity.notAfter) {
      throw new Error("Certificate expired or not yet valid");
    }
    console.log("1");

    if (isCertificateRevoked(certPem)) {
      throw new Error("CERTIFICATE REVOKED: Access denied by Administrator");
    }
    console.log("2");

    const caStore = forge.pki.createCaStore([rootCert, intCert]);
    forge.pki.verifyCertificateChain(caStore, [userCert]);
    console.log("3");

    return {
      isValid : true, 
      message: "Success: Certificate is valid"
    };
  } catch (err) {

    console.error("Certificate verification failed:", err.message);
    return {
      isValid: false, 
      message: err.message
    }
  }
}


/**
 * Reads the OpenSSL index.txt file and returns a parsed list of certificates
 */
 function getUserDetails(indexPath)  {
    if (!fs.existsSync(indexPath)) throw new Error("Index file not found");

    const fileContent = fs.readFileSync(indexPath, "utf8");
    return fileContent.split("\n")
        .filter(line => line.trim() !== "")
        .map(line => {
            const parts = line.split("\t");
            const dn = parts[5] || "";
            const cnMatch = dn.match(/CN=([^/,\s]+)/);

            return {
                status: parts[0] === 'V' ? 'Valid' : parts[0] === 'R' ? 'Revoked' : 'Expired',
                expiration: parts[1],
                revocationDate: parts[2] !== '' ? parts[2] : null,
                serial: parts[3],
                username: cnMatch ? cnMatch[1] : "Unknown"
            };
        });
};

module.exports = { isCertificateRevoked , verifyCertificateChain ,getUserDetails};