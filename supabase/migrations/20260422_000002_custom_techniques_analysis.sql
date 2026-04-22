-- Subsystem B (prompt-synthesizer) — extend custom_techniques for rich analysis.
-- See docs/superpowers/specs/2026-04-22-prompt-synthesizer-design.md §5, §6.2.

ALTER TABLE custom_techniques ADD COLUMN analysis JSONB NULL;

COMMENT ON COLUMN custom_techniques.analysis IS
  'Populated by prompt-synthesizer (Subsystem B). Contains why_it_works, '
  'detected_axes, strategy_tags, shibboleth audit. Nullable for rows '
  'inserted outside the synthesizer flow (backward-compat).';

-- Prevent accidental duplicate saves from the same user.
ALTER TABLE custom_techniques
  ADD CONSTRAINT custom_techniques_owner_name_unique
  UNIQUE (owner_user_id, name);

-- RLS: owner reads/writes their own; public rows readable by everyone.
ALTER TABLE custom_techniques ENABLE ROW LEVEL SECURITY;

CREATE POLICY custom_techniques_read ON custom_techniques
  FOR SELECT USING (owner_user_id = auth.uid() OR is_public = true);

CREATE POLICY custom_techniques_insert ON custom_techniques
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY custom_techniques_update ON custom_techniques
  FOR UPDATE USING (owner_user_id = auth.uid());

CREATE POLICY custom_techniques_delete ON custom_techniques
  FOR DELETE USING (owner_user_id = auth.uid());
