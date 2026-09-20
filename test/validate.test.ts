import { describe, expect, it } from 'vitest';
import { validateConfig } from '../src/validate.js';
import type { Config } from '../src/types.js';
import { sampleConfig } from './helpers.js';

const cfg = (partial: Partial<Config>): Config => ({ permissions: [], resources: [], endpoints: [], ...partial });
const perm = (id: string, implies: string[] = []) => ({ id, implies });
const ep = (id: string, requires: string[], isPublic = false) => ({ id, requires, public: isPublic });

describe('validateConfig', () => {
  it('accepts the sample config', () => {
    const r = validateConfig(sampleConfig());
    expect(r).toEqual({ ok: true, errors: [], warnings: [] });
  });

  it('reports duplicate ids in every section', () => {
    const r = validateConfig(
      cfg({
        permissions: [perm('a'), perm('a')],
        resources: [
          { id: 'r', actions: { read: 'a' } },
          { id: 'r', actions: { read: 'a' } },
        ],
        endpoints: [ep('GET /x', ['a']), ep('GET /x', ['a'])],
      }),
    );
    expect(r.ok).toBe(false);
    const dups = r.errors.filter((e) => e.code === 'E_DUPLICATE_ID');
    expect(dups.map((d) => d.path)).toEqual(['permissions[1].id', 'resources[1].id', 'endpoints[1].id']);
    expect(dups[0]?.message).toBe('duplicate permission id "a" (first defined at permissions[0])');
  });

  it('cites the file of the first definition when provenance is given', () => {
    const provenance = new Map([['permission:a', 'one.yaml']]);
    const r = validateConfig(cfg({ permissions: [perm('a'), perm('a')] }), provenance);
    expect(r.errors[0]?.message).toContain('first defined in one.yaml');
  });

  it('reports dangling implies with a suggestion', () => {
    const r = validateConfig(cfg({ permissions: [perm('users:read'), perm('users:write', ['users:red'])] }));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ code: 'E_UNKNOWN_PERMISSION', path: 'permissions[1].implies[0]' });
    expect(r.errors[0]?.message).toBe('permission "users:red" is not defined (did you mean "users:read"?)');
  });

  it('reports resource actions pointing at unknown permissions', () => {
    const r = validateConfig(cfg({ resources: [{ id: 'users', actions: { read: 'nope' } }] }));
    expect(r.errors[0]).toMatchObject({ code: 'E_UNKNOWN_PERMISSION', path: 'resources[0].actions.read' });
  });

  it('reports endpoint requirement problems', () => {
    const r = validateConfig(
      cfg({
        permissions: [perm('users:read')],
        resources: [{ id: 'users', actions: { read: 'users:read' } }],
        endpoints: [
          ep('a', ['nope']),
          ep('b', ['user.read']),
          ep('c', ['users.delete']),
          ep('d', ['users:read.write']),
        ],
      }),
    );
    expect(r.errors.map((e) => [e.code, e.path])).toEqual([
      ['E_UNKNOWN_PERMISSION', 'endpoints[0].requires[0]'],
      ['E_UNKNOWN_RESOURCE', 'endpoints[1].requires[0]'],
      ['E_UNKNOWN_ACTION', 'endpoints[2].requires[0]'],
      ['E_BAD_REF', 'endpoints[3].requires[0]'],
    ]);
    expect(r.errors[1]?.message).toBe('resource "user" is not defined (did you mean "users"?)');
    expect(r.errors[2]?.message).toBe('resource "users" has no action "delete" (actions: read)');
    expect(r.errors[3]?.message).toBe('"users:read.write" is neither a permission id (a:b) nor a resource action (a.b)');
  });

  it('enforces public / requires consistency', () => {
    const r = validateConfig(
      cfg({
        permissions: [perm('a')],
        endpoints: [ep('empty', []), ep('both', ['a'], true), ep('ok-public', [], true), ep('ok', ['a'])],
      }),
    );
    expect(r.errors.map((e) => [e.code, e.path])).toEqual([
      ['E_EMPTY_REQUIRES', 'endpoints[0]'],
      ['E_PUBLIC_WITH_REQUIRES', 'endpoints[1]'],
    ]);
    expect(r.errors[0]?.message).toBe('endpoint "empty" has no requirements; add requires or set public: true');
  });

  it('reports a cycle with its path', () => {
    const r = validateConfig(cfg({ permissions: [perm('admin', ['users:write']), perm('users:write', ['admin'])] }));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ code: 'E_CYCLE', path: 'permissions' });
    expect(r.errors[0]?.message).toBe('implication cycle detected: admin -> users:write -> admin');
  });

  it('reports a self-cycle', () => {
    const r = validateConfig(cfg({ permissions: [perm('a', ['a'])] }));
    expect(r.errors[0]?.message).toBe('implication cycle detected: a -> a');
  });

  it('collects several independent errors in one run', () => {
    const r = validateConfig(
      cfg({
        permissions: [perm('a', ['a']), perm('b', ['zzz'])],
        endpoints: [ep('x', [])],
      }),
    );
    expect(r.errors.map((e) => e.code).sort()).toEqual(['E_CYCLE', 'E_EMPTY_REQUIRES', 'E_UNKNOWN_PERMISSION']);
  });
});
