const express = require('express');
const { spawn } = require('child_process');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = 8000;

// ==========================================
// 1. POWERSHELL SCRIPTS (Logic)
// ==========================================

// --- SCRIPT A: SIGNUP (Enrollment) ---
// CHANGE: Switched to 'repairstore' to forcefully fix broken links
const SIGNUP_SCRIPT = `
param(
    [Parameter(Mandatory=$true)] [string]$username,
    [Parameter(Mandatory=$true)] [string]$serviceRoles, 
    [Parameter(Mandatory=$true)] [string]$email,
    [Parameter(Mandatory=$true)] [string]$orgUnit,
    [Parameter(Mandatory=$true)] [string]$org,
    [Parameter(Mandatory=$true)] [string]$state,
    [Parameter(Mandatory=$true)] [string]$country
)

$serverUrl = "http://localhost:5000"
$infFileName = "$username.inf"
$csrFileName = "$username.req"
$responseFileName = "$username.cer"

function Output-Json($status, $msg, $data = $null) {
    $obj = @{ status = $status; message = $msg; data = $data }
    Write-Output ($obj | ConvertTo-Json -Compress)
}

try {
    try { $testJson = $serviceRoles | ConvertFrom-Json } catch { throw "Invalid JSON roles" }

    Write-Host "[CLIENT] 1. Creating INF configuration..." -ForegroundColor Cyan

    # We explicitly name the container as the username. 
    # We will rely on this specific name in the Login script if the link breaks.
    $infContent = @"
[NewRequest]
Subject = "CN=$username, E=$email, OU=$orgUnit, O=$org, S=$state, C=$country"
KeyLength = 2048
KeySpec = 2 
KeyUsage = 0xA0 
MachineKeySet = FALSE
Exportable = FALSE 
RequestType = PKCS10
SMIME = FALSE
ProviderName = "SafeSign Standard Cryptographic Service Provider"
ProviderType = 1
KeyContainer = "$username"
[EnhancedKeyUsageExtension]
OID=1.3.6.1.5.5.7.3.2 
"@

    $infContent | Out-File -FilePath $infFileName -Encoding ASCII

    Write-Host "[CLIENT] 2. Generating Keys & CSR..." -ForegroundColor Cyan
    certreq -new -q $infFileName $csrFileName

    if (-not (Test-Path $csrFileName)) { throw "Failed to generate CSR." }
    $csrContent = [System.IO.File]::ReadAllText("$PWD\\$csrFileName")

    Write-Host "[CLIENT] 3. Sending CSR to Backend..." -ForegroundColor Cyan

    $payload = @{
        username     = $username
        csr          = $csrContent
        serviceRoles = $serviceRoles
        email        = $email
    } | ConvertTo-Json -Depth 10

    $response = Invoke-RestMethod -Uri "$serverUrl/api/enroll" -Method Post -Body $payload -ContentType "application/json"

    if ($response.success) {
        Write-Host "[CLIENT] Certificate Signed!" -ForegroundColor Green

        $certContent = $response.certificate
        $certContent | Out-File -FilePath $responseFileName -Encoding ASCII

        Write-Host "[CLIENT] 4. Binding Certificate to Token..." -ForegroundColor Cyan
        certreq -accept -q $responseFileName

        # --- FIX: REPAIR STORE ---
        # verify just checks, 'repairstore' actually fixes the null link
        $tempCert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($responseFileName)
        $thumbprint = $tempCert.Thumbprint
        
        Write-Host "[CLIENT] Repairing Key Link for $thumbprint..." -ForegroundColor Yellow
        
        # -csp argument ensures we look in the right driver
        $null = certutil -user -silent -repairstore -csp "SafeSign Standard Cryptographic Service Provider" My $thumbprint

        Start-Sleep -Seconds 1
        # -------------------------

        Remove-Item $infFileName, $csrFileName, $responseFileName -ErrorAction SilentlyContinue
        Output-Json "success" "Certificate installed successfully" $certContent
    }
    else {
        throw "Server Error: $($response.error)"
    }
}
catch {
    $errorMsg = $_.Exception.Message
    Write-Host "ERROR: $errorMsg" -ForegroundColor Red
    Output-Json "error" $errorMsg
    exit 1
}
`;

