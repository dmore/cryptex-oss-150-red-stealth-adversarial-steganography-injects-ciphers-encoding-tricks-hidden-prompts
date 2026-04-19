---
title: Privacy
description: What leaves your browser, what doesn't, and why.
category: policy
order: 1
---

# Privacy

Cryptex is local-first. The things most red-team tools get wrong about privacy,
we try to get right. Here's what the app actually does:

## In-memory tool state

Inputs, outputs, and intermediate state for every tool live in Svelte `$state`
inside your browser tab. Reloading the tab loses unsaved state (by design).
Favorites and settings persist to `localStorage` — nothing else.

## BYOK-only AI calls

PromptCraft, Anti-Classifier, and Translate make HTTPS calls from your browser
directly to `openrouter.ai`. The key lives in `localStorage` under
`cryptex.openrouterApiKey` and never touches a Cryptex server (because there
isn't one — the site is static HTML + JS).

## No telemetry

Cryptex ships no analytics SDK, no error reporter, and no "anonymous
usage" beacon. The only outbound network traffic is the direct call
from your browser to the AI provider you configured.

## AdSense — on two pages, with consent

The only pages that load Google AdSense are `/guide` and `/about`. Ads are
consent-gated: refuse, and no AdSense script loads. Every tool tab is ad-free.

## Session log is downloadable, not uploadable

The History drawer logs each run in-memory for your current tab. Download it
as JSON if you want a record. It is never transmitted anywhere.

## No hidden telemetry

There is no pixel, no beacon, no third-party analytics. If you disagree, the
source is open — grep it.
