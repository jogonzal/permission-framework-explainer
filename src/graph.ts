/**
 * Pure graph algorithms over the permission implication graph.
 * Nodes are permission ids; an edge a -> b means "a implies b".
 * These functions know nothing about config files or endpoints.
 */
import type { PermissionDef } from './types.js';

export type Graph = ReadonlyMap<string, readonly string[]>;

/** Build an adjacency map. Edges to undefined nodes are dropped (validation reports them). */
export function buildGraph(perms: readonly PermissionDef[]): Graph {
  const known = new Set(perms.map((p) => p.id));
  const g = new Map<string, string[]>();
  for (const p of perms) {
    if (!g.has(p.id)) g.set(p.id, []);
    const out = g.get(p.id) as string[];
    for (const target of p.implies) {
      if (known.has(target) && !out.includes(target)) out.push(target);
    }
  }
  return g;
}

/**
 * Find a cycle using iterative three-color DFS.
 * Returns the cycle as a path that starts and ends on the same node,
 * e.g. `['a', 'b', 'a']` or `['a', 'a']` for a self-loop. Returns null for a DAG.
 */
export function findCycle(g: Graph): string[] | null {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const v of g.keys()) color.set(v, WHITE);

  for (const root of g.keys()) {
    if (color.get(root) !== WHITE) continue;
    // Each frame: node + index of the next neighbor to visit.
    const stack: { node: string; next: number }[] = [{ node: root, next: 0 }];
    color.set(root, GRAY);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1] as { node: string; next: number };
      const neighbors = g.get(frame.node) ?? [];
      if (frame.next < neighbors.length) {
        const w = neighbors[frame.next] as string;
        frame.next++;
        const c = color.get(w);
        if (c === GRAY) {
          const path = stack.map((f) => f.node);
          const start = path.indexOf(w);
          return [...path.slice(start), w];
        }
        if (c === WHITE) {
          color.set(w, GRAY);
          stack.push({ node: w, next: 0 });
        }
      } else {
        color.set(frame.node, BLACK);
        stack.pop();
      }
    }
  }
  return null;
}

/**
 * Compute the transitive closure of every node. Each closure includes the node itself.
 * Memoized DFS: every node is expanded exactly once. Precondition: the graph is acyclic.
 */
export function computeClosures(g: Graph): Map<string, Set<string>> {
  const memo = new Map<string, Set<string>>();
  const visit = (v: string): Set<string> => {
    const cached = memo.get(v);
    if (cached) return cached;
    const out = new Set<string>([v]);
    // Store before recursing so a cycle (should not happen post-validation) cannot loop forever.
    memo.set(v, out);
    for (const w of g.get(v) ?? []) {
      for (const x of visit(w)) out.add(x);
    }
    return out;
  };
  for (const v of g.keys()) visit(v);
  return memo;
}

/**
 * Shortest implication path from `from` to `to`, inclusive of both ends (BFS).
 * Returns `[from]` when they are equal, or null when `to` is unreachable.
 */
export function findPath(g: Graph, from: string, to: string): string[] | null {
  if (!g.has(from)) return null;
  if (from === to) return [from];
  const parent = new Map<string, string>();
  const queue: string[] = [from];
  const seen = new Set<string>([from]);
  while (queue.length > 0) {
    const v = queue.shift() as string;
    for (const w of g.get(v) ?? []) {
      if (seen.has(w)) continue;
      seen.add(w);
      parent.set(w, v);
      if (w === to) {
        const path = [to];
        let cur = to;
        while (cur !== from) {
          cur = parent.get(cur) as string;
          path.push(cur);
        }
        return path.reverse();
      }
      queue.push(w);
    }
  }
  return null;
}
