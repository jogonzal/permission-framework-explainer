import { describe, expect, it } from 'vitest';
import { buildGraph, computeClosures, findCycle, findPath } from '../src/graph.js';
import type { PermissionDef } from '../src/types.js';

const perms = (spec: Record<string, string[]>): PermissionDef[] =>
  Object.entries(spec).map(([id, implies]) => ({ id, implies }));

describe('buildGraph', () => {
  it('drops edges to unknown nodes and de-duplicates', () => {
    const g = buildGraph(perms({ a: ['b', 'zzz', 'b'], b: [] }));
    expect(g.get('a')).toEqual(['b']);
    expect(g.get('b')).toEqual([]);
  });
});

describe('computeClosures', () => {
  it('leaf closure is itself', () => {
    const c = computeClosures(buildGraph(perms({ leaf: [] })));
    expect([...(c.get('leaf') as Set<string>)]).toEqual(['leaf']);
  });

  it('follows chains transitively', () => {
    const g = buildGraph(perms({ 'users:read': [], 'users:write': ['users:read'], admin: ['users:write'] }));
    const c = computeClosures(g);
    expect(c.get('admin')).toEqual(new Set(['admin', 'users:write', 'users:read']));
    expect(c.get('users:write')).toEqual(new Set(['users:write', 'users:read']));
  });

  it('handles a diamond without duplicates and memoizes shared subtrees', () => {
    const g = buildGraph(perms({ a: ['b', 'c'], b: ['d'], c: ['d'], d: [] }));
    const c = computeClosures(g);
    expect(c.get('a')).toEqual(new Set(['a', 'b', 'c', 'd']));
    expect(c.get('b')?.has('d')).toBe(true);
    expect(c.get('c')?.has('d')).toBe(true);
    expect(c.size).toBe(4);
  });
});

describe('findCycle', () => {
  it('returns null for a DAG', () => {
    expect(findCycle(buildGraph(perms({ a: ['b', 'c'], b: ['d'], c: ['d'], d: [] })))).toBeNull();
  });

  it('detects a self-cycle', () => {
    expect(findCycle(buildGraph(perms({ a: ['a'] })))).toEqual(['a', 'a']);
  });

  it('detects a two-node cycle', () => {
    expect(findCycle(buildGraph(perms({ a: ['b'], b: ['a'] })))).toEqual(['a', 'b', 'a']);
  });

  it('reports only the cycle, not the prefix leading to it', () => {
    const g = buildGraph(perms({ x: ['a'], a: ['b'], b: ['c'], c: ['a'] }));
    expect(findCycle(g)).toEqual(['a', 'b', 'c', 'a']);
  });

  it('is deterministic for a given insertion order', () => {
    const g1 = buildGraph(perms({ p: ['q'], q: ['p'], r: ['s'], s: ['r'] }));
    const g2 = buildGraph(perms({ p: ['q'], q: ['p'], r: ['s'], s: ['r'] }));
    expect(findCycle(g1)).toEqual(findCycle(g2));
  });
});

describe('findPath', () => {
  const g = buildGraph(perms({ admin: ['users:write', 'users:read'], 'users:write': ['users:read'], 'users:read': [], other: [] }));

  it('returns [from] when from === to', () => {
    expect(findPath(g, 'admin', 'admin')).toEqual(['admin']);
  });

  it('prefers the shortest path', () => {
    expect(findPath(g, 'admin', 'users:read')).toEqual(['admin', 'users:read']);
  });

  it('walks multi-hop paths', () => {
    const chain = buildGraph(perms({ a: ['b'], b: ['c'], c: [] }));
    expect(findPath(chain, 'a', 'c')).toEqual(['a', 'b', 'c']);
  });

  it('returns null when unreachable or from is unknown', () => {
    expect(findPath(g, 'other', 'users:read')).toBeNull();
    expect(findPath(g, 'nope', 'users:read')).toBeNull();
  });
});
