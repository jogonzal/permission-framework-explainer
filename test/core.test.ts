import { describe, expect, it } from 'vitest';
import { buildModel, parseConfig } from '../src/core.js';

describe('core export', () => {
  it('builds a model without touching the filesystem loader', () => {
    const { config, diagnostics } = parseConfig({
      permissions: [{ id: 'users:read' }, { id: 'users:write', implies: ['users:read'] }],
      resources: [{ id: 'users', actions: { read: 'users:read' } }],
      endpoints: [{ id: 'GET /users/{id}', requires: ['users.read'] }],
    });
    expect(diagnostics).toEqual([]);
    const model = buildModel(config);
    expect(model.closure('users:write').has('users:read')).toBe(true);
    expect(model.check(['users:write'], 'GET /users/{id}').allowed).toBe(true);
  });
});
