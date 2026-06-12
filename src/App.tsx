/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Search } from './pages/Search';
import { Landing } from './pages/Landing';
import { PropertyDetail } from './pages/PropertyDetail';
import { Dashboard } from './pages/Dashboard';
import { MobileDashboard } from './pages/MobileDashboard';
import { AddProperty } from './pages/AddProperty';
import { AdminDashboard } from './pages/AdminDashboard';
import { LandlordProfile } from './pages/LandlordProfile';
import { EditLandlordProfile } from './pages/EditLandlordProfile';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <Router>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/search" element={<Search />} />
          <Route path="/property/:id" element={<PropertyDetail />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/mobile-dashboard" element={<MobileDashboard />} />
          <Route path="/add-property" element={<AddProperty />} />
          <Route path="/edit-property/:id" element={<AddProperty />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/landlord/:id" element={<LandlordProfile />} />
          <Route path="/edit-profile" element={<EditLandlordProfile />} />
        </Routes>
      </ErrorBoundary>
    </Router>
  );
}
