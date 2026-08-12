import { Navigate, Route, Routes, useLocation, Outlet } from "react-router-dom";
import NebulaBackground from "./components/NebulaBackground";
import LoginPage from "./pages/LoginPage";
import EmailVerificationPage from "./pages/EmailVerificationPage";
import DashboardPage from "./pages/DashboardPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import LoadingSpinner from "./components/LoadingSpinner";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import HomePage from "./pages/HomePage";
import Footer from "./components/Footer";
import SubscriptionExpiredPage from "./pages/SubscriptionExpiredPage";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./store/authStore";
import { useUiStore } from "./store/uiStore";
import SelectBranch from "./pages/SelectBranch";
import { useEffect } from "react";
import type { UserRole } from '@inventory/shared';

type Theme = "dark" | "light";

interface ProtectedRouteProps {
  children: React.JSX.Element;
  allowedRoles?: UserRole[];
}

// protect routes that require authentication and optional role permissions
const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

interface RedirectAuthenticatedUserProps {
  children: React.JSX.Element;
}

// redirect authenticated users to the dashboard page
const RedirectAuthenticatedUser = ({ children }: RedirectAuthenticatedUserProps) => {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

interface BranchGateProps {
  children: React.JSX.Element;
}

// BranchGate: ensure a branch is selected after authentication
const BranchGate = ({ children }: BranchGateProps) => {
  const { isAuthenticated, activeBranchId, user } = useAuthStore();
  const location = useLocation();

  // If not authenticated, let ProtectedRoute handle redirection to login
  if (!isAuthenticated) return children;

  const esSuperAdmin = user?.role === 'admin' || user?.role === 'TENANT_OWNER';

  if (!esSuperAdmin) {
    // 1. Bloqueo por carencia absoluta de asignaciones
    if (!user?.assigned_branches || user.assigned_branches.length === 0) {
      return <Navigate to="/select-branch" state={{ from: location }} replace />;
    }

    // 2. Bloqueo por inyección de estado, sesión caducada o ID ajeno
    if (!activeBranchId || !user.assigned_branches.includes(activeBranchId)) {
      return <Navigate to="/select-branch" state={{ from: location }} replace />;
    }
  }

  return children;
};

function App() {
  const { isCheckingAuth, checkAuth, isSubscriptionExpired } = useAuthStore();
  const isDarkMode = useUiStore((state) => state.isDarkMode);
  const location = useLocation();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const theme: Theme = isDarkMode ? "dark" : "light";
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  if (isCheckingAuth) return <LoadingSpinner />;

  if (isSubscriptionExpired) {
    return (
      <div className="min-h-screen w-full bg-[#020617] relative overflow-x-hidden font-sans selection:bg-orange-500/30">
        <div className="fixed inset-0 z-0">
          <NebulaBackground />
        </div>
        <SubscriptionExpiredPage />
        <Toaster />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#020617] relative overflow-x-hidden font-sans selection:bg-orange-500/30">
      <div className="fixed inset-0 z-0">
        <NebulaBackground />
      </div>

      {/* Contenido de la App */}
      <div className="relative z-10 w-full min-h-screen">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/select-branch" element={<SelectBranch />} />

          {/* Todas las demás rutas se renderizan dentro de un contenedor centrado */}
          <Route
            element={
              <div className="min-h-screen w-full flex items-center justify-center p-4">
                <BranchGate>
                  <Outlet />
                </BranchGate>
              </div>
            }
          >
            <Route
              path="/dashboard/*"
              element={
                <ProtectedRoute allowedRoles={["admin", "TENANT_OWNER", "employee"]}>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/login"
              element={
                <RedirectAuthenticatedUser>
                  <LoginPage />
                </RedirectAuthenticatedUser>
              }
            />
            <Route path="/verify-email" element={<EmailVerificationPage />} />
            <Route
              path="/forgot-password"
              element={
                <RedirectAuthenticatedUser>
                  <ForgotPasswordPage />
                </RedirectAuthenticatedUser>
              }
            />
            <Route
              path="/reset-password/:token"
              element={
                <RedirectAuthenticatedUser>
                  <ResetPasswordPage />
                </RedirectAuthenticatedUser>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </div>
      {!location.pathname.startsWith("/dashboard") && <Footer />}
      <Toaster />
    </div>
  );
}

export default App;
