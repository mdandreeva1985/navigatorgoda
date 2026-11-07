import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";
import { jwtVerify } from "https://deno.land/x/jose@v4.15.4/index.ts";
import { getDbConnection } from "../_shared/database.ts";
import { BadRequest, runUserOp } from "../_shared/userOps.ts";

async function isAdmin(userId: string): Promise<boolean> {
  const sql = getDbConnection();
  try {
    const roles = await sql`
      SELECT 1 FROM life_navigator.user_roles
      WHERE user_id = ${userId}::uuid AND role = 'admin'`;
    return roles.length > 0;
  } finally {
    await sql.end();
  }
}

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

// Verify custom JWT token and get user ID
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

async function bootstrapQuery(sql: ReturnType<typeof postgres>, userId: string) {
  const rows = await sql`
          SELECT jsonb_build_object(
            'profile', (SELECT to_jsonb(p) FROM (
              SELECT id, email, first_name, last_name, birth_date, birth_time, subscription_until
              FROM life_navigator.profiles WHERE id = ${userId}::uuid
            ) p),
            'tasks', COALESCE((SELECT jsonb_agg(t ORDER BY t.date, t.created_at) FROM life_navigator.tasks t WHERE t.user_id = ${userId}::uuid), '[]'::jsonb),
            'habits', COALESCE((SELECT jsonb_agg(h ORDER BY h.created_at) FROM life_navigator.habits h WHERE h.user_id = ${userId}::uuid), '[]'::jsonb),
            'habitCompletions', COALESCE((SELECT jsonb_agg(hc) FROM life_navigator.habit_completions hc JOIN life_navigator.habits h ON h.id = hc.habit_id WHERE h.user_id = ${userId}::uuid), '[]'::jsonb),
            'dailyEnergy', COALESCE((SELECT jsonb_agg(e ORDER BY e.date) FROM life_navigator.daily_energy e), '[]'::jsonb),
            'baziChart', (SELECT to_jsonb(b) FROM life_navigator.bazi_charts b WHERE b.user_id = ${userId}::uuid LIMIT 1),
            'monthlyEvents', COALESCE((SELECT jsonb_agg(e ORDER BY e.date) FROM life_navigator.monthly_events e), '[]'::jsonb),
            'userHint', (SELECT to_jsonb(h) FROM life_navigator.user_hints h WHERE h.user_id = ${userId}::uuid LIMIT 1),
            'individualForecasts', COALESCE((SELECT jsonb_agg(f) FROM life_navigator.individual_forecasts f WHERE f.user_id = ${userId}::uuid), '[]'::jsonb),
            'generalForecast', (SELECT to_jsonb(f) FROM life_navigator.general_forecasts f WHERE f.year = ${new Date().getFullYear()} LIMIT 1),
            'achievements', COALESCE((SELECT jsonb_agg(a ORDER BY a.date) FROM life_navigator.achievements a WHERE a.user_id = ${userId}::uuid), '[]'::jsonb),
            'userGoals', COALESCE((SELECT jsonb_agg(g ORDER BY g.updated_at DESC NULLS LAST, g.created_at DESC) FROM life_navigator.user_goals g WHERE g.user_id = ${userId}::uuid), '[]'::jsonb),
            'stemToStemRules', COALESCE((SELECT jsonb_agg(r) FROM life_navigator.stem_to_stem_rules r), '[]'::jsonb),
            'stemToBranchRules', COALESCE((SELECT jsonb_agg(r) FROM life_navigator.stem_to_branch_rules r), '[]'::jsonb),
            'dayBranchRules', COALESCE((SELECT jsonb_agg(r) FROM life_navigator.day_branch_rules r), '[]'::jsonb),
            'yearBranchRules', COALESCE((SELECT jsonb_agg(r) FROM life_navigator.year_branch_rules r), '[]'::jsonb),
            'monthBranchRules', COALESCE((SELECT jsonb_agg(r) FROM life_navigator.month_branch_rules r), '[]'::jsonb)
          )::text AS data
        `;
  // Raw JSON text: avoids parsing and re-serialising a large snapshot in the function.
  return (rows[0]?.data as string | undefined) ?? "null";
}

