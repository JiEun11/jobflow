-- Run manually as the schema owner after the approved migration.
-- Create jobflow_web and jobflow_collector with CREATE ROLE ... LOGIN, then set passwords with psql.
BEGIN;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO jobflow_web;
GRANT SELECT ON public.owner, public.auth_user, public.auth_account TO jobflow_web;
GRANT SELECT, INSERT ON public.profile_version TO jobflow_web;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_session, public.auth_rate_limit TO jobflow_web;

GRANT USAGE ON SCHEMA jobflow_collection TO jobflow_web, jobflow_collector;
GRANT SELECT ON jobflow_collection.run, jobflow_collection.job, jobflow_collection.job_snapshot TO jobflow_web;
GRANT SELECT, INSERT, UPDATE ON jobflow_collection.run, jobflow_collection.attempt, jobflow_collection.job TO jobflow_collector;
GRANT INSERT ON jobflow_collection.board_result TO jobflow_collector;
GRANT SELECT, INSERT ON jobflow_collection.job_snapshot TO jobflow_collector;

COMMIT;
