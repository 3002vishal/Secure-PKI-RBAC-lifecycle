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
const MODIFY_ALL_SCRIPT = `
param(
    [string]$username, [string]$serviceRoles, [string]$email,
    [string]$orgUnit, [string]$org, [string]$state, [string]$country
)

$serverUrl = "http://localhost:5000"
$workDir = $env:TEMP
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$infFileName = Join-Path $workDir "$username-$timestamp.inf"
$csrFileName = Join-Path $workDir "$username-$timestamp.req"
$responseFileName = Join-Path $workDir "$username-$timestamp.cer"
$logFile = Join-Path $env:TEMP "hsm-modify-debug.log"

function Log($msg) {
    $ts = Get-Date -Format "HH:mm:ss"
    "[$ts] $msg" | Out-File $logFile -Append
    Write-Host "[LOG] $msg" 
}

try {
    # --- STEP 1: DELETE OLD CERTIFICATE ---
    Log "Step 1: Searching for old certificates for $username..."
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store("My", "CurrentUser")
    $store.Open("ReadWrite")
    $oldCerts = $store.Certificates | Where-Object { $_.Subject -match "CN=$username" }
    
    foreach ($cert in $oldCerts) {
        Log "Removing old certificate: $($cert.Thumbprint)"
        $store.Remove($cert)
    }
    $store.Close()

    # --- STEP 2: CREATE NEW INF ---
    Log "Step 2: Creating INF with unique container: $username-$timestamp"
    $infContent = @"
[NewRequest]
Subject = "CN=$username, E=$email, OU=$orgUnit, O=$org, S=$state, C=$country"
KeyLength = 2048
KeySpec = 2 
MachineKeySet = FALSE
RequestType = PKCS10
ProviderName = "SafeSign Standard Cryptographic Service Provider"
ProviderType = 1
KeyContainer = "$username-$timestamp"
[EnhancedKeyUsageExtension]
OID=1.3.6.1.5.5.7.3.2 
"@
    $infContent | Out-File -FilePath $infFileName -Encoding ASCII -Force

    # --- STEP 3: GENERATE CSR ---
    Log "Step 3: Generating new Keys & CSR..."
    $certOutput = certreq -new -user -q $infFileName $csrFileName 2>&1
    if (-not (Test-Path $csrFileName)) {
        throw "CSR Generation Failed. Error: $certOutput"
    }
    $csrContent = [System.IO.File]::ReadAllText($csrFileName)

    # --- STEP 4: SEND TO BACKEND ---
    Log "Step 4: Sending CSR to Backend for signing..."
    $payload = @{
        username     = $username
        csr          = $csrContent
        serviceRoles = $serviceRoles
        email        = $email
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$serverUrl/api/modify" -Method Post -Body $payload -ContentType "application/json"

    if ($response.success) {
        # --- STEP 5: INSTALL NEW CERT ---
        Log "Step 5: Saving and Accepting new certificate..."
        $response.certificate | Out-File -FilePath $responseFileName -Encoding ASCII -Force
        certreq -accept -user -q $responseFileName

        # --- STEP 6: REPAIR KEY LINK ---
        Log "Step 6: Repairing link to HSM..."
        $tempCert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($responseFileName)
        $thumbprint = $tempCert.Thumbprint
        certutil -user -silent -repairstore -csp "SafeSign Standard Cryptographic Service Provider" My $thumbprint

        # Cleanup
        Remove-Item $infFileName, $csrFileName, $responseFileName -ErrorAction SilentlyContinue
        
        Log "SUCCESS: Identity updated."
        @{ status = "success"; message = "Identity updated and old certs removed"; data = $response.certificate } | ConvertTo-Json -Compress
    } else {
        throw "Backend Error: $($response.error)"
    }
}
catch {
    Log "CRITICAL ERROR: $($_.Exception.Message)"
    @{ status = "error"; message = $_.Exception.Message } | ConvertTo-Json -Compress
    exit 1
}
`;

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
    $timestamp = Get-Date -Format "yyyyMMddHHmss"
    $uniqueContainer = "$username-$timestamp"
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
KeyContainer = "$uniqueContainer"
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
    else if(scriptName === 'modify.ps1') content = MODIFY_ALL_SCRIPT;
    else throw new Error("Unknown script requested");

    const tempPath = path.join(os.tmpdir(), `hsm-${scriptName}`);
    try { fs.writeFileSync(tempPath, content); } catch (e) { }
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

                if (parsedResult.status === 'error') {
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

app.post('/modify', (req, res) => {
    const { username, serviceRoles, email, orgUnit, org, state, country } = req.body;

    console.log(`\n--- [MODIFY REQUEST] User: ${username} ---`);

    try {
        const scriptPath = getScriptPath('modify.ps1');
        const serviceRolesString = JSON.stringify(serviceRoles);

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

        let scriptOutput = "";
        let errorOutput = "";

        ps.stdout.on('data', (data) => {
            const out = data.toString();
            console.log(`[PS-STDOUT]: ${out}`);
            scriptOutput += out;
        });

        ps.stderr.on('data', (data) => {
            const err = data.toString();
            console.error(`[PS-STDERR]: ${err}`); // This captures system-level PS errors
            errorOutput += err;
        });

        ps.on('close', (code) => {
            console.log(`[PROCESS CLOSE] Code: ${code}`);
            
            try {
                const jsonStartIndex = scriptOutput.indexOf('{');
                if (jsonStartIndex === -1) {
                    return res.status(500).json({ 
                        status: "error", 
                        message: "No JSON response from script", 
                        rawOutput: scriptOutput,
                        systemError: errorOutput 
                    });
                }

                const parsedResult = JSON.parse(scriptOutput.substring(jsonStartIndex));
                res.status(parsedResult.status === 'error' ? 500 : 200).json(parsedResult);
            } catch (e) {
                res.status(500).json({ 
                    status: "error", 
                    message: "Bridge parse failure", 
                    details: scriptOutput,
                    error: e.message 
                });
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