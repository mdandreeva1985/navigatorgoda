import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

/** All planner services use the same private Cloud database and schema. */
export function getDbConnection() {
  const url = Deno.env.get("SUPABASE_DB_URL");
  if (!url) throw new Error("Cloud database configuration is missing");

  return postgres(url, {
    ssl: "require",
    max: 1,
    prepare: false,
    connect_timeout: 10,
    connection: { search_path: "life_navigator,public" },
  });
}