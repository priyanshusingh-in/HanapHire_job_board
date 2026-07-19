-- startAgent()'s "max 1 concurrent run per job" guard was check-then-act
-- (findFirst for an existing RUNNING run, then create) with no locking
-- between the two — under a genuine race (an impatient double-click, or a
-- client retrying a click that briefly looked unstable), two calls can both
-- see "no running run" before either commits, each creating its own
-- ScreeningRun. Observed in practice as two runs progressing concurrently
-- for the same job, with the UI flipping between DONE and RUNNING as
-- whichever run is newest by createdAt changes.
--
-- A partial unique index makes "one RUNNING run per job" a database-level
-- invariant instead of an application-level race: the second concurrent
-- insert now fails with a unique violation, which startAgent() catches and
-- turns into "return the run that won."
create unique index "screening_runs_one_running_per_job"
  on "screening_runs" ("jobId")
  where "status" = 'RUNNING';
