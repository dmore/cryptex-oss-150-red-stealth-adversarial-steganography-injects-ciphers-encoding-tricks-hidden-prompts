# Persistent Broken-State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pin a past Chain session as a chat's working context. While pinned, every main-chat send prepends the won session's transcript (orchestrator turns as `user`, target turns as `assistant`) to the LLM message array, so the target sees the conversation as continuing from the won state.

**Architecture:** Single optional field `persistedAttackSessionId` on `ChatSettings`. Repo gains `getAttackSession` / `pinAttackSession` / `unpinAttackSession`. `dispatch.sendTurn` calls a new `resolvePinnedPrefix(chat)` helper at every main-chat streamChat site (skipping `/btw`, which is by-design out-of-context). New `PinnedSessionBanner.svelte` mounted above composer textarea provides the only Unpin location. Pin buttons surface on the final-summary card and in past-session history rows.

**Tech Stack:** Svelte 5 runes, Vitest + fake-indexeddb, existing Dexie + repo patterns. No new dependencies.

**Spec:** [`docs/superpowers/specs/2026-04-30-persistent-broken-state-design.md`](../specs/2026-04-30-persistent-broken-state-design.md)

**Working directory:** `C:/Users/m4xx/Downloads/cryptex` (master).

**Shell:** PowerShell 5.1. POSIX heredoc form `git commit -m "$(cat <<'EOF' ... EOF)"` for multiline commits. Do NOT use `@'...'@`.

**Untracked scratch files** (`docs/superpowers/plans/2026-04-18-byok-gateway-plan.md`, `templates/hermes-agent/`) MUST remain unstaged.

**Existing dispatch streamChat sites** (verified by exploration):
- `dispatch.ts:90` — `/btw` path. Already bypasses chat history. **DO NOT prepend pinned prefix** — `/btw` is explicitly out-of-context.
- `dispatch.ts:227` — slash mutator path. Main-chat send. **Prepend pinned prefix.**
- `dispatch.ts:355` — normal chat path. Main-chat send. **Prepend pinned prefix.**
- `dispatch.ts:579` — continue-assistant-message. Continuation of main-chat send. **Prepend pinned prefix** so the continuation inherits the same broken state as the original send.

**Existing repo patterns:**
- `repo.saveAttackSession` writes via `db.attackSessions.put(JSON.parse(JSON.stringify(row)))` (structured-clone-safe)
- `repo.listAttackSessions` filters on `ownerId` + `tombstoned`, applies `backfillV3`
- `ownerId()` helper returns the current owner string (line 11 of repo.ts)
- `repo.updateChat` exists for chat-level patches — reuse for pin/unpin

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `app/src/lib/chat/types.ts` | Modify | Add `persistedAttackSessionId?: string` to `ChatSettings` |
| `app/src/lib/chat/repo.ts` | Modify | Add `getAttackSession`, `pinAttackSession`, `unpinAttackSession` |
| `app/src/lib/chat/__tests__/repo.test.ts` | Modify | Append three new tests for the methods above |
| `app/src/lib/chat/dispatch.ts` | Modify | Add `resolvePinnedPrefix(chat)` helper; call at main-chat streamChat sites |
| `app/src/lib/chat/__tests__/dispatch.test.ts` | Modify | Append integration tests for prefix injection + missing-session unpin |
| `app/src/lib/components/chat/composer/PinnedSessionBanner.svelte` | Create | The banner component shown above composer when pinned |
| `app/src/lib/components/chat/composer/Composer.svelte` | Modify | Render `<PinnedSessionBanner {chat} />` above textarea |
| `app/src/lib/components/chat/attack-chain/AttackChainTab.svelte` | Modify | Add `Pin to chat` button on final-summary card + handler + pass `onPin` to AttackSessionHistory |
| `app/src/lib/components/chat/attack-chain/AttackSessionHistory.svelte` | Modify | Accept `onPin` prop; add Pin icon button in expanded detail; show "Pinned" badge on pinned row |

---

## Task 1: Extend `ChatSettings` types

**Goal:** Pure type-addition. One optional field.

**Files:**
- Modify: `app/src/lib/chat/types.ts`

- [ ] **Step 1: Read existing `ChatSettings`**

```bash
grep -n "interface ChatSettings\|workspaceTab\|workspaceWidth\|leftSidebarWidth" app/src/lib/chat/types.ts | head -10
```

