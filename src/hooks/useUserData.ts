import { useState, useEffect, useCallback, useRef } from 'react';
import { useExternalDb } from './useExternalDb';
import { getCachedAccountId, readUserDataCache, writeUserDataCache, deduplicateUserData } from '@/lib/userDataCache';
import { takeBootstrapPrefetch } from '@/lib/bootstrap';

const normalizeDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  return String(dateStr).split('T')[0];
};

const dedupeAchievementsByDate = (rows: DbAchievement[]): DbAchievement[] => {
  // Keep only the latest row per date (if duplicates exist in client state)
  const byDate = new Map<string, DbAchievement>();
  rows.forEach((a) => {
    byDate.set(normalizeDate(a.date), a);
  });
  return Array.from(byDate.values()).sort((a, b) => normalizeDate(a.date).localeCompare(normalizeDate(b.date)));
};

// Types matching database schema
export interface DbTask {
  id: string;
  user_id: string;
  text: string;
  date: string;
  completed: boolean;
  created_at: string;
  recurring_group_id?: string | null;
}

export interface DbHabit {
  id: string;
  user_id: string;
  text: string;
  start_date: string;
  end_date: string | null;
  repeat: 'week' | 'month' | '3months' | 'year';
  created_at: string;
}

export interface DbHabitCompletion {
  id: string;
  habit_id: string;
  date: string;
}

export interface DbProfile {
  id: string;
  auth_user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  birth_time: string | null;
  subscription_until: string | null;
}

export interface DbDailyEnergy {
  id: string;
  date: string;
  heavenly_stem: string | null;
  earthly_branch: string | null;
  is_lucky_day: boolean;
  is_money_activation: boolean;
  is_rest_day: boolean;
  is_money_haircut: boolean;
  is_solar_eclipse: boolean;
  is_lunar_eclipse: boolean;
  is_no_wealth_day: boolean;
  is_mercury_retrograde: boolean;
  daily_advice: string | null;
}

export interface DbBaziChart {
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
}

// Focus rule types
export interface DbStemToStemRule {
  id: string;
  user_day_stem: string;
  current_day_stem: string;
  advice: string | null;
  emoji: string | null;
}

export interface DbStemToBranchRule {
  id: string;
  user_day_stem: string;
  current_day_branch: string;
  advice: string | null;
  emoji: string | null;
}

export interface DbDayBranchRule {
  id: string;
  user_day_branch: string;
  current_day_branch: string;
  advice: string | null;
  emoji: string | null;
}

export interface DbYearBranchRule {
  id: string;
  user_year_branch: string;
  current_day_branch: string;
  advice: string | null;
  emoji: string | null;
}

export interface DbMonthBranchRule {
  id: string;
  user_month_branch: string;
  current_day_branch: string;
  advice: string | null;
  emoji: string | null;
}

export interface PersonalizedRule {
  advice: string;
  emoji: string;
}

export interface DbMonthlyEvent {
  id: string;
  date: string;
  emoji: string;
  label: string | null;
}

export interface DbUserHint {
  id: string;
  user_id: string;
  hint_text: string | null;
}

export interface DbIndividualForecast {
  id: string;
  user_id: string;
  type: 'year' | 'month';
  year: number;
  month: number | null;
  title: string | null;
  content: string | null;
}

export interface DbGeneralForecast {
  id: string;
  year: number;
  title: string | null;
  content: string | null;
}

