import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getCurrentUser,
  loginFarmer,
  logoutFarmer,
  registerFarmer,
  type FarmerUser,
} from "../services/api";

interface AuthContextValue {
  user: FarmerUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<FarmerUser>;
  register: (data: { full_name: string; username: string; password: string; phone?: string; security_answer1: string; security_answer2: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function responseError(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "response" in error) {
    const data = (error.response as { data?: { error?: string } })?.data;
    if (data?.error) return data.error;
  }
  return fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FarmerUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((currentUser) => { if (active) setUser(currentUser); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setIsLoading(false); });

    const onExpired = () => setUser(null);
    window.addEventListener("rootpulse:auth-expired", onExpired);
    return () => {
      active = false;
      window.removeEventListener("rootpulse:auth-expired", onExpired);
    };
  }, []);

  async function login(username: string, password: string) {
    try {
      const result = await loginFarmer(username, password);
      if (!result.user) throw new Error("The login response did not include an account.");
      setUser(result.user);
      return result.user;
    } catch (error) {
      throw new Error(responseError(error, "Could not reach the login service. Try again."));
    }
  }

  async function register(data: { full_name: string; username: string; password: string; phone?: string; security_answer1: string; security_answer2: string }) {
    try {
      await registerFarmer(data);
    } catch (error) {
      throw new Error(responseError(error, "Could not reach the registration service. Try again."));
    }
  }

  async function logout() {
    await logoutFarmer();
    setUser(null);
  }

  const value = useMemo(() => ({ user, isLoading, login, register, logout }), [user, isLoading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
