import React, { useState, useRef, useEffect } from 'react';
import { 
  Container, 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Box, 
  Alert, 
  CircularProgress,
  Divider,
  Grid,
  Chip,
  Collapse,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import SecurityIcon from '@mui/icons-material/Security';
import PersonIcon from '@mui/icons-material/Person';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LockIcon from '@mui/icons-material/Lock';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LoginIcon from '@mui/icons-material/Login';

import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

const SERVICE_CONFIG = {
  "Zero Trust Gateway": ["NA", "Gateway Admin", "Policy Admin", "Access Auditor"],
  "PKI Management":     ["NA", "PKI Admin", "Cert Operator", "PKI Auditor"],
  "HSM Operation":      ["NA", "HSM Admin", "Crypto Operator", "HSM Auditor"],
  "IAM":                ["NA", "IAM Admin", "Access Operator", "IAM Auditor"],
  "Security Analytics": ["NA", "SOC Admin", "SOC Analyst", "Compliance Auditor"],
  "Crypto Vault":       ["NA", "Vault Admin", "Secret Operator", "Vault Auditor"]
};

const SERVICES = Object.keys(SERVICE_CONFIG);

const getRoleColor = (roleName) => {
  if (roleName === 'NA') return '#f30b39ff';
  const lower = roleName.toLowerCase();
  if (lower.includes('admin')) return '#ff8a65';
  if (lower.includes('operator')) return '#81c784';
  if (lower.includes('auditor')) return '#ce93d8';
  if (lower.includes('analyst')) return '#4fc3f7';
  return '#90a4ae';
};

export default function App() {
  const [activeStep, setActiveStep] = useState(0);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [orgUnit, setOrgUnit] = useState('');
  const [org, setOrg] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('IN');

  const [serviceRoles, setServiceRoles] = useState({
    "Zero Trust Gateway": "NA",
    "PKI Management": "NA",
    "HSM Operation": "NA",
    "IAM": "NA",
    "Security Analytics": "NA",
    "Crypto Vault": "NA"
  });

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  
  const [logs, setLogs] = useState([
    { message: "System initialized. Ready for secure enrollment...", type: "info", timestamp: new Date().toLocaleTimeString() }
  ]);
  
  const [showLogs, setShowLogs] = useState(true);
  const [bridgeDownloaded, setBridgeDownloaded] = useState(false);

  // CHANGED: Ref now points to the Container, not a div at the bottom
  const logContainerRef = useRef(null);

  // CHANGED: Scroll logic now targets the container's scrollTop
  // This ensures ONLY the box scrolls internally, not the whole window
  useEffect(() => {
    if (logContainerRef.current) {
      const { scrollHeight, clientHeight } = logContainerRef.current;
      // Scroll to bottom of the specific container
      logContainerRef.current.scrollTop = scrollHeight - clientHeight;
    }
  }, [logs]); // Runs whenever logs update

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
  };

  const getLogStyle = (type) => {
    switch (type) {
      case 'success': return { color: '#66bb6a', icon: <CheckCircleOutlineIcon fontSize="small" /> };
      case 'error':   return { color: '#ef5350', icon: <ErrorOutlineIcon fontSize="small" /> };
      case 'process': return { color: '#42a5f5', icon: <ArrowForwardIcon fontSize="small" /> };
      case 'warning': return { color: '#ffa726', icon: <WarningAmberIcon fontSize="small" /> };
      default:        return { color: '#bdbdbd', icon: <InfoOutlinedIcon fontSize="small" /> };
    }
  };

  const handleRoleChange = (service, newRole) => {
    setServiceRoles(prev => ({
      ...prev,
      [service]: newRole
    }));
    addLog(`Updated ${service} role to: ${newRole}`, "info");
  };

  const validatePersonalInfo = () => {
    if (!username || !email || !orgUnit || !org || !state || !country) {
      setStatus({ type: 'error', msg: 'All personal fields are required.' });
      return false;
    }
    if (!email.includes('@')) {
      setStatus({ type: 'error', msg: 'Please enter a valid email address.' });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (activeStep === 0 && !bridgeDownloaded) {
      setStatus({ type: 'warning', msg: 'Please download the HSM Bridge before proceeding.' });
      return;
    }
    if (activeStep === 1 && !validatePersonalInfo()) {
      return;
    }
    setStatus({ type: '', msg: '' });
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
    setStatus({ type: '', msg: '' });
  };

  const handleEnrollment = async () => {
    if (!validatePersonalInfo()) return;

    setLoading(true);
    setStatus({ type: 'info', msg: 'Initiating secure hardware enrollment...' });
    
    addLog(`Starting enrollment for user: ${username}`, "process");
    addLog(`Identity Data: ${email} | ${org}`, "info");

    try {
      addLog("Connecting to Local HSM Bridge (localhost:8000)...", "process");
      addLog(`Encoding Access Matrix: ${JSON.stringify(serviceRoles)}`, "info");

      const response = await fetch('http://localhost:8000/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            username, 
            serviceRoles,
            email, 
            orgUnit, 
            org, 
            state, 
            country 
        })
      });

      if (!response.ok) {
        throw new Error(`Bridge Communication Error: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.status === 'success') {
        addLog("Hardware token provisioned successfully", "success");
        addLog("Digital certificate installed to secure storage", "success");
        setStatus({ type: 'success', msg: '🎉 Enrollment Complete! Your identity is now secured by hardware.' });
        setActiveStep(3);
      } else {
        throw new Error(result.message || "Unknown enrollment error");
      }

    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: '❌ Enrollment Failed - Please check logs' });
      addLog(`Enrollment Error: ${err.message}`, "error");

      if (err.message.includes("Failed to fetch")) {
        addLog("HINT: HSM Bridge service is not running. Please start it and retry.", "warning");
      }
    } finally {
      setLoading(false);
    }
  };

  const steps = ['Download Bridge', 'Personal Details', 'Access Privileges', 'Complete'];

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      py: 4 
    }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 4, color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
            <LockIcon sx={{ fontSize: 48, mr: 2 }} />
            <Typography variant="h3" fontWeight="bold">
              Enrollment Portal
            </Typography>
          </Box>
          <Chip 
            icon={<SecurityIcon />} 
            label="PKI + HSM Protected" 
            sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
          />
        </Box>

        <Paper elevation={6} sx={{ p: 4, borderRadius: 3 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {activeStep === 0 && (
            <Box>
              <Card sx={{ bgcolor: '#f5f5f5', mb: 3 }}>
                <CardContent>
                  <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    <DownloadIcon sx={{ mr: 1, color: '#1976d2' }} />
                    Required: HSM Bridge Application
                  </Typography>
                  <Typography variant="body1" color="textSecondary" paragraph>
                    The HSM Bridge creates a secure channel between this web interface and your hardware security module. 
                    This ensures your private keys never leave the secure hardware environment.
                  </Typography>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <strong>Important:</strong> You must download and run the HSM Bridge before proceeding with enrollment.
                  </Alert>
                  <Button 
                    variant="contained" 
                    size="large"
                    fullWidth
                    startIcon={<DownloadIcon />}
                    href="/hsm-bridge.exe" 
                    download="hsm-bridge.exe"
                    onClick={() => {
                      setBridgeDownloaded(true);
                      addLog("HSM Bridge downloaded successfully", "success");
                    }}
                    sx={{ 
                      height: 56,
                      background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                      boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
                    }}
                  >
                    Download HSM Bridge (Windows)
                  </Button>
                  {bridgeDownloaded && (
                    <Alert severity="success" sx={{ mt: 2 }}>
                      ✓ Bridge downloaded. Please run hsm-bridge.exe before continuing.
                    </Alert>
                  )}

                  <Divider sx={{ my: 3 }} />
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <Typography variant="body1" color="textSecondary">
                      Already have a certificate and enrolled?
                    </Typography>
                    <Button 
                      variant="outlined" 
                      color="primary"
                      href="/"
                      startIcon={<LoginIcon />}
                    >
                      Go to Login
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          )}

          {activeStep === 1 && (
            <Box>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <PersonIcon sx={{ mr: 1, color: '#1976d2' }} />
                Personal Identity Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Username (Common Name)" 
                    placeholder="e.g., john.doe"
                    variant="outlined" 
                    fullWidth 
                    required
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    InputProps={{
                      startAdornment: <PersonIcon sx={{ mr: 1, color: 'action.active' }} />
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Email Address" 
                    placeholder="user@organization.com"
                    type="email"
                    variant="outlined" 
                    fullWidth 
                    required
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Organizational Unit" 
                    placeholder="e.g., IT Security"
                    variant="outlined" 
                    fullWidth 
                    required
                    value={orgUnit} 
                    onChange={(e) => setOrgUnit(e.target.value)}
                    disabled={loading}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Organization" 
                    placeholder="e.g., Acme Corporation"
                    variant="outlined" 
                    fullWidth 
                    required
                    value={org} 
                    onChange={(e) => setOrg(e.target.value)}
                    disabled={loading}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="State/Province" 
                    placeholder="e.g., Karnataka"
                    variant="outlined" 
                    fullWidth 
                    required
                    value={state} 
                    onChange={(e) => setState(e.target.value)}
                    disabled={loading}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Country Code" 
                    placeholder="e.g., IN"
                    variant="outlined" 
                    fullWidth 
                    required
                    value={country} 
                    onChange={(e) => setCountry(e.target.value.toUpperCase())}
                    disabled={loading}
                    helperText="Two-letter ISO code (e.g., IN, US, UK)"
                  />
                </Grid>
              </Grid>
              <Alert severity="info" sx={{ mt: 3 }}>
                This information will be embedded in your cryptographic certificate and cannot be changed later.
              </Alert>
            </Box>
          )}

          {activeStep === 2 && (
            <Box>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AdminPanelSettingsIcon sx={{ mr: 1, color: '#1976d2' }} />
                Service Access Matrix
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Define role-based access for each security service. These permissions will be cryptographically bound to your hardware token.
              </Typography>
              
              <Grid container spacing={2}>
                {SERVICES.map((serviceName) => {
                  const specificRoles = SERVICE_CONFIG[serviceName];
                  return (
                    <Grid item xs={12} sm={6} md={4} key={serviceName}>
                      <Card variant="outlined" sx={{ height: '100%' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <VpnKeyIcon sx={{ mr: 1, color: '#1976d2' }} />
                            <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 'bold' }}>
                                {serviceName}
                            </Typography>
                          </Box>
                          <FormControl fullWidth>
                            <InputLabel>Access Role</InputLabel>
                            <Select
                              value={serviceRoles[serviceName] || "NA"}
                              label="Access Role"
                              onChange={(e) => handleRoleChange(serviceName, e.target.value)}
                              disabled={loading}
                            >
                              {specificRoles.map(r => (
                                <MenuItem key={r} value={r}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                    <Box 
                                      sx={{ 
                                        width: 12, height: 12, borderRadius: '50%', 
                                        bgcolor: getRoleColor(r), mr: 1 
                                      }} 
                                    />
                                    {r}
                                  </Box>
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <Box sx={{ mt: 1 }}>
                            <Chip 
                              size="small" 
                              label={serviceRoles[serviceName]}
                              sx={{ 
                                bgcolor: getRoleColor(serviceRoles[serviceName]),
                                color: 'white', fontWeight: 'bold', fontSize: '0.75rem'
                              }}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
              <Alert severity="warning" sx={{ mt: 3 }}>
                <strong>Security Notice:</strong> These access privileges will be permanently encoded in your certificate. 
              </Alert>
            </Box>
          )}

          {activeStep === 3 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircleIcon sx={{ fontSize: 100, color: '#4caf50', mb: 2 }} />
              <Typography variant="h4" gutterBottom fontWeight="bold" color="success.main">
                Enrollment Successful!
              </Typography>
              <Typography variant="body1" color="textSecondary" paragraph>
                Your identity has been securely provisioned and is now protected by hardware-backed cryptography.
              </Typography>
              <Card variant="outlined" sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5' }}>
                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                  Enrolled Identity
                </Typography>
                <Typography variant="h6">{username}</Typography>
                <Typography variant="body2">{email}</Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" color="textSecondary">
                  Organization: {org} ({orgUnit})
                </Typography>
              </Card>
              <Button 
                variant="contained" 
                size="large" 
                href="/"
                sx={{ mt: 3 }}
              >
                Proceed to Login
              </Button>
            </Box>
          )}

          {status.msg && activeStep !== 3 && (
            <Alert severity={status.type} sx={{ mt: 3 }}>
              {status.msg}
            </Alert>
          )}

          {activeStep < 3 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button
                disabled={activeStep === 0 || loading}
                onClick={handleBack}
                size="large"
              >
                Back
              </Button>
              <Box sx={{ flex: 1 }} />
              {activeStep === 2 ? (
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleEnrollment}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <SecurityIcon />}
                  sx={{ 
                    minWidth: 200,
                    background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
                    boxShadow: '0 3px 5px 2px rgba(255, 105, 135, .3)',
                  }}
                >
                  {loading ? 'Enrolling...' : 'Complete Enrollment'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleNext}
                  sx={{ minWidth: 120 }}
                >
                  Next
                </Button>
              )}
            </Box>
          )}

          {activeStep > 0 && (
            <Box sx={{ mt: 4 }}>
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  mb: 1
                }}
                onClick={() => setShowLogs(!showLogs)}
              >
                <Typography variant="subtitle2" color="textSecondary">
                  🔍 LIVE SECURITY LOGS
                </Typography>
                <IconButton size="small">
                  {showLogs ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
              <Collapse in={showLogs}>
                <Box 
                  ref={logContainerRef} // Ref attached to container
                  sx={{ 
                    bgcolor: '#1e1e1e', 
                    borderRadius: 2, 
                    maxHeight: 250, 
                    overflowY: 'auto', 
                    border: '1px solid #333',
                    p: 1
                  }}
                >
                  {logs.map((log, index) => {
                    const style = getLogStyle(log.type);
                    return (
                      <Box 
                        key={index} 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'start', 
                          mb: 1, 
                          p: 1, 
                          borderRadius: 1,
                          bgcolor: 'rgba(255,255,255,0.03)' 
                        }}
                      >
                        <Box sx={{ color: style.color, mr: 1.5, mt: 0.5 }}>
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
                </Box>
              </Collapse>
            </Box>
          )}
        </Paper>

        <Box sx={{ textAlign: 'center', mt: 3, color: 'white', opacity: 0.8 }}>
          <Typography variant="caption">
            🔒 Secured by Hardware Security Module (HSM) • Zero Trust Architecture • PKI Infrastructure
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}