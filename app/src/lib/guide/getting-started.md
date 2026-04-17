---
title: Getting started
description: BYOK setup in four steps — key, paste, model, translate.
category: intro
order: 2
---

# Getting started

Most of Cryptex is offline-first: transforms, the decoder, steganography, the
tokenizer, Tokenade, Bijection, and Fuzzer all run as pure JS in your browser.
You do not need an account for any of that.

The three AI-powered tools — **PromptCraft**, **Anti-Classifier**, and
**Translate** — use OpenRouter. BYOK, your key, your models, your bill.

## 1. Grab an OpenRouter key

Sign up at `openrouter.ai`, top up a few dollars of credit, and create an API
key. OpenRouter brokers to Anthropic, OpenAI, Google, Mistral, Meta, xAI, and
hundreds of open-weight models through one endpoint.

## 2. Paste into Settings

Open `/settings`, paste the key, hit save. Cryptex immediately validates the
key against `/api/v1/auth/key`. A green check means live credit and usable; a
red cross means re-check the key.

```
cryptex → /settings → paste sk-or-v1-… → Save
```

## 3. Pick a model

The model picker fetches OpenRouter's live catalog and caches it for an hour.
Hit the refresh icon any time, or save a new key — the catalog auto-refreshes
and every open tab updates reactively.

## 4. Run your first translation

Open `/translate`, paste a sentence, choose Latin, hit Translate. You should
see tokens streaming back.

> Tip: key validation is the easiest way to confirm a fresh key works.
> If the validator says invalid, nothing else will work either — fix the key
> first before blaming the model.