Note the closing brace of the `ChatSettings` interface body.

- [ ] **Step 2: Append the field**

In `app/src/lib/chat/types.ts`, find `ChatSettings` interface body. Just before its closing brace, append:

```ts
  /** v3.2: pin a past Chain session's transcript as the chat's working context.
   *  When set, dispatch.sendTurn prepends the session's turns to every send so
   *  the target sees the conversation as continuing from the won state. Missing
   *  / deleted sessions trigger silent unpin at send time. */
  persistedAttackSessionId?: string;
```

- [ ] **Step 3: Typecheck**

```bash
cd app; npm run check 2>&1 | tail -1
```

Expected: `0 ERRORS`.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/m4xx/Downloads/cryptex
git add app/src/lib/chat/types.ts
git commit -m "$(cat <<'EOF'
feat(chat): ChatSettings adds persistedAttackSessionId

One optional field referencing AttackSessionRow.id. When set,
dispatch.sendTurn prepends the session's turns to every main-chat
send so the target sees the conversation as continuing from the
won (broken) state. Missing/deleted sessions trigger silent unpin
at send time (handled in Task 3).
EOF
)"
```

---

## Task 2: Repo methods + tests

**Goal:** Three new accessors on `repo`. Singular `getAttackSession`, `pinAttackSession`, `unpinAttackSession`.

**Files:**
- Modify: `app/src/lib/chat/repo.ts`
- Modify: `app/src/lib/chat/__tests__/repo.test.ts`

- [ ] **Step 1: Write failing tests**

Append inside the existing `describe('chat repo', …)` block in `app/src/lib/chat/__tests__/repo.test.ts`:

```ts
  it('getAttackSession returns the row when present', async () => {
    const { repo } = await import('../repo');
    const chat = await repo.createChat({ title: 't', modelQualifiedId: 'x' });
    const row = await repo.saveAttackSession({
      chatId: chat.id,
      objective: 'pin-test',
      targetModelId: 'm',
      orchestratorModelId: 'm',
      maxAttempts: 6,
      turns: [],
      strategyLog: [],
      finalOutcome: null,
      finalConfidence: null,
      finalSummary: null
    });
    const got = await repo.getAttackSession(row.id);
    expect(got?.id).toBe(row.id);
    expect(got?.objective).toBe('pin-test');
  });

  it('getAttackSession returns null for unknown id', async () => {
    const { repo } = await import('../repo');
    const got = await repo.getAttackSession('no-such-id');
    expect(got).toBeNull();
  });

  it('getAttackSession returns null for tombstoned row', async () => {
    const { repo } = await import('../repo');
    const chat = await repo.createChat({ title: 't', modelQualifiedId: 'x' });
    const row = await repo.saveAttackSession({
      chatId: chat.id, objective: 'x', targetModelId: 'm',
      orchestratorModelId: 'm', maxAttempts: 6, turns: [], strategyLog: [],
      finalOutcome: null, finalConfidence: null, finalSummary: null
    });
    await repo.deleteAttackSession(row.id);
    const got = await repo.getAttackSession(row.id);
    expect(got).toBeNull();
  });

  it('pinAttackSession sets persistedAttackSessionId on the chat', async () => {
    const { repo } = await import('../repo');
    const chat = await repo.createChat({ title: 't', modelQualifiedId: 'x' });
    await repo.pinAttackSession(chat.id, 'session-abc');
    const updated = await repo.getChat(chat.id);
    expect(updated?.settings.persistedAttackSessionId).toBe('session-abc');
  });

  it('pinAttackSession overwrites any prior pin', async () => {
    const { repo } = await import('../repo');
    const chat = await repo.createChat({ title: 't', modelQualifiedId: 'x' });
    await repo.pinAttackSession(chat.id, 'session-1');
    await repo.pinAttackSession(chat.id, 'session-2');
    const updated = await repo.getChat(chat.id);
    expect(updated?.settings.persistedAttackSessionId).toBe('session-2');
  });

  it('unpinAttackSession removes persistedAttackSessionId from settings', async () => {
    const { repo } = await import('../repo');
    const chat = await repo.createChat({ title: 't', modelQualifiedId: 'x' });
    await repo.pinAttackSession(chat.id, 'session-abc');
    await repo.unpinAttackSession(chat.id);
    const updated = await repo.getChat(chat.id);
    expect(updated?.settings.persistedAttackSessionId).toBeUndefined();
  });

  it('pin/unpin tolerate unknown chat id silently', async () => {
    const { repo } = await import('../repo');
    await repo.pinAttackSession('no-such-chat', 'session-abc');
    await repo.unpinAttackSession('no-such-chat');
    expect(true).toBe(true);
  });
