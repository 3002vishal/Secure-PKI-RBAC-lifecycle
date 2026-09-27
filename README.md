# Secure PKI RBAC Lifecycle

A full-stack proof of concept for **certificate-based authentication and role-based access control (RBAC)** using PKI, cryptographic tokens, and challenge-response authentication.

## Why this project

Traditional web applications often rely only on bearer tokens. This project explores a stronger authentication model in which access is tied to possession of a private key and its corresponding X.509 certificate.

## Architecture

```text
React UI
   |
   v
Local HSM / Token Bridge (Node.js + PKCS#11 integration)
   |
   v
PKI Server / Authentication APIs
   |
   +--> X.509 certificate validation
   +--> Challenge-response signature verification
   +--> Role extraction / authorization
   +--> OCSP / certificate lifecycle checks
```

## Highlights

- Certificate-based login using challenge-response signatures
- Private-key operations delegated to a connected cryptographic token
- Role-based authorization for protected application services
- React frontend with Material UI
- Local bridge service built with Node.js / Express
- PKI utilities using OpenSSL, PKI.js, node-forge and ASN.1 tooling
- OCSP-related certificate status handling
- Support code for token discovery and PKCS#11 interaction

## Tech Stack

**Frontend:** React, Material UI, Axios, React Router  
**Backend / Bridge:** Node.js, Express, MySQL  
**Security:** PKI, X.509, PKCS#11, OpenSSL, OCSP, challenge-response authentication  
**Native integration:** C/C++

## Security Notes

Private keys and keystores must never be committed to source control. Demo key material previously used for local testing has been removed from the active branch and ignore rules have been added.

For any real deployment:
- generate fresh keys locally or inside an HSM/token,
- use environment variables or a secrets manager,
- rotate any credential that has ever been committed,
- protect CA private keys offline or in an HSM.

## Status

This repository is an engineering prototype focused on PKI-backed Zero Trust / RBAC concepts and cryptographic-token integration.