// --- SCRIPT B: SIGN (Login) ---
// CHANGE: Added "Manual Override" to reconstruct the key link if Windows returns null
const SIGN_SCRIPT = `
param(
    [string]$ChallengeData
)

Add-Type -AssemblyName System.Security

$maxRetries = 4
$attempt = 0
$signatureBase64 = $null
$lastError = ""

while ($attempt -lt $maxRetries -and $null -eq $signatureBase64) {
    $attempt++
    
    try {
        $store = New-Object System.Security.Cryptography.X509Certificates.X509Store("My", "CurrentUser")
        $store.Open("ReadOnly")
        
        $certs = $store.Certificates.Find("FindByTimeValid", [DateTime]::Now, $false)
        
        if ($attempt -eq 1) {
            $selection = [System.Security.Cryptography.X509Certificates.X509Certificate2UI]::SelectFromCollection(
                $certs, "Select Token", "Pick your hardware certificate", "SingleSelection"
            )
            if ($selection.Count -eq 0) { Write-Output "ERROR:User_Cancelled"; exit }
            $targetThumbprint = $selection[0].Thumbprint
            $cert = $selection[0]
        } else {
            $found = $store.Certificates.Find("FindByThumbprint", $targetThumbprint, $false)
            if ($found.Count -eq 0) { throw "Certificate disappeared" }
            $cert = $found[0]
        }

        $dataBytes = [System.Text.Encoding]::UTF8.GetBytes($ChallengeData)
        $signatureBytes = $null
        $errDetails = ""

        # --- ATTEMPT 1: Standard Access (Might be NULL) ---
        try {
            if ($cert.HasPrivateKey) {
                $rsaLegacy = [System.Security.Cryptography.RSACryptoServiceProvider]$cert.PrivateKey
                $signatureBytes = $rsaLegacy.SignData($dataBytes, "SHA256")
            }
        } catch { $errDetails += "[Standard Failed: $($_.Exception.Message)] " }

        # --- ATTEMPT 2: MANUAL OVERRIDE (The Fix) ---
        # If standard access failed or key was null, we manually open the container
        # using the CN (Username) from the cert subject.
        if ($null -eq $signatureBytes) {
            try {
                # Extract CN from Subject "CN=vishal, O=..."
                $subject = $cert.Subject
                $cnMatch = $subject -match "CN=([^,]+)"
                if ($matches[1]) {
                    $containerName = $matches[1] # This is "vishal"
                    
                    # Manually build the CSP connection
                    $cspParams = New-Object System.Security.Cryptography.CspParameters
                    $cspParams.ProviderName = "SafeSign Standard Cryptographic Service Provider"
                    $cspParams.ProviderType = 1
                    $cspParams.KeyContainerName = $containerName
                    $cspParams.Flags = [System.Security.Cryptography.CspProviderFlags]::UseExistingKey

                    $rsaManual = New-Object System.Security.Cryptography.RSACryptoServiceProvider($cspParams)
                    $signatureBytes = $rsaManual.SignData($dataBytes, "SHA256")
                }
            } catch {
                $errDetails += "[Manual Override Failed: $($_.Exception.Message)]"
            }
        }

        if ($signatureBytes) {
            $signatureBase64 = [Convert]::ToBase64String($signatureBytes)
        } else {
            throw "All providers failed. $errDetails"
        }
        
        $store.Close()

    } catch {
        $lastError = $_.Exception.Message
        
        if ($lastError -match "Keyset does not exist" -or $lastError -match "Keyset is not defined" -or $lastError -match "The parameter is incorrect") {
             Write-Host "Token busy ($attempt/$maxRetries). Retrying..." -ForegroundColor Yellow
             if ($cert) { $cert.Reset() }
             if ($store) { $store.Close() }
             [System.GC]::Collect()
             Start-Sleep -Seconds 1
        } else {
             break 
        }
    }
}

if ($signatureBase64) {
    Write-Output $signatureBase64
} else {
    Write-Output "ERROR:Signing_Failed"
    Write-Output "Details: $lastError"
    exit 1
}
`;

