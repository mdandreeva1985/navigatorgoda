import { useState, useCallback } from 'react';
import { useExternalDb } from './useExternalDb';

export interface ClientProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  birth_time: string | null;
  subscription_until: string | null;
  created_at: string;
  updated_at: string;
  last_activity: string | null;
}

export interface BaziChart {
  id: string;
  user_id: string;
  year_stem: string | null;
  year_branch: string | null;
  month_stem: string | null;
  month_branch: string | null;
  day_stem: string | null;
  day_branch: string | null;
  hour_stem: string | null;
  hour_branch: string | null;
  is_auto_calculated: boolean;
}

export interface IndividualForecast {
  id: string;
  user_id: string;
  type: 'year' | 'month';
  year: number;
  month: number | null;
  title: string | null;
  content: string | null;
}

export interface UserHint {
  id: string;
  user_id: string;
  hint_text: string | null;
  updated_at: string;
}

export const useClients = () => {
  const { query } = useExternalDb();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getClients = useCallback(async (search?: string): Promise<ClientProfile[]> => {
    setLoading(true);
    setError(null);
    try {
      const searchFilter = search 
        ? `WHERE email ILIKE '%${search}%' OR first_name ILIKE '%${search}%' OR last_name ILIKE '%${search}%'` 
        : '';
      
      // Try with last_activity, fallback to without
      let result: ClientProfile[];
      try {
        const sql = `SELECT id, email, first_name, last_name, birth_date, birth_time, subscription_until, created_at, updated_at, last_activity 
                     FROM life_navigator.profiles ${searchFilter} ORDER BY created_at DESC`;
        result = await query<ClientProfile>(sql);
      } catch {
        // Column doesn't exist yet - query without it
        const sql = `SELECT id, email, first_name, last_name, birth_date, birth_time, subscription_until, created_at, updated_at 
                     FROM life_navigator.profiles ${searchFilter} ORDER BY created_at DESC`;
        result = await query<ClientProfile>(sql);
        result = result.map(r => ({ ...r, last_activity: null }));
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch clients';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [query]);

  const getClient = useCallback(async (clientId: string): Promise<ClientProfile | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await query<ClientProfile>(
        `SELECT id, email, first_name, last_name, birth_date, birth_time, subscription_until, created_at, updated_at 
         FROM life_navigator.profiles WHERE id = '${clientId}'`
      );
      return result[0] || null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch client';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [query]);

  const updateClient = useCallback(async (
    clientId: string,
    data: Partial<ClientProfile>
  ): Promise<ClientProfile | null> => {
    setLoading(true);
    setError(null);
    try {
      const updates: string[] = [];
      if (data.first_name !== undefined) {
        updates.push(data.first_name ? `first_name = '${data.first_name}'` : 'first_name = NULL');
      }
      if (data.last_name !== undefined) {
        updates.push(data.last_name ? `last_name = '${data.last_name}'` : 'last_name = NULL');
      }
      if (data.birth_date !== undefined) {
        updates.push(data.birth_date ? `birth_date = '${data.birth_date}'` : 'birth_date = NULL');
      }
      if (data.birth_time !== undefined) {
        updates.push(data.birth_time ? `birth_time = '${data.birth_time}'` : 'birth_time = NULL');
      }
      if (data.subscription_until !== undefined) {
        updates.push(data.subscription_until ? `subscription_until = '${data.subscription_until}'` : 'subscription_until = NULL');
      }
      updates.push(`updated_at = now()`);

      const result = await query<ClientProfile>(
        `UPDATE life_navigator.profiles 
         SET ${updates.join(', ')}
         WHERE id = '${clientId}'
         RETURNING id, email, first_name, last_name, birth_date, birth_time, subscription_until, created_at, updated_at`
      );
      return result[0] || null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update client';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [query]);

  const getBaziChart = useCallback(async (userId: string): Promise<BaziChart | null> => {
    try {
      const result = await query<BaziChart>(
        `SELECT * FROM life_navigator.bazi_charts WHERE user_id = '${userId}'`
      );
      return result[0] || null;
    } catch {
      return null;
    }
  }, [query]);

  const saveBaziChart = useCallback(async (
    userId: string,
    chart: Partial<BaziChart>
  ): Promise<BaziChart | null> => {
    try {
      const result = await query<BaziChart>(
        `INSERT INTO life_navigator.bazi_charts 
         (user_id, year_stem, year_branch, month_stem, month_branch, 
          day_stem, day_branch, hour_stem, hour_branch, is_auto_calculated)
         VALUES ('${userId}', 
                 ${chart.year_stem ? `'${chart.year_stem}'` : 'NULL'},
                 ${chart.year_branch ? `'${chart.year_branch}'` : 'NULL'},
                 ${chart.month_stem ? `'${chart.month_stem}'` : 'NULL'},
                 ${chart.month_branch ? `'${chart.month_branch}'` : 'NULL'},
                 ${chart.day_stem ? `'${chart.day_stem}'` : 'NULL'},
                 ${chart.day_branch ? `'${chart.day_branch}'` : 'NULL'},
                 ${chart.hour_stem ? `'${chart.hour_stem}'` : 'NULL'},
                 ${chart.hour_branch ? `'${chart.hour_branch}'` : 'NULL'},
                 ${chart.is_auto_calculated ?? true})
         ON CONFLICT (user_id) DO UPDATE SET
           year_stem = EXCLUDED.year_stem,
           year_branch = EXCLUDED.year_branch,
           month_stem = EXCLUDED.month_stem,
           month_branch = EXCLUDED.month_branch,
           day_stem = EXCLUDED.day_stem,
           day_branch = EXCLUDED.day_branch,
           hour_stem = EXCLUDED.hour_stem,
           hour_branch = EXCLUDED.hour_branch,
           is_auto_calculated = EXCLUDED.is_auto_calculated,
           updated_at = now()
         RETURNING *`
      );
      return result[0] || null;
    } catch {
      return null;
    }
  }, [query]);

  const getForecasts = useCallback(async (userId: string): Promise<IndividualForecast[]> => {
    try {
      const result = await query<IndividualForecast>(
        `SELECT * FROM life_navigator.individual_forecasts 
         WHERE user_id = '${userId}' 
         ORDER BY year DESC, month ASC NULLS FIRST`
      );
      return result;
    } catch {
      return [];
    }
  }, [query]);

  const saveForecast = useCallback(async (
    userId: string,
    forecast: Partial<IndividualForecast>
  ): Promise<IndividualForecast | null> => {
    try {
      const safeTitle = forecast.title ? forecast.title.replace(/'/g, "''") : null;
      const safeContent = forecast.content ? forecast.content.replace(/'/g, "''") : null;
      
      // Handle NULL month correctly - ON CONFLICT doesn't work with NULL values
      const monthCondition = forecast.month !== null && forecast.month !== undefined
        ? `month = ${forecast.month}`
        : 'month IS NULL';
      
      // First try to UPDATE existing record
      const updated = await query<IndividualForecast>(
        `UPDATE life_navigator.individual_forecasts
         SET title = ${safeTitle ? `'${safeTitle}'` : 'NULL'},
             content = ${safeContent ? `'${safeContent}'` : 'NULL'},
             updated_at = now()
         WHERE user_id = '${userId}' 
           AND type = '${forecast.type}' 
           AND year = ${forecast.year} 
           AND ${monthCondition}
         RETURNING *`
      );
      
      if (updated && updated[0]) {
        return updated[0];
      }
      
      // If no row was updated, INSERT a new one
      const monthValue = forecast.month !== null && forecast.month !== undefined 
        ? forecast.month.toString() 
        : 'NULL';
      
      const inserted = await query<IndividualForecast>(
        `INSERT INTO life_navigator.individual_forecasts 
         (user_id, type, year, month, title, content)
         VALUES ('${userId}', '${forecast.type}', ${forecast.year}, ${monthValue},
                 ${safeTitle ? `'${safeTitle}'` : 'NULL'},
                 ${safeContent ? `'${safeContent}'` : 'NULL'})
         RETURNING *`
      );
      
      return inserted[0] || null;
    } catch (err) {
      console.error('saveForecast error:', err);
      return null;
    }
  }, [query]);

  const getHint = useCallback(async (userId: string): Promise<UserHint | null> => {
    try {
      const result = await query<UserHint>(
        `SELECT * FROM life_navigator.user_hints WHERE user_id = '${userId}'`
      );
      return result[0] || null;
    } catch {
      return null;
    }
  }, [query]);

  const saveHint = useCallback(async (userId: string, hintText: string): Promise<UserHint | null> => {
    try {
      const result = await query<UserHint>(
        `INSERT INTO life_navigator.user_hints (user_id, hint_text)
         VALUES ('${userId}', '${hintText.replace(/'/g, "''")}')
         ON CONFLICT (user_id) DO UPDATE SET
           hint_text = EXCLUDED.hint_text,
           updated_at = now()
         RETURNING *`
      );
      return result[0] || null;
    } catch {
      return null;
    }
  }, [query]);

  return {
    loading,
    error,
    getClients,
    getClient,
    updateClient,
    getBaziChart,
    saveBaziChart,
    getForecasts,
    saveForecast,
    getHint,
    saveHint,
  };
};
