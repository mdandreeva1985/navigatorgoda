REVOKE INSERT ON ALL TABLES IN SCHEMA life_navigator FROM sandbox_exec;
REVOKE USAGE ON SCHEMA life_navigator FROM sandbox_exec;
ALTER SEQUENCE life_navigator.push_config_id_seq RESTART WITH 2;