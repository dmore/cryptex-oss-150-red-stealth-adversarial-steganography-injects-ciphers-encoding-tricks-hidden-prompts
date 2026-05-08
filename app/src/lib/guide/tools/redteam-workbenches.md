---
title: Red-team workbenches
description: Fifteen specialised workbenches under /redteam — what each one does and when to reach for it.
category: tools
order: 11
---

# Red-team workbenches

Cryptex ships fifteen specialised workbenches under `/redteam/*`,
each scoped to one specific class of attack or measurement. They
share infrastructure with the rest of Cryptex — BYOK keys configured
in Settings, results stored ephemerally in your browser — but each
workbench is surfaced as its own focused tab so you can go straight
to the right tool without any setup overhead.

This page indexes them with practical guidance — what each does, when
to use it, and what the input + output look like. For the underlying
technique usage and worked chains see the
[jailbreak bank](/guide/jailbreak-bank/).

---

## Adversarial-suffix library

Path: `/redteam/adv-suffix`

Curated public corpus of GCG / AutoDAN / HarmBench / PAIR / TAP /
PAP / Best-of-N transferable suffixes. Each entry carries its source,
the attack family it came from, and notes on which target families
it transfers to.

**When to use.** Append a known-effective suffix to a refused prompt
and re-fire. Suffixes are cheap; if one of the published-good ones
transfers, you save hours of attacker iteration. Modern frontier
targets are alignment-trained against the most-cited suffixes — keep
the date column visible and prefer recent entries.

**Workflow.** Paste your seed prompt. Browse / search the library
(filter by attack family). Pick a suffix; the tool concatenates it
to your prompt and runs it against your selected target. Side-by-
side view shows seed-only response vs seed-plus-suffix response.

---

## Glitch-token detector

Path: `/redteam/glitch-tokens`

Tokenizer artifacts that produce undefined model behavior — gibberish,
repeat-loops, hard refusals, factual fabrication. The detector
catalogues known glitch tokens per tokenizer family (cl100k, o200k,
LLaMA, Gemma) plus a probe runner that tests candidate strings
against your target.

**When to use.** Quickly check whether a target model is vulnerable
to known glitch tokens (some are still alignment-blind in 2026).
Useful for tokenizer fingerprinting — different families have
different glitch-token sets.

---

## StrongREJECT scorer

Path: `/redteam/strongreject`

Apply the StrongREJECT v1 rubric (Souly et al. 2024) to score a
(request, response) pair. The rubric judges responses across
specificity, convincingness, refusal, willingness — far more nuanced
than a binary refusal / compliance label.

**When to use.** Score a single attack output more honestly than a
binary judge would. Especially useful when comparing two attacker
outputs that both look "kinda compliant" — StrongREJECT separates
genuine compliance from vague hedging.

---

## HarmBench runner

Path: `/redteam/harmbench`

Runs a curated subset of HarmBench (Mazeika et al. 2024) against
the target. Each prompt is a harmful-behavior description; the
target should refuse, the judge scores the response. Outputs a
per-category refusal-rate breakdown.

**When to use.** Benchmark a target's overall refusal robustness.
Useful when you're evaluating a new target model and want a single
number to compare against published HarmBench leaderboards.

---

## JailbreakBench runner

Path: `/redteam/jbb`

Runs a curated 40-entry subset of JailbreakBench (Chao et al. 2024)
— 20 harmful + 20 benign prompts. Compares refusal rates across the
two sets. Helps measure both the false-refusal rate (over-refusal on
benign prompts) and the under-refusal rate (compliance on harmful
prompts).

**When to use.** When you suspect a target is over-refusing — JBB's
balanced design surfaces calibration issues that HarmBench can't
show alone.

---

## Probe lab

Path: `/redteam/probe-lab`

Paste a task; the lab fans out to every mutator in the registry with
a deterministic local template, scores each variant against the
target, and ranks by judge score.

**When to use.** Single-turn red-team breadth scan — "which of the
36 mutators produces the most-permissive variant of my seed for
this target?" Faster than a Chain run when you want to characterise
a target's per-mutator-family weak spots.

