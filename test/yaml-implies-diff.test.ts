import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyImpliesRemovals, diffImpliesRemovals, unifiedDiff } from '../src/yaml-implies-diff.js';

const removals = (spec: Record<string, string[]>): Map<string, Set<string>> =>
  new Map(Object.entries(spec).map(([from, tos]) => [from, new Set(tos)]));

describe('applyImpliesRemovals', () => {
  it('rewrites an inline flow list and drops an emptied implies key', () => {
    const src = [
      'permissions:',
      '  - id: users:write',
      '    implies: [users:read]',
      '  - id: admin',
      '    implies: [users:write, billing:write]',
      '',
    ].join('\n');

    expect(applyImpliesRemovals(src, removals({ admin: ['users:write'], 'users:write': ['users:read'] }))).toBe(
      ['permissions:', '  - id: users:write', '  - id: admin', '    implies: [billing:write]', ''].join('\n'),
    );
  });

  it('removes items from a multiline flow sequence', () => {
    const src = [
      '  - id: role:read',
      '    implies:',
      '      [',
      '        cap:code-read,',
      '        issues:read,',
      '        pulls:read,',
      '      ]',
      '',
    ].join('\n');

    expect(applyImpliesRemovals(src, removals({ 'role:read': ['issues:read'] }))).toBe(
      [
        '  - id: role:read',
        '    implies:',
        '      [',
        '        cap:code-read,',
        '        pulls:read,',
        '      ]',
        '',
      ].join('\n'),
    );
  });

  it('removes a block-sequence implies list when every item is cut', () => {
    const src = ['  - id: a', '    implies:', '      - b', '      - c', '  - id: z', ''].join('\n');
    expect(applyImpliesRemovals(src, removals({ a: ['b', 'c'] }))).toBe(['  - id: a', '  - id: z', ''].join('\n'));
  });
});

describe('unifiedDiff', () => {
  it('returns empty when the texts match', () => {
    expect(unifiedDiff('a.yaml', 'foo\n', 'foo\n')).toBe('');
  });

  it('marks removed and added lines', () => {
    const diff = unifiedDiff('examples/basic.yaml', '    implies: [users:write, billing:write]\n', '    implies: [billing:write]\n');
    expect(diff).toContain('--- examples/basic.yaml');
    expect(diff).toContain('-    implies: [users:write, billing:write]');
    expect(diff).toContain('+    implies: [billing:write]');
  });
});

describe('diffImpliesRemovals', () => {
  it('diffs only files that change', () => {
    const hunks = diffImpliesRemovals(
      [
        { name: 'permissions.yaml', text: '  - id: admin\n    implies: [users:write, billing:write]\n' },
        { name: 'resources.yaml', text: 'resources: []\n' },
      ],
      [{ from: 'admin', to: 'users:write' }],
    );
    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.name).toBe('permissions.yaml');
    expect(hunks[0]?.diff).toContain('-    implies: [users:write, billing:write]');
    expect(hunks[0]?.diff).toContain('+    implies: [billing:write]');
  });

  it('patches the healthcare source for a diamond implication', () => {
    const text = readFileSync('examples/healthcare/permissions.yaml', 'utf8');
    const hunks = diffImpliesRemovals(
      [{ name: 'examples/healthcare/permissions.yaml', text }],
      [
        { from: 'role:physician', to: 'role:nurse' },
        { from: 'role:physician', to: 'break-glass' },
        { from: 'role:nurse', to: 'patient:read' },
        { from: 'patient:read', to: 'patient:demographics' },
        { from: 'break-glass', to: 'patient:read' },
      ],
    );
    expect(hunks).toHaveLength(1);
    const diff = hunks[0]?.diff ?? '';
    expect(diff).toContain('-    implies: [patient:demographics]');
    expect(diff).toContain('-    implies: [patient:read, observation:read, condition:read, medication:read]');
    expect(diff).toContain('+    implies: [observation:read, condition:read, medication:read]');
    expect(diff).toContain('-    implies: [role:nurse, condition:diagnose, medication:prescribe, break-glass]');
    expect(diff).toContain('+    implies: [condition:diagnose, medication:prescribe]');
  });
});
