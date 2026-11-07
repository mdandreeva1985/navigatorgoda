import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";
import { SignJWT, jwtVerify } from "https://deno.land/x/jose@v4.15.4/index.ts";
import { getDbConnection } from "../_shared/database.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  // Lets browsers reuse the permission check instead of repeating it before every request.
  "Access-Control-Max-Age": "86400",
};

// Password hashing using Web Crypto API (PBKDF2) - works in Edge Functions
const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 32;

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  
  const key = await crypto.subtle.importKey(
    "raw",
    passwordData,
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    key,
    KEY_LENGTH * 8
  );
  
  const hashArray = new Uint8Array(derivedBits);
  const combined = new Uint8Array(SALT_LENGTH + KEY_LENGTH);
  combined.set(salt);
  combined.set(hashArray, SALT_LENGTH);
  
  return btoa(String.fromCharCode(...combined));
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const combined = Uint8Array.from(atob(storedHash), c => c.charCodeAt(0));
    const salt = combined.slice(0, SALT_LENGTH);
    const storedKey = combined.slice(SALT_LENGTH);
    
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    
    const key = await crypto.subtle.importKey(
      "raw",
      passwordData,
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: ITERATIONS,
        hash: "SHA-256",
      },
      key,
      KEY_LENGTH * 8
    );
    
    const derivedKey = new Uint8Array(derivedBits);
    
    // Constant-time comparison
    if (derivedKey.length !== storedKey.length) return false;
    let result = 0;
    for (let i = 0; i < derivedKey.length; i++) {
      result |= derivedKey[i] ^ storedKey[i];
    }
    return result === 0;
  } catch {
    return false;
  }
}

