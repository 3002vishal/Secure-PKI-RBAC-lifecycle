// src/hooks/useSecureFetch.js
import { useState, useCallback } from 'react';

export const useSecureFetch = (username) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const secureFetch = useCallback(async (endpoint, payload = {}) => {
    if (!username) {
      setError("No username provided for secure fetch.");
      return null;
    }

    setLoading(true);
    setError(null);
    
    try {
      // ------------------------------------------------
      // STEP 1: Get Challenge
      // ------------------------------------------------
      console.log(`[SecureFetch] Requesting challenge for ${username}...`);
      const challengeRes = await fetch(`http://localhost:5000/auth/challenge/${username}`);
      if (!challengeRes.ok) throw new Error("Could not fetch challenge from server.");
      
      const { challenge } = await challengeRes.json();
      
      // ------------------------------------------------
      // STEP 2: Sign Challenge (Bridge)
      // ------------------------------------------------
      console.log("[SecureFetch] Signing challenge via Bridge...");
      
      let signRes;
      try {
        signRes = await fetch('http://localhost:8000/sign-challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challenge })
        });
      } catch (e) {
        throw new Error("your bridge server is not running. Please start hsm-bridge.exe");
      }

      const signData = await signRes.json();

      // --- ERROR HANDLING LOGIC STARTS HERE ---
      if (signRes.status !== 200 || signData.status !== 'success') {
        const rawError = signData.details || signData.error || "";

        // Detect specific "Missing Key" errors from Windows/PowerShell
        const isKeyMissing = 
          rawError.includes("Keyset does not exist") ||
          rawError.includes("keyset is not defined") ||
          rawError.includes("No_Private_Key_Found") ||
          rawError.includes("null-valued expression") || // The specific error you saw earlier
          rawError.includes("Certificate disappeared");

        if (isKeyMissing) {
          throw new Error(" Private Key not found corresponding your  certificate.");
        } else {
          throw new Error(`Hardware Sign Failed: ${rawError}`);
        }
      }
      // ----------------------------------------

      const signature = signData.signature;

      // ------------------------------------------------
      // STEP 3: Actual API Call with Signature
      // ------------------------------------------------
      console.log(`[SecureFetch] Sending authenticated request to ${endpoint}...`);
      
      const finalBody = {
        username,
        signature,
        ...payload 
      };

      const apiRes = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalBody)
      });

      const data = await apiRes.json();

      if (!apiRes.ok) {
        throw new Error(data.error || "API Request Denied.");
      }

      return data;

    } catch (err) {
      console.error("[SecureFetch Error]", err);
      // We set the user-friendly error message we generated above
      setError(err.message);
      return null; // Return null so the component knows it failed
    } finally {
      setLoading(false);
    }
  }, [username]);

  return { secureFetch, loading, error };
};