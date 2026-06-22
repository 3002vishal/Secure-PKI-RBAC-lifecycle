import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Grid, Card, Typography, Box, AppBar, Toolbar, Button, 
  CardActionArea, Divider, Alert, Snackbar, CircularProgress, Backdrop, Slide
} from '@mui/material';
import { Logout, Https, Shield } from '@mui/icons-material';

// 1. Import your custom hook explicitly
import { useSecureFetch } from '../hooks/useSecureFetch';

function SlideTransition(props) {
  return <Slide {...props} direction="down" />;
}

const ServicesSection = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const username = location.state?.username;

  // 2. Initialize your secure fetch cryptographic routine
  const { secureFetch, loading: secureFetchLoading, error: hookError } = useSecureFetch(username);

  // DB State Management
  const [dbServices, setDbServices] = useState([]);
  const [accessError, setAccessError] = useState("");
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Combine loading parameters seamlessly
  const isLoading = secureFetchLoading || verifying;

  // Fetch active microservice boundaries from your database registry on load
  useEffect(() => {
    const fetchActiveRegistry = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/services');
        const data = await response.json();
        setDbServices(data);
      } catch (err) {
        console.error("Failed to fetch dynamic routing targets:", err);
        setAccessError("Critical Connection Error: Service registry unreachable.");
        setOpenSnackbar(true);
      }
    };
    fetchActiveRegistry();
  }, []);

  // Sync validation errors from hook execution down to the UI banner
  useEffect(() => {
    if (hookError) {
      setAccessError(hookError);
      setOpenSnackbar(true);
    }
  }, [hookError]);

  // Handler: Validate Certificate -> Secure Challenge-Response -> Render UI
  const handleServiceClick = async (service) => {
    setAccessError("");
    setOpenSnackbar(false);
    setVerifying(true); 

    try {
      // ---------------------------------------------------------
      // STEP 1: VERIFY CERTIFICATE CHAIN WITH YOUR INTERMEDIARY CA
      // ---------------------------------------------------------
      console.log(`Verifying root chain signature for ${username}...`);
      const verifyRes = await fetch('http://localhost:5000/api/verify-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      const verifyData = await verifyRes.json();
      if (!verifyData.valid) {
        throw new Error(`Certificate Chain Error: ${verifyData.message}`);
      }

      console.log("Certificate Chain Validated. Proceeding to Hardware Handshake Challenge...");

      // ---------------------------------------------------------
      // STEP 2: SECURE FETCH HANDSHAKE (Uses your custom hook)
      // ---------------------------------------------------------
      // Because your hook prefixes the URL with 'http://localhost:5000',
      // we pass the relative endpoint subpath directly.
      // Example target: /services/pki
      
      const relativeEndpoint = service.target_url.replace('http://localhost:5000', '');
      
      console.log(`Executing hardware signing sequence on endpoint: ${relativeEndpoint}`);
      
      // We pass custom configuration flags if needed, or leave it clear
      const result = await secureFetch(relativeEndpoint);
      
      setVerifying(false); // Shut down pre-check loader state

      if (result) {
        // ---------------------------------------------------------
        // STEP 3: INTERCEPT & RENDER RAW HTML RESPONSE
        // ---------------------------------------------------------
        // Since your hook parses JSON by default, if your endpoint sends string content
        // make sure your hook returns it or injects it smoothly. 
        // If your endpoint already provides string layouts:
        
        document.open();
        document.write(typeof result === 'string' ? result : JSON.stringify(result));
        document.close();
      }

    } catch (err) {
      console.error("Access Authentication Aborted:", err);
      setVerifying(false); 
      setAccessError(err.message || "Access Denied");
      setOpenSnackbar(true);
    }
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') return;
    setOpenSnackbar(false);
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)', overflow: 'hidden' }}>
      
      {/* Dynamic Handshake Backdrop Loader */}
      <Backdrop
        sx={{ color: '#00ff41', zIndex: (theme) => theme.zIndex.drawer + 1, flexDirection: 'column' }}
        open={isLoading}
      >
        <CircularProgress color="inherit" />
        <Typography sx={{ mt: 2, fontFamily: 'monospace', letterSpacing: 1.5, textAlign: 'center' }}>
          {verifying 
            ? "Veryfying" 
            : "PROVISIONING CHALLENGE Token & EXECUTING HARDWARE SIGNATURE..."}
        </Typography>
      </Backdrop>

      {/* Access Denied Alerts */}
      <Snackbar open={openSnackbar} autoHideDuration={4000} onClose={handleCloseSnackbar} TransitionComponent={SlideTransition} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert variant="filled" severity="error" onClose={handleCloseSnackbar} sx={{ width: '100%', fontWeight: 'bold' }}>
          {accessError}
        </Alert>
      </Snackbar>

      {/* Master Top Control Bar */}
      <AppBar position="static" elevation={0} sx={{ background: 'linear-gradient(90deg, #1a1f3a 0%, #2d3561 100%)', borderBottom: '2px solid #00ff41' }}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 0.5, minHeight: '56px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Https sx={{ fontSize: 28, color: '#00ff41' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#00ff41', letterSpacing: 2, fontSize: '1.1rem' }}>
              ZERO TRUST SECURITY PLATFORM
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ color: '#00ff41', fontWeight: 'bold', fontFamily: 'monospace' }}>
              PRINCIPAL: {username?.toUpperCase()}
            </Typography>
            <Button variant="contained" color="error" size="small" onClick={() => navigate('/')} startIcon={<Logout />}>
              Logout
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Dynamic Viewport Grid */}
      <Box sx={{ flex: 1, py: 4, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ color: '#ccd6f6', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: 1.5 }}>
            <Shield sx={{ color: '#00ff41', fontSize: 28 }} />
            Cryptographic Microservice Boundaries
          </Typography>
        </Box>

        <Box sx={{ px: 6 }}>
          <Grid container spacing={3} justifyContent="center" sx={{ maxWidth: '1400px', margin: '0 auto', alignItems: 'stretch' }}>
            {dbServices.map((service, index) => (
              <Grid item xs={12} sm={6} md={4} key={service.id || index} sx={{ display: 'flex' }}>
                <Card sx={{ 
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'linear-gradient(135deg, #1e2749 0%, #2d3561 100%)', 
                    border: '1px solid #3d4863', 
                    transition: '0.2s smooth-bounce',
                    '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0, 255, 65, 0.25)', border: '1px solid #00ff41' } 
                  }}>
                  <CardActionArea 
                    onClick={() => handleServiceClick(service)}
                    disabled={isLoading} 
                    sx={{ 
                      p: 4, 
                      textAlign: 'center', 
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center'
                    }}
                  >
                    <Typography variant="h6" sx={{ color: '#ccd6f6', fontWeight: 'bold', fontSize: '1.25rem' }}>
                      {service.name}
                    </Typography>
                    <Divider sx={{ my: 2, borderColor: '#3d4863', width: '100%' }} />
                    <Typography variant="body2" sx={{ color: '#8892b0', lineHeight: 1.6 }}>
                      {service.description || "Active managed microservice runtime execution context."}
                    </Typography>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>

      {/* Footer System Posture Status */}
      <Box sx={{ background: 'linear-gradient(90deg, #1a1f3a 0%, #2d3561 100%)', borderTop: '2px solid #00ff41', py: 1.5, px: 3, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ color: '#8892b0', fontFamily: 'monospace', letterSpacing: 1 }}>
          CRYPTOGRAPHIC HARDWARE HANDSHAKE ENGINE ONLINE
        </Typography>
      </Box>
    </Box>
  );
};

export default ServicesSection;