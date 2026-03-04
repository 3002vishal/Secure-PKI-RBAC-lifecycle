import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./components/Login.js";
import Enroll from "./components/Enroll.js";
import ServicesSection from "./components/ServicesSection.js";
import Crypto from "./components/services/Crypto.js";
import Identity from "./components/services/Identity.js";
import Pki from "./components/services/Pki.js";
import Security from "./components/services/Security.js";
import Hsm from "./components/services/Hsm.js"; 
import Zerotrust from "./components/services/Zerotrust.js";
// IMPORTANT: Ensure AdminDashboard is exported as 'default' in its file
import AdminDashboard from "./components/AdminDashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin Route */}
        <Route path="/" element={<AdminDashboard />} />
        
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/enroll" element={<Enroll />} />
        
        {/* Service Routes */}
        <Route path="/services" element={<ServicesSection />} />
        <Route path="/services/zero-trust" element={<Zerotrust />} />
        <Route path="/services/crypto" element={<Crypto />} />
        <Route path="/services/identity" element={<Identity />} />
        <Route path="/services/pki" element={<Pki />} />
        <Route path="/services/security" element={<Security />} />
        <Route path="/services/hsm" element={<Hsm />} /> 
      </Routes>
    </BrowserRouter>
  );
}

export default App;