import { useEffect, useState, useCallback } from 'react';
import { clearUserDataCache } from '@/lib/userDataCache';
import { resetAuthVerification, verifySession } from '@/lib/authVerification';
import { clearBootstrapPrefetch } from '@/lib/bootstrap';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/custom-auth`;
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export interface AuthUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  subscription_until?: string;
  is_admin?: boolean;
}

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    
    // Show cached user immediately — no waiting for network
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch { /* corrupted data */ }
    }
    setLoading(false);

    // Verify token in background (refresh data silently)
    if (token) {
      verifySession(token)
        .then(res => {
          if (res.ok) return res.json();
          if (localStorage.getItem(TOKEN_KEY) !== token) return null;
          // A network/server failure must not discard the offline session.
          if (res.status === 401 || res.status === 404) {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            clearUserDataCache();
      clearBootstrapPrefetch();
            resetAuthVerification();
            setUser(null);
          }
          return null;
        })
        .then(data => {
          if (data?.user) {
            const currentToken = localStorage.getItem(TOKEN_KEY);
            if (currentToken !== token && currentToken !== data.token) return;
            setUser(data.user);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
          }
        })
        .catch(() => { /* keep cached user for offline */ });
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ error: string | null; user: AuthUser | null }> => {
    try {
      const response = await fetch(`${FUNCTION_URL}?action=login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Login failed', user: null };
      }

      // Store token and user
      clearUserDataCache();
      clearBootstrapPrefetch();
      resetAuthVerification();
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);

      return { error: null, user: data.user };
    } catch (error) {
      console.error('Login error:', error);
      return { error: 'Network error. Please try again.', user: null };
    }
  }, []);

  const signOut = useCallback(async () => {
    clearUserDataCache();
      clearBootstrapPrefetch();
    resetAuthVerification();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const getToken = useCallback((): string | null => {
    return localStorage.getItem(TOKEN_KEY);
  }, []);

  const getAuthHeader = useCallback((): string | null => {
    const token = getToken();
    return token ? `Bearer ${token}` : null;
  }, [getToken]);

  const isAuthenticated = useCallback((): boolean => {
    return !!localStorage.getItem(TOKEN_KEY);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    try {
      const response = await verifySession(token, true);

      if (response.ok) {
        const data = await response.json();
        if (localStorage.getItem(TOKEN_KEY) !== token) return;
        setUser(data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        if (data.token) {
          localStorage.setItem(TOKEN_KEY, data.token);
        }
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, []);

  const isAdmin = user?.is_admin === true;

  return {
    user,
    loading,
    login,
    signOut,
    getToken,
    getAuthHeader,
    isAuthenticated,
    refreshUser,
    isAdmin,
    // Compatibility with old code
    session: user ? { access_token: getToken() } : null,
  };
};
