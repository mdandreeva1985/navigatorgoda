REVOKE INSERT ON ALL TABLES IN SCHEMA life_navigator FROM supabase_read_only_user;
REVOKE USAGE ON SCHEMA life_navigator FROM supabase_read_only_user;
GRANT USAGE ON SCHEMA life_navigator TO sandbox_exec;
GRANT INSERT ON ALL TABLES IN SCHEMA life_navigator TO sandbox_exec;