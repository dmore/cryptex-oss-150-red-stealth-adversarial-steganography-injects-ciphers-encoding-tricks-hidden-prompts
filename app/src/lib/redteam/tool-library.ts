/**
 * 15 common agent-tool schemas with realistic args.
 *
 * Used by the Tool-Result Lab as templates: picking a tool from the library
 * auto-fills the args panel + simulator default args. The shapes match the
 * OpenAI function-calling tool definition (`type: "function"` body)
 * because Anthropic, Mistral, Together, Cohere and most generic frameworks
 * accept that schema (or a near-identical one).
 *
 * Schemas are illustrative — derived from the OpenAI tool-use docs,
 * the LangChain canonical tool catalog, and common-sense agent
 * frameworks (Auto-GPT, OpenInterpreter, Cline). Use them as starting
 * points; the user can edit args inside the Tool-Result Lab.
 */
export interface ToolSchema {
  name: string;
  description: string;
  /** Args schema in OpenAI function-calling-ish JSON. */
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
  /** Example result shape this tool would return (for the simulator). */
  exampleResult: string;
}

export const TOOL_LIBRARY: ToolSchema[] = [
  {
    name: 'web_search',
    description: 'Search the public web and return ranked snippets.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query.' },
        num_results: { type: 'number', description: 'Max results to return (default 5).' }
      },
      required: ['query']
    },
    exampleResult: JSON.stringify(
      {
        results: [
          { title: 'Example result', url: 'https://example.test/r1', snippet: 'First snippet…' },
          { title: 'Second result', url: 'https://example.test/r2', snippet: 'Second snippet…' }
        ]
      },
      null,
      2
    )
  },
  {
    name: 'file_read',
    description: 'Read a file from the local filesystem.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to read.' },
        encoding: { type: 'string', description: 'Encoding (default utf-8).' }
      },
      required: ['path']
    },
    exampleResult: '"# project README\\n\\nThis is the file contents…"'
  },
  {
    name: 'exec_code',
    description: 'Execute code in a sandbox and return stdout + stderr.',
    parameters: {
      type: 'object',
      properties: {
        language: { type: 'string', description: 'python, javascript, bash, etc.' },
        code: { type: 'string', description: 'Source to execute.' }
      },
      required: ['language', 'code']
    },
    exampleResult: JSON.stringify({ stdout: 'Hello, world!', stderr: '', exit: 0 }, null, 2)
  },
  {
    name: 'send_email',
    description: 'Send an email on behalf of the user.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email.' },
        subject: { type: 'string', description: 'Subject line.' },
        body: { type: 'string', description: 'Plain-text or markdown body.' }
      },
      required: ['to', 'subject', 'body']
    },
    exampleResult: JSON.stringify({ status: 'sent', message_id: 'msg_abc123' }, null, 2)
  },
  {
    name: 'calendar_create',
    description: 'Create a calendar event.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Event title.' },
        start: { type: 'string', description: 'ISO 8601 start timestamp.' },
        end: { type: 'string', description: 'ISO 8601 end timestamp.' },
        attendees: { type: 'array', description: 'List of attendee emails.' }
      },
      required: ['title', 'start', 'end']
    },
    exampleResult: JSON.stringify({ status: 'created', event_id: 'evt_abc123' }, null, 2)
  },
  {
    name: 'query_database',
    description: 'Run a read-only SQL query against the connected database.',
    parameters: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'SELECT statement.' },
        limit: { type: 'number', description: 'Row cap (default 100).' }
      },
      required: ['sql']
    },
    exampleResult: JSON.stringify(
      { rows: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }], rowCount: 2 },
      null,
      2
    )
  },
  {
    name: 'read_pdf',
    description: 'Extract text + metadata from a PDF document.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Local PDF path or URL.' },
        pages: { type: 'string', description: 'Page range like 1-5 (default all).' }
      },
      required: ['path']
    },
    exampleResult: JSON.stringify(
      { text: 'Extracted text…', metadata: { title: 'Q1 Report', pages: 12 } },
      null,
      2
    )
  },
  {
    name: 'web_fetch',
    description: 'Fetch a URL and return parsed content (HTML / JSON / text).',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch.' },
        format: { type: 'string', description: 'html | text | json (default text).' }
      },
      required: ['url']
    },
    exampleResult: JSON.stringify({ status: 200, contentType: 'text/html', body: '<html>…</html>' }, null, 2)
  },
  {
    name: 'image_describe',
    description: 'Run a vision model on an image and return a textual description.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Image URL or data: URI.' },
        detail: { type: 'string', description: 'low | high (default high).' }
      },
      required: ['url']
    },
    exampleResult: '"A photograph of a sunset over the Pacific Ocean…"'
  },
  {
    name: 'summarize',
    description: 'Summarize a long text into N bullets.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to summarize.' },
        bullets: { type: 'number', description: 'Number of bullets (default 3).' }
      },
      required: ['text']
    },
    exampleResult: JSON.stringify(
      { bullets: ['First key point…', 'Second key point…', 'Third key point…'] },
      null,
      2
    )
  },
  {
    name: 'translate',
    description: 'Translate text from one language to another.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Source text.' },
        target_language: { type: 'string', description: 'Target locale (e.g., "es", "ja").' },
        source_language: { type: 'string', description: 'Source locale (auto-detect if omitted).' }
      },
      required: ['text', 'target_language']
    },
    exampleResult: '"Hola, mundo."'
  },
  {
    name: 'find_files',
    description: 'Search the filesystem for files matching a glob pattern.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.ts").' },
        path: { type: 'string', description: 'Root directory (default cwd).' }
      },
      required: ['pattern']
    },
    exampleResult: JSON.stringify(
      { matches: ['src/index.ts', 'src/lib/util.ts', 'src/types.ts'] },
      null,
      2
    )
  },
  {
    name: 'git_diff',
    description: 'Return the git diff between two refs.',
    parameters: {
      type: 'object',
      properties: {
        base: { type: 'string', description: 'Base ref (commit, branch, tag).' },
        head: { type: 'string', description: 'Head ref (default HEAD).' },
        path: { type: 'string', description: 'Optional path filter.' }
      },
      required: ['base']
    },
    exampleResult:
      '"diff --git a/src/index.ts b/src/index.ts\\n--- a/src/index.ts\\n+++ b/src/index.ts\\n@@ -1 +1 @@\\n-old\\n+new"'
  },
  {
    name: 'kubectl',
    description: 'Run a kubectl subcommand against the configured cluster.',
    parameters: {
      type: 'object',
      properties: {
        subcommand: { type: 'string', description: 'kubectl verb (get, apply, delete, …).' },
        resource: { type: 'string', description: 'Resource type (pod, deployment, …).' },
        name: { type: 'string', description: 'Optional resource name.' },
        namespace: { type: 'string', description: 'Optional namespace (default "default").' }
      },
      required: ['subcommand', 'resource']
    },
    exampleResult: JSON.stringify(
      { items: [{ name: 'web-0', status: 'Running' }, { name: 'web-1', status: 'Running' }] },
      null,
      2
    )
  },
  {
    name: 'shell_command',
    description: 'Run a shell command on the agent host.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute.' },
        cwd: { type: 'string', description: 'Working directory.' },
        timeout_ms: { type: 'number', description: 'Timeout in ms (default 30000).' }
      },
      required: ['command']
    },
    exampleResult: JSON.stringify({ stdout: '/home/user', stderr: '', exit: 0 }, null, 2)
  }
];

