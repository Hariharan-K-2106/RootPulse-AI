import { LoaderCircle, Sprout } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) {
    return <div className="auth-checking"><span className="brand-mark"><Sprout size={23} /></span><LoaderCircle size={20} className="spin" /><span>Checking your session…</span></div>;
  }
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />;
}

export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return <div className="auth-checking"><span className="brand-mark"><Sprout size={23} /></span><LoaderCircle size={20} className="spin" /><span>Checking your session…</span></div>;
  }
  return user ? <Navigate to="/" replace /> : children;
}
