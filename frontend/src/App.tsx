import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from '@/components/layout/Layout'
import LoginPage from '@/pages/auth/LoginPage'
import Dashboard from '@/pages/Dashboard'
import VehiclesPage from '@/pages/vehicles/VehiclesPage'
import DriversPage from '@/pages/drivers/DriversPage'
import SpeedEventsPage from '@/pages/speed-events/SpeedEventsPage'
import IncidentsPage from '@/pages/incidents/IncidentsPage'
import DocumentsPage from '@/pages/documents/DocumentsPage'
import MaintenancePage from '@/pages/maintenance/MaintenancePage'
import DriverCompliancePage from '@/pages/driver-compliance/DriverCompliancePage'
import ComplianceDashboard from '@/pages/compliance/ComplianceDashboard'
import AdminPage from '@/pages/admin/AdminPage'
import CanAccess from '@/components/CanAccess'

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } }
})

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return localStorage.getItem('access_token')
    ? <>{children}</>
    : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>

          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* All protected pages share the Layout */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="vehicles"          element={<CanAccess module="fleet">          <VehiclesPage />          </CanAccess>} />
            <Route path="drivers"           element={<CanAccess module="drivers">         <DriversPage />           </CanAccess>} />
            <Route path="maintenance"       element={<CanAccess module="maintenance">     <MaintenancePage />       </CanAccess>} />
            <Route path="speed-events"      element={<CanAccess module="speed_events">    <SpeedEventsPage />       </CanAccess>} />
            <Route path="incidents"         element={<CanAccess module="incidents">       <IncidentsPage />         </CanAccess>} />
            <Route path="driver-compliance" element={<CanAccess module="driver_compliance"><DriverCompliancePage /> </CanAccess>} />
            <Route path="compliance"        element={<CanAccess module="compliance_report"><ComplianceDashboard />  </CanAccess>} />
            <Route path="documents"         element={<CanAccess module="documents">       <DocumentsPage />         </CanAccess>} />
            <Route path="admin"             element={<CanAccess module="admin">           <AdminPage />             </CanAccess>} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}