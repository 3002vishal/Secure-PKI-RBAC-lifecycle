import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Divider,
  Chip
} from "@mui/material";
import SecurityIcon from "@mui/icons-material/Security";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import PersonIcon from "@mui/icons-material/Person";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

function Pki() {
  const location = useLocation();
  const navigate = useNavigate();

  const { username, serverData } = location.state || {};

  // Handle refresh / direct access
  if (!username) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h6" color="error">
          No PKI data found
        </Typography>
        <Button
          variant="contained"
          sx={{ mt: 2 }}
          onClick={() => navigate(-1)}
        >
          Go Back
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, backgroundColor: "#f5f7fa", minHeight: "100vh" }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        PKI Dashboard
      </Typography>

      <Divider sx={{ mb: 3 }} />

      <Grid container spacing={3}>
        {/* User Card */}
        <Grid item xs={12} md={4}>
          <Card elevation={3}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <PersonIcon color="primary" />
                <Typography variant="h6">User Info</Typography>
              </Box>

              <Typography sx={{ mt: 2 }}>
                <strong>Username:</strong> {username}
              </Typography>
                <Typography sx={{ mt: 2 }}>
                                <strong>Role:</strong> {serverData.role}
                              </Typography>
            
            </CardContent>
          </Card>
        </Grid>

        {/* PKI Data */}
        
      </Grid>

      {/* Back Button */}
      <Box sx={{ mt: 4 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
        >
          Back
        </Button>
      </Box>
    </Box>
  );
}

export default Pki;
