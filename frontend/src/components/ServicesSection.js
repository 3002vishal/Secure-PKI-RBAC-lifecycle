import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  Grid, Card, Typography, Box, AppBar, Toolbar, Button, 
  CardActionArea, Divider, Alert, Snackbar, CircularProgress, Backdrop, Slide
} from '@mui/material';
import {
  Logout, Shield, VpnKey, Fingerprint, Lock, 
  VerifiedUser, Https, BarChart
} from '@mui/icons-material';

// 1. Import the custom hook
import { useSecureFetch } from '../hooks/useSecureFetch';

// Slide transition for the popup (Smoother look)
function SlideTransition(props) {
  return <Slide {...props} direction="down" />;
}

const services = [
  {
    title: 'Zero Trust Gateway',
    path: 'zero-trust',
    apiEndpoint: '/services/zero-trust',
    desc: '',
    icon: <Shield sx={{ fontSize: 40, color: '#00ff41' }} />,
  },
  {
    title: 'PKI Management',
    path: 'pki',
    apiEndpoint: '/services/pki',
    desc: '',
    icon: <VpnKey sx={{ fontSize: 40, color: '#00ff41' }} />,
  },
  {
    title: 'HSM Operations',
    path: 'hsm',
    apiEndpoint: '/services/hsm',
    desc: '',
    icon: <Fingerprint sx={{ fontSize: 40, color: '#00ff41' }} />,
  },
  {
    title: 'Identity & Access',
    path: 'identity',
    apiEndpoint: '/services/identity',
    desc: '',
    icon: <VerifiedUser sx={{ fontSize: 40, color: '#00ff41' }} />,
  },
  {
    title: 'Security Analytics',
    path: 'security',
    apiEndpoint: '/services/security',
    desc: '',
    icon: <BarChart sx={{ fontSize: 40, color: '#00ff41' }} />,
  },
  {
    title: 'Crypto Vault',
    path: 'crypto',
    apiEndpoint: '/services/crypto',
    desc: '',
    icon: <Lock sx={{ fontSize: 40, color: '#00ff41' }} />,
  },
];

