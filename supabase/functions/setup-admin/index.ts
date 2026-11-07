import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";
import { getDbConnection } from "../_shared/database.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  // Lets browsers reuse the permission check instead of repeating it before every request.
  "Access-Control-Max-Age": "86400",
};

const ADMIN_EMAIL = "marlendigitalstudio@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

  if (claimsError || !claimsData?.claims) {
    return new Response(
      JSON.stringify({ error: "Invalid token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const userId = claimsData.claims.sub as string;
  const userEmail = claimsData.claims.email as string;

  // Only allow the designated admin email
  if (userEmail !== ADMIN_EMAIL) {
    return new Response(
      JSON.stringify({ error: "Not authorized to become admin" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const sql = getDbConnection();

  try {
    // Check if profile exists
    const existingProfiles = await sql`
      SELECT id FROM life_navigator.profiles WHERE auth_user_id = ${userId}
    `;

    let profileId: string;

    if (existingProfiles.length === 0) {
      // Create profile for admin
      const newProfiles = await sql`
        INSERT INTO life_navigator.profiles (auth_user_id, email, first_name, last_name)
        VALUES (${userId}, ${userEmail}, 'Мария', 'Андреева')
        RETURNING id
      `;
      profileId = newProfiles[0].id;
      console.log("Created admin profile:", profileId);
    } else {
      profileId = existingProfiles[0].id;
      console.log("Admin profile exists:", profileId);
    }

    // Check if admin role exists
    const existingRoles = await sql`
      SELECT id FROM life_navigator.user_roles 
      WHERE user_id = ${profileId} AND role = 'admin'
    `;

    if (existingRoles.length === 0) {
      // Assign admin role
      await sql`
        INSERT INTO life_navigator.user_roles (user_id, role)
        VALUES (${profileId}, 'admin')
      `;
      console.log("Assigned admin role to:", profileId);
    }

    await sql.end();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Admin setup complete",
        profileId,
        email: userEmail
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const error = err as Error;
    console.error("Setup admin error:", error);
    await sql.end();
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
