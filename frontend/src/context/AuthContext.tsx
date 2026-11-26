import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiClient } from '../lib/api';
import type { AuthResponse, Role, UserSummary } from '../types/auth';

interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  role: Extract<Role, 'USER' | 'ADMIN'>;
  orgName?: string;
  registrationNo?: string;
}

interface AuthContextValue {
  user: UserSummary | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserSummary>;
  register: (payload: RegisterPayload) => Promise<UserSummary>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('td_access_token');
    if (!token) {
      setLoading(false);
      return;
    }
    apiClient
      .get<UserSummary>('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('td_access_token');
        localStorage.removeItem('td_refresh_token');
      })
      .finally(() => setLoading(false));
  }, []);

  const persistSession = (data: AuthResponse) => {
    localStorage.setItem('td_access_token', data.accessToken);
    localStorage.setItem('td_refresh_token', data.refreshToken);
    setUser(data.user);
    return data.user;
  };

  const login = async (email: string, password: string) => {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    return persistSession(data);
  };

  const register = async (payload: RegisterPayload) => {
    const { data } = await apiClient.post<AuthResponse>('/auth/register', payload);
    return persistSession(data);
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('td_refresh_token');
    try {
      await apiClient.post('/auth/logout', { refreshToken });
    } catch {
      // Clear client tokens even if already expired
    }
    localStorage.removeItem('td_access_token');
    localStorage.removeItem('td_refresh_token');
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const { data } = await apiClient.get<UserSummary>('/auth/me');
      setUser(data);
    } catch {
      // Keep current session state on transient error
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