const ServicesSection = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const username = location.state?.username;

  // 2. Initialize Hook
  const { secureFetch, loading: secureFetchLoading, error: hookError } = useSecureFetch(username);

  const [accessError, setAccessError] = useState("");
  const [openSnackbar, setOpenSnackbar] = useState(false);
  
  // NEW: Local state to track verification loading status
  const [verifying, setVerifying] = useState(false);

  // Combine loading states for the UI
  const isLoading = secureFetchLoading || verifying;

  // --- LOGIC FIX 1: Sync hook error to local state ---
  useEffect(() => {
    if (hookError) {
      setAccessError(hookError);
      setOpenSnackbar(true);
    }
  }, [hookError]);

  // --- MODIFIED HANDLER: Chain Verification -> Secure Fetch ---
  const handleServiceClick = async (service) => {
    setAccessError("");
    setOpenSnackbar(false);
    setVerifying(true); // Start loading

    try {
      // ---------------------------------------------------------
      // STEP 1: VERIFY CERTIFICATE CHAIN (Pre-Check)
      // ---------------------------------------------------------
      console.log(`Verifying chain for ${username}...`);
      const verifyRes = await fetch('http://localhost:5000/api/verify-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      const verifyData = await verifyRes.json();

      if (!verifyData.valid) {
        throw new Error(`Certificate Chain Error: ${verifyData.message}`);
      }

      console.log("Certificate Chain Valid. Proceeding to Secure Fetch...");

      // ---------------------------------------------------------
      // STEP 2: SECURE FETCH (Challenge-Response)
      // ---------------------------------------------------------
      // Note: verifyData is valid, so we proceed.
      // We keep 'verifying' true briefly to avoid loading flicker before secureFetch starts.
      
      const result = await secureFetch(service.apiEndpoint);
      
      // Stop local verifying loader now that secureFetch is done
      setVerifying(false);

      if (result) {
        navigate(service.path, { 
          state: { 
            username, 
            serverData: result
          } 
        });
      } else {
        // If result is null/false, secureFetch usually sets the hookError,
        // but we throw here just in case to catch in this block.
        throw new Error("You are not authorized to access this service.");
      }

    } catch (err) {
      console.error("Access Process Failed:", err);
      setVerifying(false); // Stop loading on error
      setAccessError(err.message || "Access Denied");
      setOpenSnackbar(true);
    }
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSnackbar(false);
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)', overflow: 'hidden' }}>
      
      {/* Loading Overlay (Updated to use combined isLoading state) */}
      <Backdrop
        sx={{ color: '#00ff41', zIndex: (theme) => theme.zIndex.drawer + 1, flexDirection: 'column' }}
        open={isLoading}
      >
        <CircularProgress color="inherit" />
        <Typography sx={{ mt: 2, fontFamily: 'monospace' }}>
          {verifying ? "VERIFYING CERTIFICATE CHAIN..." : "PERFORMING HARDWARE HANDSHAKE..."}
        </Typography>
      </Backdrop>

      {/* Access Denied Alert */}
      <Snackbar 
        open={openSnackbar} 
        autoHideDuration={4000} 
        onClose={handleCloseSnackbar}
        TransitionComponent={SlideTransition}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          variant="filled" 
          severity="error" 
          onClose={handleCloseSnackbar}
          sx={{ width: '100%', fontWeight: 'bold' }} 
        >
          {accessError}
        </Alert>
      </Snackbar>

      <AppBar position="static" elevation={0} sx={{ background: 'linear-gradient(90deg, #1a1f3a 0%, #2d3561 100%)', borderBottom: '2px solid #00ff41' }}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 0.5, minHeight: '56px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Https sx={{ fontSize: 28, color: '#00ff41' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#00ff41', letterSpacing: 2 }}>
              ZERO TRUST SECURITY PLATFORM
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ color: '#00ff41', fontWeight: 'bold' }}>
              {username?.toUpperCase()}
            </Typography>
            <Button variant="contained" color="error" size="small" onClick={() => navigate('/Login')} startIcon={<Logout />}>
              Logout
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, py: 2, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {location.pathname === '/services' ? (
          <>
            <Box sx={{ mb: 3, textAlign: 'center' }}>
              <Typography variant="h5" sx={{ color: '#ccd6f6', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: 1.5 }}>
                <Shield sx={{ color: '#00ff41', fontSize: 28 }} />
                Security Services
              </Typography>
            </Box>

            <Box sx={{ px: 6 }}>
              <Grid container spacing={3} justifyContent="center" sx={{ maxWidth: '1400px', margin: '0 auto', alignItems: 'stretch' }}>
                {services.map((service, index) => (
                  <Grid item xs={12} sm={6} md={4} key={index} sx={{ display: 'flex' }}>
                    <Card sx={{ 
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'linear-gradient(135deg, #1e2749 0%, #2d3561 100%)', 
                        border: '1px solid #3d4863', 
                        '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 16px rgba(0, 255, 65, 0.3)', border: '1px solid #00ff41' } 
                      }}>
                      <CardActionArea 
                        onClick={() => handleServiceClick(service)}
                        disabled={isLoading} 
                        sx={{ 
                          p: 2.5, 
                          textAlign: 'center', 
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'flex-start'
                        }}
                      >
                        {service.icon}
                        <Typography variant="h6" sx={{ mt: 1.5, color: '#ccd6f6', fontWeight: 'bold' }}>
                          {service.title}
                        </Typography>
                        <Divider sx={{ my: 1, borderColor: '#3d4863', width: '100%' }} />
                        <Typography variant="body2" sx={{ color: '#8892b0' }}>
                          {service.desc}
                        </Typography>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </>
        ) : (
          <Box sx={{ flex: 1, p: 2 }}>
             <Button sx={{ color: '#00ff41', mb: 2 }} onClick={() => navigate('/services')}>← Dashboard</Button>
             <Outlet />
          </Box>
        )}
      </Box>

      <Box sx={{ background: 'linear-gradient(90deg, #1a1f3a 0%, #2d3561 100%)', borderTop: '2px solid #00ff41', py: 1, px: 3 }}>
        <Typography variant="body2" sx={{ color: '#8892b0', fontFamily: 'monospace' }}>
      
        </Typography>
      </Box>
    </Box>
  );
};

export default ServicesSection;