import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

const TokenContext = createContext(null);

const API_BASE = "http://localhost:8080/api";

export const TokenProvider = ({ children }) => {
  // --------------------------------------------------
  // SELECTED TOKEN
  // --------------------------------------------------

  const [selectedToken, setSelectedToken] = useState(() => {
    try {
      const savedToken = localStorage.getItem("selectedToken");

      return savedToken
        ? JSON.parse(savedToken)
        : null;
    } catch (error) {
      console.error(
        "Failed to load selected token:",
        error
      );

      return null;
    }
  });


  // --------------------------------------------------
  // TOKEN PIN
  // --------------------------------------------------
  //
  // IMPORTANT:
  // PIN is kept ONLY in React memory.
  //
  // It is NOT stored in localStorage.
  //
  // It will be cleared when the token is disconnected.
  // --------------------------------------------------

  const [tokenPin, setTokenPin] = useState("");


  // --------------------------------------------------
  // PERSIST SELECTED TOKEN
  // --------------------------------------------------

  useEffect(() => {

    if (selectedToken) {

      localStorage.setItem(
        "selectedToken",
        JSON.stringify(selectedToken)
      );

    } else {

      localStorage.removeItem(
        "selectedToken"
      );

    }

  }, [selectedToken]);


  // --------------------------------------------------
  // SELECT / LOGIN TOKEN
  // --------------------------------------------------

  const selectToken = async (
    token,
    pin
  ) => {

    // ------------------------------------------------
    // VALIDATE PIN
    // ------------------------------------------------

    if (
      !pin ||
      typeof pin !== "string" ||
      !pin.trim()
    ) {

      return {
        success: false,
        error: "PIN is required",
      };

    }


    try {

      // ------------------------------------------------
      // LOGIN API
      // ------------------------------------------------

      const response = await fetch(
        `${API_BASE}/login`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({

            slotId: token.slotId,

            pin: pin,

            dllPath:
              token.vendor?.dllPath,

          }),
        }
      );


      // ------------------------------------------------
      // HANDLE HTTP ERROR
      // ------------------------------------------------

      if (!response.ok) {

        let message =
          `Token selection failed: HTTP ${response.status}`;

        try {

          const errorData =
            await response.json();

          if (errorData?.message) {

            message =
              errorData.message;

          }

        } catch {
          // Response was not JSON
        }


        throw new Error(message);

      }


      // ------------------------------------------------
      // LOGIN SUCCESSFUL
      // ------------------------------------------------
      //
      // Only now store token + PIN in React memory.
      // ------------------------------------------------

      setSelectedToken(token);

      setTokenPin(pin);


      return {
        success: true,
        token,
      };


    } catch (error) {

      console.error(
        "Token selection error:",
        error
      );


      // Make sure stale credentials are not retained
      setTokenPin("");


      return {
        success: false,
        error: error.message,
      };

    }

  };


  // --------------------------------------------------
  // LOGOUT / DISCONNECT TOKEN
  // --------------------------------------------------

  const clearSelectedToken = async () => {

    try {

      const response =
        await fetch(
          `${API_BASE}/logout`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );


      if (!response.ok) {

        console.error(
          `Logout failed: HTTP ${response.status}`
        );

      }

    } catch (error) {

      console.error(
        "Logout request error:",
        error
      );

    } finally {

      // ----------------------------------------------
      // IMPORTANT
      // ----------------------------------------------
      //
      // Clear both token and PIN.
      //
      // Enrollment can no longer obtain the PIN after
      // disconnect.
      // ----------------------------------------------

      setSelectedToken(null);

      setTokenPin("");

    }

  };


  // --------------------------------------------------
  // CONTEXT
  // --------------------------------------------------

  return (
    <TokenContext.Provider
      value={{
        selectedToken,

        tokenPin,

        selectToken,

        clearSelectedToken,
      }}
    >
      {children}
    </TokenContext.Provider>
  );

};


// --------------------------------------------------
// USE TOKEN HOOK
// --------------------------------------------------

export const useToken = () => {

  const context =
    useContext(TokenContext);

  if (!context) {

    throw new Error(
      "useToken must be used inside TokenProvider"
    );

  }

  return context;

};