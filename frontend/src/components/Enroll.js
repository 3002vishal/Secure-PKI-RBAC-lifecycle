import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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
  Alert,
  CircularProgress,
  Grid,
  Chip,
  Collapse,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Box
} from '@mui/material';

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


// --------------------------------------------------
// ROLE COLOR
// --------------------------------------------------

const getRoleColor = (roleName) => {
  if (!roleName) {
    return '#90a4ae';
  }

  if (roleName === 'NA') {
    return '#f30b39';
  }

  const lower = String(roleName).toLowerCase();

  if (lower.includes('admin')) {
    return '#ff8a65';
  }

  if (lower.includes('operator')) {
    return '#81c784';
  }

  if (lower.includes('auditor')) {
    return '#ce93d8';
  }

  if (lower.includes('analyst')) {
    return '#4fc3f7';
  }

  if (lower.includes('user')) {
    return '#64b5f6';
  }

  return '#90a4ae';
};


// --------------------------------------------------
// MAIN COMPONENT
// --------------------------------------------------

export default function App() {

  const navigate = useNavigate();

  // --------------------------------------------------
  // STEP MANAGEMENT
  // --------------------------------------------------

  const [activeStep, setActiveStep] = useState(0);


  // --------------------------------------------------
  // SERVICES / ROLES
  // --------------------------------------------------

  const [dynamicServices, setDynamicServices] = useState([]);
  const [serviceRoles, setServiceRoles] = useState({});


  // --------------------------------------------------
  // PERSONAL INFORMATION
  // --------------------------------------------------

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [orgUnit, setOrgUnit] = useState('');
  const [org, setOrg] = useState('');
  const [locality, setLocality] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('IN');


  // --------------------------------------------------
  // TOKEN PIN
  // --------------------------------------------------

  const [pin, setPin] = useState('');


  // --------------------------------------------------
  // UI STATES
  // --------------------------------------------------

  const [loading, setLoading] = useState(false);

  const [status, setStatus] = useState({
    type: '',
    msg: ''
  });

  const [logs, setLogs] = useState([]);

  const [showLogs, setShowLogs] = useState(true);

  const logContainerRef = useRef(null);


  // --------------------------------------------------
  // LOAD ACTIVE SERVICES
  // --------------------------------------------------

  useEffect(() => {

    const loadActiveServices = async () => {

      try {

        const endpoint = 'http://localhost:5000/api/services';

        addInitialLog(
          `Loading active services from ${endpoint}...`,
          'process'
        );

        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            Accept: 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(
            `Service API returned HTTP ${response.status}`
          );
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error(
            'Invalid service API response. Expected an array.'
          );
        }

        setDynamicServices(data);

        // --------------------------------------------------
        // CREATE DEFAULT ROLE MATRIX
        // --------------------------------------------------

        const initialMatrix = {};

        data.forEach((service) => {

          if (service && service.name) {
            initialMatrix[service.name] = 'NA';
          }

        });

        setServiceRoles(initialMatrix);

        setLogs([
          {
            message:
              'System initialized. Dynamic microservices and roles matrix synced successfully.',
            type: 'info',
            timestamp: new Date().toLocaleTimeString()
          },
          {
            message:
              `Loaded ${data.length} active service(s).`,
            type: 'success',
            timestamp: new Date().toLocaleTimeString()
          }
        ]);

      } catch (err) {

        console.error(
          'Failed to sync service registry matrix:',
          err
        );

        setLogs([
          {
            message:
              'System initialization started.',
            type: 'info',
            timestamp: new Date().toLocaleTimeString()
          },
          {
            message:
              `CRITICAL SCHEMA ERROR: Unable to load services. Details: ${err.message}`,
            type: 'error',
            timestamp: new Date().toLocaleTimeString()
          }
        ]);

      }

    };

    loadActiveServices();

  }, []);


  // --------------------------------------------------
  // INITIAL LOG
  // --------------------------------------------------

  const addInitialLog = (message, type = 'info') => {
    console.log(message);
  };


  // --------------------------------------------------
  // AUTO-SCROLL LOGS
  // --------------------------------------------------

  useEffect(() => {

    if (logContainerRef.current) {

      const {
        scrollHeight,
        clientHeight
      } = logContainerRef.current;

      logContainerRef.current.scrollTop =
        scrollHeight - clientHeight;

    }

  }, [logs]);


  // --------------------------------------------------
  // ADD LOG
  // --------------------------------------------------

  const addLog = (message, type = 'info') => {

    const timestamp =
      new Date().toLocaleTimeString();

    setLogs(prev => [
      ...prev,
      {
        message,
        type,
        timestamp
      }
    ]);

  };


  // --------------------------------------------------
  // ROLE CHANGE
  // --------------------------------------------------

  const handleRoleChange = (
    service,
    newRole
  ) => {

    setServiceRoles(prev => ({
      ...prev,
      [service]: newRole
    }));

    addLog(
      `Updated ${service} authorization assignment to: ${newRole}`,
      'info'
    );

  };


  // --------------------------------------------------
  // VALIDATE PERSONAL INFORMATION
  // --------------------------------------------------

  const validatePersonalInfo = () => {

    const cleanUsername = username.trim();
    const cleanEmail = email.trim();
    const cleanOrgUnit = orgUnit.trim();
    const cleanOrg = org.trim();
    const cleanLocality = locality.trim();
    const cleanState = state.trim();
    const cleanCountry = country.trim().toUpperCase();
    const cleanPin = pin.trim();


    // --------------------------------------------------
    // REQUIRED FIELDS
    // --------------------------------------------------

    if (
      !cleanUsername ||
      !cleanEmail ||
      !cleanOrgUnit ||
      !cleanOrg ||
      !cleanLocality ||
      !cleanState ||
      !cleanCountry
    ) {

      setStatus({
        type: 'error',
        msg: 'All personal information fields are required.'
      });

      return false;
    }


    // --------------------------------------------------
    // USERNAME VALIDATION
    // --------------------------------------------------

    if (cleanUsername.length < 2) {

      setStatus({
        type: 'error',
        msg: 'Username must contain at least 2 characters.'
      });

      return false;
    }


    // --------------------------------------------------
    // EMAIL VALIDATION
    // --------------------------------------------------

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanEmail)) {

      setStatus({
        type: 'error',
        msg: 'Please enter a valid email address.'
      });

      return false;
    }


    // --------------------------------------------------
    // COUNTRY VALIDATION
    // --------------------------------------------------

    if (!/^[A-Z]{2}$/.test(cleanCountry)) {

      setStatus({
        type: 'error',
        msg: 'Country must be a valid 2-letter ISO country code, for example IN.'
      });

      return false;
    }


    // --------------------------------------------------
    // PIN VALIDATION
    // --------------------------------------------------

    if (!cleanPin) {

      setStatus({
        type: 'error',
        msg: 'Token PIN is required.'
      });

      return false;
    }


    return true;

  };


  // --------------------------------------------------
  // VALIDATE SERVICE ROLES
  // --------------------------------------------------

  const validateServiceRoles = () => {

    if (!dynamicServices || dynamicServices.length === 0) {

      setStatus({
        type: 'error',
        msg: 'No active services are available. Please check the service registry.'
      });

      return false;
    }


    return true;

  };


  // --------------------------------------------------
  // NEXT STEP
  // --------------------------------------------------

  const handleNext = () => {

    if (activeStep === 0) {

      if (!validatePersonalInfo()) {
        return;
      }

    }


    if (activeStep === 1) {

      if (!validateServiceRoles()) {
        return;
      }

    }


    setStatus({
      type: '',
      msg: ''
    });

    setActiveStep(prev => prev + 1);

  };


  // --------------------------------------------------
  // BACK
  // --------------------------------------------------

  const handleBack = () => {

    if (loading) {
      return;
    }

    setActiveStep(prev => Math.max(0, prev - 1));

    setStatus({
      type: '',
      msg: ''
    });

  };


  // --------------------------------------------------
  // CERTIFICATE ENROLLMENT
  // --------------------------------------------------

  const handleEnrollment = async () => {

    if (!validatePersonalInfo()) {
      setActiveStep(0);
      return;
    }


    if (!validateServiceRoles()) {
      return;
    }


    setLoading(true);


    const endpoint =
      'http://localhost:8080/api/enrollment/enroll';


    setStatus({
      type: 'info',
      msg: 'Initiating secure certificate enrollment...'
    });


    addLog(
      `Starting certificate enrollment for user: ${username.trim()}`,
      'process'
    );


    try {

      // --------------------------------------------------
      // CLEAN VALUES
      // --------------------------------------------------

      const cleanUsername = username.trim();
      const cleanEmail = email.trim();
      const cleanOrg = org.trim();
      const cleanOrgUnit = orgUnit.trim();
      const cleanLocality = locality.trim();
      const cleanState = state.trim();
      const cleanCountry = country.trim().toUpperCase();
      const cleanPin = pin.trim();


      // --------------------------------------------------
      // COPY COMPLETE SERVICE ROLE MATRIX
      // --------------------------------------------------
      //
      // IMPORTANT:
      // Do NOT use Object.values(serviceRoles)[0].
      //
      // That would send only the first role and lose the
      // service -> role mapping.
      //
      // Example:
      //
      // {
      //   "PKI": "USER",
      //   "Vault": "ADMIN",
      //   "Audit": "NA"
      // }
      //
      // is sent completely to the backend.
      // --------------------------------------------------

      const selectedServiceRoles = {
        ...serviceRoles
      };


      addLog(
        `Selected service roles: ${JSON.stringify(selectedServiceRoles)}`,
        'info'
      );


      // --------------------------------------------------
      // REQUEST BODY
      // --------------------------------------------------

      const requestBody = {
        alias: cleanUsername,
        commonName: cleanUsername,
        email: cleanEmail,
        organization: cleanOrg,
        organizationalUnit: cleanOrgUnit,
        locality: cleanLocality,
        state: cleanState,
        country: cleanCountry,
        serviceRoles: selectedServiceRoles,
        pin: cleanPin
      };


      // --------------------------------------------------
      // DEBUG
      // --------------------------------------------------

      console.log(
        '========================================'
      );

      console.log(
        'ENROLLMENT ENDPOINT:',
        endpoint
      );

      console.log(
        'ENROLLMENT REQUEST BODY:',
        JSON.stringify(requestBody, null, 2)
      );

      console.log(
        '========================================'
      );


      addLog(
        `Connecting to Enrollment API: ${endpoint}`,
        'process'
      );


      addLog(
        `Request body: ${JSON.stringify(
          {
            ...requestBody,
            pin: '********'
          }
        )}`,
        'info'
      );


      addLog(
        'Sending certificate enrollment request to backend...',
        'process'
      );


      // --------------------------------------------------
      // API CALL
      // --------------------------------------------------

      const response = await fetch(
        endpoint,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },

          body: JSON.stringify(requestBody)
        }
      );


      // --------------------------------------------------
      // READ RESPONSE
      // --------------------------------------------------

      const responseText =
        await response.text();

      let result = null;


      try {

        result = responseText
          ? JSON.parse(responseText)
          : null;

      } catch (parseError) {

        console.error(
          'Failed to parse backend response:',
          parseError
        );

      }


      // --------------------------------------------------
      // HTTP ERROR
      // --------------------------------------------------

      if (!response.ok) {

        let errorMessage =
          `HTTP ${response.status}`;

        if (result) {

          errorMessage =
            result.error ||
            result.message ||
            result.details ||
            errorMessage;

        } else if (responseText) {

          errorMessage =
            responseText;

        }


        throw new Error(errorMessage);

      }


      // --------------------------------------------------
      // EMPTY RESPONSE
      // --------------------------------------------------

      if (!result) {

        throw new Error(
          'Backend returned an empty or invalid response.'
        );

      }


      console.log(
        'ENROLLMENT RESPONSE:',
        result
      );


      // --------------------------------------------------
      // SUCCESS
      // --------------------------------------------------

      if (
        result.success === true ||
        result.status === 'success'
      ) {

        addLog(
          'Certificate enrollment completed successfully.',
          'success'
        );


        if (result.alias) {

          addLog(
            `Certificate generated for alias: ${result.alias}`,
            'success'
          );

        }


        setStatus({
          type: 'success',
          msg: 'Certificate Enrollment Complete!'
        });


        setActiveStep(2);


      } else {

        throw new Error(
          result.error ||
          result.message ||
          'Certificate enrollment failed.'
        );

      }


    } catch (err) {

      console.error(
        'Certificate enrollment error:',
        err
      );


      setStatus({
        type: 'error',
        msg: `Certificate Enrollment Failed: ${err.message}`
      });


      addLog(
        `Enrollment error: ${err.message}`,
        'error'
      );

    } finally {

      setLoading(false);

    }

  };


  // --------------------------------------------------
  // LOG STYLE
  // --------------------------------------------------

  const getLogStyle = (type) => {

    switch (type) {

      case 'success':

        return {
          color: '#66bb6a',
          icon: (
            <CheckCircleOutlineIcon
              fontSize="small"
            />
          )
        };


      case 'error':

        return {
          color: '#ef5350',
          icon: (
            <ErrorOutlineIcon
              fontSize="small"
            />
          )
        };


      case 'process':

        return {
          color: '#42a5f5',
          icon: (
            <ArrowForwardIcon
              fontSize="small"
            />
          )
        };


      case 'warning':

        return {
          color: '#ffa726',
          icon: (
            <WarningAmberIcon
              fontSize="small"
            />
          )
        };


      default:

        return {
          color: '#bdbdbd',
          icon: (
            <InfoOutlinedIcon
              fontSize="small"
            />
          )
        };

    }

  };


  // --------------------------------------------------
  // STEPS
  // --------------------------------------------------

  const steps = [
    'Personal Details',
    'Access Privileges',
    'Complete'
  ];


  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (

    <Box
      sx={{
        minHeight: '100vh',
        background:
          'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        py: 4
      }}
    >

      <Container maxWidth="lg">

        {/* ==================================================
            HEADER
        ================================================== */}

        <Box
          sx={{
            textAlign: 'center',
            mb: 4,
            color: 'white'
          }}
        >

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2
            }}
          >

            <LockIcon
              sx={{
                fontSize: 48,
                mr: 2
              }}
            />

            <Typography
              variant="h3"
              fontWeight="bold"
            >
              Certificate Enrollment Portal
            </Typography>

          </Box>

        </Box>


        {/* ==================================================
            MAIN CARD
        ================================================== */}

        <Paper
          elevation={6}
          sx={{
            p: 4,
            borderRadius: 3
          }}
        >

          {/* ==================================================
              STEPPER
          ================================================== */}

          <Stepper
            activeStep={activeStep}
            sx={{ mb: 4 }}
          >

            {steps.map(label => (

              <Step key={label}>

                <StepLabel>
                  {label}
                </StepLabel>

              </Step>

            ))}

          </Stepper>


          {/* ==================================================
              STEP 1 - PERSONAL DETAILS
          ================================================== */}

          {activeStep === 0 && (

            <Box>

              <Typography
                variant="h5"
                gutterBottom
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mb: 3
                }}
              >

                <PersonIcon
                  sx={{
                    mr: 1,
                    color: '#1976d2'
                  }}
                />

                Personal Identity Information

              </Typography>


              <Grid
                container
                spacing={2}
              >

                {/* USERNAME */}

                <Grid
                  item
                  xs={12}
                  sm={6}
                >

                  <TextField
                    label="Username (Common Name)"
                    variant="outlined"
                    fullWidth
                    required
                    value={username}

                    onChange={(e) =>
                      setUsername(e.target.value)
                    }

                    onBlur={() =>
                      setUsername(username.trim())
                    }

                    disabled={loading}

                    InputProps={{
                      startAdornment: (
                        <PersonIcon
                          sx={{
                            mr: 1,
                            color: 'action.active'
                          }}
                        />
                      )
                    }}

                    helperText={
                      username.endsWith(' ')
                        ? 'Trailing spaces will be removed'
                        : ''
                    }

                    error={
                      username.endsWith(' ')
                    }
                  />

                </Grid>


                {/* EMAIL */}

                <Grid
                  item
                  xs={12}
                  sm={6}
                >

                  <TextField
                    label="Email Address"
                    type="email"
                    variant="outlined"
                    fullWidth
                    required
                    value={email}

                    onChange={(e) =>
                      setEmail(e.target.value)
                    }

                    disabled={loading}
                  />

                </Grid>


                {/* ORGANIZATIONAL UNIT */}

                <Grid
                  item
                  xs={12}
                  sm={6}
                >

                  <TextField
                    label="Organizational Unit"
                    variant="outlined"
                    fullWidth
                    required
                    value={orgUnit}

                    onChange={(e) =>
                      setOrgUnit(e.target.value)
                    }

                    disabled={loading}
                  />

                </Grid>


                {/* ORGANIZATION */}

                <Grid
                  item
                  xs={12}
                  sm={6}
                >

                  <TextField
                    label="Organization"
                    variant="outlined"
                    fullWidth
                    required
                    value={org}

                    onChange={(e) =>
                      setOrg(e.target.value)
                    }

                    disabled={loading}
                  />

                </Grid>


                {/* LOCALITY */}

                <Grid
                  item
                  xs={12}
                  sm={6}
                >

                  <TextField
                    label="Locality / City"
                    variant="outlined"
                    fullWidth
                    required
                    value={locality}

                    onChange={(e) =>
                      setLocality(e.target.value)
                    }

                    disabled={loading}
                  />

                </Grid>


                {/* STATE */}

                <Grid
                  item
                  xs={12}
                  sm={6}
                >

                  <TextField
                    label="State / Province"
                    variant="outlined"
                    fullWidth
                    required
                    value={state}

                    onChange={(e) =>
                      setState(e.target.value)
                    }

                    disabled={loading}
                  />

                </Grid>


                {/* COUNTRY */}

                <Grid
                  item
                  xs={12}
                  sm={6}
                >

                  <TextField
                    label="Country Code"
                    variant="outlined"
                    fullWidth
                    required
                    value={country}
                    inputProps={{
                      maxLength: 2
                    }}

                    onChange={(e) =>
                      setCountry(
                        e.target.value
                          .replace(/[^a-zA-Z]/g, '')
                          .slice(0, 2)
                          .toUpperCase()
                      )
                    }

                    disabled={loading}
                  />

                </Grid>


                {/* PIN */}

                <Grid
                  item
                  xs={12}
                  sm={6}
                >

                  <TextField
                    label="Token PIN"
                    type="password"
                    variant="outlined"
                    fullWidth
                    required
                    value={pin}

                    onChange={(e) =>
                      setPin(e.target.value)
                    }

                    disabled={loading}

                    InputProps={{
                      startAdornment: (
                        <VpnKeyIcon
                          sx={{
                            mr: 1,
                            color: 'action.active'
                          }}
                        />
                      )
                    }}
                  />

                </Grid>

              </Grid>

            </Box>

          )}


          {/* ==================================================
              STEP 2 - ACCESS PRIVILEGES
          ================================================== */}

          {activeStep === 1 && (

            <Box>

              <Typography
                variant="h5"
                gutterBottom
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mb: 1
                }}
              >

                <AdminPanelSettingsIcon
                  sx={{
                    mr: 1,
                    color: '#1976d2'
                  }}
                />

                Service Access Matrix

              </Typography>


              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 3 }}
              >

                Select the role that should be assigned
                to the certificate for each service.

              </Typography>


              {dynamicServices.length === 0 ? (

                <Alert
                  severity="warning"
                  sx={{ mb: 2 }}
                >
                  No active services were loaded from the
                  service registry.
                </Alert>

              ) : (

                <Grid
                  container
                  spacing={2}
                >

                  {dynamicServices.map(service => {

                    let rawRolesList = [];


                    // --------------------------------------------------
                    // PARSE SERVICE ROLES
                    // --------------------------------------------------

                    try {

                      if (typeof service.roles === 'string') {

                        const parsedRoles =
                          JSON.parse(service.roles);

                        if (Array.isArray(parsedRoles)) {
                          rawRolesList = parsedRoles;
                        }

                      } else if (
                        Array.isArray(service.roles)
                      ) {

                        rawRolesList =
                          service.roles;

                      }

                    } catch (error) {

                      console.error(
                        'Invalid service roles:',
                        service.roles,
                        error
                      );

                    }


                    // --------------------------------------------------
                    // ALWAYS PROVIDE NA
                    // --------------------------------------------------

                    const roles = [
                      'NA',
                      ...rawRolesList
                        .filter(role => role !== null)
                        .map(role => String(role))
                        .filter(role => role !== 'NA')
                    ];


                    return (

                      <Grid
                        item
                        xs={12}
                        sm={6}
                        md={4}
                        key={
                          service.id ??
                          service.name
                        }
                      >

                        <Card
                          variant="outlined"
                          sx={{
                            height: '100%'
                          }}
                        >

                          <CardContent>

                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                mb: 2
                              }}
                            >

                              <VpnKeyIcon
                                sx={{
                                  mr: 1,
                                  color: '#1976d2'
                                }}
                              />

                              <Typography
                                variant="h6"
                                sx={{
                                  fontSize: '1rem',
                                  fontWeight: 'bold'
                                }}
                              >

                                {service.name}

                              </Typography>

                            </Box>


                            <FormControl
                              fullWidth
                            >

                              <InputLabel>
                                Access Role
                              </InputLabel>

                              <Select
                                value={
                                  serviceRoles[
                                    service.name
                                  ] || 'NA'
                                }

                                label="Access Role"

                                onChange={(e) =>
                                  handleRoleChange(
                                    service.name,
                                    e.target.value
                                  )
                                }

                                disabled={loading}
                              >

                                {roles.map(role => (

                                  <MenuItem
                                    key={`${service.name}-${role}`}
                                    value={role}
                                  >

                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        width: '100%'
                                      }}
                                    >

                                      <Box
                                        sx={{
                                          width: 12,
                                          height: 12,
                                          borderRadius: '50%',
                                          bgcolor:
                                            getRoleColor(role),
                                          mr: 1
                                        }}
                                      />

                                      {role}

                                    </Box>

                                  </MenuItem>

                                ))}

                              </Select>

                            </FormControl>


                            <Box sx={{ mt: 1 }}>

                              <Chip
                                size="small"

                                label={
                                  serviceRoles[
                                    service.name
                                  ] || 'NA'
                                }

                                sx={{
                                  bgcolor:
                                    getRoleColor(
                                      serviceRoles[
                                        service.name
                                      ] || 'NA'
                                    ),

                                  color: 'white',

                                  fontWeight: 'bold'
                                }}
                              />

                            </Box>

                          </CardContent>

                        </Card>

                      </Grid>

                    );

                  })}

                </Grid>

              )}

            </Box>

          )}


          {/* ==================================================
              STEP 3 - COMPLETE
          ================================================== */}

          {activeStep === 2 && (

            <Box
              sx={{
                textAlign: 'center',
                py: 4
              }}
            >

              <CheckCircleIcon
                sx={{
                  fontSize: 100,
                  color: '#4caf50',
                  mb: 2
                }}
              />


              <Typography
                variant="h4"
                gutterBottom
                fontWeight="bold"
                color="success.main"
              >

                Certificate Enrollment Successful!

              </Typography>


              <Card
                variant="outlined"
                sx={{
                  mt: 3,
                  p: 2,
                  bgcolor: '#f5f5f5'
                }}
              >

                <Typography variant="h6">
                  {username}
                </Typography>

                <Typography variant="body2">
                  {email}
                </Typography>

                <Typography
                  variant="body2"
                  sx={{ mt: 1 }}
                >

                  Certificate has been successfully
                  enrolled on the hardware token.

                </Typography>

              </Card>


              <Button
                variant="contained"
                size="large"

                onClick={() =>
                  navigate('/admin-dashboard')
                }

                sx={{ mt: 3 }}
              >

                Return to Dashboard

              </Button>

            </Box>

          )}


          {/* ==================================================
              STATUS MESSAGE
          ================================================== */}

          {status.msg &&
            activeStep !== 2 && (

              <Alert
                severity={status.type || 'info'}
                sx={{ mt: 3 }}
              >

                {status.msg}

              </Alert>

            )}


          {/* ==================================================
              NAVIGATION BUTTONS
          ================================================== */}

          {activeStep < 2 && (

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                mt: 4
              }}
            >

              <Button
                disabled={
                  activeStep === 0 ||
                  loading
                }

                onClick={handleBack}

                size="large"
              >

                Back

              </Button>


              {activeStep === 1 ? (

                <Button
                  variant="contained"
                  size="large"

                  onClick={handleEnrollment}

                  disabled={
                    loading ||
                    dynamicServices.length === 0
                  }

                  sx={{
                    minWidth: 200,
                    background:
                      'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)'
                  }}
                >

                  {loading ? (

                    <>

                      <CircularProgress
                        size={22}
                        color="inherit"
                        sx={{ mr: 1 }}
                      />

                      Processing...

                    </>

                  ) : (

                    'Complete Enrollment'

                  )}

                </Button>

              ) : (

                <Button
                  variant="contained"
                  size="large"

                  onClick={handleNext}

                  disabled={loading}

                  sx={{
                    minWidth: 120
                  }}
                >

                  Next

                </Button>

              )}

            </Box>

          )}


          {/* ==================================================
              LIVE SECURITY LOGS
          ================================================== */}

          <Box sx={{ mt: 4 }}>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                mb: 1
              }}

              onClick={() =>
                setShowLogs(!showLogs)
              }
            >

              <Typography
                variant="subtitle2"
                color="textSecondary"
              >

                🔍 LIVE SECURITY LOGS

              </Typography>


              <IconButton size="small">

                {showLogs
                  ? <ExpandLessIcon />
                  : <ExpandMoreIcon />
                }

              </IconButton>

            </Box>


            <Collapse in={showLogs}>

              <Box
                ref={logContainerRef}

                sx={{
                  bgcolor: '#1e1e1e',
                  borderRadius: 2,
                  maxHeight: 250,
                  overflowY: 'auto',
                  border: '1px solid #333',
                  p: 1
                }}
              >

                {logs.length === 0 ? (

                  <Typography
                    variant="body2"
                    sx={{
                      color: '#888',
                      p: 1,
                      fontFamily: 'monospace'
                    }}
                  >

                    No logs available.

                  </Typography>

                ) : (

                  logs.map(
                    (log, index) => {

                      const style =
                        getLogStyle(
                          log.type
                        );


                      return (

                        <Box
                          key={`${log.timestamp}-${index}`}

                          sx={{
                            display: 'flex',
                            alignItems: 'start',
                            mb: 1,
                            p: 1,
                            borderRadius: 1,
                            bgcolor:
                              'rgba(255,255,255,0.03)'
                          }}
                        >

                          <Box
                            sx={{
                              color: style.color,
                              mr: 1.5,
                              mt: 0.5
                            }}
                          >

                            {style.icon}

                          </Box>


                          <Box>

                            <Typography
                              variant="caption"
                              sx={{
                                color: '#888',
                                display: 'block',
                                mb: 0.5
                              }}
                            >

                              {log.timestamp}

                            </Typography>


                            <Typography
                              variant="body2"
                              sx={{
                                color: '#eee',
                                fontFamily: 'monospace',
                                wordBreak: 'break-word'
                              }}
                            >

                              {log.message}

                            </Typography>

                          </Box>

                        </Box>

                      );

                    }
                  )

                )}

              </Box>

            </Collapse>

          </Box>

        </Paper>

      </Container>

    </Box>

  );

}