function bootstrapResponse(json: string) {
  return new Response(`{"data":${json}}`, {
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "health";
  const authHeader = req.headers.get("Authorization");

  try {
    // Health check - no auth required, also runs migrations
    if (action === "health" && req.method === "GET") {
      const sql = getDbConnection();
      await sql`SELECT 1`;
      
      // Auto-run migrations on health check
      try {
        await sql`
          DO $$ BEGIN
            ALTER TABLE life_navigator.tasks ADD COLUMN IF NOT EXISTS recurring_group_id UUID DEFAULT null;
          EXCEPTION
            WHEN duplicate_column THEN null;
          END $$;
        `;
        console.log("Migration: recurring_group_id column ensured");
      } catch (migErr) {
        console.log("Migration note:", migErr);
      }
      
      await sql.end();
      return new Response(
        JSON.stringify({ status: "ok", message: "Database connection successful" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Startup snapshot as a "simple" cross-origin request (text/plain body, no
    // Authorization header) so the browser skips the extra permission round trip.
    if (action === "bootstrap" && req.method === "POST") {
      let token = "";
      try { token = String(JSON.parse(await req.text())?.token || ""); } catch { /* invalid body */ }
      const bodyAuth = await verifyAuth(token ? `Bearer ${token}` : null);
      if (!bodyAuth) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const sql = getDbConnection();
      try {
        return bootstrapResponse(await bootstrapQuery(sql, bodyAuth.userId));
      } finally {
        await sql.end();
      }
    }

    // All other actions require authentication
    const authData = await verifyAuth(authHeader);
    if (!authData) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userId } = authData;

    // One connection and one SQL statement for the complete planner snapshot.
    // User identity comes exclusively from the verified token.
    if (action === "bootstrap" && req.method === "GET") {
      const sql = getDbConnection();
      try {
        return bootstrapResponse(await bootstrapQuery(sql, userId));
      } finally {
        await sql.end();
      }
    }

    // Fixed, per-user planner changes (tasks, habits, achievements, goals).
    if (action === "user-op" && req.method === "POST") {
      const { op, args } = await req.json();
      const sql = getDbConnection();
      try {
        const data = await runUserOp(sql, userId, String(op), (args ?? {}) as Record<string, unknown>);
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        if (err instanceof BadRequest) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw err;
      } finally {
        await sql.end();
      }
    }

    // Raw SQL and schema changes are for the admin panel only.
    if ((action === "query" || action === "migrate") && !(await isAdmin(userId))) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Execute query (admin only)
    if (action === "query" && req.method === "POST") {
      const { query, params } = await req.json();
      
      if (!query) {
        return new Response(
          JSON.stringify({ error: "Query is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sql = getDbConnection();
      let result;
      if (params && Array.isArray(params)) {
        result = await sql.unsafe(query, params);
      } else {
        result = await sql.unsafe(query);
      }
      await sql.end();

      return new Response(
        JSON.stringify({ data: result, userId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile
    if (action === "profile" && req.method === "GET") {
      const sql = getDbConnection();
      const profiles = await sql`
        SELECT id, email, first_name, last_name, birth_date, birth_time, subscription_until, created_at, updated_at
        FROM life_navigator.profiles 
        WHERE id = ${userId}::uuid
      `;
      await sql.end();

      return new Response(
        JSON.stringify({ profile: profiles.length > 0 ? profiles[0] : null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    if (action === "is-admin" && req.method === "GET") {
      const sql = getDbConnection();
      const roles = await sql`
        SELECT ur.role FROM life_navigator.user_roles ur
        WHERE ur.user_id = ${userId}::uuid AND ur.role = 'admin'
      `;
      await sql.end();

      return new Response(
        JSON.stringify({ isAdmin: roles.length > 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create or update profile (for updating profile data, not for creating users)
    if (action === "upsert-profile" && req.method === "POST") {
      const { first_name, last_name, birth_date, birth_time } = await req.json();
      
      const sql = getDbConnection();
      
      // Update existing profile
      const updated = await sql`
        UPDATE life_navigator.profiles 
        SET 
          first_name = COALESCE(${first_name}, first_name),
          last_name = COALESCE(${last_name}, last_name),
          birth_date = COALESCE(${birth_date}, birth_date),
          birth_time = COALESCE(${birth_time}, birth_time),
          updated_at = now()
        WHERE id = ${userId}::uuid
        RETURNING *
      `;
      
      await sql.end();

      return new Response(
        JSON.stringify({ profile: updated.length > 0 ? updated[0] : null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Run migrations
    if (action === "migrate" && req.method === "POST") {
      const sql = getDbConnection();
      const logs: string[] = [];
      
      try {
        // Add is_from_admin column to tasks if it doesn't exist
        await sql`
          DO $$ BEGIN
            ALTER TABLE life_navigator.tasks ADD COLUMN IF NOT EXISTS is_from_admin BOOLEAN DEFAULT false;
          EXCEPTION
            WHEN duplicate_column THEN null;
          END $$;
        `;
        logs.push("✓ Column is_from_admin added to tasks");
        
        // Add recurring_group_id column to tasks if it doesn't exist
        await sql`
          DO $$ BEGIN
            ALTER TABLE life_navigator.tasks ADD COLUMN IF NOT EXISTS recurring_group_id UUID DEFAULT null;
          EXCEPTION
            WHEN duplicate_column THEN null;
          END $$;
        `;
        logs.push("✓ Column recurring_group_id added to tasks");
        
        await sql.end();
        
        return new Response(
          JSON.stringify({ success: true, logs }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        await sql.end();
        throw err;
      }
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const error = err as Error;
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
