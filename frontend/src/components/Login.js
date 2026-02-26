import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import { useSecureFetch } from '../hooks/useSecureFetch';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  
  // CHANGED: Logs are now objects with { message, type, timestamp }
  const [logs, setLogs] = useState([
    { message: "System Ready. Please identify yourself.", type: "info", timestamp: new Date().toLocaleTimeString() }
  ]);
  
  const [userRole, setUserRole] = useState(null);
  const [localLoading, setLocalLoading] = useState(false); // Local state to handle loading during verification
  
  const { secureFetch, loading: hookLoading, error } = useSecureFetch(username);
  
  // Merge local loading with hook loading for UI states
  const loading = localLoading || hookLoading;

  const logEndRef = useRef(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // CHANGED: addLog now accepts a 'type' (info, success, error, process)
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
  };

  const handleLogin = async () => {
    if (!username.trim()) {
      addLog("Username cannot be empty.", "error");
      return;
    }

    setLocalLoading(true); // Start UI loading
    setUserRole(null);

    // --- STEP 1: PRE-CHECK CERTIFICATE CHAIN ---
    addLog(`Verifying Certificate Trust Chain for: ${username}...`, "process");

    try {
      const verifyRes = await fetch('http://localhost:5000/api/verify-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      const verifyData = await verifyRes.json();

      if (!verifyData.valid) {
        addLog(`Certificate Verification Failed: ${verifyData.message}`, "error");
        setLocalLoading(false); // Stop loading if failed
        return; // STOP LOGIN PROCESS
      }

      addLog("Certificate Chain Valid & Trusted.", "success");
      // Optional: Display issuer or expiry if returned
      if (verifyData.details?.issuer) {
        addLog(`Verified Issuer: ${verifyData.details.issuer}`, "info");
      }

    } catch (err) {
      addLog("Could not contact verification service.", "error");
      console.error(err);
      setLocalLoading(false);
      return;
    }

    // --- STEP 2: CHALLENGE-RESPONSE (SECURE FETCH) ---
    addLog(`Initiating Hardware Handshake...`, "process");
    
    // secureFetch will handle its own loading state, but we keep localLoading true 
    // until the very end to prevent flickering or double-clicks.
    const result = await secureFetch('/api/login');
    setLocalLoading(false); // Stop local loading now that hook is done

    if (result) {
      addLog("Identity Verified Successfully.", "success");
      addLog("Decrypted Access Token received.", "success");
      
      setUserRole("Authenticated"); 
      
      setTimeout(() => {
        addLog("Redirecting to Service Dashboard...", "process");
        navigate("/services", { state: { username: username } });
      }, 1000);
    } else {
      addLog("Authentication Failed. Token rejected.", "error");
    }
  };

  // Helper to get color/icon based on log type
  const getLogStyle = (type) => {
    switch (type) {
      case 'success': return { color: '#66bb6a', icon: <CheckCircleOutlineIcon fontSize="small" /> }; // Green
      case 'error':   return { color: '#ef5350', icon: <ErrorOutlineIcon fontSize="small" /> };     // Red
      case 'process': return { color: '#42a5f5', icon: <ArrowForwardIcon fontSize="small" /> };     // Blue
      default:        return { color: '#bdbdbd', icon: <InfoOutlinedIcon fontSize="small" /> };     // Grey
    }
  };

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        width: '100%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4 
      }}
    >
      <Container maxWidth="sm">
        <Paper elevation={6} sx={{ p: 4, width: '100%', borderRadius: 3 }}>

          <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
            <SecurityIcon color="primary" sx={{ fontSize: 50, mb: 1 }} />
            <Typography variant="h4" component="h1" fontWeight="bold" color="primary">
              Secure Login
            </Typography>
            <Typography variant="caption" color="textSecondary">
               Zero-Trust Access Control
            </Typography>
          </Box>

          {/* Logged-in view */}
          {userRole ? (
            <Box textAlign="center" py={3}>
              <Alert severity="success" sx={{ mb: 2 }}>
                Identity Verified. Redirecting...
              </Alert>
              <CircularProgress size={30} />
            </Box>
          ) : (
            <Box component="form" noValidate autoComplete="off">
              <TextField
                label="Username"
                placeholder="e.g. vishal"
                variant="outlined"
                fullWidth
                margin="normal"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                InputProps={{
                  startAdornment: <VpnKeyIcon color="action" sx={{ mr: 1 }} />
                }}
              />

              <Button
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                onClick={handleLogin}
                disabled={loading || !username}
                sx={{ mt: 2, height: 50, fontWeight: 'bold' }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : "Login with Token"}
              </Button>

              <Box textAlign="center" mt={2} mb={2}>
                <Button
                  startIcon={<PersonAddIcon />}
                  onClick={() => navigate('/')}
                  disabled={loading}
                  color="secondary"
                >
                  Enroll New User
                </Button>
              </Box>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
              )}
              
              {loading && !error && (
                <Alert severity="info" sx={{ mb: 2 }}>Contacting Security Infrastructure...</Alert>
              )}
            </Box>
          )}

          <Divider sx={{ my: 2 }}>
            <Typography variant="caption" color="textSecondary">LIVE SECURITY STATUS</Typography>
          </Divider>

          {/* IMPROVED LOG SECTION */}
          <Box sx={{
            bgcolor: '#1e1e1e', // Slightly lighter dark background
            borderRadius: 2,
            height: 180,
            overflowY: 'auto',
            border: '1px solid #333',
            p: 1
          }}>
            {logs.map((log, index) => {
              const style = getLogStyle(log.type);
              return (
                <Box 
                  key={index} 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'start', 
                    mb: 1.5, 
                    p: 1, 
                    borderRadius: 1,
                    bgcolor: 'rgba(255,255,255,0.03)' 
                  }}
                >
                  <Box sx={{ color: style.color, mr: 1.5, mt: 0.5, display: 'flex' }}>
                    {style.icon}
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 0.5 }}>
                      {log.timestamp}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#eee', fontFamily: 'monospace' }}>
                      {log.message}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
            <div ref={logEndRef} />
          </Box>

        </Paper>
      </Container>
    </Box>
  );
}