```

- [ ] **Step 2: Run tests — expect RED**

```bash
cd app
npx vitest run src/lib/chat/__tests__/repo.test.ts
```

Expected: 7 new cases FAIL because the methods don't exist.

- [ ] **Step 3: Implement the three methods**

In `app/src/lib/chat/repo.ts`, find the existing `repo` object's `deleteAttackSession` method (around line 333). Append the three new methods just after it (still inside the `repo` object literal):

```ts
  /** Singular accessor — fetch one AttackSessionRow by id, respecting ownerId
   *  and tombstoned. Returns null when missing. Used by dispatch.sendTurn at
   *  pin-resolution time. */
  async getAttackSession(id: string): Promise<AttackSessionRow | null> {
    const row = await db.attackSessions.get(id);
    if (!row || row.ownerId !== ownerId() || row.tombstoned) return null;
    return backfillV3(row);
  },

  /** Set the chat's pinned session id. Tolerates unknown chat ids silently. */
  async pinAttackSession(chatId: string, sessionId: string): Promise<void> {
    const chat = await db.chats.get(chatId);
    if (!chat || chat.ownerId !== ownerId()) return;
    const next = JSON.parse(JSON.stringify({
      ...chat,
      settings: { ...(chat.settings ?? {}), persistedAttackSessionId: sessionId },
      updatedAt: Date.now()
    }));
    await db.chats.put(next);
  },

  /** Clear the chat's pinned session id. Tolerates unknown chat ids silently. */
  async unpinAttackSession(chatId: string): Promise<void> {
    const chat = await db.chats.get(chatId);
    if (!chat || chat.ownerId !== ownerId()) return;
    const settingsCopy = { ...(chat.settings ?? {}) } as Record<string, unknown>;
    delete settingsCopy.persistedAttackSessionId;
    const next = JSON.parse(JSON.stringify({
      ...chat,
      settings: settingsCopy,
      updatedAt: Date.now()
    }));
    await db.chats.put(next);
  }
```

- [ ] **Step 4: Run tests — expect GREEN**

```bash
npx vitest run src/lib/chat/__tests__/repo.test.ts
```

Expected: all 7 new tests PASS plus existing tests unchanged.

- [ ] **Step 5: Typecheck**

```bash
npm run check 2>&1 | tail -1
```

Expected: `0 ERRORS`.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/m4xx/Downloads/cryptex
git add app/src/lib/chat/repo.ts app/src/lib/chat/__tests__/repo.test.ts
git commit -m "$(cat <<'EOF'
feat(chat): repo getAttackSession + pin/unpin helpers

Three new methods on repo:
  - getAttackSession(id): singular accessor with owner + tombstone
    filter; returns null when missing. Used by dispatch.sendTurn
    at pin-resolution time.
  - pinAttackSession(chatId, sessionId): writes
    chat.settings.persistedAttackSessionId. Overwrites any prior
    pin (one pin per chat).
  - unpinAttackSession(chatId): clears the field via property
    delete + structured-clone-safe put.

Both pin/unpin tolerate unknown chat ids silently (no-op).
EOF
)"
```

---

## Task 3: Dispatch — `resolvePinnedPrefix` + integrate at 3 sites

**Goal:** New helper that returns the prefix `ChatMessage[]` (empty when not pinned). Called at the three main-chat `streamChat` sites (line ~227 mutator, line ~355 normal chat, line ~579 continue-assistant). NOT called from `/btw` (line ~90 — by-design out-of-context).

**Files:**
- Modify: `app/src/lib/chat/dispatch.ts`
- Modify: `app/src/lib/chat/__tests__/dispatch.test.ts`

- [ ] **Step 1: Read the dispatch file**

```bash
grep -n "for await (const evt of streamChat\|providerMessages\|messages:" app/src/lib/chat/dispatch.ts | head -20
```

Locate the four `streamChat` sites (line ~90 `/btw`, ~227 mutator, ~355 normal, ~579 continue) and how each constructs its `messages` array.

