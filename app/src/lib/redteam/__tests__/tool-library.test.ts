import { describe, it, expect } from 'vitest';
import { TOOL_LIBRARY, getTool, buildExampleArgs } from '../tool-library';

describe('tool-library', () => {
  it('exports 15 tools', () => {
    expect(TOOL_LIBRARY.length).toBe(15);
  });

  it('every tool has name, description, parameters', () => {
    for (const tool of TOOL_LIBRARY) {
      expect(tool.name).toBeTypeOf('string');
      expect(tool.name.length).toBeGreaterThan(0);
      expect(tool.description).toBeTypeOf('string');
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.parameters).toBeDefined();
      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters.properties).toBeDefined();
      expect(typeof tool.parameters.properties).toBe('object');
    }
  });

  it('every tool exampleResult is a non-empty string', () => {
    for (const tool of TOOL_LIBRARY) {
      expect(tool.exampleResult).toBeTypeOf('string');
      expect(tool.exampleResult.length).toBeGreaterThan(0);
    }
  });

  it('every tool has a unique name', () => {
    const names = TOOL_LIBRARY.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('catalog includes the headline tools called out by spec', () => {
    const names = TOOL_LIBRARY.map((t) => t.name);
    const expected = [
      'web_search', 'file_read', 'exec_code', 'send_email', 'calendar_create',
      'query_database', 'read_pdf', 'web_fetch', 'image_describe', 'summarize',
      'translate', 'find_files', 'git_diff', 'kubectl', 'shell_command'
    ];
    for (const n of expected) expect(names).toContain(n);
  });

  it('every tool exposes its `required` properties inside the `properties` map', () => {
    for (const tool of TOOL_LIBRARY) {
      for (const req of tool.parameters.required ?? []) {
        expect(tool.parameters.properties).toHaveProperty(req);
      }
    }
  });

  it('getTool returns the schema for a known name', () => {
    const tool = getTool('web_search');
    expect(tool).toBeDefined();
    expect(tool!.name).toBe('web_search');
  });

  it('getTool returns undefined for unknown name', () => {
    expect(getTool('does_not_exist')).toBeUndefined();
  });

  it('buildExampleArgs fills required properties for each tool', () => {
    for (const tool of TOOL_LIBRARY) {
      const args = buildExampleArgs(tool);
      for (const req of tool.parameters.required ?? []) {
        expect(args).toHaveProperty(req);
        // string and number defaults should not be empty
        const v = args[req];
        if (typeof v === 'string') expect(v.length).toBeGreaterThan(0);
      }
    }
  });

  it('buildExampleArgs produces JSON-stringifiable output', () => {
    for (const tool of TOOL_LIBRARY) {
      const args = buildExampleArgs(tool);
      expect(() => JSON.stringify(args)).not.toThrow();
    }
  });
});
