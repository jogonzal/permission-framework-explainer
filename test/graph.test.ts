import { describe, expect, it } from 'vitest';
import {
  buildGraph,
  computeClosures,
  edgesOnPaths,
  findAllPaths,
  findCycle,
  findPath,
} from '../src/graph.js';
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

describe('findAllPaths', () => {
  it('returns [[from]] when from === to', () => {
    const g = buildGraph(perms({ admin: ['users:read'], 'users:read': [] }));
    expect(findAllPaths(g, 'admin', 'admin')).toEqual({ paths: [['admin']], truncated: false });
  });

  it('returns a single chain', () => {
    const g = buildGraph(perms({ a: ['b'], b: ['c'], c: [] }));
    expect(findAllPaths(g, 'a', 'c')).toEqual({ paths: [['a', 'b', 'c']], truncated: false });
  });

  it('enumerates both sides of a diamond', () => {
    const g = buildGraph(perms({ a: ['b', 'c'], b: ['d'], c: ['d'], d: [] }));
    expect(findAllPaths(g, 'a', 'd')).toEqual({
      paths: [
        ['a', 'b', 'd'],
        ['a', 'c', 'd'],
      ],
      truncated: false,
    });
  });

  it('returns an empty list when unreachable or a node is unknown', () => {
    const g = buildGraph(perms({ admin: ['users:read'], 'users:read': [], other: [] }));
    expect(findAllPaths(g, 'other', 'users:read')).toEqual({ paths: [], truncated: false });
    expect(findAllPaths(g, 'nope', 'users:read')).toEqual({ paths: [], truncated: false });
    expect(findAllPaths(g, 'admin', 'missing')).toEqual({ paths: [], truncated: false });
  });

  it('caps the result and sets truncated when more paths exist', () => {
    const g = buildGraph(perms({ a: ['b', 'c', 'd'], b: ['e'], c: ['e'], d: ['e'], e: [] }));
    expect(findAllPaths(g, 'a', 'e', 2)).toEqual({
      paths: [
        ['a', 'b', 'e'],
        ['a', 'c', 'e'],
      ],
      truncated: true,
    });
  });
});

describe('edgesOnPaths', () => {
  it('deduplicates hops and preserves first-seen order', () => {
    expect(
      edgesOnPaths([
        ['a', 'b', 'd'],
        ['a', 'c', 'd'],
        ['a', 'b', 'd'],
      ]),
    ).toEqual([
      { from: 'a', to: 'b' },
      { from: 'b', to: 'd' },
      { from: 'a', to: 'c' },
      { from: 'c', to: 'd' },
    ]);
  });
});
