import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/schema.js';

describe('parseConfig', () => {
  it('applies defaults', () => {
    const { config, diagnostics } = parseConfig({
      permissions: [{ id: 'users:read' }],
      endpoints: [{ id: 'GET /x', requires: ['users:read'] }],
    });
    expect(diagnostics).toEqual([]);
    expect(config.permissions[0]).toEqual({ id: 'users:read', implies: [] });
    expect(config.resources).toEqual([]);
    expect(config.endpoints[0]).toEqual({ id: 'GET /x', requires: ['users:read'], public: false });
  });

  it('treats null / empty documents as an empty config', () => {
    expect(parseConfig(null).config).toEqual({ permissions: [], resources: [], endpoints: [] });
    expect(parseConfig(undefined).diagnostics).toEqual([]);
  });

  it('rejects unknown keys with a path', () => {
    const { diagnostics } = parseConfig({ permissions: [{ id: 'a', implys: [] }] }, 'x.yaml');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ code: 'E_SCHEMA', path: 'permissions[0]', file: 'x.yaml' });
    expect(diagnostics[0]?.message).toContain('"implys"');
  });

  it('rejects bad id characters as E_BAD_ID', () => {
    const { diagnostics } = parseConfig({
      permissions: [{ id: 'Users.Read' }],
      resources: [{ id: 'users:x', actions: { 'bad.action': 'users:read' } }],
    });
    const codes = diagnostics.map((d) => d.code);
    expect(codes).toContain('E_BAD_ID');
    expect(diagnostics.find((d) => d.path === 'permissions[0].id')).toBeDefined();
    expect(diagnostics.find((d) => d.path === 'resources[0].id')).toBeDefined();
  });

  it('rejects wrong types', () => {
    const { diagnostics } = parseConfig({ endpoints: [{ id: 'GET /x', requires: 'users:read' }] });
    expect(diagnostics[0]).toMatchObject({ code: 'E_SCHEMA', path: 'endpoints[0].requires' });
    expect(diagnostics[0]?.message).toBe('expected array, received string');
  });

  it('rejects a non-object root', () => {
    const { diagnostics, config } = parseConfig([1, 2, 3]);
    expect(diagnostics[0]?.code).toBe('E_SCHEMA');
    expect(config.permissions).toEqual([]);
  });
});
