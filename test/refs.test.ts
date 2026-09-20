import { describe, expect, it } from 'vitest';
import { parseRequirementRef, parseTarget, isPermissionId, isResourceId } from '../src/refs.js';

describe('parseRequirementRef', () => {
  it('parses permission ids', () => {
    expect(parseRequirementRef('users:read')).toEqual({ kind: 'permission', raw: 'users:read', permission: 'users:read' });
    expect(parseRequirementRef('admin')).toEqual({ kind: 'permission', raw: 'admin', permission: 'admin' });
    expect(parseRequirementRef('a:b:c')).toMatchObject({ kind: 'permission' });
  });

  it('parses resource-action references', () => {
    expect(parseRequirementRef('users.write')).toEqual({
      kind: 'resourceAction',
      raw: 'users.write',
      resource: 'users',
      action: 'write',
    });
  });

  it('rejects strings matching neither grammar', () => {
    for (const bad of ['a.b.c', 'a:b.c', 'Users.read', '', 'users:', ':read', 'users..read', 'a b']) {
      expect(parseRequirementRef(bad), bad).toBeNull();
    }
  });
});

describe('id predicates', () => {
  it('distinguishes permission and resource ids', () => {
    expect(isPermissionId('users:read')).toBe(true);
    expect(isPermissionId('users.read')).toBe(false);
    expect(isResourceId('users')).toBe(true);
    expect(isResourceId('users:read')).toBe(false);
  });
});

describe('parseTarget', () => {
  it('treats resource.action as a resource action and anything else as an endpoint', () => {
    expect(parseTarget('users.write')).toEqual({ kind: 'resourceAction', resource: 'users', action: 'write' });
    expect(parseTarget('GET /users/{id}')).toEqual({ kind: 'endpoint', id: 'GET /users/{id}' });
  });
});
