import { useCallback } from 'react';
import { fetchBootstrap } from '@/lib/bootstrap';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/external-db`;
const INIT_SCHEMA_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/init-schema`;
const TOKEN_KEY = 'auth_token';

export const useExternalDb = () => {
  const getAuthHeader = (): string => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      throw new Error('Not authenticated');
    }
    return `Bearer ${token}`;
  };

  // Run migrations via health check (no auth required)
  const runMigrations = async (): Promise<void> => {
    try {
      await fetch(`${FUNCTION_URL}?action=health`, {
        method: 'GET',
      });
    } catch (err) {
      console.log('Health check/migrations:', err);
    }
  };

  const query = useCallback(async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
    const authHeader = getAuthHeader();
    
    const response = await fetch(`${FUNCTION_URL}?action=query`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql, params }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Query failed');
    }

    return result.data as T[];
  }, []);

  const getBootstrap = useCallback(<T,>(): Promise<T> => fetchBootstrap<T>(), []);

  const getProfile = async () => {
    const authHeader = getAuthHeader();
    
    const response = await fetch(`${FUNCTION_URL}?action=profile`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to get profile');
    }

    return result.profile;
  };

  const upsertProfile = useCallback(async (data: {
    email: string;
    first_name?: string;
    last_name?: string;
    birth_date?: string;
    birth_time?: string;
  }) => {
    const authHeader = getAuthHeader();
    
    const response = await fetch(`${FUNCTION_URL}?action=upsert-profile`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to upsert profile');
    }

    return result.profile;
  }, []);

  const checkIsAdmin = async (): Promise<boolean> => {
    const authHeader = getAuthHeader();
    
    const response = await fetch(`${FUNCTION_URL}?action=is-admin`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });

    const result = await response.json();
    
    if (!response.ok) {
      return false;
    }

    return result.isAdmin === true;
  };

  const initSchema = async (): Promise<{ success?: boolean; logs?: string[]; error?: string }> => {
    const authHeader = getAuthHeader();

    const response = await fetch(`${INIT_SCHEMA_URL}?action=init`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
      },
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error((result as any)?.error || 'Не удалось инициализировать схему');
    }

    return result as { success?: boolean; logs?: string[]; error?: string };
  };

  return {
    getBootstrap,
    query,
    getProfile,
    upsertProfile,
    checkIsAdmin,
    runMigrations,
    initSchema,
  };
};
