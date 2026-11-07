# Faster startup
- [x] Combine planner startup reads into one authenticated request.
- [x] Show per-account saved data immediately and refresh silently; persist edits.
- [x] Deduplicate repeated authentication checks.
- [x] Remove the extra permission round trip, start the download before the screen renders, retry stalled requests, add a retry button.
- [x] Lazy-load admin pages; preconnect to the backend.
- [ ] Verify authenticated startup on a real phone — blocked by unavailable custom-auth session.

- [x] Prepare planner tables in built-in database (life_navigator schema)
- [x] Import supplied Timeweb dump and verify all row counts and relationships.
- [x] Switch edge functions from EXTERNAL_DB_* to built-in database after import.
- [x] Preserve existing account credentials and push configuration; verify database connection and login page.
- [ ] Verify successful account login and planner readback — waiting for the owner to sign in using the existing custom-auth credentials.