- [ ] **Step 2: Add `resolvePinnedPrefix` helper**

At the top of `app/src/lib/chat/dispatch.ts`, after the existing imports, add (or place before `sendTurn` declaration — wherever the file's other helpers naturally live):

```ts
/** Resolve the pinned-session prefix for main-chat sends. Returns an empty
 *  array when the chat has no pin or the pinned session is missing/deleted.
 *  In the missing-session case, silently auto-unpins so the next send doesn't
 *  re-attempt the lookup. */
async function resolvePinnedPrefix(chat: ChatRow): Promise<ChatMessage[]> {
  const pinId = chat.settings?.persistedAttackSessionId;
  if (!pinId) return [];
  const session = await repo.getAttackSession(pinId);
  if (!session) {
    console.warn('[dispatch] pinned session missing, auto-unpinning:', pinId);
    await repo.unpinAttackSession(chat.id);
    return [];
  }
  return session.turns.map((t) => ({
    role: t.role === 'orchestrator' ? ('user' as const) : ('assistant' as const),
    content: t.text
  }));
}
```

If `ChatMessage` isn't imported in this file, find an adjacent type import and add it (its definition lives in `$lib/ai/types`):

```ts
import type { ChatMessage, ChatRequest } from '$lib/ai/types';
```

(If `ChatRequest` is already imported, just add `ChatMessage` to that import.)

- [ ] **Step 3: Integrate at site #1 — slash mutator path (~line 227)**

Find the slash mutator path's message-array construction. It typically looks like:

```ts
    const providerMessages: ChatMessage[] = [];
    if (chat.settings.systemPrompt.trim()) {
      providerMessages.push({ role: 'system', content: chat.settings.systemPrompt });
    }
    // ...existing history pushes...
    providerMessages.push({ role: 'user', content: ... });
```

Right after the `systemPrompt` push (if any) and BEFORE the existing-history push, insert the prefix:

```ts
    const pinnedPrefix = await resolvePinnedPrefix(chat);
    providerMessages.push(...pinnedPrefix);
```

Order: `[system?, ...pinnedPrefix, ...existingHistory, userTurn]` — the won session sits between the system prompt and the chat's existing history, so it reads as "the conversation that got us here, then the chat continues from there."

- [ ] **Step 4: Integrate at site #2 — normal chat path (~line 355)**

Find the normal chat path's `providerMessages` construction. Apply the same insertion as Step 3:

```ts
    const pinnedPrefix = await resolvePinnedPrefix(chat);
    providerMessages.push(...pinnedPrefix);
```

placed after the system-prompt push and before the existing-history push.

- [ ] **Step 5: Integrate at site #3 — continueAssistantMessage (~line 579)**

Find the continue-assistant path's message-array construction. Same insertion. The continuation must inherit the same broken-state context as the original send.

If the continue path doesn't use `providerMessages` as a name (different local), match the existing variable name. The pattern is the same: insert the pinned prefix between system prompt and chat history.

- [ ] **Step 6: DO NOT modify the `/btw` path (~line 90)**

The `/btw` path is by-design out-of-context — it explicitly bypasses chat history (the existing `// 1a) /btw — side question, bypass chat history` comment makes the intent clear). Pinned prefix should also be skipped for `/btw`. Leave that path alone.

- [ ] **Step 7: Write integration tests**

Append inside the existing `describe(...)` block at the top of `app/src/lib/chat/__tests__/dispatch.test.ts` (or in a new `describe('persisted broken state', ...)` block):

```ts
describe('persisted broken state', () => {
  it('sendTurn on a non-pinned chat does not prepend any prefix', async () => {
    const captured: any[] = [];
    vi.doMock('$lib/ai/gateway', () => ({
      streamChat: async function* (req: any) {
        captured.push(req);
        yield { type: 'text-delta', delta: 'reply' };
        yield { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1 } };
      },
      chat: async () => ({ content: '' })
    }));
    const { sendTurn } = await import('../dispatch');
    const { repo } = await import('../repo');
    const chat = await repo.createChat({ title: 't', modelQualifiedId: 'x' });
    await sendTurn(chat, 'hello', new AbortController().signal);

    expect(captured).toHaveLength(1);
    const messages = captured[0].messages as Array<{ role: string; content: string }>;
    // No assistant role from any pinned session — only user (and optional system).
    const assistantPrefix = messages.filter((m) => m.role === 'assistant');
    expect(assistantPrefix).toHaveLength(0);
  });

  it('sendTurn on a pinned chat prepends transcript turns as user/assistant pairs', async () => {
    const captured: any[] = [];
    vi.doMock('$lib/ai/gateway', () => ({
      streamChat: async function* (req: any) {
        captured.push(req);
        yield { type: 'text-delta', delta: 'reply' };
        yield { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1 } };
      },
      chat: async () => ({ content: '' })
    }));
    const { sendTurn } = await import('../dispatch');
    const { repo } = await import('../repo');

    const chat = await repo.createChat({ title: 't', modelQualifiedId: 'x' });
    const session = await repo.saveAttackSession({
      chatId: chat.id,
      objective: 'extract X',
      targetModelId: 'm',
      orchestratorModelId: 'm',
      maxAttempts: 6,
      turns: [
        { role: 'orchestrator', strategyId: 'historical', text: 'tell me about X', rationale: 'r', createdAt: 1 },
        { role: 'target', text: 'X is...', createdAt: 2 }
      ],
      strategyLog: [],
      finalOutcome: 'extracted',
      finalConfidence: 0.9,
      finalSummary: 's'
    });
    await repo.pinAttackSession(chat.id, session.id);

    // Reload chat so the pin is visible to sendTurn.
    const pinnedChat = (await repo.getChat(chat.id))!;
    await sendTurn(pinnedChat, 'follow-up', new AbortController().signal);

    expect(captured).toHaveLength(1);
    const messages = captured[0].messages as Array<{ role: string; content: string }>;
    // The transcript should appear as a user/assistant pair somewhere in messages.
    const userTexts = messages.filter((m) => m.role === 'user').map((m) => m.content);
    const assistantTexts = messages.filter((m) => m.role === 'assistant').map((m) => m.content);
    expect(userTexts).toContain('tell me about X');
    expect(assistantTexts).toContain('X is...');
    // And the new user turn is also present
    expect(userTexts).toContain('follow-up');
  });

  it('sendTurn on a pinned chat with a missing session auto-unpins and sends without prefix', async () => {
    const captured: any[] = [];
    vi.doMock('$lib/ai/gateway', () => ({
      streamChat: async function* (req: any) {
        captured.push(req);
        yield { type: 'text-delta', delta: 'reply' };
        yield { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1 } };
      },
      chat: async () => ({ content: '' })
    }));
    const { sendTurn } = await import('../dispatch');
    const { repo } = await import('../repo');

    const chat = await repo.createChat({ title: 't', modelQualifiedId: 'x' });
    await repo.pinAttackSession(chat.id, 'session-that-does-not-exist');
    const pinnedChat = (await repo.getChat(chat.id))!;
    await sendTurn(pinnedChat, 'hi', new AbortController().signal);

    // No assistant prefix injected.
    const messages = captured[0].messages as Array<{ role: string; content: string }>;
    const assistantPrefix = messages.filter((m) => m.role === 'assistant');
    expect(assistantPrefix).toHaveLength(0);

    // Pin field should be cleared on the chat row now.
    const after = await repo.getChat(chat.id);
    expect(after?.settings.persistedAttackSessionId).toBeUndefined();
  });
});
```

- [ ] **Step 8: Run tests — expect GREEN**

```bash
cd app
npx vitest run src/lib/chat/__tests__/dispatch.test.ts
```

Expected: 3 new persisted-broken-state tests PASS plus existing dispatch tests unchanged.

- [ ] **Step 9: Typecheck**

```bash
npm run check 2>&1 | tail -1
```

Expected: `0 ERRORS`.

- [ ] **Step 10: Commit**

```bash
cd C:/Users/m4xx/Downloads/cryptex
git add app/src/lib/chat/dispatch.ts app/src/lib/chat/__tests__/dispatch.test.ts
git commit -m "$(cat <<'EOF'
feat(chat): dispatch prepends pinned chain transcript as broken state

New resolvePinnedPrefix(chat) helper transforms a pinned
AttackSessionRow's turns into ChatMessage[] (orchestrator -> user,
target -> assistant) and prepends them to the message array at
three main-chat streamChat sites: slash mutator, normal chat, and
continueAssistantMessage. /btw bypasses pinned prefix by design.

Missing/deleted pinned sessions trigger silent auto-unpin so the
next send doesn't re-attempt the lookup. console.warn for
debugging.

Three integration tests cover: non-pinned (no prefix), pinned
(transcript injected as user/assistant pairs), missing-session
(auto-unpin + no prefix).
EOF
)"
```

---

## Task 4: `PinnedSessionBanner.svelte` + Composer mount

**Goal:** New banner above the composer textarea that renders only when pinned, shows the objective + turn count + Unpin × button.

**Files:**
- Create: `app/src/lib/components/chat/composer/PinnedSessionBanner.svelte`
- Modify: `app/src/lib/components/chat/composer/Composer.svelte`

- [ ] **Step 1: Create the banner**

Create `app/src/lib/components/chat/composer/PinnedSessionBanner.svelte`:

```svelte
<script lang="ts">
  import type { ChatRow, AttackSessionRow } from '$lib/chat/types';
  import { repo } from '$lib/chat/repo';
  import Pin from 'lucide-svelte/icons/pin';
  import X from 'lucide-svelte/icons/x';

  type Props = { chat: ChatRow };
  let { chat }: Props = $props();

  let session = $state<AttackSessionRow | null>(null);

  $effect(() => {
    const id = chat.settings?.persistedAttackSessionId;
    if (!id) { session = null; return; }
    void repo.getAttackSession(id).then((row) => { session = row; });
  });

  async function unpin() {
    await repo.unpinAttackSession(chat.id);
  }

  function preview(s: string, n = 60): string {
    const t = s.trim();
    return t.length <= n ? t : t.slice(0, n) + '…';
  }
</script>

{#if session}
  <div class="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-[11px]">
    <Pin size={11} class="shrink-0 mt-0.5 text-primary" />
    <div class="flex-1 min-w-0">
      <div class="flex items-baseline gap-2">
        <span class="font-medium text-foreground">Pinned</span>
        <span class="truncate text-muted-foreground">{preview(session.objective)}</span>
        <span class="ml-auto text-[10px] text-muted-foreground">{session.turns.length} turns</span>
      </div>
      <p class="mt-0.5 text-[10px] text-muted-foreground">Replies prepended with the won transcript. Unpin to send normally.</p>
    </div>
    <button
      type="button"
      onclick={unpin}
      aria-label="Unpin session"
      class="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
    ><X size={11} /></button>
  </div>
{/if}
```

- [ ] **Step 2: Mount the banner in Composer**

Read `app/src/lib/components/chat/composer/Composer.svelte`. Find the top of the markup (the outermost wrapper around the textarea — typically a `<div>` containing attachment chips, the textarea wrapper, and the send button row).

Add the import inside `<script>`:

```ts
  import PinnedSessionBanner from './PinnedSessionBanner.svelte';
```

The Composer already receives a `chat` prop (or has access to it via parent). Verify by reading the existing Props type. If `chat: ChatRow` isn't already a prop, add it to Props and to the destructure.

In the markup, immediately INSIDE the outer wrapper but BEFORE all other content (attachment chips, textarea, etc.), insert:

```svelte
<PinnedSessionBanner {chat} />
```

The component renders nothing when no pin is set, so positioning it at the top of the composer wrapper is safe — it doesn't push other content when inactive.

- [ ] **Step 3: Typecheck**

```bash
cd app; npm run check 2>&1 | tail -1
```

Expected: `0 ERRORS`.

If a missing-prop error surfaces because `Composer` doesn't currently accept `chat` as a prop, check who imports Composer and trace the prop. Most chat-page renders pass `chat` already; if not, propagate it through.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/m4xx/Downloads/cryptex
git add app/src/lib/components/chat/composer/PinnedSessionBanner.svelte app/src/lib/components/chat/composer/Composer.svelte
git commit -m "$(cat <<'EOF'
feat(chat-ui): PinnedSessionBanner above composer

Shows when chat.settings.persistedAttackSessionId is set: pin icon,
truncated objective, turn count, and × button as the sole Unpin
action. Renders nothing when no pin is set.

Mounted at the top of Composer.svelte so it appears above the
textarea, attachment chips, and send button — directly in the user's
attention path before they hit Send.
EOF
)"
```

---

## Task 5: Pin buttons on AttackChainTab + AttackSessionHistory

**Goal:** Two new entry points to pin a session. Final-summary card on the Chain tab pins the just-finished session; History disclosure pins any past session.

**Files:**
- Modify: `app/src/lib/components/chat/attack-chain/AttackChainTab.svelte`
- Modify: `app/src/lib/components/chat/attack-chain/AttackSessionHistory.svelte`

- [ ] **Step 1: Read AttackChainTab final-summary card**

```bash
grep -n "promoteCurrentSession\|finalOutcome\|Send thread to main chat" app/src/lib/components/chat/attack-chain/AttackChainTab.svelte | head -10
```

Locate the existing button row inside the `{#if finalOutcome}` block — currently contains "Send thread to main chat".

- [ ] **Step 2: Add Pin import + handlers**

In `AttackChainTab.svelte`'s `<script>` block, add the icon import alongside other lucide imports:

```ts
  import Pin from 'lucide-svelte/icons/pin';
```

Near the existing handlers (`promoteCurrentSession`, `dismissOrchestratorTip`, etc.), add:

```ts
  async function pinCurrentSession() {
    if (!currentSessionId) return;
    await repo.pinAttackSession(chat.id, currentSessionId);
    showToast('success', 'Pinned. Subsequent main-chat sends will use this session as context.');
  }

  async function pinSession(session: AttackSessionRow) {
    await repo.pinAttackSession(chat.id, session.id);
    const preview = session.objective.length > 40 ? session.objective.slice(0, 40) + '…' : session.objective;
    showToast('success', `Pinned: ${preview}`);
  }
```

- [ ] **Step 3: Add Pin button to the final-summary card action row**

Find the existing action-button row inside `{#if finalOutcome}`. It contains a `<button>` for "Send thread to main chat" (calls `promoteCurrentSession`). Adjacent to that button, append a sibling Pin button:

```svelte
<button
  type="button"
  onclick={pinCurrentSession}
  class="inline-flex items-center gap-1 rounded border border-primary/30 px-2 py-1 text-[10px] text-primary hover:bg-primary/10"
>
  <Pin size={10} /> Pin to chat
</button>
```

The button mirrors the styling of the existing Send-to-main-chat button (same row, same border treatment).

- [ ] **Step 4: Pass `onPin` to AttackSessionHistory**

Find where `<AttackSessionHistory ... />` is rendered. Currently it receives `sessions`, `onPromote`, `onDelete` (verified by exploration). Add `onPin={pinSession}`:

```svelte
<AttackSessionHistory
  {sessions}
  onPromote={promoteFullSession}
  onDelete={deleteSession}
  onPin={pinSession}
/>
```

- [ ] **Step 5: Add `onPin` Prop + button + Pinned badge to AttackSessionHistory**

Read `app/src/lib/components/chat/attack-chain/AttackSessionHistory.svelte`. Find the `Props` type and the existing action-icon buttons (Promote / Delete) in the row markup.

Update Props:

```ts
  type Props = {
    sessions: AttackSessionRow[];
    onPromote: (session: AttackSessionRow) => void;
    onDelete: (id: string) => void;
    onPin: (session: AttackSessionRow) => void;
  };
  let { sessions, onPromote, onDelete, onPin }: Props = $props();
```

Add the icon import alongside existing lucide imports:

```ts
  import Pin from 'lucide-svelte/icons/pin';
```

Find the existing action-icon row (inside each `{#each sessions}` row, alongside Promote and Delete buttons). Add a new Pin button:

```svelte
<button
  type="button"
  onclick={() => onPin(row)}
  aria-label="Pin to chat"
  class="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
><Pin size={11} /></button>
```

To show a "Pinned" badge on the currently-pinned row, the component needs to know the active pin id. Add `pinnedSessionId?: string` to Props:

```ts
  type Props = {
    sessions: AttackSessionRow[];
    pinnedSessionId?: string;
    onPromote: (session: AttackSessionRow) => void;
    onDelete: (id: string) => void;
    onPin: (session: AttackSessionRow) => void;
  };
  let { sessions, pinnedSessionId, onPromote, onDelete, onPin }: Props = $props();
```

In each row's outer markup (next to the existing outcome badge), add a small "Pinned" pill when this row matches:

```svelte
{#if pinnedSessionId === row.id}
  <span class="rounded bg-primary/20 px-1 py-0.5 text-[9px] uppercase text-primary">Pinned</span>
{/if}
```

In `AttackChainTab.svelte`, pass `pinnedSessionId` through:

```svelte
<AttackSessionHistory
  {sessions}
  pinnedSessionId={chat.settings?.persistedAttackSessionId}
  onPromote={promoteFullSession}
  onDelete={deleteSession}
  onPin={pinSession}
/>
```

- [ ] **Step 6: Typecheck**

```bash
cd app; npm run check 2>&1 | tail -1
```

Expected: `0 ERRORS`.

- [ ] **Step 7: Commit**

```bash
cd C:/Users/m4xx/Downloads/cryptex
git add app/src/lib/components/chat/attack-chain/AttackChainTab.svelte app/src/lib/components/chat/attack-chain/AttackSessionHistory.svelte
git commit -m "$(cat <<'EOF'
feat(chain-ui): Pin buttons on summary card + history

Two new pin entry points:
- AttackChainTab final-summary card gets a "Pin to chat" button
  alongside the existing "Send thread to main chat" button. Pins
  the just-finished session.
- AttackSessionHistory rows get a Pin icon button alongside Promote
  / Delete. Pins any past session. The currently-pinned row shows
  a "Pinned" pill next to the outcome badge.

Both call repo.pinAttackSession + showToast on success. Unpin
remains exclusive to the PinnedSessionBanner above the composer.
EOF
)"
```

---

## Task 6: Final verification + push

**Goal:** Run the full CI matrix locally + push to origin.

**Files:** none directly modified.

- [ ] **Step 1: Full chain + chat suite**

```bash
cd app
npx vitest run src/lib/chat/__tests__/repo.test.ts src/lib/chat/__tests__/dispatch.test.ts src/lib/chat/chain/__tests__/ 2>&1 | tail -8
```

Expected: all green. Counts: chain 72, repo +7 (new pin tests), dispatch +3 (new persisted broken-state tests).

- [ ] **Step 2: Typecheck**

```bash
npm run check 2>&1 | tail -1
```

Expected: `0 ERRORS`.

- [ ] **Step 3: Production build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✔ done`.

- [ ] **Step 4: Verification marker**

```bash
cd C:/Users/m4xx/Downloads/cryptex
git commit --allow-empty -m "$(cat <<'EOF'
chore(chain): persistent broken-state verification pass

- repo: 7 new pin/unpin/getAttackSession tests green
- dispatch: 3 new persisted-broken-state integration tests green
  covering non-pinned, pinned (transcript injection), and
  missing-session auto-unpin
- chain suite still 72/72 green
- svelte-check: 0 errors
- production build: clean

Manual smoke deferred to user. Pin a session from the Chain tab
or History; the banner appears above the composer; subsequent
main-chat sends prepend the won transcript so the target sees
continuity from the broken state. /btw remains by-design
out-of-context. Click × on the banner to unpin.
EOF
)"
```

- [ ] **Step 5: Push**

```bash
git push origin master
```

Auto-deploy fires. Watch `https://github.com/m4xx101/cryptex/actions` for the run.

