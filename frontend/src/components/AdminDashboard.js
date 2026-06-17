import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, Typography, Button, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton, 
  Tooltip, Box, CircularProgress, TextField, MenuItem, Select, 
  FormControl, Divider, Dialog, DialogTitle, 
  DialogContent, DialogActions, Alert
} from '@mui/material';
import { 
  GppBad as RevokeIcon, 
  PersonAdd as EnrollIcon,
  Refresh as ReissueIcon,
  Search as SearchIcon,
  Shield as ShieldIcon,
  Fingerprint as SerialIcon
} from '@mui/icons-material';

const REVOCATION_REASONS = [
  { value: 'unspecified', label: 'Unspecified' },
  { value: 'keyCompromise', label: 'Key Compromise' },
  { value: 'CACompromise', label: 'CA Compromise' },
  { value: 'affiliationChanged', label: 'Affiliation Changed' },
  { value: 'superseded', label: 'Superseded' },
  { value: 'cessationOfOperation', label: 'Cessation of Operation' }
];

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [fetchingUser, setFetchingUser] = useState(null);
  const navigate = useNavigate();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/admin/get-user-detail');
      const data = await res.json();
      if (data.success && Array.isArray(data.userdetail)) {
        setUsers(data.userdetail);
      }
    } catch (err) {
      console.error("Connection Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const formatDate = (rawDate) => {
    if (!rawDate || rawDate === 'null') return 'N/A';
    const year = `20${rawDate.substring(0, 2)}`;
    const month = rawDate.substring(2, 4);
    const day = rawDate.substring(4, 6);
    return new Date(`${year}-${month}-${day}`).toLocaleDateString('en-GB', { 
      year: 'numeric', month: 'short', day: 'numeric' 
    });
  };

  const filteredUsers = useMemo(() => {
    return users
      .filter((cert) => {
        const name = cert.username.toLowerCase();
        if (name === "admin") return false;
        const matchesSearch = name.includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || cert.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => a.expiration.localeCompare(b.expiration));
  }, [users, searchTerm, statusFilter]);

  const handleReissueClick = async (targetUsername) => {
    setFetchingUser(targetUsername);
    try {
      const res = await fetch(`http://localhost:5000/api/admin/user-details/${targetUsername}`);
      const data = await res.json();
      if (data.success) {
        navigate('/enroll', { state: { editUser: data.user } });
      } else {
        alert("Error: " + data.message);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      alert("Backend connection failed.");
    } finally {
      setFetchingUser(null);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* SECURITY HEADER */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <ShieldIcon color="primary" sx={{ fontSize: 35 }} />
          <Box>
            <Typography variant="h5" fontWeight="800" sx={{ letterSpacing: '-0.5px' }}>
              PKI COMMAND CENTER
            </Typography>
            <Typography variant="caption" color="textSecondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
              Access Control & Revocation Management
            </Typography>
          </Box>
        </Box>
        <Button 
          variant="contained" 
          disableElevation
          startIcon={<EnrollIcon />} 
          onClick={() => navigate('/enroll')}
          sx={{ borderRadius: 2, bgcolor: 'primary.main', fontWeight: 700 }}
        >
          Enroll Identity
        </Button>
      </Box>

      {/* FILTER BAR */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 2, borderRadius: 2 }}>
        <TextField 
          placeholder="Search identity..." 
          variant="outlined" size="small" sx={{ flexGrow: 1 }} 
          value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} /> }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <MenuItem value="All">All Statuses</MenuItem>
            <MenuItem value="Valid">Valid</MenuItem>
            <MenuItem value="Revoked">Revoked</MenuItem>
          </Select>
        </FormControl>
      </Paper>

      {/* DATA TABLE */}
      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2, border: '1px solid #e0e0e0' }}>
        {loading ? (
          <Box p={10} textAlign="center"><CircularProgress thickness={5} /></Box>
        ) : (
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8f9fa' }}>STATUS</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8f9fa' }}>IDENTITY</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8f9fa' }}>SERIAL</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8f9fa' }}>EXPIRATION</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#f8f9fa' }}>MANAGEMENT</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.serial} hover>
                  <TableCell>
                    <Chip 
                      label={user.status} 
                      color={user.status === 'Valid' ? 'success' : 'error'} 
                      size="small" 
                      sx={{ fontWeight: 'bold', px: 1 }} 
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight="700">{user.username}</Typography>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <SerialIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontFamily: 'Monaco, monospace', color: 'text.secondary' }}>
                        {user.serial}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{formatDate(user.expiration)}</TableCell>
                  <TableCell align="right">
                    
                    {/* MODIFIED: Reissue button now disables if status is Revoked */}
                    <Tooltip title={user.status === 'Revoked' ? "Cannot reissue revoked certificate" : "Modify / Reissue"}>
                        <span> {/* Span wrapper ensures tooltip works on disabled buttons */}
                          <IconButton 
                            color="primary" 
                            size="small" 
                            onClick={() => handleReissueClick(user.username)}
                            // Disables if currently fetching OR if the certificate is revoked
                            disabled={fetchingUser === user.username || user.status === 'Revoked'}
                          >
                            {fetchingUser === user.username ? <CircularProgress size={20} /> : <ReissueIcon fontSize="small" />}
                          </IconButton>
                        </span>
                    </Tooltip>

                    <IconButton 
                      color="error" 
                      size="small" 
                      disabled={user.status === 'Revoked'} 
                      onClick={() => handleRevoke(user.username)}
                    >
                      <RevokeIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* SECURITY CONFIRMATION DIALOG */}
      <Dialog open={revokeModal.open} onClose={() => setRevokeModal({ open: false, user: null })}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Revocation Confirmation</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will push Serial <b>{revokeModal.user?.serial}</b> to the CRL.
          </Alert>
          <Typography variant="body2">
            Are you sure you want to revoke <b>{revokeModal.user?.username}</b>? 
            Reason: <b>{revocationReasons[revokeModal.user?.username] || 'unspecified'}</b>.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRevokeModal({ open: false, user: null })} color="inherit">Cancel</Button>
          <Button onClick={handleRevoke} variant="contained" color="error" autoFocus>
            Confirm Revocation
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminDashboard;