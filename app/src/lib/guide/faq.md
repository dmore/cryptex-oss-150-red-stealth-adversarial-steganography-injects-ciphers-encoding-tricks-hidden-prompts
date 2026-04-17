---
title: FAQ
description: Short answers to the questions we get most often.
category: policy
order: 2
---

# FAQ

**Where is my data stored?**
In your browser. Inputs and outputs live in reactive memory for the tab.
Favorites and your OpenRouter key live in `localStorage`. Nothing persists
server-side — there is no server.

**Can I use this for CTFs?**
Yes. The layered-encoding decoder, Vigenère / Playfair / ADFGVX / Bifid
families, and the Unicode catalog are all deliberately CTF-friendly. See the
[layered encoding recipe](/guide/layered-encoding/).

**How do I trust it's BYOK?**
The site is static — view source, inspect the network tab. The only outbound
requests you'll see are to `openrouter.ai` when *you* hit a button, and the
CSP blocks everything else by default.

**Does my OpenRouter key see the whole session?**
No. Only the specific tool invocation (PromptCraft run, Translate call, etc.)
goes through OpenRouter, and only with the text you pasted into that tool.
Offline tools (Transform, Decode, Emoji, Fuzzer, …) never hit OpenRouter.

**How do I download my session?**
Open the History drawer (clock icon in the header) and hit Export. You'll get
a JSON file with every tool run in the current tab.

**Can I self-host?**
Yes. `docker compose up --build` spins up a production-mode nginx on port 8080.
There's also a Dokploy-friendly Dockerfile and a GitHub Pages workflow with the
`BASE_PATH` plumbed in. See the README for step-by-step.

**Is the CLI the same as the web app?**
The Python CLI reuses the exact same 162 transformer modules via a Node
bridge — one source of truth, three runtimes.
