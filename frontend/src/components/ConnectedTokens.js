import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Stack,
  Typography,
  Divider,
  Tooltip,
  Container,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";

import RefreshIcon from "@mui/icons-material/Refresh";
import UsbIcon from "@mui/icons-material/Usb";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";

import { useToken } from "../context/TokenContext";

const API_URL = "http://localhost:8080/tokens";

const ConnectedTokens = () => {
  const navigate = useNavigate();

  const {
    selectedToken,
    selectToken,
  } = useToken();

  const [tokens, setTokens] = useState([]);

  const [loading, setLoading] = useState(true);

  // True while connecting/authenticating a token
  const [selecting, setSelecting] = useState(false);

  const [selectedTokenId, setSelectedTokenId] = useState(null);

  const [error, setError] = useState("");

  const [selectionError, setSelectionError] = useState("");

  const [selectionSuccess, setSelectionSuccess] = useState("");

  // ================================
  // PIN DIALOG STATE
  // ================================

  const [pinDialogOpen, setPinDialogOpen] = useState(false);

  const [pin, setPin] = useState("");

  // Token that the user clicked
  const [tokenToConnect, setTokenToConnect] = useState(null);

  /*
   * ==========================================
   * FETCH CONNECTED TOKENS
   * ==========================================
   */

  const fetchTokens = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      setTokens(Array.isArray(data) ? data : []);

    } catch (err) {
      console.error("Error fetching tokens:", err);

      setError("Unable to connect to token service.");

      setTokens([]);

    } finally {
      setLoading(false);
    }
  };

  /*
   * ==========================================
   * FETCH TOKENS WHEN PAGE OPENS
   * ==========================================
   */

  useEffect(() => {
    fetchTokens();
  }, []);

  /*
   * ==========================================
   * KEEP LOCAL SELECTED ID SYNCHRONIZED
   * WITH GLOBAL SELECTED TOKEN
   * ==========================================
   */

  useEffect(() => {
    if (selectedToken) {
      setSelectedTokenId(selectedToken.serialNumber);
    } else {
      setSelectedTokenId(null);
    }
  }, [selectedToken]);

  /*
   * ==========================================
   * USER CLICKS TOKEN
   *
   * DO NOT CONNECT YET.
   *
   * Instead, open the PIN dialog.
   * ==========================================
   */

  const handleTokenSelect = (token) => {
    if (selecting) {
      return;
    }

    setSelectionError("");
    setSelectionSuccess("");

    setTokenToConnect(token);
    setPin("");
    setPinDialogOpen(true);
  };

  /*
   * ==========================================
   * CONNECT TOKEN USING USER ENTERED PIN
   *
   * This now makes a SINGLE call, through
   * TokenContext.selectToken(), which owns
   * the /api/login request. Do not call
   * /api/login directly from this component —
   * that previously caused a second, redundant
   * login call that masked PIN validation.
   * ==========================================
   */

  const handleConnectWithPin = async () => {
    if (!tokenToConnect) {
      return;
    }

    if (!pin.trim()) {
      setSelectionError("Please enter the token PIN.");
      return;
    }

    setSelecting(true);
    setSelectionError("");
    setSelectionSuccess("");

    try {

      const result = await selectToken(tokenToConnect, pin);

      if (!result?.success) {
        throw new Error(result?.error || "Failed to connect to token.");
      }

      setSelectedTokenId(tokenToConnect.serialNumber);

      setSelectionSuccess(
        `${tokenToConnect.label || "Token"} connected successfully.`
      );

      setPinDialogOpen(false);
      setPin("");
      setTokenToConnect(null);

    } catch (err) {

      console.error("Token connection error:", err);

      setSelectionError(err.message || "Failed to connect to token.");

    } finally {

      setSelecting(false);
    }
  };

  /*
   * ==========================================
   * CLOSE PIN DIALOG
   * ==========================================
   */

  const handleClosePinDialog = () => {
    if (selecting) {
      return;
    }
    setPinDialogOpen(false);
    setPin("");
    setTokenToConnect(null);
    setSelectionError("");
  };

  /*
   * ==========================================
   * CHECK WHETHER TOKEN IS SELECTED
   * ==========================================
   */

  const isSelected = (token) => {
    return (
      selectedTokenId &&
      selectedTokenId === token.serialNumber
    );
  };

  /*
   * ==========================================
   * UI
   * ==========================================
   */

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        py: 4,
      }}
    >

      <Container maxWidth="lg">

        {/* HEADER */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 3, backgroundColor: "white", borderRadius: 3, p: 2, boxShadow: 4 }}
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <Tooltip title="Back to Login">
              <IconButton onClick={() => navigate(-1)} color="primary">
                <ArrowBackIcon />
              </IconButton>
            </Tooltip>

            <Box>
              <Typography variant="h5" fontWeight="bold" color="primary">
                Connected Tokens
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Hardware security tokens connected to this computer
              </Typography>
            </Box>
          </Stack>

          <Tooltip title="Refresh tokens">
            <span>
              <IconButton
                onClick={fetchTokens}
                disabled={loading || selecting}
                color="primary"
              >
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        {/* ACTIVE TOKEN STATUS */}
        {selectedToken && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2, borderRadius: 2 }}>
            <strong>Active Token:</strong>{" "}
            {selectedToken.label || "Unnamed Token"}
            {" — Slot ID: "}
            {selectedToken.slotId}f
          </Alert>
        )}

        {/* NO TOKEN SELECTED */}
        {!selectedToken && (
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
            No token selected. Click a token below to connect it.
          </Alert>
        )}

        {/* SUCCESS MESSAGE */}
        {selectionSuccess && (
          <Alert
            severity="success"
            sx={{ mb: 2, borderRadius: 2 }}
            onClose={() => setSelectionSuccess("")}
          >
            {selectionSuccess}
          </Alert>
        )}

        {/* GENERAL SELECTION ERROR */}
        {selectionError && !pinDialogOpen && (
          <Alert
            severity="error"
            sx={{ mb: 2, borderRadius: 2 }}
            onClose={() => setSelectionError("")}
          >
            {selectionError}
          </Alert>
        )}

        {/* LOADING */}
        {loading && (
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
                <CircularProgress />
                <Typography color="text.secondary">
                  Detecting connected tokens...
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* API ERROR */}
        {!loading && error && (
          <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "error.light" }}>
            <CardContent>
              <Typography color="error" fontWeight="bold">
                Token Service Error
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {error}
              </Typography>
              <Button
                variant="outlined"
                color="error"
                startIcon={<RefreshIcon />}
                onClick={fetchTokens}
                sx={{ mt: 2 }}
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* NO TOKENS */}
        {!loading && !error && tokens.length === 0 && (
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
                <UsbIcon sx={{ fontSize: 55, color: "text.disabled" }} />
                <Typography variant="h6" fontWeight="bold">
                  No Token Connected
                </Typography>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  Connect a PKCS#11 compatible hardware token and click refresh.
                </Typography>
                <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchTokens}>
                  Refresh
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* CONNECTED TOKENS */}
        {!loading && !error && tokens.length > 0 && (
          <>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Chip
                icon={
                  <Box
                    component="span"
                    sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "success.main", ml: 1 }}
                  />
                }
                label={`${tokens.length} token${tokens.length !== 1 ? "s" : ""} connected`}
                color="success"
                variant="outlined"
              />
            </Stack>

            <Grid container spacing={2}>
              {tokens.map((token, index) => {
                const selected = isSelected(token);

                return (
                  <Grid item xs={12} md={6} lg={4} key={`${token.serialNumber}-${index}`}>
                    <Card
                      onClick={() => handleTokenSelect(token)}
                      sx={{
                        height: "100%",
                        borderRadius: 3,
                        cursor: selecting ? "wait" : "pointer",
                        border: selected ? "2px solid" : "1px solid",
                        borderColor: selected ? "success.main" : "divider",
                        backgroundColor: selected ? "success.50" : "background.paper",
                        transition: "all 0.2s",
                        position: "relative",
                        "&:hover": {
                          boxShadow: selecting ? 1 : 6,
                          transform: selecting ? "none" : "translateY(-2px)",
                        },
                      }}
                    >
                      <CardContent>
                        {selected && (
                          <Chip
                            icon={<CheckCircleIcon />}
                            label="Selected"
                            color="success"
                            size="small"
                            sx={{ position: "absolute", top: 12, right: 12, fontWeight: "bold" }}
                          />
                        )}

                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={2}
                          sx={{ mb: 2, pr: selected ? 9 : 0 }}
                        >
                          <Box
                            sx={{
                              width: 48,
                              height: 48,
                              borderRadius: 2,
                              bgcolor: selected ? "success.main" : "primary.50",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <VerifiedUserIcon
                              sx={{ color: selected ? "white" : "primary.main", fontSize: 28 }}
                            />
                          </Box>

                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="h6" fontWeight={600}>
                              {token.label || "Unnamed Token"}
                            </Typography>

                            <Stack direction="row" alignItems="center" spacing={0.7} sx={{ mt: 0.3 }}>
                              <Box
                                sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "success.main" }}
                              />
                              <Typography variant="caption" color="success.main" fontWeight={600}>
                                Connected
                              </Typography>
                            </Stack>
                          </Box>
                        </Stack>

                        <Divider sx={{ mb: 1 }} />

                        <TokenDetail label="Vendor" value={token.vendor?.name} />
                        <TokenDetail label="Manufacturer" value={token.manufacturer} />
                        <TokenDetail label="Model" value={token.model} />
                        <TokenDetail label="Serial Number" value={token.serialNumber} monospace />
                        <TokenDetail label="Slot ID" value={token.slotId} monospace />

                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          sx={{ mt: 2 }}
                        >
                          {selected ? (
                            <Chip
                              icon={<CheckCircleIcon />}
                              label="Active Token"
                              size="small"
                              color="success"
                              variant="filled"
                            />
                          ) : (
                            <Chip
                              icon={<RadioButtonUncheckedIcon />}
                              label="Connect Token"
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          )}

                          <Typography variant="caption" color="text.secondary">
                            Token #{index + 1}
                          </Typography>
                        </Stack>

                        {selecting &&
                          tokenToConnect &&
                          tokenToConnect.serialNumber === token.serialNumber && (
                            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", mt: 2 }}>
                              <CircularProgress size={18} />
                              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                Connecting...
                              </Typography>
                            </Box>
                          )}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </>
        )}

        {/* PIN DIALOG */}
        <Dialog open={pinDialogOpen} onClose={handleClosePinDialog} fullWidth maxWidth="xs">
          <DialogTitle>Connect Hardware Token</DialogTitle>

          <DialogContent>
            {tokenToConnect && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Enter the PIN for{" "}
                <strong>{tokenToConnect.label || "this token"}</strong>
              </Typography>
            )}

            <TextField
              autoFocus
              fullWidth
              label="Token PIN"
              type="password"
              value={pin}
              onChange={(event) => {
                setPin(event.target.value);
                setSelectionError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !selecting && pin.trim()) {
                  handleConnectWithPin();
                }
              }}
              disabled={selecting}
              autoComplete="off"
              margin="normal"
              inputProps={{ maxLength: 128 }}
            />

            {selectionError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {selectionError}
              </Alert>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={handleClosePinDialog} disabled={selecting}>
              Cancel
            </Button>

            <Button
              variant="contained"
              onClick={handleConnectWithPin}
              disabled={selecting || !pin.trim()}
            >
              {selecting ? (
                <>
                  <CircularProgress size={18} sx={{ mr: 1 }} />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogActions>
        </Dialog>

      </Container>
    </Box>
  );
};

const TokenDetail = ({ label, value, monospace = false }) => {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      spacing={2}
      sx={{ py: 1, borderBottom: "1px solid", borderColor: "divider" }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>

      <Typography
        variant="body2"
        fontWeight={500}
        sx={{
          textAlign: "right",
          wordBreak: "break-word",
          fontFamily: monospace ? "monospace" : "inherit",
        }}
      >
        {value || "N/A"}
      </Typography>
    </Stack>
  );
};

export default ConnectedTokens;