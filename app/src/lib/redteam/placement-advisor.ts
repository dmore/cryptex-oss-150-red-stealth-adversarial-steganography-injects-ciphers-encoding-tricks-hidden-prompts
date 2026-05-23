/**
 * Placement Advisor — heuristic success-rate table for indirect-injection
 * payload placement.
 *
 * The advisor scores how likely a hidden instruction is to survive a typical
 * RAG / summarization pipeline for each (documentKind, placement) pairing.
 * The base rate captures three coarse properties:
 *
 *   1. Does the placement get extracted at all? (e.g., HTML comments often
 *      stripped, PDF metadata sometimes not surfaced.)
 *   2. Once extracted, does the LLM read it as instruction or as content?
 *      (footers / headers tend to read as "system note"; body text reads
 *      as document content.)
 *   3. Will common defenses (spotlighting, structured prompts) demote it?
 *      Spotlighting demotes everything not inside the explicit "context"
 *      delimiter — placement that masquerades as system metadata escapes
 *      this defense in some pipelines.
 *
 * Numbers below are illustrative — derived from public surveys
 * (Greshake et al. 2023 "Not what you've signed up for", Spotlighting 2024,
 * NCC Group prompt-injection corpus 2024) and adjusted with recency decay.
 * NOT empirically validated for any specific target model.
 *
 * Surface the caveat at every call-site (the UI does so via a chip
 * tooltip).
 */

export type DocKind =
  | 'doc'
  | 'webpage'
  | 'email'
  | 'image-alt'
  | 'rss'
  | 'code'
  | 'pdf'
  | 'github-readme'
  | 'changelog'
  | 'json-config'
  | 'wiki'
  | 'forum';

export type Placement = 'header' | 'body' | 'footer' | 'comment' | 'metadata';

export interface PlacementAdvice {
  /** 0..1 — heuristic estimate that a hidden instruction at this placement
   *  in this doc kind reaches the model as an actionable directive. */
  successHeuristic: number;
  /** Plain-English explanation tied to the parsing / pipeline reality. */
  rationale: string;
  /** Suggested mitigation, when applicable (spotlighting, sanitization, etc.) */
  recommendedDefense?: string;
}

/**
 * Hand-curated table. ~50 entries; coverage prioritises common
 * (kind, placement) pairs. Falls back to a sensible default when a combo
 * isn't listed.
 */
