import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AccessPage } from './pages/AccessPage'
import { ApprovalPage } from './pages/ApprovalPage'
import { GrantAccessPage } from './pages/GrantAccessPage'
import { ReportAccidentPage } from './pages/ReportAccidentPage'
import { DashboardPage } from './pages/DashboardPage'
import { LandingPage } from './pages/LandingPage'
import { DoctorRegisterPage } from './pages/DoctorRegisterPage'
import { LoginPage } from './pages/LoginPage'
import { PatientPage } from './pages/PatientPage'
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
        <Route path="/patients/:id" element={<PatientPage />} />
        <Route path="/patients/:id/access" element={<AccessPage />} />
        <Route path="/report/:id" element={<ReportAccidentPage />} />
        <Route path="/accept/:id/:key" element={<ApprovalPage />} />
        <Route path="/grant-access/:token" element={<GrantAccessPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
