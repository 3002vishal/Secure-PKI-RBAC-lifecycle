import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./components/Login.js";
import Enroll from "./components/Enroll.js";
import ServicesSection from "./components/ServicesSection.js";

import ServiceManager from "./components/ServiceManger.js";
// IMPORTANT: Ensure AdminDashboard is exported as 'default' in its file
import AdminDashboard from "./components/AdminDashboard";
import ConnectedTokens from "./components/ConnectedTokens.js";
import TokenStatusBar from "./components/TokenStatusBar.jsx";

function App() {
  // Add this temporary debugging block

  return (
    <>
       <TokenStatusBar/>
      <Routes>
        {/* Admin Route */}
        <Route path="/" element={< Login/>} />
        
        {/* Auth Routes */}
        <Route
        path = "/connected-tokens"
        element={<ConnectedTokens/>}
        />
        <Route path="/admin-dashboard" element={<AdminDashboard/>} />
        <Route path = "/admin/service-managemnt" element = {<ServiceManager />} />
        <Route path="/enroll" element={<Enroll />} />
        {/* Service Routes */}
        <Route path="/services" element={<ServicesSection />} />
    
      </Routes>
    </>
  );
}

export default App;