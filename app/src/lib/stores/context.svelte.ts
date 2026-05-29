/**
 * Shared cross-tool context — the goal + target a researcher is working on,
 * carried across tools so they don't re-enter the target model on every tab.
 *
 * Design constraints (v2.6.0):
 *   - ADDITIVE + BACK-COMPAT. This is a NEW localStorage key (`cryptex.context`).
 *     The default `targetModel: ''` means a tool's first read is a no-op — it
 *     keeps using its OWN per-tool pref (`cryptex.pc.model`, etc.). No existing
 *     key is read, written, or migrated.
 *   - EXPLICIT, never reactive. Tools opt in by calling `hydrate*()` on a user
 *     action ("Use campaign target") or `set()` on a "Send to Campaign →"
 *     click. There is NO automatic two-way binding that could silently
 *     overwrite a tool's model behind the user's back.
 *
 * The Campaign front door is the canonical producer/consumer of this store;
 * individual tools are opt-in participants.
 */
import { createPersistedState } from './_persisted.svelte';

export interface SharedContext {
  /** The objective / forbidden goal the researcher is testing. */
  goal: string;
  /** Qualified target model id (e.g. `openrouter:openai/gpt-4o`). Empty = unset. */
  targetModel: string;
}

const _ctx = createPersistedState<SharedContext>('cryptex.context', {
  goal: '',
  targetModel: ''
});

export const sharedContext = {
  get goal(): string {
    return _ctx.value.goal;
  },
  set goal(v: string) {
    _ctx.value = { ..._ctx.value, goal: v };
  },
  get targetModel(): string {
    return _ctx.value.targetModel;
  },
  set targetModel(v: string) {
    _ctx.value = { ..._ctx.value, targetModel: v };
  },
  /** Merge a partial patch. Used by "Send to Campaign →" affordances. */
  set(patch: Partial<SharedContext>): void {
    _ctx.value = { ..._ctx.value, ...patch };
  },
  /** True when a target has been set (so consumers can decide whether to hydrate). */
  get hasTarget(): boolean {
    return _ctx.value.targetModel.trim().length > 0;
  }
};
