import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, unwrap } from "../api/client";
import type { AuthUser, Role } from "../api/types";

interface LoginResult {
  otpRequired: boolean;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyLoginOtp: (email: string, code: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  function persistSession(data: { accessToken: string; refreshToken: string; email: string; fullName: string; roles: Role[] }) {
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    const authUser: AuthUser = { email: data.email, fullName: data.fullName, roles: data.roles };
    localStorage.setItem("user", JSON.stringify(authUser));
    setUser(authUser);
  }

  async function login(email: string, password: string): Promise<LoginResult> {
    const result = await unwrap<any>(api.post("/auth/login", { email, password }));
    if (!result.otpRequired) {
      persistSession(result as any);
    }
    return { otpRequired: result.otpRequired, email: result.email };
  }

  async function verifyLoginOtp(email: string, code: string) {
    const result = await unwrap<any>(api.post("/auth/verify-login-otp", { email, code }));
    persistSession(result as any);
  }

  function logout() {
    const refreshToken = localStorage.getItem("refreshToken");
    if (refreshToken) {
      api.post("/auth/logout", { refreshToken }).catch(() => {});
    }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
  }

  function hasRole(...roles: Role[]) {
    return !!user && roles.some((r) => user.roles.includes(r));
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyLoginOtp, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