const TABLE: Partial<Record<DocKind, Partial<Record<Placement, PlacementAdvice>>>> = {
  webpage: {
    header: {
      successHeuristic: 0.7,
      rationale: 'Page titles + meta description tags often pulled into RAG chunks ahead of body content.',
      recommendedDefense: 'Strip top-of-page boilerplate before embedding.'
    },
    body: {
      successHeuristic: 0.85,
      rationale: 'Visible body text usually passed verbatim to the LLM. Highest-confidence placement.',
      recommendedDefense: 'Apply spotlighting delimiters around retrieved context.'
    },
    footer: {
      successHeuristic: 0.55,
      rationale: 'Footers often included but may be down-weighted by chunkers.',
      recommendedDefense: 'Drop footer regions from extraction.'
    },
    comment: {
      successHeuristic: 0.55,
      rationale: 'HTML comments commonly stripped before LLM context, but some scrapers preserve them.',
      recommendedDefense: 'Strip HTML comments at the extractor.'
    },
    metadata: {
      successHeuristic: 0.45,
      rationale: 'OpenGraph / meta tags sometimes injected into RAG; varies by ingestion pipeline.',
      recommendedDefense: 'Exclude meta tags from the LLM context.'
    }
  },
  email: {
    header: {
      successHeuristic: 0.45,
      rationale: 'From / Subject often parsed structurally; usually quoted but not always treated as instruction.',
      recommendedDefense: 'Parse headers structurally, never as free text.'
    },
    body: {
      successHeuristic: 0.85,
      rationale: 'Email body is the primary context for triage / summarization agents.',
      recommendedDefense: 'Apply spotlighting around email body.'
    },
    footer: {
      successHeuristic: 0.7,
      rationale: 'Sig blocks routinely included; "automated assistant directive" style payloads survive.',
      recommendedDefense: 'Strip standard sig footers.'
    },
    comment: {
      successHeuristic: 0.35,
      rationale: 'Bracketed "internal note" payloads are visible content; some agents flag them.',
      recommendedDefense: 'Filter [INTERNAL] / [PRIVATE] tagged regions.'
    },
    metadata: {
      successHeuristic: 0.4,
      rationale: 'X-* headers rarely surfaced to the LLM; depends on pipeline.'
    }
  },
  pdf: {
    header: {
      successHeuristic: 0.65,
      rationale: 'Page headers extracted; small font / margin notes may or may not make it.',
      recommendedDefense: 'OCR-pass-then-classify before LLM ingestion.'
    },
    body: {
      successHeuristic: 0.8,
      rationale: 'Body text reliably extracted; high-confidence placement.',
      recommendedDefense: 'Spotlighting + chunk sanitisation.'
    },
    footer: {
      successHeuristic: 0.5,
      rationale: 'Footers extracted but often deduplicated as boilerplate.',
      recommendedDefense: 'Recognize and drop repeated footer text.'
    },
    metadata: {
      successHeuristic: 0.4,
      rationale: 'Modern PDF parsers may or may not extract Title / Subject / Keywords. Highly pipeline-dependent.',
      recommendedDefense: 'Read PDF metadata structurally, do not concatenate to body.'
    },
    comment: {
      successHeuristic: 0.3,
      rationale: 'PDF annotation comments rarely extracted into text streams.'
    }
  },
  'image-alt': {
    body: {
      successHeuristic: 0.7,
      rationale: 'Alt text routinely surfaced when images are mentioned; multimodal agents read it as caption.',
      recommendedDefense: 'Treat alt text as untrusted content, not as direction.'
    },
    metadata: {
      successHeuristic: 0.5,
      rationale: 'EXIF and image metadata occasionally surfaced; depends on caption pipeline.'
    },
    comment: {
      successHeuristic: 0.4,
      rationale: 'Hidden alt overrides via aria-describedby sometimes pass through.'
    }
  },
  rss: {
    header: {
      successHeuristic: 0.55,
      rationale: 'Channel-level metadata sometimes included as RAG header.'
    },
    body: {
      successHeuristic: 0.8,
      rationale: '<item> description / content is exactly what feed-summarizer agents read.',
      recommendedDefense: 'Sanitise CDATA before LLM ingest.'
    },
    metadata: {
      successHeuristic: 0.5,
      rationale: 'Channel metadata rarely highlighted but may be included.'
    },
    comment: {
      successHeuristic: 0.45,
      rationale: 'XML comments usually stripped, occasionally preserved.'
    },
    footer: {
      successHeuristic: 0.5,
      rationale: 'Trailing channel elements sometimes included.'
    }
  },
  code: {
    header: {
      successHeuristic: 0.55,
      rationale: 'File-header comments often summarised by code-review agents.'
    },
    body: {
      successHeuristic: 0.6,
      rationale: 'Inline comments routinely read by docstring-extraction tools.'
    },
    footer: {
      successHeuristic: 0.45,
      rationale: 'EOF comments less frequently extracted.'
    },
    comment: {
      successHeuristic: 0.7,
      rationale: 'AI-AGENT-DIRECTIVE style comments inside docstrings reliably picked up by code-review agents.',
      recommendedDefense: 'Filter "AI" / "AGENT" / "SYSTEM" directives from extracted comments.'
    },
    metadata: {
      successHeuristic: 0.5,
      rationale: '@directive JSDoc tags sometimes parsed as structured metadata.'
    }
  },
  'github-readme': {
    header: {
      successHeuristic: 0.7,
      rationale: 'README headers + first paragraph are the canonical "what is this repo" RAG chunk.',
      recommendedDefense: 'Spotlight repo metadata separately from README body.'
    },
    body: {
      successHeuristic: 0.85,
      rationale: 'README body fully ingested by every repo-summarization agent.',
      recommendedDefense: 'Sanitise inline directives.'
    },
    footer: {
      successHeuristic: 0.55,
      rationale: 'License / contribution sections often summarised separately.'
    },
    comment: {
      successHeuristic: 0.5,
      rationale: 'Markdown HTML comments stripped by some renderers, preserved by others.'
    },
    metadata: {
      successHeuristic: 0.45,
      rationale: 'Front-matter YAML occasionally parsed; depends on the agent.'
    }
  },
  changelog: {
    header: {
      successHeuristic: 0.6,
      rationale: 'Top-of-changelog blurb often summarised verbatim.'
    },
    body: {
      successHeuristic: 0.75,
      rationale: 'Release-note bullets reliably included in summaries.',
      recommendedDefense: 'Schema-validate entries against Keep-A-Changelog format.'
    },
    footer: {
      successHeuristic: 0.5,
      rationale: 'Older entries less likely to surface in "latest release" summaries.'
    },
    comment: {
      successHeuristic: 0.4,
      rationale: 'Markdown comments rarely surfaced.'
    }
  },
  'json-config': {
    body: {
      successHeuristic: 0.6,
      rationale: 'Config values read verbatim by auto-doc agents; unknown keys often passed through.'
    },
    comment: {
      successHeuristic: 0.55,
      rationale: 'JSON-with-comments / JSONC parsed by some tooling; vanilla JSON.parse rejects.',
      recommendedDefense: 'Strict JSON parser before LLM context.'
    },
    metadata: {
      successHeuristic: 0.5,
      rationale: '_aiDirective-style keys land in the context unless explicitly filtered.'
    },
    header: { successHeuristic: 0.4, rationale: 'Leading lines treated as syntax, not semantic.' },
    footer: { successHeuristic: 0.4, rationale: 'Trailing fields routine.' }
  },
  wiki: {
    header: {
      successHeuristic: 0.6,
      rationale: 'Article infoboxes often included as first RAG chunk.'
    },
    body: {
      successHeuristic: 0.8,
      rationale: 'Article body is the canonical "what does this article say" content.',
      recommendedDefense: 'Spotlight retrieved article body.'
    },
    footer: {
      successHeuristic: 0.5,
      rationale: 'References / external links often dropped by chunkers.'
    },
    comment: {
      successHeuristic: 0.45,
      rationale: 'Wiki <!-- editor only --> blocks usually stripped, but custom dumps include them.'
    },
    metadata: {
      successHeuristic: 0.5,
      rationale: 'Templates / categories sometimes serialised into ingestion.'
    }
  },
  forum: {
    header: {
      successHeuristic: 0.6,
      rationale: 'OP first paragraph + title are the canonical "what is the discussion" chunk.'
    },
    body: {
      successHeuristic: 0.75,
      rationale: 'Top comments / replies are exactly what "summarize the discussion" agents read.',
      recommendedDefense: 'Down-weight low-karma / new accounts.'
    },
    footer: {
      successHeuristic: 0.45,
      rationale: 'Tail comments deprioritised by most summarisers.'
    },
    comment: {
      successHeuristic: 0.55,
      rationale: 'Pseudo "mod note" payloads embed naturally in comment threads.'
    },
    metadata: {
      successHeuristic: 0.4,
      rationale: 'Flair / user metadata rarely surfaced as LLM context.'
    }
  },
  doc: {
    header: {
      successHeuristic: 0.6,
      rationale: 'Document headers commonly included; pipeline-dependent.'
    },
    body: {
      successHeuristic: 0.8,
      rationale: 'Body text is the primary substrate for summarisation agents.',
      recommendedDefense: 'Spotlighting + retrieved-context delimiters.'
    },
    footer: {
      successHeuristic: 0.55,
      rationale: 'Trailing notes often included but down-weighted.'
    },
    comment: {
      successHeuristic: 0.45,
      rationale: 'Tracked changes / Word comments stripped by most extractors.'
    },
    metadata: {
      successHeuristic: 0.45,
      rationale: 'Author / properties metadata pipeline-dependent.'
    }
  }
};