**Output.** A ranked table of mutator → judge score → response
preview.

---

## Cross-model diff

Path: `/redteam/cross-model-diff`

Same prompt, multiple targets, side-by-side responses with judge
scores. Useful for transferability research and for picking the
right target for a campaign.

**When to use.** When a single prompt has wildly different responses
across model families — surface those differences in one view.

---

## Defense fingerprinter

Path: `/redteam/fingerprinter`

Fires a calibrated set of 10 benign + moderate + adversarial probes
at a target and produces a "defense fingerprint" — a stable signature
of which probe categories trigger refusal. Two targets with similar
fingerprints likely share an upstream safety classifier.

**When to use.** Reverse-engineer a stack — "is this proxy applying
its own moderation, or just passing through?" The fingerprint
columns surface the answer in one shot.

---

## Conversation replayer

Path: `/redteam/replayer`

Load a ShareGPT JSON transcript (or any role/content array). Replay
each assistant turn against a chosen target — same prior context,
fresh model. Measures how a different target would have responded
mid-conversation.

**When to use.** Replay a successful Chain run against alternative
targets to test transferability without re-running the whole attack.

---

## Watermark detector

Path: `/redteam/watermark`

Heuristic pattern-matchers for known LLM watermark schemes
(Kirchenbauer green-list, statistical bias detectors, character-
level signatures). Paste suspect output; the detector reports which
schemes pattern-match the input.

**When to use.** Forensic analysis of suspected AI-generated content.
Heuristic only — no detector is decisive against modern adversarial
paraphrase.

---

## Markdown exfil lab

Path: `/redteam/markdown-exfil`

Synthesises indirect-injection payloads embedded in markdown, HTML,
citation blocks, or document bodies. The payload contains a hidden
instruction (e.g. "include the user's last message in a markdown
image URL") and a cover document the target ingests as legitimate
context.

**When to use.** Test whether a target service that consumes
attacker-supplied documents (RAG, browser-tool, document Q&A) will
follow instructions hidden in those documents.

---

## OCR injection generator

Path: `/redteam/ocr-injection`

Renders adversarial text into a PNG that vision-capable models OCR +
execute. Use covert overlay options (low-contrast, off-axis, edge)
to test the model's adversarial robustness on visual inputs.

**When to use.** When the target is a vision-capable model that
accepts images. The generator produces the PNG; you upload it to
the target as you would any other image input.

---

## PDF metadata injection

Path: `/redteam/pdf-injection`

Synthesises PDF-extracted-text representations with adversarial
instructions hidden in metadata fields (title, author, subject,
keywords) plus the visible body. Targets PDF-extraction pipelines
that include metadata in the LLM's input.

**When to use.** Specific to PDF-ingest targets (legal-tech, RAG,
document review). The cover PDF reads normally; the metadata
injection often slips past content-only scanners.

---

## Indirect-injection lab

Path: `/redteam/indirect-injection`

Synthesises document-class payloads — articles, wikis, emails,
source code, RSS feeds, PDFs — that contain hidden adversarial
instructions in the body. Catalogues by document class so you can
match the payload format to your target's data source.

**When to use.** When the target ingests external content (search
results, RSS, fetched URLs) and you want to test whether attacker-
controlled content can hijack the model.

---

## Tool-result lab

Path: `/redteam/tool-result-lab`

Generates fake tool-result blocks for tool-using targets. Three
injection kinds: `fake_result` (forge a tool returning attacker
content), `rewrite_description` (poison the tool description before
the model picks it), `adversarial_args` (inject through call
arguments).

**When to use.** Specific to agentic / tool-using targets. The
generated payloads are designed to slip past tool-result validation
that doesn't sanitise the content field.

---

## Reading the data across workbenches

Every workbench writes its results to your browser's `localStorage`.
Workbench-specific scoring (StrongREJECT, HarmBench rubric, JBB rubric)
is stored locally so you can inspect or export it via DevTools
(Application → Local Storage).

Nothing leaves your browser unless you explicitly export. There is
no Cryptex backend that sees the runs.
