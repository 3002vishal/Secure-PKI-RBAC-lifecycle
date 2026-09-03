``
import React from "react";

import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Chip,
  Button,
} from "@mui/material";

import UsbIcon from "@mui/icons-material/Usb";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";

import { useToken } from "../context/TokenContext";

function TokenStatusBar() {
  const {
    selectedToken,
    clearSelectedToken,
  } = useToken();

  const handleDisconnect = async () => {
   
      // Clear React state only after backend logout succeeds
      await clearSelectedToken();

  
  };

  return (
    <AppBar
      position="sticky"
      color="default"
      elevation={1}
      sx={{
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Toolbar
        variant="dense"
        sx={{
          minHeight: 48,
          justifyContent: "space-between",
        }}
      >

        {/* Left */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <UsbIcon
            fontSize="small"
            color={
              selectedToken
                ? "success"
                : "disabled"
            }
          />

          <Typography
            variant="body2"
            color="text.secondary"
          >
            Active Token:
          </Typography>

          {selectedToken ? (
            <Chip
              icon={<CheckCircleIcon />}
              label={
                selectedToken.label ||
                "Unnamed Token"
              }
              color="success"
              size="small"
            />
          ) : (
            <Chip
              icon={<CancelIcon />}
              label="No Token Selected"
              color="default"
              size="small"
            />
          )}
        </Box>

        {/* Token information */}
        {selectedToken && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
            >
              Slot: {selectedToken.slotId}
            </Typography>

            <Typography
              variant="caption"
              color="text.secondary"
            >
              Serial: {selectedToken.serialNumber}
            </Typography>

            <Button
              size="small"
              color="error"
              onClick={handleDisconnect}
            >
              Disconnect
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}

export default TokenStatusBar;

