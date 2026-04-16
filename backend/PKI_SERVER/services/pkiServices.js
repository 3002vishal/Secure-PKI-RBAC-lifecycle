const forge = require("node-forge");
const fs = require("fs");
const { execSync } = require("child_process");
const {INTERMEDIATE_DIR, ROOT_CA_PEM, INT_CA_PEM, CRL_PATH , CERT_DIR,CHAIN_PATH,INTERMEDIATE_CA_PATH,ROOT_CA_PATH} = require("../config/certConfig");
const path  = require('path');





/**
 * @param {string} certPem - The PEM text of the user certificate
 * @param {string} intCaPath - The FILE PATH to your intermediate CA (e.g., 'backend/demoCA/intermediate/int.cert.pem')
 * @param {string} chainPath - The FILE PATH to your chain (e.g., 'backend/demoCA/intermediate/chain.pem')
 */
function isCertificateRevoked(certPem, intCaPath, chainPath) {
  try {
    const forgeCert = forge.pki.certificateFromPem(certPem);
    // Get the raw serial number
    const serialNumber = forgeCert.serialNumber; 
    
    // 1. Get all files in the newcerts directory
    const newcertsDir = path.resolve(INTERMEDIATE_DIR, "newcerts");
    const files = fs.readdirSync(newcertsDir);

    // 2. Find the file that matches the serial number (case-insensitive)
    // This matches "101d.pem", "101D.PEM", or "101D.pem"
    const matchedFile = files.find(file => 
      file.toLowerCase() === `${serialNumber.toLowerCase()}.pem`
    );

    if (!matchedFile) {
      console.error(`Cert file not found for serial: ${serialNumber} in ${newcertsDir}`);
      return true; // Fail-closed
    }

    const existingCertPath = path.join(newcertsDir, matchedFile);
    console.log(`Checking OCSP for existing file: ${existingCertPath}`);

    // 3. Ensure your CA paths are valid (not undefined)
    const issuer = intCaPath || INTERMEDIATE_CA_PATH;
    const chain = chainPath || CHAIN_PATH;

    if (!issuer || issuer === "undefined") {
        throw new Error("Issuer path is missing or undefined");
    }

    // 4. Run the command
    const ocspCommand = `openssl ocsp -issuer "${issuer}" -cert "${existingCertPath}" -url http://127.0.0.1:8888 -CAfile "${chain}" -no_nonce`;
    
    const output = execSync(ocspCommand).toString();
    console.log("OCSP Response:", output.trim());

    return !output.toLowerCase().includes(": good");

  } catch (err) {
    if (err.stdout && err.stdout.toString().toLowerCase().includes(": revoked")) {
        console.log("OCSP confirmed: Certificate is REVOKED");
        return true;
    }
    console.error("OCSP Check Error:", err.message);
    return true; 
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


function  getFullUserDetails(username) {
    try {
        const certPath = path.join(CERT_DIR, `${username}_cert.pem`);
        console.log(certPath);
        if (!fs.existsSync(certPath)) return null;

        const certPem = fs.readFileSync(certPath, "utf8");
        const cert = forge.pki.certificateFromPem(certPem);

        // 1. Helper to get Subject fields by ShortName
        const getSubjectField = (shortName) => {
            const field = cert.subject.getField(shortName);
            return field ? field.value : "";
        };

        // 2. Extract Identity Details
        const details = {
            username: username, // CN
            email: getSubjectField('E') || getSubjectField('emailAddress'),
            orgUnit: getSubjectField('OU'),
            org: getSubjectField('O'),
            state: getSubjectField('ST'),
            country: getSubjectField('C') || "IN",
            serviceRoles: {} // Default empty
        };

        // 3. Extract Custom Extension (Roles)
        // Note: Using your specific OID 1.2.3.4.5.6.7.8.1
        const roleExt = cert.extensions.find((ext) => ext.id === "1.2.3.4.5.6.7.8.1");
        
        if (roleExt && roleExt.value) {
            // Forge encodes the value in ASN.1. 
            // We use your regex to find the JSON structure inside the raw data.
            const raw = roleExt.value.toString("utf8");
            const jsonMatch = raw.match(/\{.*\}/);
            
            if (jsonMatch) {
                try {
                    details.serviceRoles = JSON.parse(jsonMatch[0]);
                } catch (e) {
                    console.error("Failed to parse roles JSON from cert");
                }
            }
        }

        return details;
    } catch (err) {
        console.error("Extraction Error:", err);
        return null;
    }
};

console.log(getFullUserDetails("user6"));


module.exports = { isCertificateRevoked , verifyCertificateChain ,getUserDetails, getFullUserDetails};