---
title: FAQ
description: Short answers to the questions we get most often.
category: policy
order: 2
---

# FAQ

**Where is my data stored?**
In your browser. Chat history, Attack Chain traces, dataset rows, and
attachments all live in IndexedDB (`cryptex-chat` database). Provider
keys live in `localStorage`. Nothing is transmitted to a Cryptex
server.

**Who can I use this against?**
Systems you own or have explicit written authorization to test. That
covers internal red-team engagements, bug bounty scopes that permit
prompt-injection research, CTFs you are registered for, and models
you host yourself. Out-of-scope targets are off-limits the same way
any security tool is.

**Which providers work?**
OpenRouter (recommended default), Anthropic direct, and any
OpenAI-compatible endpoint. Named presets: OpenAI, Google Gemini
(via OpenAI-compat), Groq, Together, Fireworks, DeepInfra, Cerebras,
SambaNova. Plus a Custom endpoint picker for any other OpenAI-shape
`/v1/chat/completions`. See [chat basics](/guide/chat-basics/) for
the full matrix.

**Does my key see the whole session?**
Each provider only receives the specific turn routed to it. Switching
models mid-chat routes subsequent turns through the new provider;
historical turns do not replay through every provider.

**Can I export my data?**
Yes. Per-chat **Export JSON** in the sidebar, or the **Dataset
Inspector** at `/dataset` for cross-chat ShareGPT JSONL and raw
JSONL downloads.

**How do I trust it is BYOK?**
The site is static. View source, inspect the network tab. The only
outbound requests are the ones you make to the provider you
configured. No Cryptex backend exists to send anything to.
