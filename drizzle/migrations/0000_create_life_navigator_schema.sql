CREATE SCHEMA IF NOT EXISTS life_navigator;
REVOKE ALL ON SCHEMA life_navigator FROM anon, authenticated;

CREATE TYPE life_navigator.app_role AS ENUM ('admin', 'user');
CREATE TYPE life_navigator.forecast_type AS ENUM ('year', 'month');
CREATE TYPE life_navigator.habit_repeat AS ENUM ('week', 'month', '3months', 'year');

CREATE TABLE life_navigator.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  first_name TEXT,
  last_name TEXT,
  birth_date DATE,
  birth_time TIME,
  subscription_until DATE,
  last_activity TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE life_navigator.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES life_navigator.profiles(id) ON DELETE CASCADE,
  role life_navigator.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE life_navigator.bazi_charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES life_navigator.profiles(id) ON DELETE CASCADE,
  year_stem TEXT, year_branch TEXT, month_stem TEXT, month_branch TEXT,
  day_stem TEXT, day_branch TEXT, hour_stem TEXT, hour_branch TEXT,
  is_auto_calculated BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE life_navigator.individual_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES life_navigator.profiles(id) ON DELETE CASCADE,
  type life_navigator.forecast_type NOT NULL,
  year INT NOT NULL,
  month INT,
  title TEXT,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, type, year, month)
);

CREATE TABLE life_navigator.user_hints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES life_navigator.profiles(id) ON DELETE CASCADE,
  hint_text TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE life_navigator.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES life_navigator.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  date DATE NOT NULL,
  completed BOOLEAN DEFAULT false,
  is_from_admin BOOLEAN DEFAULT false,
  recurring_group_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE life_navigator.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES life_navigator.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  repeat life_navigator.habit_repeat NOT NULL DEFAULT 'week',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE life_navigator.habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES life_navigator.habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  UNIQUE (habit_id, date)
);

CREATE TABLE life_navigator.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES life_navigator.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  achievement_1 TEXT, achievement_2 TEXT, achievement_3 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE TABLE life_navigator.daily_energy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  heavenly_stem TEXT,
  earthly_branch TEXT,
  is_lucky_day BOOLEAN DEFAULT false,
  is_money_activation BOOLEAN DEFAULT false,
  is_rest_day BOOLEAN DEFAULT false,
  is_money_haircut BOOLEAN DEFAULT false,
  is_solar_eclipse BOOLEAN DEFAULT false,
  is_lunar_eclipse BOOLEAN DEFAULT false,
  is_no_wealth_day BOOLEAN DEFAULT false,
  is_mercury_retrograde BOOLEAN DEFAULT false,
  daily_advice TEXT
);

CREATE TABLE life_navigator.monthly_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  emoji TEXT NOT NULL,
  label TEXT,
  description TEXT
);

CREATE TABLE life_navigator.global_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE life_navigator.general_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL UNIQUE,
  title TEXT,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE life_navigator.user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES life_navigator.profiles(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('year', 'month')),
  year INT NOT NULL,
  month INT,
  goal_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, type, year, month)
);

CREATE TABLE life_navigator.interpretation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT
);

CREATE TABLE life_navigator.personal_branch_advice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_element TEXT NOT NULL,
  day_branch TEXT NOT NULL,
  advice TEXT,
  UNIQUE (personal_element, day_branch)
);

CREATE TABLE life_navigator.branch_interactions_day (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_branch TEXT NOT NULL,
  day_branch TEXT NOT NULL,
  interaction_type TEXT,
  advice TEXT,
  UNIQUE (user_branch, day_branch)
);

CREATE TABLE life_navigator.branch_interactions_year (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_branch TEXT NOT NULL,
  year_branch TEXT NOT NULL,
  interaction_type TEXT,
  advice TEXT,
  UNIQUE (user_branch, year_branch)
);

CREATE TABLE life_navigator.month_branch_advice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_branch TEXT NOT NULL,
  month_branch TEXT NOT NULL,
  advice TEXT,
  UNIQUE (user_branch, month_branch)
);

CREATE TABLE life_navigator.stem_to_stem_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_day_stem TEXT NOT NULL, current_day_stem TEXT NOT NULL,
  advice TEXT, emoji TEXT,
  UNIQUE (user_day_stem, current_day_stem)
);

CREATE TABLE life_navigator.stem_to_branch_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_day_stem TEXT NOT NULL, current_day_branch TEXT NOT NULL,
  advice TEXT, emoji TEXT,
  UNIQUE (user_day_stem, current_day_branch)
);

CREATE TABLE life_navigator.day_branch_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_day_branch TEXT NOT NULL, current_day_branch TEXT NOT NULL,
  advice TEXT, emoji TEXT,
  UNIQUE (user_day_branch, current_day_branch)
);

CREATE TABLE life_navigator.year_branch_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_year_branch TEXT NOT NULL, current_day_branch TEXT NOT NULL,
  advice TEXT, emoji TEXT,
  UNIQUE (user_year_branch, current_day_branch)
);

CREATE TABLE life_navigator.month_branch_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_month_branch TEXT NOT NULL, current_day_branch TEXT NOT NULL,
  advice TEXT, emoji TEXT,
  UNIQUE (user_month_branch, current_day_branch)
);

CREATE TABLE life_navigator.push_config (
  id SERIAL PRIMARY KEY,
  vapid_public_key TEXT NOT NULL,
  vapid_private_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE life_navigator.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES life_navigator.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  timezone_offset INT NOT NULL DEFAULT 180,
  last_notified_date DATE,
  last_expiry_notified_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_user_date ON life_navigator.tasks(user_id, date);
CREATE INDEX idx_habits_user ON life_navigator.habits(user_id);
CREATE INDEX idx_monthly_events_date ON life_navigator.monthly_events(date);
CREATE INDEX idx_user_goals_user_year ON life_navigator.user_goals(user_id, year);
CREATE INDEX idx_push_subscriptions_user ON life_navigator.push_subscriptions(user_id);
