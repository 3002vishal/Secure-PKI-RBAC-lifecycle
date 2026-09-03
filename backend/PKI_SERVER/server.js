const express = require("express");
const cors = require("cors");
const authController = require("./controllers/authController");
const certController = require("./controllers/certController");
const { verifyAccess } = require("./middleware/authMiddleware");
// top of server.js
const adminController = require('./controllers/adminController'); // Added the 'r'
require('dotenv').config();
const serviceRoutes = require('./routes/serviceRoutes')
const createServiceRoutes = require('./routes/createServiceRoutes')
// route line

const app = express();
const PORT = process.env.PORT;

// Middleware
app.use(express.json());
app.use(cors({ origin: true, credentials: false }));

// Authentication Routes
app.get("/auth/challenge/:user", authController.getChallenge);
app.post("/api/login", authController.login);

// Certificate Management Routes
app.post("/api/enroll", certController.enroll);
app.post("/find",certController.find);
app.post("/api/admin/revoke", certController.revoke);
app.post("/api/verify-certificate", certController.verify);
app.get("/api/admin/get-user-detail",certController.getUserList);
app.post("/api/modify", certController.modify);
app.get("/api/admin/user-details/:username",adminController.getUserDetailsForEdit);

app.use('/api/services',serviceRoutes);
app.use('/',createServiceRoutes);



app.listen(PORT, () => console.log(`✅ Zero Trust Server running on http://localhost:${PORT}`));