export interface DbUserGoal {
  id: string;
  user_id: string;
  type: 'year' | 'month';
  year: number;
  month: number | null;
  goal_text: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DbAchievement {
  id: string;
  user_id: string;
  date: string;
  achievement_1: string | null;
  achievement_2: string | null;
  achievement_3: string | null;
}

export interface UserDataSnapshot {
  profile: DbProfile | null;
  tasks: DbTask[];
  habits: DbHabit[];
  habitCompletions: DbHabitCompletion[];
  dailyEnergy: DbDailyEnergy[];
  baziChart: DbBaziChart | null;
  monthlyEvents: DbMonthlyEvent[];
  userHint: DbUserHint | null;
  individualForecasts: DbIndividualForecast[];
  generalForecast: DbGeneralForecast | null;
  achievements: DbAchievement[];
  userGoals: DbUserGoal[];
  stemToStemRules: DbStemToStemRule[];
  stemToBranchRules: DbStemToBranchRule[];
  dayBranchRules: DbDayBranchRule[];
  yearBranchRules: DbYearBranchRule[];
  monthBranchRules: DbMonthBranchRule[];
}

export const useUserData = () => {
  const { query, getBootstrap, upsertProfile } = useExternalDb();
  const [accountId] = useState(getCachedAccountId);
  const [cached] = useState(() => {
    const data = readUserDataCache<UserDataSnapshot>(accountId);
    if (!data || data.profile?.id !== accountId) return null;
    const collections = ['tasks', 'habits', 'habitCompletions', 'dailyEnergy', 'monthlyEvents',
      'individualForecasts', 'achievements', 'userGoals', 'stemToStemRules', 'stemToBranchRules',
      'dayBranchRules', 'yearBranchRules', 'monthBranchRules'] as const;
    return collections.every(key => Array.isArray(data[key])) ? data : null;
  });
  const [loading, setLoading] = useState(!cached);
  const hasDataRef = useRef(!!cached);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<DbProfile | null>(cached?.profile ?? null);
  const [tasks, setTasks] = useState<DbTask[]>(cached?.tasks ?? []);
  const [habits, setHabits] = useState<DbHabit[]>(cached?.habits ?? []);
  const [habitCompletions, setHabitCompletions] = useState<DbHabitCompletion[]>(cached?.habitCompletions ?? []);
  const [dailyEnergy, setDailyEnergy] = useState<DbDailyEnergy[]>(cached?.dailyEnergy ?? []);
  const [baziChart, setBaziChart] = useState<DbBaziChart | null>(cached?.baziChart ?? null);
  const [monthlyEvents, setMonthlyEvents] = useState<DbMonthlyEvent[]>(cached?.monthlyEvents ?? []);
  const [userHint, setUserHint] = useState<DbUserHint | null>(cached?.userHint ?? null);
  const [individualForecasts, setIndividualForecasts] = useState<DbIndividualForecast[]>(cached?.individualForecasts ?? []);
  const [generalForecast, setGeneralForecast] = useState<DbGeneralForecast | null>(cached?.generalForecast ?? null);
  const [achievements, setAchievements] = useState<DbAchievement[]>(cached?.achievements ?? []);
  const [userGoals, setUserGoals] = useState<DbUserGoal[]>(cached?.userGoals ?? []);
  const [stemToStemRules, setStemToStemRules] = useState<DbStemToStemRule[]>(cached?.stemToStemRules ?? []);
  const [stemToBranchRules, setStemToBranchRules] = useState<DbStemToBranchRule[]>(cached?.stemToBranchRules ?? []);
  const [dayBranchRules, setDayBranchRules] = useState<DbDayBranchRule[]>(cached?.dayBranchRules ?? []);
  const [yearBranchRules, setYearBranchRules] = useState<DbYearBranchRule[]>(cached?.yearBranchRules ?? []);
  const [monthBranchRules, setMonthBranchRules] = useState<DbMonthBranchRule[]>(cached?.monthBranchRules ?? []);

  // Refresh without replacing saved content with a loading screen.
  const loadUserData = useCallback(async () => {
    if (!accountId) { setLoading(false); return; }
    setError(null);
    // Retry after a failed first launch shows the spinner again.
    if (!hasDataRef.current) setLoading(true);
    try {
      const data = await deduplicateUserData(accountId,
        () => takeBootstrapPrefetch<UserDataSnapshot>(accountId) ?? getBootstrap<UserDataSnapshot>());
      // Discard late responses after logout/account switches.
      if (getCachedAccountId() !== accountId) return;
      if (!data || data.profile?.id !== accountId) throw new Error('Failed to load profile');
      hasDataRef.current = true;
      setProfile(data.profile);
      setTasks(data.tasks);
      setHabits(data.habits);
      setHabitCompletions(data.habitCompletions);
      setDailyEnergy(data.dailyEnergy);
      setBaziChart(data.baziChart);
      setMonthlyEvents(data.monthlyEvents);
      setUserHint(data.userHint);
      setIndividualForecasts(data.individualForecasts);
      setGeneralForecast(data.generalForecast);
      setAchievements(dedupeAchievementsByDate(data.achievements));
      setUserGoals(data.userGoals);
      setStemToStemRules(data.stemToStemRules);
      setStemToBranchRules(data.stemToBranchRules);
      setDayBranchRules(data.dayBranchRules);
      setYearBranchRules(data.yearBranchRules);
      setMonthBranchRules(data.monthBranchRules);
    } catch (err) {
      console.error('Error loading user data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [accountId, getBootstrap]);

  // Includes successful local edits, not just the initial server response.
  useEffect(() => {
    if (loading || !accountId || profile?.id !== accountId || getCachedAccountId() !== accountId) return;
    writeUserDataCache<UserDataSnapshot>(accountId, {
    profile, tasks, habits, habitCompletions, dailyEnergy, baziChart, monthlyEvents, userHint, individualForecasts, generalForecast, achievements, userGoals, stemToStemRules, stemToBranchRules, dayBranchRules, yearBranchRules, monthBranchRules
    });
  }, [loading, accountId, profile, tasks, habits, habitCompletions, dailyEnergy, baziChart, monthlyEvents, userHint, individualForecasts, generalForecast, achievements, userGoals, stemToStemRules, stemToBranchRules, dayBranchRules, yearBranchRules, monthBranchRules]);

  // Task operations
  const addTask = useCallback(async (text: string, date: string, recurringGroupId?: string) => {
    if (!profile) return null;
    try {
      // Try with recurring_group_id first, fall back to without if column doesn't exist
      let result: DbTask[];
      if (recurringGroupId) {
        try {
          result = await query<DbTask>(
            `INSERT INTO life_navigator.tasks (user_id, text, date, completed, recurring_group_id)
             VALUES ('${profile.id}', '${text.replace(/'/g, "''")}', '${date}', false, '${recurringGroupId}')
             RETURNING *`
          );
        } catch (err) {
          // Column might not exist yet, try without it
          console.log('Falling back to INSERT without recurring_group_id');
          result = await query<DbTask>(
            `INSERT INTO life_navigator.tasks (user_id, text, date, completed)
             VALUES ('${profile.id}', '${text.replace(/'/g, "''")}', '${date}', false)
             RETURNING *`
          );
        }
      } else {
        result = await query<DbTask>(
          `INSERT INTO life_navigator.tasks (user_id, text, date, completed)
           VALUES ('${profile.id}', '${text.replace(/'/g, "''")}', '${date}', false)
           RETURNING *`
        );
      }
      if (result[0]) {
        setTasks(prev => [...prev, result[0]]);
        return result[0];
      }
      return null;
    } catch (err) {
      console.error('Error adding task:', err);
      return null;
    }
  }, [profile, query]);

  const toggleTask = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    try {
      await query(
        `UPDATE life_navigator.tasks SET completed = ${!task.completed} WHERE id = '${taskId}'`
      );
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t));
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  }, [tasks, query]);

  const deleteTask = useCallback(async (taskId: string, deleteAll: boolean = true) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      
      // If task has a recurring group and deleteAll is true, delete all tasks in the group
      if (deleteAll && task?.recurring_group_id) {
        await query(`DELETE FROM life_navigator.tasks WHERE recurring_group_id = '${task.recurring_group_id}'`);
        setTasks(prev => prev.filter(t => t.recurring_group_id !== task.recurring_group_id));
      } else {
        await query(`DELETE FROM life_navigator.tasks WHERE id = '${taskId}'`);
        setTasks(prev => prev.filter(t => t.id !== taskId));
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  }, [query, tasks]);

  const updateTask = useCallback(async (taskId: string, newText: string) => {
    try {
      await query(
        `UPDATE life_navigator.tasks SET text = '${newText.replace(/'/g, "''")}' WHERE id = '${taskId}'`
      );
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, text: newText } : t));
    } catch (err) {
      console.error('Error updating task:', err);
    }
  }, [query]);

  // Habit operations
  const addHabit = useCallback(async (text: string, startDate: string, repeat: 'week' | 'month' | '3months' | 'year') => {
    if (!profile) return null;
    
    // Calculate end date
    const [year, month, day] = startDate.split('-').map(Number);
    const start = new Date(year, month - 1, day);
    let end = new Date(start);
    
    switch (repeat) {
      case 'week': end.setDate(start.getDate() + 6); break;
      case 'month': end.setMonth(start.getMonth() + 1); end.setDate(end.getDate() - 1); break;
      case '3months': end.setMonth(start.getMonth() + 3); end.setDate(end.getDate() - 1); break;
      case 'year': end.setFullYear(start.getFullYear() + 1); end.setDate(end.getDate() - 1); break;
    }
    
    const endDateStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    
    try {
      const result = await query<DbHabit>(
        `INSERT INTO life_navigator.habits (user_id, text, start_date, end_date, repeat)
         VALUES ('${profile.id}', '${text.replace(/'/g, "''")}', '${startDate}', '${endDateStr}', '${repeat}')
         RETURNING *`
      );
      if (result[0]) {
        setHabits(prev => [...prev, result[0]]);
        return result[0];
      }
      return null;
    } catch (err) {
      console.error('Error adding habit:', err);
      return null;
    }
  }, [profile, query]);

  const toggleHabit = useCallback(async (habitId: string, date: string) => {
    const normalizedDate = date.split('T')[0];
    const isCompleted = habitCompletions.some(c => c.habit_id === habitId && c.date.split('T')[0] === normalizedDate);
    
    try {
      if (isCompleted) {
        await query(`DELETE FROM life_navigator.habit_completions WHERE habit_id = '${habitId}' AND date = '${normalizedDate}'`);
        setHabitCompletions(prev => prev.filter(c => !(c.habit_id === habitId && c.date.split('T')[0] === normalizedDate)));
      } else {
        const result = await query<DbHabitCompletion>(
          `INSERT INTO life_navigator.habit_completions (habit_id, date) VALUES ('${habitId}', '${date}') RETURNING *`
        );
        if (result[0]) {
          setHabitCompletions(prev => [...prev, result[0]]);
        }
      }
    } catch (err) {
      console.error('Error toggling habit:', err);
    }
  }, [habitCompletions, query]);

  const deleteHabit = useCallback(async (habitId: string) => {
    try {
      await query(`DELETE FROM life_navigator.habits WHERE id = '${habitId}'`);
      setHabits(prev => prev.filter(h => h.id !== habitId));
      setHabitCompletions(prev => prev.filter(c => c.habit_id !== habitId));
    } catch (err) {
      console.error('Error deleting habit:', err);
    }
  }, [query]);

  const updateHabit = useCallback(async (habitId: string, newText: string) => {
    try {
      await query(
        `UPDATE life_navigator.habits SET text = '${newText.replace(/'/g, "''")}' WHERE id = '${habitId}'`
      );
      setHabits(prev => prev.map(h => h.id === habitId ? { ...h, text: newText } : h));
    } catch (err) {
      console.error('Error updating habit:', err);
    }
  }, [query]);

  // Achievement operations
  const saveAchievement = useCallback(async (date: string, achievement1: string, achievement2: string, achievement3: string) => {
    if (!profile) return;

    const safeDate = normalizeDate(date);
    
    try {
      const result = await query<DbAchievement>(
        `INSERT INTO life_navigator.achievements (user_id, date, achievement_1, achievement_2, achievement_3)
         VALUES ('${profile.id}', '${safeDate}', 
           ${achievement1 ? `'${achievement1.replace(/'/g, "''")}'` : 'NULL'},
           ${achievement2 ? `'${achievement2.replace(/'/g, "''")}'` : 'NULL'},
           ${achievement3 ? `'${achievement3.replace(/'/g, "''")}'` : 'NULL'})
         ON CONFLICT (user_id, date) DO UPDATE SET
           achievement_1 = EXCLUDED.achievement_1,
           achievement_2 = EXCLUDED.achievement_2,
           achievement_3 = EXCLUDED.achievement_3
         RETURNING *`
      );
      if (result[0]) {
        const normalized = normalizeDate(result[0].date);
        setAchievements((prev) => {
          const withoutSameDate = prev.filter((a) => normalizeDate(a.date) !== normalized);
          return dedupeAchievementsByDate([...withoutSameDate, result[0]]);
        });
      }
    } catch (err) {
      console.error('Error saving achievement:', err);
    }
  }, [profile, query]);

  // Ensure user_goals table exists (creates it if missing)
  const ensureUserGoalsTable = useCallback(async () => {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS life_navigator.user_goals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES life_navigator.profiles(id) ON DELETE CASCADE,
          type VARCHAR(10) NOT NULL CHECK (type IN ('year', 'month')),
          year INT NOT NULL,
          month INT,
          goal_text TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE(user_id, type, year, month)
        )
      `);
    } catch (err) {
      // Table likely already exists, ignore error
      console.log('User goals table check:', err);
    }
  }, [query]);

  // Year/Month goal operations (using user_goals table - separate from admin's forecasts)
  const saveYearGoal = useCallback(async (goal: string) => {
    if (!profile) return;
    const currentYear = new Date().getFullYear();
    
    try {
      // Ensure table exists first
      await ensureUserGoalsTable();

      const safeGoal = goal.replace(/'/g, "''");

      // IMPORTANT: month is NULL for year goals. A UNIQUE(user_id,type,year,month) constraint
      // does NOT prevent duplicates with NULL month, so we update the latest existing row if present.
      const updated = await query<DbUserGoal>(
        `UPDATE life_navigator.user_goals
         SET goal_text = '${safeGoal}', updated_at = now()
         WHERE id = (
           SELECT id FROM life_navigator.user_goals
           WHERE user_id = '${profile.id}' AND type = 'year' AND year = ${currentYear} AND month IS NULL
           ORDER BY updated_at DESC NULLS LAST, created_at DESC
           LIMIT 1
         )
         RETURNING *`
      );

      const row = updated[0];

      // If there was no existing row, insert a new one
      const result = row
        ? [row]
        : await query<DbUserGoal>(
            `INSERT INTO life_navigator.user_goals (user_id, type, year, month, goal_text)
             VALUES ('${profile.id}', 'year', ${currentYear}, NULL, '${safeGoal}')
             RETURNING *`
          );

      if (result[0]) {
        setUserGoals(prev => {
          const updated = prev.filter(g => !(g.type === 'year' && g.year === currentYear && g.month === null));
          return [...updated, result[0]];
        });
      }
    } catch (err) {
      console.error('Error saving year goal:', err);
    }
  }, [profile, query, ensureUserGoalsTable]);

  const saveMonthGoal = useCallback(async (monthIndex: number, goal: string) => {
    if (!profile) return;
    const currentYear = new Date().getFullYear();
    
    try {
      // Ensure table exists first
      await ensureUserGoalsTable();
      
      const result = await query<DbUserGoal>(
        `INSERT INTO life_navigator.user_goals (user_id, type, year, month, goal_text)
         VALUES ('${profile.id}', 'month', ${currentYear}, ${monthIndex + 1}, '${goal.replace(/'/g, "''")}')
         ON CONFLICT (user_id, type, year, month) DO UPDATE SET
           goal_text = EXCLUDED.goal_text,
           updated_at = now()
         RETURNING *`
      );
      if (result[0]) {
        setUserGoals(prev => {
          const updated = prev.filter(g => !(g.type === 'month' && g.year === currentYear && g.month === monthIndex + 1));
          return [...updated, result[0]];
        });
      }
    } catch (err) {
      console.error('Error saving month goal:', err);
    }
  }, [profile, query, ensureUserGoalsTable]);

  // Helper to get user's year goal (from user_goals table)
  const getYearGoal = useCallback(() => {
    const currentYear = new Date().getFullYear();
    const candidates = userGoals.filter(
      g => g.type === 'year' && g.year === currentYear && g.month === null
    );
    if (candidates.length === 0) return '';

    const sorted = [...candidates].sort((a, b) => {
      const aTime = new Date((a.updated_at || a.created_at || 0) as any).getTime();
      const bTime = new Date((b.updated_at || b.created_at || 0) as any).getTime();
      return bTime - aTime;
    });

    return sorted[0]?.goal_text || '';
  }, [userGoals]);

  // Helper to get user's month goals (from user_goals table)
  const getMonthGoals = useCallback(() => {
    const currentYear = new Date().getFullYear();
    const goals: Record<number, string> = {};
    userGoals
      .filter(g => g.type === 'month' && g.year === currentYear && g.month !== null)
      .forEach(g => {
        if (g.month !== null && g.goal_text) {
          goals[g.month - 1] = g.goal_text;
        }
      });
    return goals;
  }, [userGoals]);

  // Helper to get today's energy
  const getTodayEnergy = useCallback(() => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return dailyEnergy.find(e => e.date.startsWith(dateStr)) || null;
  }, [dailyEnergy]);

  // Helper to get habit completions for a habit
  const getHabitCompletedDates = useCallback((habitId: string) => {
    return habitCompletions.filter(c => c.habit_id === habitId).map(c => c.date.split('T')[0]);
  }, [habitCompletions]);

  // Get personalized rules for a specific date
  const getPersonalizedRulesForDate = useCallback((dateStr: string): PersonalizedRule[] => {
    if (!baziChart) return [];
    
    // Get energy for the date
    const energy = dailyEnergy.find(e => e.date.startsWith(dateStr));
    if (!energy) return [];
    
    const currentDayStem = energy.heavenly_stem?.toLowerCase() || '';
    const currentDayBranch = energy.earthly_branch?.toLowerCase() || '';
    
    if (!currentDayStem && !currentDayBranch) return [];
    
    const rules: PersonalizedRule[] = [];
    
    // 1. Stem to Stem (user day stem × current day stem)
    if (baziChart.day_stem && currentDayStem) {
      const rule = stemToStemRules.find(
        r => r.user_day_stem?.toLowerCase() === baziChart.day_stem?.toLowerCase() &&
             r.current_day_stem?.toLowerCase() === currentDayStem
      );
      if (rule?.advice || rule?.emoji) {
        rules.push({ advice: rule.advice || '', emoji: rule.emoji || '' });
      }
    }
    
    // 2. Stem to Branch (user day stem × current day branch)
    if (baziChart.day_stem && currentDayBranch) {
      const rule = stemToBranchRules.find(
        r => r.user_day_stem?.toLowerCase() === baziChart.day_stem?.toLowerCase() &&
             r.current_day_branch?.toLowerCase() === currentDayBranch
      );
      if (rule?.advice || rule?.emoji) {
        rules.push({ advice: rule.advice || '', emoji: rule.emoji || '' });
      }
    }
    
    // 3. Day Branch to Branch (user day branch × current day branch)
    if (baziChart.day_branch && currentDayBranch) {
      const rule = dayBranchRules.find(
        r => r.user_day_branch?.toLowerCase() === baziChart.day_branch?.toLowerCase() &&
             r.current_day_branch?.toLowerCase() === currentDayBranch
      );
      if (rule?.advice || rule?.emoji) {
        rules.push({ advice: rule.advice || '', emoji: rule.emoji || '' });
      }
    }
    
    // 4. Year Branch to Branch (user year branch × current day branch)
    if (baziChart.year_branch && currentDayBranch) {
      const rule = yearBranchRules.find(
        r => r.user_year_branch?.toLowerCase() === baziChart.year_branch?.toLowerCase() &&
             r.current_day_branch?.toLowerCase() === currentDayBranch
      );
      if (rule?.advice || rule?.emoji) {
        rules.push({ advice: rule.advice || '', emoji: rule.emoji || '' });
      }
    }
    
    // 5. Month Branch to Branch (user month branch × current day branch)
    if (baziChart.month_branch && currentDayBranch) {
      const rule = monthBranchRules.find(
        r => r.user_month_branch?.toLowerCase() === baziChart.month_branch?.toLowerCase() &&
             r.current_day_branch?.toLowerCase() === currentDayBranch
      );
      if (rule?.advice || rule?.emoji) {
        rules.push({ advice: rule.advice || '', emoji: rule.emoji || '' });
      }
    }
    
    return rules;
  }, [baziChart, dailyEnergy, stemToStemRules, stemToBranchRules, dayBranchRules, yearBranchRules, monthBranchRules]);

  // Update user profile (first_name, last_name)
  const updateProfile = useCallback(async (data: { first_name?: string; last_name?: string }) => {
    if (!profile) return;
    try {
      const updated = await upsertProfile({
        email: profile.email,
        first_name: data.first_name ?? profile.first_name ?? undefined,
        last_name: data.last_name ?? profile.last_name ?? undefined,
      });
      if (updated) {
        setProfile(updated);
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
  }, [profile, upsertProfile]);

  // Check if user has active subscription
  const hasActiveSubscription = useCallback((): boolean => {
    if (!profile?.subscription_until) return false;
    const subscriptionEnd = new Date(profile.subscription_until);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    subscriptionEnd.setHours(0, 0, 0, 0);
    return subscriptionEnd >= today;
  }, [profile]);

  // Check if a specific date falls within the subscription period
  const isDateWithinSubscription = useCallback((dateStr: string): boolean => {
    if (!profile?.subscription_until) return false;
    const subscriptionEnd = new Date(profile.subscription_until);
    const targetDate = new Date(dateStr);
    subscriptionEnd.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    return targetDate <= subscriptionEnd;
  }, [profile]);

  // Get personal emojis for a date (aggregated from all matching rules) - gated by subscription date
  const getPersonalEmojisForDate = useCallback((dateStr: string): string => {
    if (!isDateWithinSubscription(dateStr)) return '';
    const rules = getPersonalizedRulesForDate(dateStr);
    const emojis = rules.map(r => r.emoji).filter(Boolean);
    return emojis.join('');
  }, [getPersonalizedRulesForDate, isDateWithinSubscription]);

  // Get personal focus advice for a date (first 1-2 rules) - gated by subscription date
  const getPersonalFocusForDate = useCallback((dateStr: string): string => {
    if (!isDateWithinSubscription(dateStr)) return '';
    const rules = getPersonalizedRulesForDate(dateStr);
    const advices = rules.map(r => r.advice).filter(Boolean).slice(0, 2);
    return advices.join('\n\n');
  }, [getPersonalizedRulesForDate, isDateWithinSubscription]);

  // Get personal emojis as list for filtering - gated by subscription date
  const getPersonalEmojisListForDate = useCallback((dateStr: string): string[] => {
    if (!isDateWithinSubscription(dateStr)) return [];
    const rules = getPersonalizedRulesForDate(dateStr);
    return rules.map(r => r.emoji).filter(Boolean);
  }, [getPersonalizedRulesForDate, isDateWithinSubscription]);

  // Load data on mount
  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  return {
    loading,
    error,
    profile,
    tasks,
    habits,
    habitCompletions,
    dailyEnergy,
    baziChart,
    monthlyEvents,
    userHint,
    individualForecasts,
    generalForecast,
    achievements,
    userGoals,
    // Operations
    updateProfile,
    addTask,
    toggleTask,
    deleteTask,
    updateTask,
    addHabit,
    toggleHabit,
    deleteHabit,
    updateHabit,
    saveAchievement,
    saveYearGoal,
    saveMonthGoal,
    // Helpers
    getYearGoal,
    getMonthGoals,
    getTodayEnergy,
    getHabitCompletedDates,
    getPersonalizedRulesForDate,
    getPersonalEmojisForDate,
    getPersonalEmojisListForDate,
    getPersonalFocusForDate,
    hasActiveSubscription,
    // Reload
    loadUserData,
  };
};
