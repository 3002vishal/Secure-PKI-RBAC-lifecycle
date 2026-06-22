import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import SecurityIcon from '@mui/icons-material/Security';
import PersonIcon from '@mui/icons-material/Person';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LockIcon from '@mui/icons-material/Lock';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

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
  const location = useLocation();
  const navigate = useNavigate();
  
  const editUser = location.state?.editUser; 
  const isEditMode = !!editUser;

  const [activeStep, setActiveStep] = useState(0);
  
  // Dynamic Services Registry States
  const [dynamicServices, setDynamicServices] = useState([]);
  const [serviceRoles, setServiceRoles] = useState({});

  // Personal Form Identity States
  const [username, setUsername] = useState(editUser?.username || '');
  const [email, setEmail] = useState(editUser?.email || '');
  const [orgUnit, setOrgUnit] = useState(editUser?.orgUnit || '');
  const [org, setOrg] = useState(editUser?.org || '');
  const [state, setState] = useState(editUser?.state || '');
  const [country, setCountry] = useState(editUser?.country || 'IN');

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(true);
  const logContainerRef = useRef(null);

  // Synchronize Live Services from your Node/MySQL API
  useEffect(() => {
    const loadActiveServices = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/services');
        const data = await response.json();
        setDynamicServices(data);

        // Map initial baseline authorization mapping matrix safely
        if (!isEditMode) {
          const initialMatrix = {};
          data.forEach(service => {
            initialMatrix[service.name] = "NA";
          });
          setServiceRoles(initialMatrix);
        } else {
          setServiceRoles(typeof editUser.serviceRoles === 'string' 
            ? JSON.parse(editUser.serviceRoles) 
            : editUser.serviceRoles
          );
        }
        
        setLogs([{
          message: isEditMode ? `Identity verified for [${editUser.username}]. Entering modification suite.` : "System initialized. Dynamic microservices and roles matrix synced successfully.",
          type: isEditMode ? "warning" : "info",
          timestamp: new Date().toLocaleTimeString()
        }]);

      } catch (err) {
        console.error("Failed to sync service registry matrix:", err);
        setLogs(prev => [...prev, {
          message: `CRITICAL SCHEMA ERROR: Unable to load services table details. Details: ${err.message}`,
          type: "error",
          timestamp: new Date().toLocaleTimeString()
        }]);
      }
    };

    loadActiveServices();
  }, [isEditMode, editUser]);

  useEffect(() => {
    if (logContainerRef.current) {
      const { scrollHeight, clientHeight } = logContainerRef.current;
      logContainerRef.current.scrollTop = scrollHeight - clientHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (isEditMode) setActiveStep(1);
  }, [isEditMode]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
  };

  const handleRoleChange = (service, newRole) => {
    setServiceRoles(prev => ({ ...prev, [service]: newRole }));
    addLog(`Updated ${service} authorization assignment to: ${newRole}`, "info");
  };

  const validatePersonalInfo = () => {
    if (!username || !email || !orgUnit || !org || !state || !country) {
      setStatus({ type: 'error', msg: 'All personal fields are required.' });
      return false;
    }
    
    if (username.endsWith(' ')) {
      setStatus({ type: 'error', msg: 'Username cannot end with an empty space.' });
      return false;
    }

    if (!email.includes('@')) {
      setStatus({ type: 'error', msg: 'Please enter a valid email address.' });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (activeStep === 0 && !validatePersonalInfo()) return;
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
    const endpoint = isEditMode ? 'http://localhost:8000/modify' : 'http://localhost:8000/signup';
    setStatus({ type: 'info', msg: isEditMode ? 'Rotating keys and updating certificate...' : 'Initiating secure hardware enrollment...' });
    
    addLog(`${isEditMode ? 'Modifying' : 'Starting enrollment for'} user: ${username}`, "process");

    try {
      addLog(`Connecting to Crypto Hardware Bridge Layer (${endpoint})...`, "process");
      addLog(`Encoding Active Matrix Claims: ${JSON.stringify(serviceRoles)}`, "info");

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: username.trim(), 
          serviceRoles, 
          email, 
          orgUnit, 
          org, 
          state, 
          country 
        })
      });

      const result = await response.json();

      if (result.status === 'success') {
        addLog(isEditMode ? "Certificate rotated and re-issued securely" : "Hardware token provisioned successfully", "success");
        setStatus({ type: 'success', msg: isEditMode ? '🎉 Update Complete! Your new certificate has been issued.' : '🎉 Enrollment Complete!' });
        setActiveStep(2);
      } else {
        if (result.message && (result.message.includes("0x80090023") || result.message.includes("STORAGE_FULL"))) {
          addLog("CRITICAL ERROR: Crypto Token Storage is full. No space for new containers.", "error");
          addLog("HINT: Please manually delete old containers using 'certutil -delkey' or format token.", "warning");
        }
        throw new Error(result.message || "Operation failed");
      }
    } catch (err) {
      setStatus({ type: 'error', msg: `❌ ${isEditMode ? 'Update' : 'Enrollment'} Failed - Please check logs` });
      addLog(`Error execution block caught: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const getLogStyle = (type) => {
    switch (type) {
      case 'success': return { color: '#66bb6a', icon: <CheckCircleOutlineIcon fontSize="small" /> };
      case 'error':   return { color: '#ef5350', icon: <ErrorOutlineIcon fontSize="small" /> };
      case 'process': return { color: '#42a5f5', icon: <ArrowForwardIcon fontSize="small" /> };
      case 'warning': return { color: '#ffa726', icon: <WarningAmberIcon fontSize="small" /> };
      default:         return { color: '#bdbdbd', icon: <InfoOutlinedIcon fontSize="small" /> };
    }
  };

  const steps = isEditMode ? ['Verify Identity', 'Modify Privileges', 'Complete'] : ['Personal Details', 'Access Privileges', 'Complete'];

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', py: 4 }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 4, color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
            {isEditMode ? <AdminPanelSettingsIcon sx={{ fontSize: 48, mr: 2 }} /> : <LockIcon sx={{ fontSize: 48, mr: 2 }} />}
            <Typography variant="h3" fontWeight="bold">
              {isEditMode ? "Identity Modification" : "Enrollment Portal"}
            </Typography>
          </Box>
        </Box>

        <Paper elevation={6} sx={{ p: 4, borderRadius: 3 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}><StepLabel>{label}</StepLabel></Step>
            ))}
          </Stepper>

          {activeStep === 0 && (
            <Box>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <PersonIcon sx={{ mr: 1, color: '#1976d2' }} />
                Personal Identity Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Username (Common Name)" 
                    variant="outlined" fullWidth required
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)}
                    onBlur={() => setUsername(username.trim())}
                    disabled={loading || isEditMode}
                    InputProps={{ startAdornment: <PersonIcon sx={{ mr: 1, color: 'action.active' }} /> }}
                    helperText={username.endsWith(' ') ? "Trailing spaces will be removed" : ""}
                    error={username.endsWith(' ')}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Email Address" type="email" variant="outlined" fullWidth required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Organizational Unit" variant="outlined" fullWidth required value={orgUnit} onChange={(e) => setOrgUnit(e.target.value)} disabled={loading} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Organization" variant="outlined" fullWidth required value={org} onChange={(e) => setOrg(e.target.value)} disabled={loading} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="State/Province" variant="outlined" fullWidth required value={state} onChange={(e) => setState(e.target.value)} disabled={loading} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Country Code" variant="outlined" fullWidth required value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} disabled={loading} />
                </Grid>
              </Grid>
            </Box>
          )}

          {activeStep === 1 && (
            <Box>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AdminPanelSettingsIcon sx={{ mr: 1, color: '#1976d2' }} />
                Service Access Matrix (Live Environment)
              </Typography>
              <Grid container spacing={2}>
                {dynamicServices.map((service) => {
                  const rawRolesList = typeof service.roles === 'string' 
                    ? JSON.parse(service.roles) 
                    : service.roles;

                  return (
                    <Grid item xs={12} sm={6} md={4} key={service.id}>
                      <Card variant="outlined" sx={{ height: '100%' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <VpnKeyIcon sx={{ mr: 1, color: '#1976d2' }} />
                            <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 'bold' }}>
                              {service.name}
                            </Typography>
                          </Box>
                          <FormControl fullWidth>
                            <InputLabel>Access Role</InputLabel>
                            <Select
                              value={serviceRoles[service.name] || "NA"}
                              label="Access Role"
                              onChange={(e) => handleRoleChange(service.name, e.target.value)}
                              disabled={loading}
                            >
                              {rawRolesList?.map(r => (
                                <MenuItem key={r} value={r}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: getRoleColor(r), mr: 1 }} />
                                    {r}
                                  </Box>
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <Box sx={{ mt: 1 }}>
                            <Chip 
                              size="small" 
                              label={serviceRoles[service.name] || "NA"} 
                              sx={{ bgcolor: getRoleColor(serviceRoles[service.name] || "NA"), color: 'white', fontWeight: 'bold' }} 
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          )}

          {activeStep === 2 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircleIcon sx={{ fontSize: 100, color: '#4caf50', mb: 2 }} />
              <Typography variant="h4" gutterBottom fontWeight="bold" color="success.main">
                {isEditMode ? 'Update Successful!' : 'Enrollment Successful!'}
              </Typography>
              <Card variant="outlined" sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5' }}>
                <Typography variant="h6">{username}</Typography>
                <Typography variant="body2">{email}</Typography>
              </Card>
              <Button variant="contained" size="large" onClick={() => navigate('/admin-dashboard')} sx={{ mt: 3 }}>
                Return to Dashboard
              </Button>
            </Box>
          )}

          {status.msg && activeStep !== 2 && <Alert severity={status.type} sx={{ mt: 3 }}>{status.msg}</Alert>}

          {activeStep < 2 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button disabled={activeStep === 0 || loading} onClick={handleBack} size="large">Back</Button>
              {activeStep === 1 ? (
                <Button variant="contained" size="large" onClick={handleEnrollment} disabled={loading} sx={{ minWidth: 200, background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)' }}>
                  {loading ? 'Processing...' : (isEditMode ? 'Modify Certificate' : 'Complete Enrollment')}
                </Button>
              ) : (
                <Button variant="contained" size="large" onClick={handleNext} sx={{ minWidth: 120 }}>Next</Button>
              )}
            </Box>
          )}

          {activeStep >= 0 && (
            <Box sx={{ mt: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', mb: 1 }} onClick={() => setShowLogs(!showLogs)}>
                <Typography variant="subtitle2" color="textSecondary">🔍 LIVE SECURITY LOGS</Typography>
                <IconButton size="small">{showLogs ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
              </Box>
              <Collapse in={showLogs}>
                <Box ref={logContainerRef} sx={{ bgcolor: '#1e1e1e', borderRadius: 2, maxHeight: 250, overflowY: 'auto', border: '1px solid #333', p: 1 }}>
                  {logs.map((log, index) => {
                    const style = getLogStyle(log.type);
                    return (
                      <Box key={index} sx={{ display: 'flex', alignItems: 'start', mb: 1, p: 1, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.03)' }}>
                        <Box sx={{ color: style.color, mr: 1.5, mt: 0.5 }}>{style.icon}</Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 0.5 }}>{log.timestamp}</Typography>
                          <Typography variant="body2" sx={{ color: '#eee', fontFamily: 'monospace' }}>{log.message}</Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Collapse>
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
}