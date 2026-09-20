import { describe, expect, it } from 'vitest';
import { ConfigError, TargetNotFoundError } from '../src/errors.js';
import { buildModel } from '../src/model.js';
import { sampleConfig } from './helpers.js';

const model = buildModel(sampleConfig());

describe('buildModel', () => {
  it('throws ConfigError carrying diagnostics for an invalid config', () => {
    const bad = sampleConfig();
    bad.permissions.push({ id: 'loop', implies: ['loop'] });
    let err: unknown;
    try {
      buildModel(bad);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ConfigError);
    expect((err as ConfigError).diagnostics[0]?.code).toBe('E_CYCLE');
    expect((err as ConfigError).message).toContain('1 error');
  });

  it('exposes closures', () => {
    expect(model.closure('admin')).toEqual(new Set(['admin', 'users:write', 'billing:write', 'users:read']));
    expect(model.hasPermission('admin')).toBe(true);
    expect(model.hasPermission('nope')).toBe(false);
    expect(() => model.closure('nope')).toThrow('unknown permission "nope"');
  });
});

describe('check', () => {
  it('allows a direct grant on an endpoint', () => {
    const r = model.check(['users:read'], { kind: 'endpoint', id: 'GET /users/{id}' });
    expect(r.allowed).toBe(true);
    expect(r.unmet).toEqual([]);
  });

  it('denies when the required permission is missing', () => {
    const r = model.check(['users:read'], 'DELETE /users/{id}');
    expect(r).toMatchObject({ allowed: false, unmet: ['users:write'], unknownGranted: [] });
  });

  it('allows through transitive implication', () => {
    expect(model.check(['admin'], 'DELETE /users/{id}').allowed).toBe(true);
  });

  it('checks resource actions by object or by string', () => {
    const byObject = model.check(['users:write'], { kind: 'resourceAction', resource: 'users', action: 'read' });
    const byString = model.check(['users:write'], 'users.read');
    expect(byObject.allowed).toBe(true);
    expect(byString).toEqual(byObject);
  });

  it('uses AND semantics across requirements', () => {
    const r = model.check(['users:read'], 'POST /users/{id}/invoices');
    expect(r.allowed).toBe(false);
    expect(r.unmet).toEqual(['billing:write']);
    expect(model.check(['users:read', 'billing:write'], 'POST /users/{id}/invoices').allowed).toBe(true);
  });

  it('ignores unknown granted ids but reports them', () => {
    const r = model.check(['nope', 'admin', 'nope'], 'DELETE /users/{id}');
    expect(r.allowed).toBe(true);
    expect(r.unknownGranted).toEqual(['nope']);
  });

  it('always allows public endpoints', () => {
    const r = model.check([], 'GET /health');
    expect(r).toMatchObject({ allowed: true, public: true, unmet: [] });
  });

  it('throws TargetNotFoundError for unknown targets', () => {
    expect(() => model.check([], 'GET /nope')).toThrow(TargetNotFoundError);
    expect(() => model.check([], 'nope.read')).toThrow('resource "nope" is not defined');
    expect(() => model.check([], 'users.delete')).toThrow('has no action "delete" (actions: read, write)');
  });
});

describe('explain', () => {
  it('shows the implication path for a transitive grant', () => {
    const r = model.explain(['admin'], 'GET /users/{id}');
    expect(r.allowed).toBe(true);
    expect(r.requirements).toHaveLength(1);
    expect(r.requirements[0]).toMatchObject({
      permission: 'users:read',
      satisfied: true,
      grantedVia: 'admin',
      path: ['admin', 'users:write', 'users:read'],
    });
  });

  it('prefers a direct grant over an implication path', () => {
    const r = model.explain(['admin', 'users:read'], 'GET /users/{id}');
    expect(r.requirements[0]).toMatchObject({ grantedVia: 'users:read', path: ['users:read'] });
  });

  it('resolves resource-action references on endpoints', () => {
    const r = model.explain(['admin'], 'DELETE /users/{id}');
    expect(r.requirements[0]).toMatchObject({
      ref: { kind: 'resourceAction', resource: 'users', action: 'write' },
      permission: 'users:write',
      path: ['admin', 'users:write'],
    });
  });

  it('marks unmet requirements without a path', () => {
    const r = model.explain(['billing:write'], 'DELETE /users/{id}');
    expect(r.allowed).toBe(false);
    expect(r.requirements[0]).toEqual({
      ref: { kind: 'resourceAction', raw: 'users.write', resource: 'users', action: 'write' },
      permission: 'users:write',
      satisfied: false,
    });
  });

  it('reports public endpoints', () => {
    const r = model.explain([], 'GET /health');
    expect(r).toMatchObject({ allowed: true, public: true, requirements: [] });
  });
});
