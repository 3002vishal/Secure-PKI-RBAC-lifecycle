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

// Standard MUI Icon imports
import SecurityIcon from '@mui/icons-material/Security';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

// Ensure this path is 100% correct and useSecureFetch is a named export
import { useSecureFetch } from '../hooks/useSecureFetch';

  function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  
  const [logs, setLogs] = useState([
    { message: "System Ready. Please identify yourself.", type: "info", timestamp: new Date().toLocaleTimeString() }
  ]);
  
  const [userRole, setUserRole] = useState(null);
  const [localLoading, setLocalLoading] = useState(false); 
  
  // Destructure with default values to prevent "undefined" errors
  const { secureFetch, loading: hookLoading, error: hookError } = useSecureFetch(username) || {};
  
  const loading = localLoading || hookLoading;
  const logEndRef = useRef(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
  };

const handleLogin = async () => {
    if (!username.trim()) {
      addLog("Username cannot be empty.", "error");
      return;
    }

    setLocalLoading(true); 
    setUserRole(null);

    addLog(`Verifying Certificate Trust Chain for: ${username}...`, "process");

    try {
      // Step 1: Standard Fetch for Certificate Verification
      const verifyRes = await fetch('http://localhost:5000/api/verify-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.valid) {
        addLog(`Certificate Verification Failed: ${verifyData.message || 'Unknown error'}`, "error");
        setLocalLoading(false);
        return; 
      }

      addLog("Certificate Chain Valid & Trusted.", "success");

      // Step 2: Hardware Handshake via useSecureFetch
      addLog(`Initiating Hardware Handshake for ${username}...`, "process");
      
      // Note: useSecureFetch usually handles the signing headers internally
      const result = await secureFetch('/api/login', {
        method: "POST",
        body: JSON.stringify({ username: username }),
        headers: { "Content-Type": "application/json" }
      });

      // Step 3: Evaluate the Secure Fetch Result
      // Ensure 'result' matches what your backend returns on success
      if (result && (result.success || result.authenticated)) {
        addLog("Identity Cryptographically Verified.", "success");
        setUserRole("Authenticated"); 

        const isAdmin = username.toLowerCase() === "admin";
        const targetPath = isAdmin ? "/admin-dashboard" : "/services";
        
        addLog(`${isAdmin ? "Admin" : "User"} Confirmed. Redirecting...`, "success");

        setTimeout(() => {
          navigate(targetPath, { state: { username: username } });
        }, 1500);
      } else {
        // Handle cases where the hook returns null or success: false
        addLog("Authentication Failed. Signature rejected by server.", "error");
      }

    } catch (err) {
      console.error("Login Error:", err);
      addLog(err.message || "Security service unreachable.", "error");
    } finally {
      setLocalLoading(false); 
    }
  };

  const getLogStyle = (type) => {
    switch (type) {
      case 'success': return { color: '#66bb6a', icon: <CheckCircleOutlineIcon fontSize="small" /> };
      case 'error':   return { color: '#ef5350', icon: <ErrorOutlineIcon fontSize="small" /> };
      case 'process': return { color: '#42a5f5', icon: <ArrowForwardIcon fontSize="small" /> };
      default:        return { color: '#bdbdbd', icon: <InfoOutlinedIcon fontSize="small" /> };
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', width: '100%', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 
    }}>
      <Container maxWidth="sm">
        <Paper elevation={6} sx={{ p: 4, width: '100%', borderRadius: 3 }}>
          <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
            <SecurityIcon color="primary" sx={{ fontSize: 50, mb: 1 }} />
            <Typography variant="h4" fontWeight="bold" color="primary">Secure Login</Typography>
            <Typography variant="caption" color="textSecondary">Zero-Trust Access Control</Typography>
          </Box>

          {userRole ? (
            <Box textAlign="center" py={3}>
              <Alert severity="success" sx={{ mb: 2 }}>Identity Verified. Redirecting...</Alert>
              <CircularProgress size={30} />
            </Box>
          ) : (
            <Box>
              <TextField
                label="Username"
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
                fullWidth
                onClick={handleLogin}
                disabled={loading || !username}
                sx={{ mt: 2, height: 50, fontWeight: 'bold' }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : "Login with Token"}
              </Button>
              <Box textAlign="center" mt={2} mb={2}>
                <Button color="secondary" onClick={() => navigate('/enroll')} disabled={loading}>
                  Enroll New User
                </Button>
              </Box>
            </Box>
          )}

          <Divider sx={{ my: 2 }}>
            <Typography variant="caption" color="textSecondary">LIVE SECURITY STATUS</Typography>
          </Divider>

          <Box sx={{ bgcolor: '#1e1e1e', borderRadius: 2, height: 180, overflowY: 'auto', p: 1 }}>
            {logs.map((log, index) => {
              const style = getLogStyle(log.type);
              return (
                <Box key={index} sx={{ display: 'flex', mb: 1.5, p: 1, bgcolor: 'rgba(255,255,255,0.03)' }}>
                  <Box sx={{ color: style.color, mr: 1.5 }}>{style.icon}</Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#888', display: 'block' }}>{log.timestamp}</Typography>
                    <Typography variant="body2" sx={{ color: '#eee', fontFamily: 'monospace' }}>{log.message}</Typography>
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

export default Login;