---

## Scope Coverage

| Spec section | Implementing task |
|---|---|
| Section 1 — Persistence (`persistedAttackSessionId` field) | Task 1 |
| Section 2 — Repo additions (3 methods) | Task 2 |
| Section 3 — Dispatch integration (3 sites + auto-unpin) | Task 3 |
| Section 4 — PinnedSessionBanner | Task 4 |
| Section 5 — Pin actions on AttackChainTab + AttackSessionHistory | Task 5 |
| Section 7 — Test plan (unit + integration) | Tasks 2 + 3 |

## Self-review verdict

- **Spec coverage:** all 5 functional sections + the test plan have a task. No gaps.
- **Placeholder scan:** no TBD/TODO/incomplete. All Svelte snippets have full markup. All test assertions concrete.
- **Type consistency:** `persistedAttackSessionId` declared in Task 1, written by Task 2's `pinAttackSession`, read by Task 3's `resolvePinnedPrefix` and Task 4's banner, surfaced as `pinnedSessionId` prop in Task 5's history component. Same field consistently across all surfaces.

## Out of scope (deferred from spec)

- Trim pin to last N turns / smart token budgeting.
- Auto-unpin after N consecutive refusals.
- Multi-pin / cross-chat pin.
- Visual per-message highlight of "from broken state".
- Pinning Godmode runs.
- Re-running the extractor on a pinned session on demand.