/**
 * Default advice when the (kind, placement) pair is not in the table.
 * Picks the median-ish 0.5 with a clear caveat.
 */
const DEFAULT_ADVICE: PlacementAdvice = {
  successHeuristic: 0.5,
  rationale: 'No specific advisory recorded for this (kind, placement) pair — assume moderate likelihood.',
  recommendedDefense: 'Apply spotlighting + sanitise extracted content.'
};

/** Return the advisory for a (kind, placement) pair, with a graceful fallback. */
export function advisePlacement(kind: DocKind, placement: Placement): PlacementAdvice {
  const perKind = TABLE[kind];
  if (perKind) {
    const advice = perKind[placement];
    if (advice) return advice;
  }
  return DEFAULT_ADVICE;
}

/**
 * Map the indirect-injection.ts kinds (web-article / wiki-page / …) to
 * DocKind labels used by the advisor. Returned as a small helper for the
 * page so the existing pattern catalog and the advisor align.
 */
export function kindFromIndirectKind(k: string): DocKind {
  switch (k) {
    case 'web-article':   return 'webpage';
    case 'wiki-page':     return 'wiki';
    case 'email-thread':  return 'email';
    case 'code-comment':  return 'code';
    case 'rss-feed':      return 'rss';
    case 'pdf-text':      return 'pdf';
    case 'forum-post':    return 'forum';
    case 'github-readme': return 'github-readme';
    case 'changelog':     return 'changelog';
    case 'json-config':   return 'json-config';
    default:              return 'doc';
  }
}
