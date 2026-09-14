import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { DashboardPage } from './pages/DashboardPage'
import { LandingPage } from './pages/LandingPage'
import { DoctorRegisterPage } from './pages/DoctorRegisterPage'
import { LoginPage } from './pages/LoginPage'
import { PatientRegisterPage } from './pages/PatientRegisterPage'
import { RegisterPage } from './pages/RegisterPage'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/patient" element={<PatientRegisterPage />} />
        <Route path="/register/doctor" element={<DoctorRegisterPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
