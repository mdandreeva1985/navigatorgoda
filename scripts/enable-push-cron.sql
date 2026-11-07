-- Daily push notifications: run ONLY on switch day, after the old Lovable cron is off,
-- otherwise users get every notification twice.
--   npx supabase db query --remote -f scripts/enable-push-cron.sql --yes
--
-- Runs every hour at :00; the function itself sends only to users whose local time is 08:00,
-- once per day (push_subscriptions.last_notified_date).
SELECT cron.schedule(
  'send-daily-push-notifications',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xidgphoiovwrryqkzfhp.supabase.co/functions/v1/push-notifications?action=send-daily',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