function getScriptPath(scriptName) {
    let content = "";
    if (scriptName === 'signup.ps1') content = SIGNUP_SCRIPT;
    else if (scriptName === 'sign.ps1') content = SIGN_SCRIPT;
    else throw new Error("Unknown script requested");

    const tempPath = path.join(os.tmpdir(), `hsm-${scriptName}`);
    try { fs.writeFileSync(tempPath, content); } catch (e) {}
    return tempPath;
}

app.post('/sign-challenge', (req, res) => {
    const challenge = req.body.challenge;
    if (!challenge) return res.status(400).json({ error: "No challenge provided" });

    console.log(`[SIGN] Launching Hardware Signer...`);

    try {
        const scriptPath = getScriptPath('sign.ps1');
        const ps = spawn('powershell.exe', [
            '-NoProfile', '-ExecutionPolicy', 'Bypass', 
            '-File', scriptPath,
            '-ChallengeData', challenge
        ]);

        let signature = "";
        let errorLog = "";

        ps.stdout.on('data', (data) => { signature += data.toString().trim(); });
        ps.stderr.on('data', (data) => { errorLog += data.toString(); console.error(data.toString()); });
        
        ps.on('close', (code) => {
            if (code !== 0 || signature.includes("ERROR:") || signature.includes("Signing_Failed")) {
                console.error("[SIGN] Failed");
                const details = signature.includes("Details:") ? signature.split("Details:")[1] : errorLog || signature;
                return res.status(500).json({ error: "Signing Failed", details: details.trim() });
            }
            res.json({ status: "success", signature: signature });
        });
    } catch (e) {
        res.status(500).json({ error: "Internal Error", details: e.message });
    }
});

app.post('/signup', (req, res) => {
    const { username, serviceRoles, email, orgUnit, org, state, country } = req.body;

    if (!username || !serviceRoles || !email || !orgUnit || !org || !state || !country) {
        return res.status(400).json({ status: "error", message: "Missing fields." });
    }

    console.log(`[ENROLL] Starting enrollment for ${username}...`);
    
    try {
        const scriptPath = getScriptPath('signup.ps1');
        console.log(0);
        const serviceRolesString = JSON.stringify(serviceRoles);
         console.log("1");
        const ps = spawn('powershell.exe', [
            '-NoProfile', '-ExecutionPolicy', 'Bypass', 
            '-File', scriptPath,
            '-username', username, 
            '-serviceRoles', serviceRolesString, 
            '-email', email,
            '-orgUnit', orgUnit,
            '-org', org,
            '-state', state,
            '-country', country
        ]);
        console.log(2);

        let scriptOutput = "";
        
        ps.stdout.on('data', (data) => { 
            const msg = data.toString();
            console.log(msg);
            scriptOutput += msg; 
        });

        ps.stderr.on('data', (data) => { 
            const msg = data.toString();
            console.error(msg); 
            scriptOutput += msg; 
        });

        ps.on('close', (code) => {
            try {
                const jsonStartIndex = scriptOutput.indexOf('{');
                if (jsonStartIndex === -1) throw new Error("No JSON found in output");
                const cleanJsonString = scriptOutput.substring(jsonStartIndex);
                const parsedResult = JSON.parse(cleanJsonString);
                
                if(parsedResult.status === 'error') {
                    res.status(500).json(parsedResult);
                } else {
                    res.json(parsedResult);
                }
            } catch (e) {
                console.error("[ENROLL] Parse Error:", e.message);
                res.status(500).json({ status: "error", message: "Bridge parse failure", details: scriptOutput });
            }
        });
    } catch (e) {
        res.status(500).json({ status: "error", message: "Execution failure", details: e.message });
    }
});

app.get('/health', (req, res) => res.json({ status: "online" }));

process.on('uncaughtException', (err) => {
    console.error("CRITICAL ERROR:", err.message);
    process.stdin.resume();
});

app.listen(PORT, () => {
    console.log(`HSM Bridge running on http://localhost:${PORT}`);
});