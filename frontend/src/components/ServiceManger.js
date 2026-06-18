import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Button, Card, CardContent, CardActions,
  Grid, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Chip, Stack
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import LanguageIcon from '@mui/icons-material/Language';

const API_BASE_URL = 'http://localhost:5000/api/services';

export default function ServiceManager() {
  const [services, setServices] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingService, setEditingService] = useState(null);
  
  // Form States
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [roleInput, setRoleInput] = useState('');
  const [roles, setRoles] = useState(['NA']); // "NA" included by default based on your schema

  // Fetch all services on load
  const fetchServices = async () => {
    try {
      const res = await fetch(API_BASE_URL);
      const data = await res.json();
      setServices(data);
    } catch (err) {
      console.error('Error fetching services:', err);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // Open dialog for adding/editing
  const handleOpenDialog = (service = null) => {
    if (service) {
      setEditingService(service);
      setName(service.name);
      setDescription(service.description);
      setTargetUrl(service.target_url);
      setRoles(typeof service.roles === 'string' ? JSON.parse(service.roles) : service.roles);
    } else {
      setEditingService(null);
      setName('');
      setDescription('');
      setTargetUrl('');
      setRoles(['NA']);
    }
    setOpenDialog(true);
  };

  // Add a tag/role to the local array
  const handleAddRole = () => {
    if (roleInput.trim() && !roles.includes(roleInput.trim())) {
      setRoles([...roles, roleInput.trim()]);
      setRoleInput('');
    }
  };

  // Remove a tag/role
  const handleRemoveRole = (roleToRemove) => {
    if (roleToRemove === 'NA') return; // Keep NA baseline protected
    setRoles(roles.filter((r) => r !== roleToRemove));
  };

  // Handle Save (Create or Update)
  const handleSave = async () => {
    const payload = { name, description, target_url: targetUrl, roles };
    const url = editingService ? `${API_BASE_URL}/${editingService.id}` : API_BASE_URL;
    const method = editingService ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setOpenDialog(false);
        fetchServices();
      }
    } catch (err) {
      console.error('Error saving service:', err);
    }
  };

  // Handle Delete
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this microservice entry?')) {
      try {
        const res = await fetch(`${API_BASE_URL}/${id}`, { method: 'DELETE' });
        if (res.ok) fetchServices();
      } catch (err) {
        console.error('Error deleting service:', err);
      }
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1" fontWeight="bold" color="primary">
          Zero Trust Service Registry
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ borderRadius: 2 }}
        >
          Add Service
        </Button>
      </Box>

      {/* Grid of Microservices */}
      <Grid container spacing={3}>
        {services.map((service) => {
          const serviceRoles = typeof service.roles === 'string' ? JSON.parse(service.roles) : service.roles;
          return (
            <Grid item xs={12} md={6} key={service.id}>
              <Card elevation={3} sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" component="h2" gutterBottom fontWeight="600">
                    {service.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: '40px' }}>
                    {service.description || "No description provided."}
                  </Typography>
                  
                  {/* Endpoint display */}
                  <Box display="flex" alignItems="center" gap={1} mb={2} bgcolor="action.hover" p={1} borderRadius={1}>
                    <LanguageIcon fontSize="small" color="action" />
                    <Typography variant="caption" component="code" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {service.target_url}
                    </Typography>
                  </Box>

                  {/* Roles Matrix chips */}
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Allowed Identity Roles:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap gap={1}>
                    {serviceRoles?.map((role, index) => (
                      <Chip key={index} label={role} size="small" color={role === 'NA' ? 'default' : 'primary'} variant="outlined" />
                    ))}
                  </Stack>
                </CardContent>

                <CardActions sx={{ justifyContent: 'flex-end', p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <IconButton color="info" onClick={() => handleOpenDialog(service)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton color="error" onClick={() => handleDelete(service.id)}>
                    <DeleteIcon />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Dynamic Modal Dialog for Add/Edit */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingService ? 'Modify Service Context' : 'Register New Microservice'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField label="Service Name" fullWidth value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., HSM Operation" />
            <TextField label="Description" fullWidth multiline rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            <TextField label="Target Backend URL Route" fullWidth value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="http://localhost:5000/services/..." />
            
            {/* Roles Matrix Construction Section */}
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                Configure Group Mapping Matrix
              </Typography>
              <Box display="flex" gap={1} mb={2}>
                <TextField label="Add Role Name" size="small" fullWidth value={roleInput} onChange={(e) => setRoleInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddRole()} />
                <Button variant="outlined" onClick={handleAddRole}>Add</Button>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap gap={1}>
                {roles.map((role, idx) => (
                  <Chip
                    key={idx}
                    label={role}
                    onDelete={role !== 'NA' ? () => handleRemoveRole(role) : undefined}
                    color="secondary"
                  />
                ))}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenDialog(false)} color="inherit">Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!name || !targetUrl}>
            Save Configuration
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}