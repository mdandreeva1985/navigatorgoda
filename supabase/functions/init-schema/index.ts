import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";
import { jwtVerify } from "https://deno.land/x/jose@v4.15.4/index.ts";
import { getDbConnection } from "../_shared/database.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  // Lets browsers reuse the permission check instead of repeating it before every request.
  "Access-Control-Max-Age": "86400",
};

// Get JWT secret as Uint8Array
function getJwtSecret(): Uint8Array {
  const secret = Deno.env.get("JWT_SECRET");
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

// Verify custom JWT token
async function verifyAuth(authHeader: string | null): Promise<{ userId: string; email: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    
    if (!payload.sub || !payload.email) {
      return null;
    }
    
    return {
      userId: payload.sub as string,
      email: payload.email as string,
    };
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

// Check if user is admin
async function isUserAdmin(sql: ReturnType<typeof getDbConnection>, userId: string): Promise<boolean> {
  const roles = await sql`
    SELECT ur.role FROM life_navigator.user_roles ur
    WHERE ur.user_id = ${userId}::uuid AND ur.role = 'admin'
  `;
  return roles.length > 0;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "init";

  // Migrate daily_energy columns - public endpoint for quick fix
  if (action === "migrate-energy-columns") {
    const sql = getDbConnection();
    try {
      await sql`ALTER TABLE life_navigator.daily_energy ADD COLUMN IF NOT EXISTS is_money_activation BOOLEAN DEFAULT false`;
      await sql`ALTER TABLE life_navigator.daily_energy ADD COLUMN IF NOT EXISTS is_money_haircut BOOLEAN DEFAULT false`;
      await sql`ALTER TABLE life_navigator.daily_energy ADD COLUMN IF NOT EXISTS is_lunar_eclipse BOOLEAN DEFAULT false`;
      await sql.end();
      return new Response(
        JSON.stringify({ success: true, message: "Daily energy columns added" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      const error = err as Error;
      console.error("Migration error:", error);
      await sql.end();
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Create user_goals table - public endpoint for quick migration
  if (action === "create-user-goals-table") {
    const sql = getDbConnection();
    try {
      await sql`
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
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_user_goals_user_year ON life_navigator.user_goals(user_id, year)`;
      await sql.end();
      return new Response(
        JSON.stringify({ success: true, message: "User goals table created" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      const error = err as Error;
      console.error("Migration error:", error);
      await sql.end();
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Add last_activity column - public endpoint for quick migration
  if (action === "add-last-activity-column") {
    const sql = getDbConnection();
    try {
      await sql`ALTER TABLE life_navigator.profiles ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ`;
      await sql.end();
      return new Response(
        JSON.stringify({ success: true, message: "last_activity column added" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      const error = err as Error;
      console.error("Migration error:", error);
      await sql.end();
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Bootstrap schema - public endpoint with JWT_SECRET protection
  // Used for initial setup when no admin exists yet
  if (action === "bootstrap-schema" && req.method === "POST") {
    const { secret_key } = await req.json();
    
    const expectedKey = Deno.env.get("JWT_SECRET");
    if (secret_key !== expectedKey) {
      return new Response(
        JSON.stringify({ error: "Invalid secret key" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sql = getDbConnection();
    const logs: string[] = [];

    try {
      // Create schema
      await sql`CREATE SCHEMA IF NOT EXISTS life_navigator`;
      logs.push("✓ Schema life_navigator created");

      // Create enum for roles
      await sql`
        DO $$ BEGIN
          CREATE TYPE life_navigator.app_role AS ENUM ('admin', 'user');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `;
      logs.push("✓ Enum app_role created");

      // Create profiles table with password_hash
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.profiles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT NOT NULL,
          password_hash TEXT,
          first_name TEXT,
          last_name TEXT,
          birth_date DATE,
          birth_time TIME,
          subscription_until DATE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      logs.push("✓ Table profiles created");

      // Add password_hash column if it doesn't exist
      await sql`
        DO $$ BEGIN
          ALTER TABLE life_navigator.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
        EXCEPTION
          WHEN duplicate_column THEN null;
        END $$;
      `;
      logs.push("✓ Column password_hash ensured");

      // Drop NOT NULL constraint from auth_user_id if it exists (for migration from old schema)
      await sql`
        DO $$ BEGIN
          ALTER TABLE life_navigator.profiles ALTER COLUMN auth_user_id DROP NOT NULL;
        EXCEPTION
          WHEN undefined_column THEN null;
        END $$;
      `;
      logs.push("✓ auth_user_id NOT NULL constraint removed");

      // Add unique constraint on email if not exists
      await sql`
        DO $$ BEGIN
          ALTER TABLE life_navigator.profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);
        EXCEPTION
          WHEN duplicate_object THEN null;
          WHEN duplicate_table THEN null;
        END $$;
      `;
      logs.push("✓ Unique constraint on email ensured");

      // Create user_roles table
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.user_roles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES life_navigator.profiles(id) ON DELETE CASCADE,
          role life_navigator.app_role NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (user_id, role)
        )
      `;
      logs.push("✓ Table user_roles created");

      // Add missing daily_energy columns if they exist
      try {
        await sql`ALTER TABLE life_navigator.daily_energy ADD COLUMN IF NOT EXISTS is_money_activation BOOLEAN DEFAULT false`;
        await sql`ALTER TABLE life_navigator.daily_energy ADD COLUMN IF NOT EXISTS is_money_haircut BOOLEAN DEFAULT false`;
        await sql`ALTER TABLE life_navigator.daily_energy ADD COLUMN IF NOT EXISTS is_lunar_eclipse BOOLEAN DEFAULT false`;
        logs.push("✓ Daily energy columns updated");
      } catch (e) {
        logs.push("Note: daily_energy table may not exist yet");
      }

      await sql.end();

      return new Response(
        JSON.stringify({ success: true, message: "Bootstrap schema completed", logs }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      const error = err as Error;
      console.error("Bootstrap schema error:", error);
      await sql.end();
      return new Response(
        JSON.stringify({ error: error.message, logs }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  const authHeader = req.headers.get("Authorization");
  const authData = await verifyAuth(authHeader);

  if (!authData) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const sql = getDbConnection();
  const logs: string[] = [];

  try {
    // Check if user is admin
    const isAdmin = await isUserAdmin(sql, authData.userId);
    if (!isAdmin) {
      await sql.end();
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "init") {
      // Create schema
      await sql`CREATE SCHEMA IF NOT EXISTS life_navigator`;
      logs.push("✓ Schema life_navigator created");

      // Create enum for roles
      await sql`
        DO $$ BEGIN
          CREATE TYPE life_navigator.app_role AS ENUM ('admin', 'user');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `;
      logs.push("✓ Enum app_role created");

      // Create enum for forecast types
      await sql`
        DO $$ BEGIN
          CREATE TYPE life_navigator.forecast_type AS ENUM ('year', 'month');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `;
      logs.push("✓ Enum forecast_type created");

      // Create enum for habit repeat
      await sql`
        DO $$ BEGIN
          CREATE TYPE life_navigator.habit_repeat AS ENUM ('week', 'month', '3months', 'year');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `;
      logs.push("✓ Enum habit_repeat created");

      // 1. profiles - Updated structure without auth_user_id, with password_hash
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.profiles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT,
          first_name TEXT,
          last_name TEXT,
          birth_date DATE,
          birth_time TIME,
          subscription_until DATE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      logs.push("✓ Table profiles created");

      // Add password_hash column if it doesn't exist (for migration)
      await sql`
        DO $$ BEGIN
          ALTER TABLE life_navigator.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
        EXCEPTION
          WHEN duplicate_column THEN null;
        END $$;
      `;
      logs.push("✓ Column password_hash ensured");

      // Add last_activity column if it doesn't exist
      await sql`
        DO $$ BEGIN
          ALTER TABLE life_navigator.profiles ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ;
        EXCEPTION
          WHEN duplicate_column THEN null;
        END $$;
      `;
      logs.push("✓ Column last_activity ensured");

      // Add unique constraint on email if not exists
      await sql`
        DO $$ BEGIN
          ALTER TABLE life_navigator.profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);
        EXCEPTION
          WHEN duplicate_object THEN null;
          WHEN duplicate_table THEN null;
        END $$;
      `;
      logs.push("✓ Unique constraint on email ensured");

      // 2. user_roles
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.user_roles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES life_navigator.profiles(id) ON DELETE CASCADE,
          role life_navigator.app_role NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (user_id, role)
        )
      `;
      logs.push("✓ Table user_roles created");

      // 3. bazi_charts
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.bazi_charts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES life_navigator.profiles(id) ON DELETE CASCADE UNIQUE,
          year_stem TEXT,
          year_branch TEXT,
          month_stem TEXT,
          month_branch TEXT,
          day_stem TEXT,
          day_branch TEXT,
          hour_stem TEXT,
          hour_branch TEXT,
          is_auto_calculated BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      logs.push("✓ Table bazi_charts created");

      // 4. individual_forecasts
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.individual_forecasts (
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
        )
      `;
      logs.push("✓ Table individual_forecasts created");

      // 5. user_hints
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.user_hints (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES life_navigator.profiles(id) ON DELETE CASCADE UNIQUE,
          hint_text TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      logs.push("✓ Table user_hints created");

      // 6. tasks
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES life_navigator.profiles(id) ON DELETE CASCADE,
          text TEXT NOT NULL,
          date DATE NOT NULL,
          completed BOOLEAN DEFAULT false,
          is_from_admin BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      logs.push("✓ Table tasks created");
      
      // Add is_from_admin column if it doesn't exist
      await sql`
        DO $$ BEGIN
          ALTER TABLE life_navigator.tasks ADD COLUMN IF NOT EXISTS is_from_admin BOOLEAN DEFAULT false;
        EXCEPTION
          WHEN duplicate_column THEN null;
        END $$;
      `;
      logs.push("✓ Column is_from_admin ensured");

      // 7. habits
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.habits (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES life_navigator.profiles(id) ON DELETE CASCADE,
          text TEXT NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE,
          repeat life_navigator.habit_repeat NOT NULL DEFAULT 'week',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      logs.push("✓ Table habits created");

      // 8. habit_completions
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.habit_completions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          habit_id UUID NOT NULL REFERENCES life_navigator.habits(id) ON DELETE CASCADE,
          date DATE NOT NULL,
          UNIQUE (habit_id, date)
        )
      `;
      logs.push("✓ Table habit_completions created");

      // 9. achievements
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.achievements (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES life_navigator.profiles(id) ON DELETE CASCADE,
          date DATE NOT NULL,
          achievement_1 TEXT,
          achievement_2 TEXT,
          achievement_3 TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (user_id, date)
        )
      `;
      logs.push("✓ Table achievements created");

      // 10. daily_energy
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.daily_energy (
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
        )
      `;
      logs.push("✓ Table daily_energy created");

      // Add missing columns for daily_energy if they don't exist
      await sql`
        DO $$ BEGIN
          ALTER TABLE life_navigator.daily_energy ADD COLUMN IF NOT EXISTS is_money_activation BOOLEAN DEFAULT false;
        EXCEPTION
          WHEN duplicate_column THEN null;
        END $$;
      `;
      await sql`
        DO $$ BEGIN
          ALTER TABLE life_navigator.daily_energy ADD COLUMN IF NOT EXISTS is_money_haircut BOOLEAN DEFAULT false;
        EXCEPTION
          WHEN duplicate_column THEN null;
        END $$;
      `;
      await sql`
        DO $$ BEGIN
          ALTER TABLE life_navigator.daily_energy ADD COLUMN IF NOT EXISTS is_lunar_eclipse BOOLEAN DEFAULT false;
        EXCEPTION
          WHEN duplicate_column THEN null;
        END $$;
      `;
      logs.push("✓ Daily energy columns ensured");

      // 11. monthly_events
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.monthly_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          date DATE NOT NULL,
          emoji TEXT NOT NULL,
          label TEXT,
          description TEXT
        )
      `;
      logs.push("✓ Table monthly_events created");

      // 12. global_tasks
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.global_tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          text TEXT NOT NULL,
          date DATE NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      logs.push("✓ Table global_tasks created");

      // 13. general_forecasts
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.general_forecasts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          year INT NOT NULL UNIQUE,
          title TEXT,
          content TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      logs.push("✓ Table general_forecasts created");

      // 14. user_goals - separate table for user's own goals (not admin forecasts)
      await sql`
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
      `;
      logs.push("✓ Table user_goals created");

      await sql`CREATE INDEX IF NOT EXISTS idx_user_goals_user_year ON life_navigator.user_goals(user_id, year)`;
      logs.push("✓ Index on user_goals created");

      // 14. interpretation_rules
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.interpretation_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          rule_key TEXT NOT NULL UNIQUE,
          title TEXT,
          description TEXT
        )
      `;
      logs.push("✓ Table interpretation_rules created");

      // 15. personal_branch_advice
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.personal_branch_advice (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          personal_element TEXT NOT NULL,
          day_branch TEXT NOT NULL,
          advice TEXT,
          UNIQUE (personal_element, day_branch)
        )
      `;
      logs.push("✓ Table personal_branch_advice created");

      // 16. branch_interactions_day
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.branch_interactions_day (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_branch TEXT NOT NULL,
          day_branch TEXT NOT NULL,
          interaction_type TEXT,
          advice TEXT,
          UNIQUE (user_branch, day_branch)
        )
      `;
      logs.push("✓ Table branch_interactions_day created");

      // 17. branch_interactions_year
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.branch_interactions_year (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_branch TEXT NOT NULL,
          year_branch TEXT NOT NULL,
          interaction_type TEXT,
          advice TEXT,
          UNIQUE (user_branch, year_branch)
        )
      `;
      logs.push("✓ Table branch_interactions_year created");

      // 18. month_branch_advice
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.month_branch_advice (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_branch TEXT NOT NULL,
          month_branch TEXT NOT NULL,
          advice TEXT,
          UNIQUE (user_branch, month_branch)
        )
      `;
      logs.push("✓ Table month_branch_advice created");

      // 19. stem_to_stem_rules - User Day Stem × Current Day Stem (100 combinations)
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.stem_to_stem_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_day_stem TEXT NOT NULL,
          current_day_stem TEXT NOT NULL,
          advice TEXT,
          emoji TEXT,
          UNIQUE(user_day_stem, current_day_stem)
        )
      `;
      logs.push("✓ Table stem_to_stem_rules created");

      // 20. stem_to_branch_rules - User Day Stem × Current Day Branch (120 combinations)
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.stem_to_branch_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_day_stem TEXT NOT NULL,
          current_day_branch TEXT NOT NULL,
          advice TEXT,
          emoji TEXT,
          UNIQUE(user_day_stem, current_day_branch)
        )
      `;
      logs.push("✓ Table stem_to_branch_rules created");

      // 21. day_branch_rules - User Day Branch × Current Day Branch (144 combinations)
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.day_branch_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_day_branch TEXT NOT NULL,
          current_day_branch TEXT NOT NULL,
          advice TEXT,
          emoji TEXT,
          UNIQUE(user_day_branch, current_day_branch)
        )
      `;
      logs.push("✓ Table day_branch_rules created");

      // 22. year_branch_rules - User Year Branch × Current Day Branch (144 combinations)
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.year_branch_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_year_branch TEXT NOT NULL,
          current_day_branch TEXT NOT NULL,
          advice TEXT,
          emoji TEXT,
          UNIQUE(user_year_branch, current_day_branch)
        )
      `;
      logs.push("✓ Table year_branch_rules created");

      // 23. month_branch_rules - User Month Branch × Current Day Branch (144 combinations)
      await sql`
        CREATE TABLE IF NOT EXISTS life_navigator.month_branch_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_month_branch TEXT NOT NULL,
          current_day_branch TEXT NOT NULL,
          advice TEXT,
          emoji TEXT,
          UNIQUE(user_month_branch, current_day_branch)
        )
      `;
      logs.push("✓ Table month_branch_rules created");

      // Create indexes
      await sql`CREATE INDEX IF NOT EXISTS idx_profiles_email ON life_navigator.profiles(email)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON life_navigator.tasks(user_id, date)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_habits_user ON life_navigator.habits(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_daily_energy_date ON life_navigator.daily_energy(date)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_monthly_events_date ON life_navigator.monthly_events(date)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_stem_to_stem_rules ON life_navigator.stem_to_stem_rules(user_day_stem, current_day_stem)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_stem_to_branch_rules ON life_navigator.stem_to_branch_rules(user_day_stem, current_day_branch)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_day_branch_rules ON life_navigator.day_branch_rules(user_day_branch, current_day_branch)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_year_branch_rules ON life_navigator.year_branch_rules(user_year_branch, current_day_branch)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_month_branch_rules ON life_navigator.month_branch_rules(user_month_branch, current_day_branch)`;
      logs.push("✓ Indexes created");

      await sql.end();

      return new Response(
        JSON.stringify({ success: true, message: "Schema and tables initialized successfully", logs }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "assign-admin") {
      const { email } = await req.json();
      
      if (!email) {
        await sql.end();
        return new Response(
          JSON.stringify({ error: "Email is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find profile by email
      const profiles = await sql`
        SELECT id FROM life_navigator.profiles 
        WHERE LOWER(email) = LOWER(${email})
      `;

      if (profiles.length === 0) {
        await sql.end();
        return new Response(
          JSON.stringify({ error: "Profile not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const profileId = profiles[0].id;

      // Assign admin role
      await sql`
        INSERT INTO life_navigator.user_roles (user_id, role)
        VALUES (${profileId}, 'admin')
        ON CONFLICT (user_id, role) DO NOTHING
      `;

      await sql.end();

      return new Response(
        JSON.stringify({ success: true, message: `Admin role assigned to ${email}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "migrate-schema") {
      // Migration to add password_hash and remove auth_user_id dependency
      
      // Add password_hash column
      await sql`
        DO $$ BEGIN
          ALTER TABLE life_navigator.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
        EXCEPTION
          WHEN duplicate_column THEN null;
        END $$;
      `;
      logs.push("✓ Column password_hash added");

      // Add unique constraint on email
      await sql`
        DO $$ BEGIN
          ALTER TABLE life_navigator.profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);
        EXCEPTION
          WHEN duplicate_object THEN null;
          WHEN duplicate_table THEN null;
        END $$;
      `;
      logs.push("✓ Unique constraint on email added");

      // Drop auth_user_id column if exists (optional, keeping for backward compatibility)
      // We don't drop it to avoid breaking existing data
      
      await sql.end();

      return new Response(
        JSON.stringify({ success: true, message: "Schema migrated successfully", logs }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await sql.end();
    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const error = err as Error;
    console.error("Error:", error);
    await sql.end();
    return new Response(
      JSON.stringify({ error: error.message, logs }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
