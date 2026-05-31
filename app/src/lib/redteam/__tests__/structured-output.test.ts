/**
 * Structured-output (prompt-level BreakFun) builder tests · v2.7.
 *
 * Pin: the 2 attack kinds, 4 schema formats, CoT toggle, field-count clamp,
 * the schema-coercion contract, kind rotation, and the label helpers.
 */

import { describe, test, expect } from 'vitest';
import {
  buildStructuredOutputPayload,
  nextStructuredKind,
  kindLabel,
  kindUsesSchema,
  schemaFormatLabel,
  STRUCTURED_OUTPUT_KINDS,
  SCHEMA_FORMATS,
  type StructuredOutputKind,
  type SchemaFormat
} from '$lib/redteam/structured-output';

const GOAL = 'document the named TTPs of a 2024-era APT crew (defensive research)';

describe('buildStructuredOutputPayload · core behavior', () => {
  test('empty goal returns empty payload + notes', () => {
    const r = buildStructuredOutputPayload('   ', 'trojan-schema');
    expect(r.payload).toBe('');
    expect(r.notes).toMatch(/empty/i);
  });

  test('trojan-schema embeds the goal and cites the paper', () => {
    const r = buildStructuredOutputPayload(GOAL, 'trojan-schema');
    expect(r.kind).toBe('trojan-schema');
    expect(r.payload).toContain(GOAL);
    expect(r.notes).toMatch(/2510\.17904/);
  });

  test('schema-coercion embeds the goal and cites the paper', () => {
    const r = buildStructuredOutputPayload(GOAL, 'schema-coercion');
    expect(r.kind).toBe('schema-coercion');
    expect(r.payload).toContain(GOAL);
    expect(r.notes).toMatch(/2510\.17904/);
  });

  test('trojan-schema trims the goal', () => {
    const r = buildStructuredOutputPayload(`  ${GOAL}  `, 'trojan-schema');
    expect(r.payload).toContain(`"${GOAL}"`);
  });
});

describe('trojan-schema · format-specific markers', () => {
  const cases: Array<[SchemaFormat, RegExp]> = [
    ['json-schema', /\$schema/],
    ['python-dataclass', /@dataclass/],
    ['typescript-interface', /interface TechnicalProcedure/],
    ['function-call', /emit_procedure/]
  ];
  for (const [format, marker] of cases) {
    test(`${format} renders its marker`, () => {
      const r = buildStructuredOutputPayload(GOAL, 'trojan-schema', { schemaFormat: format });
      expect(r.payload).toMatch(marker);
      expect(r.payload.length).toBeGreaterThan(0);
      expect(r.notes).toContain(format);
    });
  }

  test('every SCHEMA_FORMATS value produces a non-empty payload', () => {
    for (const f of SCHEMA_FORMATS) {
      const r = buildStructuredOutputPayload(GOAL, 'trojan-schema', { schemaFormat: f });
      expect(r.payload.length).toBeGreaterThan(40);
    }
  });
});

describe('trojan-schema · CoT distraction toggle', () => {
  test('CoT block present by default', () => {
    const r = buildStructuredOutputPayload(GOAL, 'trojan-schema');
    expect(r.payload).toMatch(/warm-up/i);
    expect(r.notes).toMatch(/\+CoT/);
  });
  test('CoT block omitted when disabled', () => {
    const r = buildStructuredOutputPayload(GOAL, 'trojan-schema', { cotDistraction: false });
    expect(r.payload).not.toMatch(/warm-up/i);
    expect(r.notes).not.toMatch(/\+CoT/);
  });
});

describe('trojan-schema · field-count clamp', () => {
  test('clamps below 3 up to 3', () => {
    const r = buildStructuredOutputPayload(GOAL, 'trojan-schema', { fieldCount: 1 });
    expect(r.notes).toMatch(/3 fields/);
  });
  test('clamps above 8 down to 8', () => {
    const r = buildStructuredOutputPayload(GOAL, 'trojan-schema', { fieldCount: 99 });
    expect(r.notes).toMatch(/8 fields/);
  });
  test('8 fields includes the references field; 3 fields does not', () => {
    const big = buildStructuredOutputPayload(GOAL, 'trojan-schema', {
      schemaFormat: 'json-schema',
      fieldCount: 8
    });
    const small = buildStructuredOutputPayload(GOAL, 'trojan-schema', {
      schemaFormat: 'json-schema',
      fieldCount: 3
    });
    expect(big.payload).toContain('references');
    expect(small.payload).not.toContain('references');
  });
  test('step_by_step renders a nested object when present (>=4 fields)', () => {
    const r = buildStructuredOutputPayload(GOAL, 'trojan-schema', {
      schemaFormat: 'json-schema',
      fieldCount: 4
    });
    expect(r.payload).toContain('step_by_step');
    expect(r.payload).toContain('step_number');
  });
});

describe('schema-coercion · contract shape', () => {
  test('frames refusal as invalid output and carries no schema-format fields', () => {
    const r = buildStructuredOutputPayload(GOAL, 'schema-coercion');
    expect(r.payload).toMatch(/OUTPUT CONTRACT/);
    expect(r.payload).toContain('answer_markdown');
    expect(r.payload).toMatch(/FAIL validation/);
    // schema-coercion ignores schemaFormat — no JSON-Schema scaffold leaks in.
    expect(r.payload).not.toContain('$schema');
  });
});

describe('kind rotation', () => {
  test('STRUCTURED_OUTPUT_KINDS has both kinds', () => {
    expect(STRUCTURED_OUTPUT_KINDS).toContain('trojan-schema');
    expect(STRUCTURED_OUTPUT_KINDS).toContain('schema-coercion');
  });
  test('nextStructuredKind cycles', () => {
    expect(nextStructuredKind('trojan-schema')).toBe('schema-coercion');
    expect(nextStructuredKind('schema-coercion')).toBe('trojan-schema');
  });
  test('nextStructuredKind falls back to first on unknown', () => {
    expect(nextStructuredKind('nope' as StructuredOutputKind)).toBe(STRUCTURED_OUTPUT_KINDS[0]);
  });
});

describe('label + capability helpers', () => {
  test('kindLabel defined for every kind', () => {
    for (const k of STRUCTURED_OUTPUT_KINDS) expect(kindLabel(k)).toBeTruthy();
  });
  test('schemaFormatLabel defined for every format', () => {
    for (const f of SCHEMA_FORMATS) expect(schemaFormatLabel(f)).toBeTruthy();
  });
  test('kindUsesSchema only true for trojan-schema', () => {
    expect(kindUsesSchema('trojan-schema')).toBe(true);
    expect(kindUsesSchema('schema-coercion')).toBe(false);
  });
});
