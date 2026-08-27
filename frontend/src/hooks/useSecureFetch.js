// src/hooks/useSecureFetch.js

import { useState, useCallback } from 'react';

export const useSecureFetch = (username) => {

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const secureFetch = useCallback(
    async (endpoint, payload = {}) => {

      if (!username) {
        setError("No username provided for secure fetch.");
        return null;
      }

      setLoading(true);
      setError(null);

      try {

        // =========================================================
        // STEP 1: GET CHALLENGE
        // =========================================================

        console.log(
          `[SecureFetch] Requesting challenge for ${username}...`
        );

        const challengeUrl =
          `http://localhost:5000/auth/challenge/${encodeURIComponent(username)}`;

        const challengeRes = await fetch(challengeUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!challengeRes.ok) {
          throw new Error(
            `Could not fetch challenge. HTTP ${challengeRes.status}`
          );
        }

        const challengeData = await challengeRes.json();

        const challenge = challengeData.challenge;

        if (!challenge) {
          throw new Error(
            "Challenge was not returned by the authentication server."
          );
        }

        console.log(
          "[SecureFetch] Challenge received:",
          challenge
        );


        // =========================================================
        // STEP 2: SIGN CHALLENGE USING SPRING BOOT PKCS#11 BRIDGE
        // =========================================================

        console.log(
          "[SecureFetch] Signing challenge via PKCS#11 bridge..."
        );

        /*
         * Your Spring Boot controller is:
         *
         * @PostMapping("/sign-challenge")
         * public ResponseEntity<?> signChallenge(
         *     @RequestParam String alias,
         *     @RequestParam String challenge
         * )
         *
         * Therefore we MUST send alias and challenge
         * as URL query parameters.
         */

        const signUrl =
          `http://localhost:8080/api/sign-challenge` +
          `?alias=${encodeURIComponent(username)}` +
          `&challenge=${encodeURIComponent(challenge)}`;

        console.log(
          "[SecureFetch] Sign API:",
          signUrl
        );

        let signRes;

        try {

          signRes = await fetch(signUrl, {
            method: 'POST',
            headers: {
              'Accept': 'application/json'
            }
          });

        } catch (e) {

          console.error(
            "[SecureFetch] Could not connect to Spring Boot:",
            e
          );

          throw new Error(
            "PKCS#11 bridge server is not running. Please start the Spring Boot application."
          );
        }


        // =========================================================
        // STEP 2.1: READ SIGN RESPONSE
        // =========================================================

        const signContentType =
          signRes.headers.get("content-type");

        let signData;

        if (
          signContentType &&
          signContentType.includes("application/json")
        ) {

          signData = await signRes.json();

        } else {

          const text = await signRes.text();

          throw new Error(
            text ||
            `Signing API returned HTTP ${signRes.status}`
          );
        }


        console.log(
          "[SecureFetch] Sign API response:",
          signData
        );


        // =========================================================
        // STEP 2.2: HANDLE SIGNING ERROR
        // =========================================================

        /*
         * Your Spring Boot response is:
         *
         * {
         *     "success": true,
         *     "alias": "...",
         *     "challenge": "...",
         *     "signature": "..."
         * }
         *
         * Therefore check:
         *
         * signData.success !== true
         *
         * NOT:
         *
         * signData.status !== 'success'
         */

        if (!signRes.ok || signData.success !== true) {

          const rawError =
            signData.error ||
            "Hardware signing failed.";

          console.error(
            "[SecureFetch] Signing failed:",
            rawError
          );

          // Detect missing private key
          const isKeyMissing =
            rawError.includes("Keyset does not exist") ||
            rawError.includes("keyset is not defined") ||
            rawError.includes("No_Private_Key_Found") ||
            rawError.includes("null-valued expression") ||
            rawError.includes("Certificate disappeared") ||
            rawError.includes("Private key") ||
            rawError.includes("private key");

          if (isKeyMissing) {

            throw new Error(
              "Private key not found corresponding to this certificate."
            );

          } else {

            throw new Error(
              `Hardware signing failed: ${rawError}`
            );
          }
        }


        // =========================================================
        // STEP 2.3: GET SIGNATURE
        // =========================================================

        const signature = signData.signature;

        if (!signature) {

          throw new Error(
            "Signing API did not return a signature."
          );
        }

        console.log(
          "[SecureFetch] Challenge signed successfully."
        );


        // =========================================================
        // STEP 3: CALL ACTUAL BACKEND API
        // =========================================================

        console.log(
          `[SecureFetch] Sending authenticated request to ${endpoint}...`
        );


        const finalBody = {

          username: username,

          signature: signature,

          ...payload

        };


        console.log(
          "[SecureFetch] Final request body:",
          finalBody
        );


        const apiUrl =
          `http://localhost:5000${endpoint}`;


        const apiRes = await fetch(apiUrl, {

          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },

          body: JSON.stringify(finalBody)

        });


        // =========================================================
        // STEP 3.1: HANDLE BACKEND ERROR
        // =========================================================

        if (!apiRes.ok) {

          const contentType =
            apiRes.headers.get("content-type");

          if (
            contentType &&
            contentType.includes("application/json")
          ) {

            const errData =
              await apiRes.json();

            throw new Error(
              errData.error ||
              errData.message ||
              `API Request Denied with HTTP ${apiRes.status}`
            );

          } else {

            const errText =
              await apiRes.text();

            throw new Error(
              errText ||
              `API Request Denied with HTTP ${apiRes.status}`
            );
          }
        }


        // =========================================================
        // STEP 3.2: READ FINAL API RESPONSE
        // =========================================================

        const contentType =
          apiRes.headers.get("content-type");

        let responseData;

        if (
          contentType &&
          contentType.includes("application/json")
        ) {

          responseData =
            await apiRes.json();

        } else {

          responseData =
            await apiRes.text();
        }


        console.log(
          "[SecureFetch] Request execution completed successfully."
        );

        console.log(
          "[SecureFetch] Final API response:",
          responseData
        );


        return responseData;


      } catch (err) {

        console.error(
          "[SecureFetch Error]",
          err
        );

        setError(err.message);

        return null;


      } finally {

        setLoading(false);

      }

    },
    [username]
  );


  return {
    secureFetch,
    loading,
    error
  };
};