---
title: Chat basics
description: BYOK multi-provider chat playground with slash commands, attachments, modes, and the Attack Chain.
category: chat
order: 1
---

# Chat basics

The Chat playground is a full LLM conversation surface living inside
Cryptex. You bring your own key, pick any model across the supported
providers, and everything — chats, messages, attachments, dataset
exports — stays in your browser's IndexedDB. Nothing hits a Cryptex
server, because there isn't one.

The playground is purpose-built for red-team workflows: rewriting
prompts with slash commands, composing multi-layer attack chains,
attaching documents the model can actually read, and exporting the
resulting conversations as ShareGPT or raw JSONL for downstream
evaluation.

## Providers

Cryptex supports eleven provider types. All of them reach their
upstream directly from the browser — no Cryptex backend, no proxy
required, just CORS-open HTTPS since the CSP widening in April 2026.

| Provider | Direct adapter | Added via |
| --- | --- | --- |
| OpenRouter | Yes | First-class picker entry (recommended default) |
| Anthropic | Yes | First-class picker entry ("Claude 4 direct") |
| OpenAI | Yes | OpenAI-compatible preset |
| Google Gemini | Yes | OpenAI-compatible preset (via `/v1beta/openai` layer) |
| Groq | Yes | OpenAI-compatible preset |
| Together | Yes | OpenAI-compatible preset |
| Fireworks | Yes | OpenAI-compatible preset |
| DeepInfra | Yes | OpenAI-compatible preset |
| Cerebras | Yes | OpenAI-compatible preset |
| SambaNova | Yes | OpenAI-compatible preset |
| Custom | Yes | OpenAI-compatible picker → "Custom endpoint" |

**OpenRouter is the recommended default.** It has the broadest model
catalog — 300+ models across every major lab — and a single key
unlocks all of them. If you're not sure where to start, add an
OpenRouter key.

**Anthropic direct** is the right choice when you want Claude 4 family
models at the vendor's official latency and the full 200K context
without OpenRouter's per-request rate limits. It works in the browser
via the `anthropic-dangerous-direct-browser-access` header.

**OpenAI direct** is supported. Paste your OpenAI API key in Settings
and every GPT-4o / GPT-4 / o-series model appears in the picker.

**Google Gemini direct** is supported via Google's OpenAI-compat layer.
Paste your Gemini key and Gemini 2.5 Pro / Flash models appear
alongside the rest.

## Adding a provider

From any Cryptex surface, open **Settings → AI Providers → Add
provider**. The picker presents direct providers (OpenRouter,
Anthropic) first, then OpenAI-compatible presets, then a Custom
endpoint escape hatch.

The flow always paints an API key input and two action buttons:

- **Save** — probes the key against the provider's `models` endpoint
  (or the preset's test model). On success, the provider is added to
  your enabled list. This is the preferred path — verify your key
  works before the first real chat.
- **Save without verification** — only appears when the probe fails
  with a network-shaped error (CORS, refused, timeout). If you've
  tested the key elsewhere (in `curl`, in the provider's own console)
  and the failure is a transient hiccup or a known-broken probe
  endpoint for a niche custom deployment, this fallback button
  persists the provider anyway. Real chat calls go through a
  different code path and often succeed when the probe fails.

The verify-vs-save-anyway distinction matters for custom endpoints
with non-standard `/models` implementations. The probe checks the
canonical OpenAI-compat path; some vendored endpoints expose models
only via a proprietary route, so the probe fails even when
`/chat/completions` works fine. Save without verification, then send
a test message; if that works, you're set.

## The NoProviderBanner

If you open the chat playground or any BYOK-dependent tool
(PromptCraft, Anti-Classifier, Translate) without any provider
configured, Cryptex paints a **NoProviderBanner** across the top of
the surface: a dismissible card reading *"Add an AI provider to
unlock chat"* with an **Open settings** button. The banner is
context-aware — in tools it says "unlock this tool"; in chat it says
"unlock chat". One click away from the provider-picker dialog.

The banner doesn't block the UI. You can still browse a
previously-created chat (from before you removed the key) or inspect
dataset rows. But the composer's Send button remains disabled, and
the model picker shows an empty state, until at least one provider is
live.

## Quick start

1. Open **Settings** and add at least one provider key.
2. Click **New chat** in the sidebar.
3. Pick a model from the model picker. The picker aggregates the
   catalogs of every provider you've configured — one unified list,
   qualified IDs under the hood so routing is unambiguous.
4. Type your message. Enter sends. Shift+Enter inserts a newline.

That's it. The first response streams back token-by-token.

## Conversation modes

Three modes live behind the mode pill in the header. They set the
system prompt Cryptex injects before your message hits the model:

- **Creative** — looser register, more diverse outputs, higher
  default temperature. Brainstorming, paraphrase generation,
  adversarial rewrites where you want variety.
- **Intelligent** — precision-first, step-by-step reasoning, lower
  temperature. Technical questions, code, CTF challenge debugging,
  and anything where you want the same answer twice.
- **Adaptive** — middle register that reads the input and picks. A
  reasonable default when you haven't decided yet.

All three are local prompt templates shipped with the app; they don't
call out to anything. Switching modes mid-conversation applies to the
next turn — earlier turns keep their prior mode's system prompt in
the transcript. The mode pill sits to the left of the model picker;
click to cycle, right-click to jump directly.

## Composer anatomy

The composer at the bottom of the chat has these parts:

- **Textarea** — type your message. Slash autocomplete triggers when
  the first character is `/`.
- **Slash popover** — typing `/` opens a fuzzy-searchable list of all
  24 slash-addressable techniques. Arrow keys navigate; Enter picks;
  Escape dismisses. Search matches across the technique name,
  description, id, and category, so `/cipher` surfaces
  `cipher_encode_bypass` and `/rfc` surfaces `rfc_style`.
- **Cmd-K picker** — a second entry point. Cmd-K (Ctrl-K on
  Windows) opens the same searchable catalog from anywhere in the
  chat surface, even when the textarea isn't focused. Useful when
  you want to browse the technique catalog before deciding.
- **Mode pills** — inline shortcut to flip between Creative /
  Intelligent / Adaptive without opening the header menu.
- **Attachment chips** — drag-and-drop or paste files. Each accepted
  file shows as a chip with a remove button.
- **Send button** — enabled when the textarea has content. The button
  label changes to "Cancel" during a streaming response so you can
  stop a runaway completion.

The slash popover and Cmd-K picker index the same 24 entries: the 21
mutators (`/rephrase`, `/roleplay`, `/red_team_persona`, etc.), the
three composites (`/layered_mutation`, `/grammar_constrained_output`,
`/multi_layer_attack`), plus `/btw`. Classifier techniques are
registered for the Attack Chain but not slash-addressable — the
Cmd-K picker reflects that distinction.

## /btw — the out-of-context side channel

`/btw` is the exception to the slash-rewrite-and-send model. A
message prefixed with `/btw` is captured into the transcript and the
dataset export, but **not** included in the context window sent to
the model on subsequent turns.

Use cases: mid-session notes to yourself, tags for dataset filtering,
free-form commentary on a run without polluting the conversational
context. `/btw this is where the model pivoted` reads fine in the
exported dataset, doesn't leak into the next `assistant` turn.

## Attachments

Three file types are accepted and extracted into context the model
can actually read:

- **Images** (PNG, JPEG, WebP, GIF) — routed as multimodal
  `image_url` content parts. The image travels with the message as
  base64, subject to the model's own size limit. Only vision-capable
  models will actually look at the image; non-vision models see the
  image as a placeholder.
- **PDFs** — extracted page-by-page with `pdfjs-dist` (lazy-loaded on
  first use; the CSP needs `'wasm-unsafe-eval'` for pdfjs's internal
  code). The extracted text is attached as a `text` content part so
  any model can read it, not just vision models.
- **DOCX** — extracted via `mammoth` and similarly passed as text.

Binary data is stored in the `attachments` table of the chat DB;
text extractions are rebuilt from the binary at send-time so you're
never double-storing.

## Message actions

Each assistant message bubble has three inline actions that appear on
hover:

- **Copy** — copies the message content to the clipboard. Respects
  code blocks' internal formatting.
- **Fork** — creates a new chat starting from this message. Useful
  when you want to branch a conversation without losing the original
  trajectory. The fork inherits the parent chat's model, mode, and
  history up to and including the forked message.
- **Regenerate** — when available (assistant messages only), re-runs
  the previous user turn with the same model and mode, replacing the
  current assistant response.

User-message bubbles get an **edit** action that rewrites the message
and re-sends, regenerating the assistant's reply.

## Truncation banner

When the LLM returns a response with `finishReason: 'length'` — i.e.
it hit the `max_tokens` cap mid-output rather than finishing
naturally — the message bubble paints a **truncation banner** at the
bottom: *"Response was truncated. Consider raising max_tokens or
asking the model to continue."*

Click the banner to expand a short panel with two options:

- **Continue** — sends a follow-up user turn asking the model to
  finish where it left off.
- **Raise max_tokens** — opens the chat settings drawer with the
  `maxTokens` field focused so you can bump the cap.

The Attack Chain's Execute step defaults to `maxTokens: 4096` for
this reason — the mutated prompts it generates can produce long
structured outputs that would otherwise truncate at a provider's
default cap.

## Chat sidebar

The left sidebar lists every chat you've started, sorted by last
update:

- **Rename** — double-click the title or use the row menu.
- **Duplicate** — forks a chat so you can branch from any point.
- **Export JSON** — per-chat export; full message tree in raw JSON.
- **Delete** — soft-tombstones the row (the `tombstoned` flag is an
  auth-readiness seam; right now delete is one-click permanent as
  far as the UI is concerned).
- **Multi-select mode** — toggle from the sidebar header; allows
  bulk delete and bulk export.

For cross-chat analysis and larger exports, see the Dataset Inspector
at `/dataset`: ShareGPT JSONL and raw JSONL downloads, plus paginated
browse across every conversation.

## Model picker

The picker aggregates models from every enabled provider into a
single searchable list. Each entry shows the model's display name,
its provider, and — when the provider's catalog exposes it — context
window, pricing, and capability flags (vision, function-calling).
Switch models mid-chat freely; the next turn routes through whatever
is selected.

## Privacy

Everything persistent about the chat playground lives in the
browser's IndexedDB under the `cryptex-chat` database. The four
tables (`chats`, `messages`, `attachments`, `toolStates`) carry an
`ownerId`, an `updatedAt`, and a `tombstoned` flag so that
retrofit-to-auth is a config change, not a refactor. Today the
`ownerId` is always `'local'`.

The only outbound network calls made by the chat playground are:

- The chat completion / streaming request to the model provider you
  picked.
- The provider's own model-catalog fetch when you open the model
  picker.
- A one-shot key-probe when you paste a new API key into Settings.

That's the entire surface. No analytics, no telemetry, no Cryptex
backend.