// Get JWT secret as Uint8Array
function getJwtSecret(): Uint8Array {
  const secret = Deno.env.get("JWT_SECRET");
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

// Create JWT token
async function createToken(userId: string, email: string): Promise<string> {
  const secret = getJwtSecret();
  
  const token = await new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
  
  return token;
}

// Verify JWT token
async function verifyToken(token: string): Promise<{ userId: string; email: string } | null> {
  try {
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

// Get user from token in Authorization header
async function getUserFromAuth(authHeader: string | null): Promise<{ userId: string; email: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  
  const token = authHeader.replace("Bearer ", "");
  return await verifyToken(token);
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
    // Health check
    if (action === "health" && req.method === "GET") {
      return new Response(
        JSON.stringify({ status: "ok", message: "Custom auth service is running" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Login - public endpoint
    if (action === "login" && req.method === "POST") {
      const { email, password } = await req.json();
      
      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Email and password are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sql = getDbConnection();
      
      // Find user by email
      const users = await sql`
        SELECT id, email, password_hash, first_name, last_name, subscription_until
        FROM life_navigator.profiles
        WHERE LOWER(email) = LOWER(${email.trim()})
      `;
      
      if (users.length === 0) {
        await sql.end();
        return new Response(
          JSON.stringify({ error: "Invalid email or password" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const user = users[0];
      
      // Check if user has a password set
      if (!user.password_hash) {
        await sql.end();
        return new Response(
          JSON.stringify({ error: "Account not activated. Please contact administrator." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify password
      const isValidPassword = await verifyPassword(password, user.password_hash);
      
      if (!isValidPassword) {
        await sql.end();
        return new Response(
          JSON.stringify({ error: "Invalid email or password" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if admin
      const isAdmin = await isUserAdmin(sql, user.id);
      
      // Try to update last_activity timestamp (ignore if column doesn't exist)
      try {
        await sql`
          UPDATE life_navigator.profiles 
          SET last_activity = now() 
          WHERE id = ${user.id}::uuid
        `;
      } catch (err: unknown) {
        // Column may not exist yet, ignore error
        console.log("Could not update last_activity:", err instanceof Error ? err.message : String(err));
      }
      
      await sql.end();

      // Create JWT token
      const token = await createToken(user.id, user.email);

      return new Response(
        JSON.stringify({
          token,
          user: {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            subscription_until: user.subscription_until,
            is_admin: isAdmin,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify token
    if (action === "verify" && req.method === "GET") {
      const userData = await getUserFromAuth(authHeader);
      
      if (!userData) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sql = getDbConnection();
      
      // Get full user data
      const users = await sql`
        SELECT id, email, first_name, last_name, subscription_until
        FROM life_navigator.profiles
        WHERE id = ${userData.userId}::uuid
      `;
      
      if (users.length === 0) {
        await sql.end();
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const user = users[0];
      const isAdmin = await isUserAdmin(sql, user.id);
      
      // Issue a fresh token to extend the session
      const freshToken = await createToken(user.id, user.email);
      
      await sql.end();

      return new Response(
        JSON.stringify({
          valid: true,
          token: freshToken,
          user: {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            subscription_until: user.subscription_until,
            is_admin: isAdmin,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user - admin only
    if (action === "create-user" && req.method === "POST") {
      const adminData = await getUserFromAuth(authHeader);
      
      if (!adminData) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sql = getDbConnection();
      
      // Check if requester is admin
      const isAdmin = await isUserAdmin(sql, adminData.userId);
      
      if (!isAdmin) {
        await sql.end();
        return new Response(
          JSON.stringify({ error: "Forbidden: Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { email, password, first_name, last_name, birth_date, birth_time, subscription_until } = await req.json();
      
      if (!email || !password) {
        await sql.end();
        return new Response(
          JSON.stringify({ error: "Email and password are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (password.length < 6) {
        await sql.end();
        return new Response(
          JSON.stringify({ error: "Password must be at least 6 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if email already exists
      const existing = await sql`
        SELECT id FROM life_navigator.profiles
        WHERE LOWER(email) = LOWER(${email.trim()})
      `;
      
      if (existing.length > 0) {
        await sql.end();
        return new Response(
          JSON.stringify({ error: "User with this email already exists" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user
      const created = await sql`
        INSERT INTO life_navigator.profiles (
          email, password_hash, first_name, last_name, birth_date, birth_time, subscription_until
        )
        VALUES (
          ${email.trim()},
          ${passwordHash},
          ${first_name || null},
          ${last_name || null},
          ${birth_date || null},
          ${birth_time || null},
          ${subscription_until || null}
        )
        RETURNING id, email, first_name, last_name, birth_date, birth_time, subscription_until, created_at
      `;
      
      await sql.end();

      console.log(`User created: ${email} by admin ${adminData.email}`);

      return new Response(
        JSON.stringify({ success: true, user: created[0] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Change password - admin only
    if (action === "change-password" && req.method === "POST") {
      const adminData = await getUserFromAuth(authHeader);
      
      if (!adminData) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sql = getDbConnection();
      
      // Check if requester is admin
      const isAdmin = await isUserAdmin(sql, adminData.userId);
      
      if (!isAdmin) {
        await sql.end();
        return new Response(
          JSON.stringify({ error: "Forbidden: Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { user_id, new_password } = await req.json();
      
      if (!user_id || !new_password) {
        await sql.end();
        return new Response(
          JSON.stringify({ error: "User ID and new password are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (new_password.length < 6) {
        await sql.end();
        return new Response(
          JSON.stringify({ error: "Password must be at least 6 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Hash new password
      const passwordHash = await hashPassword(new_password);

      // Update password
      const updated = await sql`
        UPDATE life_navigator.profiles
        SET password_hash = ${passwordHash}, updated_at = now()
        WHERE id = ${user_id}::uuid
        RETURNING id, email
      `;
      
      await sql.end();

      if (updated.length === 0) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Password changed for user ${updated[0].email} by admin ${adminData.email}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reset admin password - works with JWT_SECRET verification
    if (action === "reset-admin-password" && req.method === "POST") {
      const { email, password, secret_key } = await req.json();
      
      const expectedKey = Deno.env.get("JWT_SECRET");
      if (secret_key !== expectedKey) {
        return new Response(
          JSON.stringify({ error: "Invalid secret key" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Email and password are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (password.length < 6) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 6 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sql = getDbConnection();

      // First delete ALL existing admin roles
      await sql`DELETE FROM life_navigator.user_roles WHERE role = 'admin'`;
      console.log("Deleted all existing admin roles");

      // Check if user with this email exists
      const existing = await sql`
        SELECT id FROM life_navigator.profiles
        WHERE LOWER(email) = LOWER(${email.trim()})
      `;

      let userId: string;

      if (existing.length > 0) {
        userId = existing[0].id;
        const passwordHash = await hashPassword(password);
        
        await sql`
          UPDATE life_navigator.profiles
          SET password_hash = ${passwordHash}, updated_at = now()
          WHERE id = ${userId}::uuid
        `;
        console.log(`Updated password for existing user: ${email}`);
      } else {
        const passwordHash = await hashPassword(password);
        
        const created = await sql`
          INSERT INTO life_navigator.profiles (
            email, password_hash, first_name, last_name
          )
          VALUES (
            ${email.trim()},
            ${passwordHash},
            'Admin',
            'User'
          )
          RETURNING id
        `;
        userId = created[0].id;
        console.log(`Created new admin user: ${email}`);
      }

      // Assign admin role to this user
      await sql`
        INSERT INTO life_navigator.user_roles (user_id, role)
        VALUES (${userId}::uuid, 'admin')
        ON CONFLICT (user_id, role) DO NOTHING
      `;

      await sql.end();

      console.log(`Admin role assigned to: ${email}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Admin reset successfully",
          email 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Bootstrap first admin - only works if no admins exist
    if (action === "bootstrap-admin" && req.method === "POST") {
      const { email, password, secret_key } = await req.json();
      
      // Simple secret key protection for bootstrap
      const expectedKey = Deno.env.get("JWT_SECRET");
      if (secret_key !== expectedKey) {
        return new Response(
          JSON.stringify({ error: "Invalid secret key" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Email and password are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (password.length < 6) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 6 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sql = getDbConnection();

      // Check if any admin already exists
      const existingAdmins = await sql`
        SELECT ur.id FROM life_navigator.user_roles ur
        WHERE ur.role = 'admin'
        LIMIT 1
      `;

      if (existingAdmins.length > 0) {
        await sql.end();
        return new Response(
          JSON.stringify({ error: "Admin already exists. Use regular admin functions." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user with this email exists
      const existing = await sql`
        SELECT id FROM life_navigator.profiles
        WHERE LOWER(email) = LOWER(${email.trim()})
      `;

      let userId: string;

      if (existing.length > 0) {
        // Update existing user with password
        userId = existing[0].id;
        const passwordHash = await hashPassword(password);
        
        await sql`
          UPDATE life_navigator.profiles
          SET password_hash = ${passwordHash}, updated_at = now()
          WHERE id = ${userId}::uuid
        `;
        console.log(`Updated password for existing user: ${email}`);
      } else {
        // Create new admin user
        const passwordHash = await hashPassword(password);
        
        const created = await sql`
          INSERT INTO life_navigator.profiles (
            email, password_hash, first_name, last_name
          )
          VALUES (
            ${email.trim()},
            ${passwordHash},
            'Admin',
            'User'
          )
          RETURNING id
        `;
        userId = created[0].id;
        console.log(`Created new admin user: ${email}`);
      }

      // Assign admin role
      await sql`
        INSERT INTO life_navigator.user_roles (user_id, role)
        VALUES (${userId}::uuid, 'admin')
        ON CONFLICT (user_id, role) DO NOTHING
      `;

      await sql.end();

      console.log(`Admin role assigned to: ${email}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Admin created successfully",
          email 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