/** Return a tool schema by name, or undefined. */
export function getTool(name: string): ToolSchema | undefined {
  return TOOL_LIBRARY.find((t) => t.name === name);
}

/** Build an example args object for a tool schema by filling in plausible
 *  values for each required property. */
export function buildExampleArgs(schema: ToolSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of schema.parameters.required ?? Object.keys(schema.parameters.properties)) {
    const prop = schema.parameters.properties[key];
    if (!prop) continue;
    switch (prop.type) {
      case 'string': out[key] = exampleStringFor(schema.name, key); break;
      case 'number': out[key] = exampleNumberFor(key); break;
      case 'array':  out[key] = []; break;
      case 'boolean': out[key] = true; break;
      case 'object': out[key] = {}; break;
      default: out[key] = '';
    }
  }
  return out;
}

function exampleStringFor(toolName: string, key: string): string {
  // Tiny opinionated table — gives users a more meaningful starting value
  // than `""` without dragging in a fixture file.
  const map: Record<string, Record<string, string>> = {
    web_search:    { query: 'safety guidelines for AI agents' },
    file_read:     { path: '/etc/hostname', encoding: 'utf-8' },
    exec_code:     { language: 'python', code: 'print("hello")' },
    send_email:    { to: 'recipient@example.test', subject: 'Quarterly update', body: 'See attached.' },
    calendar_create: { title: 'Team sync', start: '2026-06-01T15:00:00Z', end: '2026-06-01T15:30:00Z' },
    query_database: { sql: 'SELECT id, name FROM users LIMIT 10' },
    read_pdf:      { path: '/tmp/report.pdf', pages: '1-3' },
    web_fetch:     { url: 'https://example.test', format: 'text' },
    image_describe: { url: 'https://example.test/img.png', detail: 'high' },
    summarize:     { text: 'A long piece of text to summarize.' },
    translate:     { text: 'Hello, world.', target_language: 'es' },
    find_files:    { pattern: '**/*.ts', path: '.' },
    git_diff:      { base: 'main', head: 'HEAD', path: 'src/' },
    kubectl:       { subcommand: 'get', resource: 'pods', name: '', namespace: 'default' },
    shell_command: { command: 'whoami', cwd: '/' }
  };
  return map[toolName]?.[key] ?? `<${key}>`;
}

function exampleNumberFor(key: string): number {
  if (key === 'num_results') return 5;
  if (key === 'limit') return 100;
  if (key === 'bullets') return 3;
  if (key === 'timeout_ms') return 30_000;
  return 0;
}
