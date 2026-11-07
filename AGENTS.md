# Architecture rules
- Load planner data through the `external-db` bootstrap action using one parameterized SQL statement returned as raw JSON text, so startup does not open a connection per table.
- Request the bootstrap as a text/plain POST with the token in the body and start it in `main.tsx` before React renders, so mobile startup avoids a CORS preflight and render delay.
- Edge functions send `Access-Control-Max-Age` so browsers cache preflights; admin pages are lazy-loaded to keep the client bundle small.
- Persist planner snapshots per account with a versioned cache, and deduplicate in-flight reads; cached data must never cross account boundaries.
- Share background authentication verification across hook instances, and clear account snapshots on logout or invalid authentication.
- Planner data lives in the private `life_navigator` schema (no anon/authenticated grants); all edge functions connect through `_shared/database.ts` using the managed `SUPABASE_DB_URL`, TLS and the planner search path, so no planner feature depends on Timeweb.
- Import external dumps as reviewed, schema-qualified data inserts in dependency order; never execute their DROP/CREATE statements, so existing Cloud schema and account identities remain intact.
