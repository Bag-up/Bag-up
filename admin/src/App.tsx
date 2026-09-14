import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/admin-layout'
import { LoginPage } from '@/pages/login'
import { DashboardPage } from '@/pages/dashboard'
import { UsersPage } from '@/pages/users'
import { UserDetailPage } from '@/pages/user-detail'
import { MissionsPage } from '@/pages/missions'
import { MissionDetailPage } from '@/pages/mission-detail'
import { PaymentsPage } from '@/pages/payments'
import { SubscriptionsPage } from '@/pages/subscriptions'
import { DisputesPage } from '@/pages/disputes'
import { ReferralsPage } from '@/pages/referrals'
import { LoyaltyPage } from '@/pages/loyalty'
import { TariffsPage } from '@/pages/tariffs'
import { ProceduresPage } from '@/pages/procedures'
import { AntiGaspiPage } from '@/pages/anti-gaspi'
import { MarketplacePage } from '@/pages/marketplace'
import { ContentPage } from '@/pages/content'
import { RidesPage } from '@/pages/rides'
import { RideDetailPage } from '@/pages/ride-detail'
import { ProfilePage } from '@/pages/profile'
import { getAdminRole } from '@/lib/api'
import { canAccessPath, isStaffRole } from '@/lib/permissions'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('admin_token')
  const role = getAdminRole()
  if (!token) return <Navigate to="/login" replace />
  if (role && !isStaffRole(role)) {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function RoleRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const role = getAdminRole()
  if (!canAccessPath(role, location.pathname)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<RoleRoute><DashboardPage /></RoleRoute>} />
          <Route path="/users" element={<RoleRoute><UsersPage /></RoleRoute>} />
          <Route path="/users/:id" element={<RoleRoute><UserDetailPage /></RoleRoute>} />
          <Route path="/missions" element={<RoleRoute><MissionsPage /></RoleRoute>} />
          <Route path="/missions/:id" element={<RoleRoute><MissionDetailPage /></RoleRoute>} />
          <Route path="/rides" element={<RoleRoute><RidesPage /></RoleRoute>} />
          <Route path="/rides/:id" element={<RoleRoute><RideDetailPage /></RoleRoute>} />
          <Route path="/payments" element={<RoleRoute><PaymentsPage /></RoleRoute>} />
          <Route path="/subscriptions" element={<RoleRoute><SubscriptionsPage /></RoleRoute>} />
          <Route path="/disputes" element={<RoleRoute><DisputesPage /></RoleRoute>} />
          <Route path="/referrals" element={<RoleRoute><ReferralsPage /></RoleRoute>} />
          <Route path="/loyalty" element={<RoleRoute><LoyaltyPage /></RoleRoute>} />
          <Route path="/tariffs" element={<RoleRoute><TariffsPage /></RoleRoute>} />
          <Route path="/procedures" element={<RoleRoute><ProceduresPage /></RoleRoute>} />
          <Route path="/anti-gaspi" element={<RoleRoute><AntiGaspiPage /></RoleRoute>} />
          <Route path="/marketplace" element={<RoleRoute><MarketplacePage /></RoleRoute>} />
          <Route path="/content" element={<RoleRoute><ContentPage /></RoleRoute>} />
          <Route path="/profile" element={<RoleRoute><ProfilePage /></RoleRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
