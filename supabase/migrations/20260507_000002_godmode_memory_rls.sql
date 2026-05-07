-- Godmode-engine memory tables — RLS lockdown.
-- See ~/.claude/plans/jazzy-gathering-kernighan.md "Production data-residency
-- + RLS audit (2026-05-07)" for the audit that prompted this migration.
--
-- Background: 20260422_000001_godmode_memory.sql created two tables —
-- `attempt_memory_private` (per-user, includes `task_text` = the user's
-- prompt) and `attempt_memory_global` (cross-user, no PII by design) —
-- but never enabled RLS. Any signed-in browser session can therefore do
--   `await supabase.from('attempt_memory_private').select('*')`
-- and read every other user's private jailbreak attempts. Closing this
-- gap is a CRITICAL prerequisite to onboarding any real users.
--
-- The godmode-engine Edge Function writer (supabase/functions/godmode-engine/
-- memory.ts) connects via a direct Postgres client, NOT supabase-js, so it
-- bypasses RLS by design. RLS therefore only constrains browser-side reads,
-- which is exactly what we want.
--
-- Idempotency: this migration tolerates the godmode-engine memory feature
-- not being deployed yet on a given project (the 20260422 migration not
-- applied). Each block checks for the table's existence and `RAISE NOTICE`s
-- a skip rather than failing. Re-running this migration after the tables
-- come into existence is also safe — `IF NOT EXISTS` and `DROP POLICY IF
-- EXISTS … ; CREATE POLICY …` keep policies consistent.

-- ---------------------------------------------------------------------------
-- attempt_memory_private — owner-scoped reads, no client-side writes.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'attempt_memory_private'
  ) THEN
    EXECUTE 'ALTER TABLE public.attempt_memory_private ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS attempt_memory_private_select ON public.attempt_memory_private';
    EXECUTE $POLICY$
      CREATE POLICY attempt_memory_private_select
        ON public.attempt_memory_private
        FOR SELECT
        USING (user_id = auth.uid())
    $POLICY$;
    RAISE NOTICE 'RLS enabled on attempt_memory_private with owner-scoped SELECT policy.';
  ELSE
    RAISE NOTICE 'attempt_memory_private not present — skipping (apply 20260422_000001_godmode_memory.sql first if you want godmode-engine v2 memory tables).';
  END IF;
END
$$;

-- No INSERT / UPDATE / DELETE policies are created above.
--   · INSERT: only the godmode-engine Edge Function writes here (via direct
--     Postgres connection that bypasses RLS). Browser-side INSERT is denied.
--   · UPDATE / DELETE: rows are append-only telemetry. The 90-day TTL is
--     enforced by `expires_at` + a separate cleanup job, not user action.

-- ---------------------------------------------------------------------------
-- attempt_memory_global — public-read, no client-side writes.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'attempt_memory_global'
  ) THEN
    EXECUTE 'ALTER TABLE public.attempt_memory_global ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS attempt_memory_global_select ON public.attempt_memory_global';
    EXECUTE $POLICY$
      CREATE POLICY attempt_memory_global_select
        ON public.attempt_memory_global
        FOR SELECT
        USING (true)
    $POLICY$;
    RAISE NOTICE 'RLS enabled on attempt_memory_global with public-read SELECT policy.';
  ELSE
    RAISE NOTICE 'attempt_memory_global not present — skipping.';
  END IF;
END
$$;

-- No INSERT / UPDATE / DELETE policies — same rationale as above. Without
-- RLS the table was vulnerable to a signed-in user crafting an
-- `insert(...)` call to poison the global learnings ring.
