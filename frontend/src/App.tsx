import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import OrganizerAuthPage from './pages/OrganizerAuthPage';
import SuperAdminLoginPage from './pages/SuperAdminLoginPage';
import UserPortal from './pages/UserPortal';
import EventBookingPage from './pages/EventBookingPage';
import AdminPortal from './pages/AdminPortal';
import SuperAdminPortal from './pages/SuperAdminPortal';
import AccountSettingsPage from './pages/AccountSettingsPage';
import type { Role } from './types/auth';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-500 dark:bg-[#09090B]">
        Loading session...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-500 dark:bg-[#09090B]">
        Loading session...
      </div>
    );
  }
  if (!user) {
    const loginRoute =
      role === 'SUPER_ADMIN' ? '/platform/login' : role === 'ADMIN' ? '/organizer/auth' : '/login';
    return <Navigate to={loginRoute} replace />;
  }
  if (user.role !== role) {
    const dest = user.role === 'SUPER_ADMIN' ? '/super-admin' : user.role === 'ADMIN' ? '/admin' : '/user';
    return <Navigate to={dest} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/organizer/auth" element={<OrganizerAuthPage />} />
          <Route path="/platform/login" element={<SuperAdminLoginPage />} />
          <Route
            path="/user"
            element={
              <RequireRole role="USER">
                <UserPortal />
              </RequireRole>
            }
          />
          <Route
            path="/events/:eventId"
            element={
              <RequireRole role="USER">
                <EventBookingPage />
              </RequireRole>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireRole role="ADMIN">
                <AdminPortal />
              </RequireRole>
            }
          />
          <Route
            path="/super-admin"
            element={
              <RequireRole role="SUPER_ADMIN">
                <SuperAdminPortal />
              </RequireRole>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <AccountSettingsPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
