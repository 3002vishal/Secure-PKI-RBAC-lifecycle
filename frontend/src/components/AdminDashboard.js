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
  const navigate = useNavigate();

  // 1. Fetch Users
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

  // 2. Helper: Format OpenSSL Date (YYMMDDHHMMSSZ)
  const formatDate = (rawDate) => {
    if (!rawDate || rawDate === 'null') return 'N/A';
    // Format: 270227110423Z -> 2027-02-27
    const year = `20${rawDate.substring(0, 2)}`;
    const month = rawDate.substring(2, 4);
    const day = rawDate.substring(4, 6);
    
    const dateObj = new Date(`${year}-${month}-${day}`);
    return dateObj.toLocaleDateString('en-US', { 
      year: 'numeric', month: 'short', day: 'numeric' 
    });
  };

  // 3. Filter and Sort Logic
  const filteredUsers = useMemo(() => {
    return users
      .filter(user => {
        const matchesName = user.username.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || user.status === statusFilter;
        return matchesName && matchesStatus;
      })
      .sort((a, b) => {
        // Sort by nearest expiration date first
        return a.expiration.localeCompare(b.expiration);
      });
  }, [users, searchTerm, statusFilter]);

  // 4. Revoke Logic
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
      {/* Header Section */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary">PKI Control Center</Typography>
          <Typography variant="body2" color="textSecondary">Manage active and revoked identities</Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<EnrollIcon />} 
          onClick={() => navigate('/enroll')}
        >
          Enroll New User
        </Button>
      </Box>

      {/* Filters Section */}
      <Box display="flex" gap={2} mb={3}>
        <TextField 
          label="Search by Name"
          variant="outlined"
          size="small"
          sx={{ flexGrow: 1 }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} /> }}
        />
        <FormControl variant="outlined" size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            label="Status"
          >
            <MenuItem value="All">All Statuses</MenuItem>
            <MenuItem value="Valid">Valid</MenuItem>
            <MenuItem value="Revoked">Revoked</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Table Section */}
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
                <TableCell sx={{ fontWeight: 'bold' }}>Revocation Date</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <TableRow key={user.serial} hover>
                    <TableCell>
                      <Chip 
                        label={user.status.toUpperCase()} 
                        color={user.status === 'Valid' ? 'success' : 'error'} 
                        size="small" 
                        sx={{ fontWeight: 'bold' }}
                      />
                    </TableCell>
                    <TableCell><Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{user.username}</Typography></TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{user.serial}</TableCell>
                    <TableCell>{formatDate(user.expiration)}</TableCell>
                    <TableCell color="error">{formatDate(user.revocationDate)}</TableCell>
                    <TableCell align="right">
                      <IconButton color="primary" size="small"><ReissueIcon fontSize="small" /></IconButton>
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
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5 }}>No records match your filters.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>
    </Container>
  );
};

export default AdminDashboard;