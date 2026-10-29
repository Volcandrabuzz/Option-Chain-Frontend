import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

// Self-contained JWT payload decoder (avoids external build/bundler resolution failures)
function jwtDecode<T = any>(token: string): T {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) throw new Error('Invalid JWT token');
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    throw new Error('Failed to decode JWT: ' + err);
  }
}

const SERVER_URL = typeof window !== 'undefined' && window.location.origin.includes('localhost')
  ? 'http://localhost:5000'
  : '';

interface User {
  id: string;
  email: string;
  name: string;
  preferences: {
    default_index: string;
  };
}

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface AuthContextType {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Axios instance with auth headers
const api = axios.create({
  baseURL: SERVER_URL,
  headers: { 'Content-Type': 'application/json' },
});

function isTokenExpired(token: string): boolean {
  try {
    const decoded: any = jwtDecode(token);
    const now = Date.now() / 1000;
    return decoded.exp < now;
  } catch {
    return true;
  }
}

function isTokenExpiringSoon(token: string, bufferSeconds: number = 120): boolean {
  try {
    const decoded: any = jwtDecode(token);
    const now = Date.now() / 1000;
    return decoded.exp < now + bufferSeconds;
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAuth = useCallback(() => {
    setUser(null);
    setTokens(null);
    localStorage.removeItem('auth_tokens');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_ok'); // Clean up old auth flag
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
  }, []);

  const saveAuth = useCallback((newTokens: AuthTokens, newUser: User) => {
    setTokens(newTokens);
    setUser(newUser);
    localStorage.setItem('auth_tokens', JSON.stringify(newTokens));
    localStorage.setItem('auth_user', JSON.stringify(newUser));
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    const storedTokens = JSON.parse(localStorage.getItem('auth_tokens') || 'null');
    if (!storedTokens?.refresh_token) {
      clearAuth();
      return false;
    }

    try {
      const response = await axios.post(`${SERVER_URL}/api/auth/refresh`, {
        refresh_token: storedTokens.refresh_token,
      });

      if (response.data.success) {
        const newTokens = response.data.tokens;
        const storedUser = JSON.parse(localStorage.getItem('auth_user') || 'null');
        if (storedUser) {
          saveAuth(newTokens, storedUser);
          scheduleRefresh(newTokens.access_token);
        }
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    clearAuth();
    return false;
  }, [clearAuth, saveAuth]);

  const scheduleRefresh = useCallback((accessToken: string) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    try {
      const decoded: any = jwtDecode(accessToken);
      const expiresAt = decoded.exp * 1000;
      const now = Date.now();
      // Refresh 2 minutes before expiry
      const refreshIn = Math.max(expiresAt - now - 120_000, 10_000);

      refreshTimerRef.current = setTimeout(() => {
        refreshAccessToken();
      }, refreshIn);
    } catch {
      // If we can't decode, try refreshing in 30 minutes
      refreshTimerRef.current = setTimeout(() => {
        refreshAccessToken();
      }, 30 * 60 * 1000);
    }
  }, [refreshAccessToken]);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      const storedTokens = JSON.parse(localStorage.getItem('auth_tokens') || 'null');
      const storedUser = JSON.parse(localStorage.getItem('auth_user') || 'null');

      if (storedTokens && storedUser) {
        if (!isTokenExpired(storedTokens.access_token)) {
          setTokens(storedTokens);
          setUser(storedUser);
          scheduleRefresh(storedTokens.access_token);
        } else if (storedTokens.refresh_token && !isTokenExpired(storedTokens.refresh_token)) {
          await refreshAccessToken();
        } else {
          clearAuth();
        }
      }

      setIsLoading(false);
    };

    initAuth();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.post('/api/auth/login', { email, password });

      if (response.data.success) {
        saveAuth(response.data.tokens, response.data.user);
        scheduleRefresh(response.data.tokens.access_token);
        return { success: true, message: 'Login successful' };
      }
      return { success: false, message: response.data.message || 'Login failed' };
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed. Please try again.';
      return { success: false, message };
    }
  };

  const register = async (name: string, email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.post('/api/auth/register', { name, email, password });

      if (response.data.success) {
        saveAuth(response.data.tokens, response.data.user);
        scheduleRefresh(response.data.tokens.access_token);
        return { success: true, message: 'Registration successful' };
      }
      return { success: false, message: response.data.message || 'Registration failed' };
    } catch (error: any) {
      const message = error.response?.data?.message || 'Registration failed. Please try again.';
      return { success: false, message };
    }
  };

  const logout = () => {
    clearAuth();
  };

  const getAccessToken = (): string | null => {
    const storedTokens = JSON.parse(localStorage.getItem('auth_tokens') || 'null');
    if (!storedTokens?.access_token) return null;
    if (isTokenExpired(storedTokens.access_token)) return null;
    return storedTokens.access_token;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tokens,
        isAuthenticated: !!user && !!tokens,
        isLoading,
        login,
        register,
        logout,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { api, SERVER_URL };
export default AuthContext;
