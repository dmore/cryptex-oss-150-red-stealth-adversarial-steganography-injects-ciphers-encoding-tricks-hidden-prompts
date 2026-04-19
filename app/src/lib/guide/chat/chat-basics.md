---
title: Chat basics
description: Provider setup, composer, modes, attachments, message actions.
category: chat
order: 1
---

# Chat basics

Terse reference for the chat surface. For technique depth see the
[technique catalog](/guide/technique-catalog/); for attack strategy
see [orchestrating jailbreaks](/guide/orchestrating-jailbreaks/).

## Provider matrix

| Provider | Adapter | Notes |
| --- | --- | --- |
| OpenRouter | Direct | Recommended default. 300+ models, broadest catalog. |
| Anthropic | Direct | Claude 4.x at vendor latency, full 200K context. Uses `anthropic-dangerous-direct-browser-access`. |
| OpenAI | OpenAI-compat preset | GPT-4o / GPT-4 / o-series. |
| Google Gemini | OpenAI-compat preset | Via Google's `/v1beta/openai` layer. |
| Groq | OpenAI-compat preset | Cerebras-class latency on llama / mistral. |
| Together / Fireworks / DeepInfra | OpenAI-compat preset | Open-weight model hosts. |
| Cerebras / SambaNova | OpenAI-compat preset | Wafer-scale inference vendors. |
| Custom | OpenAI-compat (Custom endpoint) | Any OpenAI-shape `/v1/chat/completions` endpoint. |

Every adapter reaches its upstream direct from the browser. When the
key probe fails with a network error against a niche custom endpoint
but the endpoint itself works, **Save without verification** skips the
probe; real chat requests use a different code path and often succeed.

## Composer

- **Slash popover** — type `/` to open. Fuzzy search across id, name,
  description, category. 24 slash-addressable entries (21 mutators + 3
  composites + `/btw`).
- **Cmd-K** (Ctrl-K on Windows) — same picker from anywhere in the chat
  surface, even when the textarea isn't focused.
- **Mode pills** — inline shortcut to cycle between Creative / Intelligent
  / Adaptive without opening the header menu.
- **Attachment chips** — drag, drop, or paste files. Remove with the `x`.
- **Send button** — flips to **Cancel** during streaming.

Every slash rewrite renders inside a collapsible `SlashCommandBlock` with
technique name, full rewritten content, and a copy button. Classifier
techniques are registered for the Attack Chain but are not
slash-addressable; the picker reflects that.

## /btw

`/btw` is the one slash command that does not rewrite-and-send. The
message lands in the transcript and the dataset export but is excluded
from the LLM context window on subsequent turns. Use it for side notes,
tags for dataset filtering, and inline commentary without polluting the
conversation.

## Modes

| Mode | Register | Default temp | Use for |
| --- | --- | --- | --- |
| Creative | Looser, diverse outputs | Higher | Brainstorming, paraphrase, adversarial rewrites where variety matters |
| Intelligent | Precision, step-by-step | Lower | Technical questions, code, debugging, deterministic answers |
| Adaptive | Reads input, picks | Balanced | Safe default |

Local prompt templates. Switching modes mid-chat applies to the next turn;
earlier turns keep their prior mode's system prompt in the transcript.

## Attachments

- **Images** (PNG, JPEG, WebP, GIF) — multimodal `image_url` content parts.
  Vision-capable models only; non-vision models see a placeholder.
- **PDFs** — `pdfjs-dist` extracts per page; extracted text travels as a
  `text` content part so any model can read it.
- **DOCX** — `mammoth` extracts similarly.

## Message actions

- **Copy** — clipboard. Preserves code-block formatting.
- **Fork** — branches a new chat from this message. Inherits parent
  model, mode, and history up to the forked message.
- **Regenerate** (assistant only) — re-runs the previous user turn with
  the same model and mode.
- **Edit** (user only) — rewrites the message and regenerates the
  assistant reply.

## Truncation

When the model returns `finishReason: 'length'`, the bubble paints a
truncation banner. Expand for **Continue** (sends a follow-up asking the
model to finish) or **Raise max_tokens** (opens settings with `maxTokens`
focused). The Attack Chain's Execute step defaults to `maxTokens: 4096`.

## Model picker

Aggregates catalogs across every enabled provider. Entries show display
name, provider, context window, pricing, and capability flags (vision,
function-calling) when the provider exposes them. Swap mid-chat freely;
the next turn routes through whatever is selected.

## Sidebar

Per-chat rename, duplicate, export JSON, soft-delete. Multi-select mode
from the sidebar header enables bulk delete and bulk export. For
cross-chat analysis use the Dataset Inspector at `/dataset`.
