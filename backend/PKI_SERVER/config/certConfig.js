const path = require("path");
const fs = require("fs");

const CERT_DIR = path.join(__dirname ,"../../cert");
const OPENSSL_DIR = path.join(__dirname,"../../openssl.cnf")
const INTERMEDIATE_DIR = path.join(__dirname, "../../demoCA/intermediate");
const CRL_PATH = path.join(INTERMEDIATE_DIR, "intermediate.crl");

if(!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, {recursive: true});

const ROOT_CA_PEM = fs.readFileSync(path.join(__dirname , "../../demoCA/root/ca.cert.pem"), "utf-8");
const INT_CA_PEM = fs.readFileSync(path.join(INTERMEDIATE_DIR,"int.cert.pem"), "utf-8");

// console.log("cert_dir:", CERT_DIR,"\n");
// console.log("intermediate_dir:", INTERMEDIATE_DIR, "\n");
// console.log("crl_path:", CRL_PATH, "\n");
// console.log("root_ca_pem:", ROOT_CA_PEM, "\n");
// console.log("int_ca_pem:", INT_CA_PEM, "\n");

module.exports = {CERT_DIR, INTERMEDIATE_DIR, CRL_PATH, ROOT_CA_PEM, INT_CA_PEM,OPENSSL_DIR}