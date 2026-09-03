import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import {
  Container,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Box,
  CircularProgress,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Divider,
} from "@mui/material";

import {
  GppBad as RevokeIcon,
  PersonAdd as EnrollIcon,
  Refresh as ReissueIcon,
  Search as SearchIcon,
  Shield as ShieldIcon,
  Fingerprint as SerialIcon,
  Settings as SettingsIcon,
  Usb as UsbIcon,
} from "@mui/icons-material";

const REVOCATION_REASONS = [
  {
    value: "unspecified",
    label: "Unspecified",
  },
  {
    value: "keyCompromise",
    label: "Key Compromise",
  },
  {
    value: "CACompromise",
    label: "CA Compromise",
  },
  {
    value: "affiliationChanged",
    label: "Affiliation Changed",
  },
  {
    value: "superseded",
    label: "Superseded",
  },
  {
    value: "cessationOfOperation",
    label: "Cessation of Operation",
  },
];

const AdminDashboard = () => {
  const navigate = useNavigate();

  // --------------------------------------------------
  // USERS
  // --------------------------------------------------

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // --------------------------------------------------
  // FILTERS
  // --------------------------------------------------

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // --------------------------------------------------
  // REISSUE
  // --------------------------------------------------

  const [fetchingUser, setFetchingUser] = useState(null);

  // --------------------------------------------------
  // REVOCATION
  // --------------------------------------------------

  const [revokeModal, setRevokeModal] = useState({
    open: false,
    user: null,
  });

  const [selectedReason, setSelectedReason] =
    useState("unspecified");

  // --------------------------------------------------
  // FETCH USERS
  // --------------------------------------------------

  const fetchUsers = async () => {
    setLoading(true);

    try {
      const res = await fetch(
        "http://localhost:5000/api/admin/get-user-detail"
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (
        data.success &&
        Array.isArray(data.userdetail)
      ) {
        setUsers(data.userdetail);
      } else {
        setUsers([]);

        console.error(
          "Invalid user data:",
          data
        );
      }
    } catch (err) {
      console.error(
        "Connection Error:",
        err
      );

      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // --------------------------------------------------
  // DATE FORMAT
  // --------------------------------------------------

  const formatDate = (rawDate) => {
    if (
      !rawDate ||
      rawDate === "null"
    ) {
      return "N/A";
    }

    try {
      const dateString = String(rawDate);

      if (dateString.length < 6) {
        return "N/A";
      }

      const year =
        `20${dateString.substring(0, 2)}`;

      const month =
        dateString.substring(2, 4);

      const day =
        dateString.substring(4, 6);

      const date = new Date(
        `${year}-${month}-${day}`
      );

      if (Number.isNaN(date.getTime())) {
        return "N/A";
      }

      return date.toLocaleDateString(
        "en-GB",
        {
          year: "numeric",
          month: "short",
          day: "numeric",
        }
      );
    } catch (error) {
      console.error(
        "Date formatting error:",
        error
      );

      return "N/A";
    }
  };

  // --------------------------------------------------
  // FILTER USERS
  // --------------------------------------------------

  const filteredUsers = useMemo(() => {
    return users
      .filter((cert) => {
        const name = cert.username
          ? String(cert.username).toLowerCase()
          : "";

        // Never show admin account
        if (name === "admin") {
          return false;
        }

        const matchesSearch =
          name.includes(
            searchTerm.toLowerCase()
          );

        const matchesStatus =
          statusFilter === "All" ||
          cert.status === statusFilter;

        return (
          matchesSearch &&
          matchesStatus
        );
      })
      .sort((a, b) => {
        if (
          !a.expiration ||
          !b.expiration
        ) {
          return 0;
        }

        return String(
          a.expiration
        ).localeCompare(
          String(b.expiration)
        );
      });
  }, [
    users,
    searchTerm,
    statusFilter,
  ]);

  // --------------------------------------------------
  // OPEN CONNECTED TOKENS
  // --------------------------------------------------

  const handleSelectToken = () => {
    /*
     * ConnectedTokens is a reusable page.
     *
     * It handles:
     * - Token detection
     * - Token selection
     * - PIN entry
     * - Token login
     *
     * After successful connection it uses
     * navigate(-1) to return here.
     */

    navigate("/connected-tokens");
  };

  // --------------------------------------------------
  // REISSUE
  // --------------------------------------------------

  const handleReissueClick = async (
    targetUsername
  ) => {
    if (!targetUsername) {
      return;
    }

    setFetchingUser(targetUsername);

    try {
      const res = await fetch(
        `http://localhost:5000/api/admin/user-details/${encodeURIComponent(
          targetUsername
        )}`
      );

      if (!res.ok) {
        throw new Error(
          `HTTP ${res.status}`
        );
      }

      const data = await res.json();

      if (data.success) {
        navigate("/enroll", {
          state: {
            editUser: data.user,
          },
        });
      } else {
        window.alert(
          "Error: " +
            (
              data.message ||
              "Unable to fetch user details."
            )
        );
      }
    } catch (err) {
      console.error(
        "Fetch error:",
        err
      );

      window.alert(
        "Backend connection failed."
      );
    } finally {
      setFetchingUser(null);
    }
  };

  // --------------------------------------------------
  // OPEN REVOKE MODAL
  // --------------------------------------------------

  const openRevokeModal = (user) => {
    setSelectedReason("unspecified");

    setRevokeModal({
      open: true,
      user,
    });
  };

  // --------------------------------------------------
  // CLOSE REVOKE MODAL
  // --------------------------------------------------

  const closeRevokeModal = () => {
    setRevokeModal({
      open: false,
      user: null,
    });
  };

  // --------------------------------------------------
  // CONFIRM REVOCATION
  // --------------------------------------------------

  const handleConfirmRevocation =
    async () => {
      if (!revokeModal.user) {
        return;
      }

      try {
        const res = await fetch(
          "http://localhost:5000/api/admin/revoke",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              username:
                revokeModal.user.username,

              serial:
                revokeModal.user.serial,

              reason: selectedReason,
            }),
          }
        );

        if (!res.ok) {
          throw new Error(
            `HTTP ${res.status}`
          );
        }

        const data = await res.json();

        if (data.success) {
          closeRevokeModal();

          await fetchUsers();
        } else {
          window.alert(
            "Revocation failed: " +
              (
                data.message ||
                "Unknown error."
              )
          );
        }
      } catch (err) {
        console.error(
          "Revocation network error:",
          err
        );

        window.alert(
          "Failed to communicate with the PKI backend."
        );
      }
    };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <Container
      maxWidth="lg"
      sx={{
        mt: 4,
        mb: 4,
      }}
    >
      {/* ==================================================
          HEADER
      ================================================== */}

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={4}
        gap={2}
        flexWrap="wrap"
      >
        {/* TITLE */}

        <Box
          display="flex"
          alignItems="center"
          gap={1.5}
        >
          <ShieldIcon
            color="primary"
            sx={{
              fontSize: 35,
            }}
          />

          <Box>
            <Typography
              variant="h5"
              fontWeight="800"
              sx={{
                letterSpacing:
                  "-0.5px",
              }}
            >
              PKI COMMAND CENTER
            </Typography>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                textTransform:
                  "uppercase",
                fontWeight: 600,
              }}
            >
              Access Control &
              Revocation Management
            </Typography>
          </Box>
        </Box>

        {/* ==================================================
            ACTION BUTTONS
        ================================================== */}

        <Box
          display="flex"
          gap={1.5}
          alignItems="center"
          flexWrap="wrap"
        >
          {/* SERVICE MANAGEMENT */}

          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() =>
              navigate(
                "/admin/service-managemnt"
              )
            }
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              borderWidth: "2px",

              "&:hover": {
                borderWidth: "2px",
              },
            }}
          >
            Manage Services
          </Button>

          {/* TOKEN SELECTION */}

          <Button
            variant="outlined"
            startIcon={<UsbIcon />}
            onClick={handleSelectToken}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              borderWidth: "2px",

              "&:hover": {
                borderWidth: "2px",
              },
            }}
          >
            Select Token
          </Button>

          {/* ENROLL */}

          <Button
            variant="contained"
            disableElevation
            startIcon={<EnrollIcon />}
            onClick={() =>
              navigate("/enroll")
            }
            sx={{
              borderRadius: 2,
              bgcolor:
                "primary.main",
              fontWeight: 700,
            }}
          >
            Enroll Identity
          </Button>
        </Box>
      </Box>

      {/* ==================================================
          FILTER BAR
      ================================================== */}

      <Paper
        sx={{
          p: 2,
          mb: 3,
          display: "flex",
          gap: 2,
          borderRadius: 2,
          flexWrap: "wrap",
        }}
      >
        <TextField
          placeholder="Search identity..."
          variant="outlined"
          size="small"
          sx={{
            flexGrow: 1,
            minWidth: 250,
          }}
          value={searchTerm}
          onChange={(e) =>
            setSearchTerm(
              e.target.value
            )
          }
          InputProps={{
            startAdornment: (
              <SearchIcon
                sx={{
                  mr: 1,
                  color:
                    "action.active",
                }}
              />
            ),
          }}
        />

        <FormControl
          size="small"
          sx={{
            minWidth: 160,
          }}
        >
          <InputLabel id="status-filter-label">
            Status
          </InputLabel>

          <Select
            labelId="status-filter-label"
            label="Status"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value
              )
            }
          >
            <MenuItem value="All">
              All Statuses
            </MenuItem>

            <MenuItem value="Valid">
              Valid
            </MenuItem>

            <MenuItem value="Revoked">
              Revoked
            </MenuItem>
          </Select>
        </FormControl>
      </Paper>

      {/* ==================================================
          USER TABLE
      ================================================== */}

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 2,
          border:
            "1px solid #e0e0e0",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <Box
            p={10}
            textAlign="center"
          >
            <CircularProgress
              thickness={5}
            />
          </Box>
        ) : (
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    bgcolor:
                      "#f8f9fa",
                  }}
                >
                  STATUS
                </TableCell>

                <TableCell
                  sx={{
                    fontWeight: 700,
                    bgcolor:
                      "#f8f9fa",
                  }}
                >
                  IDENTITY
                </TableCell>

                <TableCell
                  sx={{
                    fontWeight: 700,
                    bgcolor:
                      "#f8f9fa",
                  }}
                >
                  SERIAL
                </TableCell>

                <TableCell
                  sx={{
                    fontWeight: 700,
                    bgcolor:
                      "#f8f9fa",
                  }}
                >
                  EXPIRATION
                </TableCell>

                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 700,
                    bgcolor:
                      "#f8f9fa",
                  }}
                >
                  MANAGEMENT
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {filteredUsers.length ===
              0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    align="center"
                    sx={{
                      py: 6,
                      color:
                        "text.secondary",
                    }}
                  >
                    No identities found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map(
                  (user) => (
                    <TableRow
                      key={user.serial}
                      hover
                    >
                      {/* STATUS */}

                      <TableCell>
                        <Chip
                          label={
                            user.status
                          }
                          color={
                            user.status ===
                            "Valid"
                              ? "success"
                              : "error"
                          }
                          size="small"
                          sx={{
                            fontWeight:
                              "bold",
                            px: 1,
                          }}
                        />
                      </TableCell>

                      {/* IDENTITY */}

                      <TableCell>
                        <Typography
                          variant="subtitle2"
                          fontWeight="700"
                        >
                          {
                            user.username
                          }
                        </Typography>
                      </TableCell>

                      {/* SERIAL */}

                      <TableCell>
                        <Box
                          display="flex"
                          alignItems="center"
                          gap={0.5}
                        >
                          <SerialIcon
                            sx={{
                              fontSize: 14,
                              color:
                                "text.secondary",
                            }}
                          />

                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily:
                                "Monaco, monospace",
                              color:
                                "text.secondary",
                            }}
                          >
                            {
                              user.serial
                            }
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* EXPIRATION */}

                      <TableCell>
                        {formatDate(
                          user.expiration
                        )}
                      </TableCell>

                      {/* MANAGEMENT */}

                      <TableCell align="right">
                        <Tooltip
                          title={
                            user.status ===
                            "Revoked"
                              ? "Cannot reissue revoked certificate"
                              : "Modify / Reissue"
                          }
                        >
                          <span>
                            <IconButton
                              color="primary"
                              size="small"
                              onClick={() =>
                                handleReissueClick(
                                  user.username
                                )
                              }
                              disabled={
                                fetchingUser ===
                                  user.username ||
                                user.status ===
                                  "Revoked"
                              }
                            >
                              {fetchingUser ===
                              user.username ? (
                                <CircularProgress
                                  size={20}
                                />
                              ) : (
                                <ReissueIcon fontSize="small" />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>

                        <Tooltip title="Revoke certificate">
                          <span>
                            <IconButton
                              color="error"
                              size="small"
                              disabled={
                                user.status ===
                                "Revoked"
                              }
                              onClick={() =>
                                openRevokeModal(
                                  user
                                )
                              }
                            >
                              <RevokeIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  )
                )
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* ==================================================
          REVOCATION DIALOG
      ================================================== */}

      <Dialog
        open={revokeModal.open}
        onClose={closeRevokeModal}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle
          sx={{
            fontWeight: "bold",
          }}
        >
          Revocation Confirmation
        </DialogTitle>

        <DialogContent>
          <Alert
            severity="warning"
            sx={{
              mb: 2,
              mt: 1,
            }}
          >
            This will push Serial{" "}
            <b>
              {
                revokeModal
                  .user?.serial
              }
            </b>{" "}
            to the CRL engine.
          </Alert>

          <Typography
            variant="body2"
            sx={{
              mb: 3,
            }}
          >
            Are you sure you want to
            invalidate the identity for{" "}
            <b>
              {
                revokeModal
                  .user?.username
              }
            </b>
            ?
          </Typography>

          <Divider
            sx={{
              mb: 3,
            }}
          />

          <FormControl
            fullWidth
            size="small"
          >
            <InputLabel id="revocation-reason-label">
              Reason Code
            </InputLabel>

            <Select
              labelId="revocation-reason-label"
              label="Reason Code"
              value={selectedReason}
              onChange={(e) =>
                setSelectedReason(
                  e.target.value
                )
              }
            >
              {REVOCATION_REASONS.map(
                (reason) => (
                  <MenuItem
                    key={reason.value}
                    value={
                      reason.value
                    }
                  >
                    {reason.label}
                  </MenuItem>
                )
              )}
            </Select>
          </FormControl>
        </DialogContent>

        <DialogActions
          sx={{
            p: 2,
            pt: 0,
          }}
        >
          <Button
            onClick={
              closeRevokeModal
            }
            color="inherit"
          >
            Cancel
          </Button>

          <Button
            onClick={
              handleConfirmRevocation
            }
            variant="contained"
            color="error"
            autoFocus
          >
            Confirm Revocation
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminDashboard;