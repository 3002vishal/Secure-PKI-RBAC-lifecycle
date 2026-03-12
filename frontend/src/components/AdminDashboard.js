import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, Typography, Button, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Paper, Chip, IconButton, 
  Tooltip, Box, CircularProgress, TextField, MenuItem, Select, FormControl, InputLabel
} from '@mui/material';
import { 
  DeleteForever as RevokeIcon, 
  PersonAdd as EnrollIcon,
  Refresh as ReissueIcon,
  Search as SearchIcon
} from '@mui/icons-material';

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [fetchingUser, setFetchingUser] = useState(null); // Local loading for reissue
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
      console.error("Error fetching user details:", err);
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
    return new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', { 
      year: 'numeric', month: 'short', day: 'numeric' 
    });
  };

  const filteredUsers = useMemo(() => {
    return users
      .filter(user => {
        const matchesName = user.username.toLowerCase().includes(searchTerm.toLowerCase()) && user.username !== "admin";
        const matchesStatus = statusFilter === 'All' || user.status === statusFilter;
        return matchesName && matchesStatus;
      })
      .sort((a, b) => a.expiration.localeCompare(b.expiration));
  }, [users, searchTerm, statusFilter]);

  // --- NEW REISSUE LOGIC ---
  const handleReissueClick = async (targetUsername) => {
    setFetchingUser(targetUsername);
    try {
      // 1. Fetch the full certificate details from your new API
      const res = await fetch(`http://localhost:5000/api/admin/user-details/${targetUsername}`);
      const data = await res.json();

      if (data.success) {
        // 2. Navigate to enroll and pass the FULL details extracted from the cert
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

  const handleRevoke = async (commonName) => {
    if (window.confirm(`Revoke certificate for ${commonName}?`)) {
      try {
        await fetch('http://localhost:5000/api/admin/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: commonName }) 
        });
        fetchUsers();
      } catch (err) {
        alert("Revocation failed");
      }
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 5, mb: 5 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary">PKI Control Center</Typography>
          <Typography variant="body2" color="textSecondary">Manage active and revoked identities</Typography>
        </Box>
        <Button variant="contained" startIcon={<EnrollIcon />} onClick={() => navigate('/enroll')}>
          Enroll New User
        </Button>
      </Box>

      <Box display="flex" gap={2} mb={3}>
        <TextField label="Search by Name" variant="outlined" size="small" sx={{ flexGrow: 1 }} 
          value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} /> }}
        />
        <FormControl variant="outlined" size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} label="Status">
            <MenuItem value="All">All Statuses</MenuItem>
            <MenuItem value="Valid">Valid</MenuItem>
            <MenuItem value="Revoked">Revoked</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <TableContainer component={Paper} elevation={6} sx={{ borderRadius: 3 }}>
        {loading ? (
          <Box p={8} textAlign="center"><CircularProgress /></Box>
        ) : (
          <Table>
            <TableHead sx={{ bgcolor: 'grey.100' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Username</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Serial</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Expiration Date</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.serial} hover>
                  <TableCell>
                    <Chip label={user.status.toUpperCase()} color={user.status === 'Valid' ? 'success' : 'error'} size="small" />
                  </TableCell>
                  <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{user.username}</Typography></TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{user.serial}</TableCell>
                  <TableCell>{formatDate(user.expiration)}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Modify / Reissue">
                        <IconButton 
                          color="primary" 
                          size="small" 
                          onClick={() => handleReissueClick(user.username)}
                          disabled={fetchingUser === user.username}
                        >
                          {fetchingUser === user.username ? <CircularProgress size={20} /> : <ReissueIcon fontSize="small" />}
                        </IconButton>
                    </Tooltip>
                    <IconButton color="error" size="small" disabled={user.status === 'Revoked'} onClick={() => handleRevoke(user.username)}>
                      <RevokeIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>
    </Container>
  );
};

export default AdminDashboard;