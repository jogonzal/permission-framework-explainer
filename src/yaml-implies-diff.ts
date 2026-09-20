/**
 * Surgical edits to permission YAML: remove selected `implies` targets and
 * emit a unified diff against the original source text.
 */

export type YamlSource = {
  name: string;
  text: string;
};

export type ImpliesEdge = {
  from: string;
  to: string;
};

export type YamlDiffHunk = {
  name: string;
  diff: string;
};

function unquote(raw: string): string {
  const value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function splitLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n');
  if (normalized === '') return [];
  const parts = normalized.split('\n');
  if (parts.at(-1) === '') parts.pop();
  return parts;
}

function leadingWs(line: string): number {
  const match = /^( *)/.exec(line);
  return match?.[1]?.length ?? 0;
}

function isBlankOrComment(line: string): boolean {
  return /^\s*(#.*)?$/.test(line);
}

function parseFlowItems(inner: string): string[] {
  if (inner.trim() === '') return [];
  const items: string[] = [];
  let buf = '';
  let quote: '"' | "'" | null = null;
  for (const ch of inner) {
    if (quote) {
      buf += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === ',') {
      const item = unquote(buf);
      if (item) items.push(item);
      buf = '';
      continue;
    }
    buf += ch;
  }
  const last = unquote(buf);
  if (last) items.push(last);
  return items;
}

function formatFlowList(items: readonly string[]): string {
  return `[${items.join(', ')}]`;
}

function flowItemId(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed === '[' || trimmed === ']' || trimmed === '[],' || trimmed === '[]') return null;
  const withoutComma = trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed;
  const unwrapped = withoutComma.replace(/^\[/, '').replace(/\]$/, '');
  const id = unquote(unwrapped);
  return id || null;
}

const ID_LINE = /^(\s*)-\s+id:\s*(.+?)\s*$/;
const IMPLIES_INLINE = /^(\s*)implies:\s*\[(.*)\]\s*$/;
const IMPLIES_KEY = /^(\s*)implies:\s*$/;
const BLOCK_ITEM = /^(\s*)-\s+(.+?)\s*$/;

function findItemEnd(lines: readonly string[], start: number, itemIndent: number): number {
  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end] as string;
    if (isBlankOrComment(line)) {
      end += 1;
      continue;
    }
    if (leadingWs(line) <= itemIndent) break;
    end += 1;
  }
  return end;
}

function removeImpliesFromBlock(
  lines: string[],
  start: number,
  end: number,
  remove: ReadonlySet<string>,
): number {
  for (let i = start + 1; i < end; i++) {
    const line = lines[i] as string;
    const inline = IMPLIES_INLINE.exec(line);
    if (inline) {
      const indent = inline[1] as string;
      const kept = parseFlowItems(inline[2] ?? '').filter((id) => !remove.has(id));
      if (kept.length === parseFlowItems(inline[2] ?? '').length) return 0;
      if (kept.length === 0) {
        lines.splice(i, 1);
        return -1;
      }
      lines[i] = `${indent}implies: ${formatFlowList(kept)}`;
      return 0;
    }

    const key = IMPLIES_KEY.exec(line);
    if (!key) continue;
    const keyIndent = (key[1] as string).length;
    let j = i + 1;
    while (j < end && isBlankOrComment(lines[j] as string)) j += 1;
    const first = j < end ? (lines[j] as string).trim() : '';

    if (first.startsWith('[')) {
      let close = j;
      while (close < end && !(lines[close] as string).includes(']')) close += 1;
      if (close >= end) return 0;
      const itemLines = lines.slice(j, close + 1);
      const keptLines = itemLines.filter((itemLine) => {
        const id = flowItemId(itemLine);
        return id === null || !remove.has(id);
      });
      const originalIds = itemLines.map(flowItemId).filter((id): id is string => id !== null);
      const removedAny = originalIds.some((id) => remove.has(id));
      if (!removedAny) return 0;
      const remainingIds = originalIds.filter((id) => !remove.has(id));
      if (remainingIds.length === 0) {
        lines.splice(i, close - i + 1);
        return -(close - i + 1);
      }
      lines.splice(j, close - j + 1, ...keptLines);
      return keptLines.length - (close - j + 1);
    }

    if (BLOCK_ITEM.test(lines[j] ?? '')) {
      let k = j;
      const kept: string[] = [];
      let removedAny = false;
      while (k < end) {
        const itemLine = lines[k] as string;
        if (isBlankOrComment(itemLine)) {
          kept.push(itemLine);
          k += 1;
          continue;
        }
        const item = BLOCK_ITEM.exec(itemLine);
        if (!item || leadingWs(itemLine) <= keyIndent) break;
        const id = unquote(item[2] as string);
        if (remove.has(id)) removedAny = true;
        else kept.push(itemLine);
        k += 1;
      }
      if (!removedAny) return 0;
      const keptItems = kept.filter((entry) => BLOCK_ITEM.test(entry));
      if (keptItems.length === 0) {
        lines.splice(i, k - i);
        return -(k - i);
      }
      lines.splice(j, k - j, ...kept);
      return kept.length - (k - j);
    }
  }
  return 0;
}

/** Apply `implies` removals to a YAML document, preserving surrounding formatting. */
export function applyImpliesRemovals(text: string, removeByFrom: ReadonlyMap<string, ReadonlySet<string>>): string {
  if (removeByFrom.size === 0) return text;
  const lines = splitLines(text);
  let i = 0;
  while (i < lines.length) {
    const match = ID_LINE.exec(lines[i] as string);
    if (!match) {
      i += 1;
      continue;
    }
    const id = unquote(match[2] as string);
    const itemIndent = (match[1] as string).length;
    const end = findItemEnd(lines, i, itemIndent);
    const remove = removeByFrom.get(id);
    if (remove && remove.size > 0) {
      const delta = removeImpliesFromBlock(lines, i, end, remove);
      i = end + delta;
    } else {
      i = end;
    }
  }
  const trailing = text.endsWith('\n') || text.endsWith('\r\n') ? '\n' : '';
  return `${lines.join('\n')}${trailing}`;
}

function lcsTable(a: readonly string[], b: readonly string[]): number[][] {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    const row = dp[i] as number[];
    const next = dp[i + 1] as number[];
    for (let j = b.length - 1; j >= 0; j--) {
      row[j] = a[i] === b[j] ? (next[j + 1] as number) + 1 : Math.max(next[j] as number, row[j + 1] as number);
    }
  }
  return dp;
}

type DiffOp = { kind: 'eq' | 'del' | 'add'; line: string };

function diffOps(a: readonly string[], b: readonly string[]): DiffOp[] {
  const dp = lcsTable(a, b);
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ kind: 'eq', line: a[i] as string });
      i += 1;
      j += 1;
    } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
      ops.push({ kind: 'del', line: a[i] as string });
      i += 1;
    } else {
      ops.push({ kind: 'add', line: b[j] as string });
      j += 1;
    }
  }
  while (i < a.length) {
    ops.push({ kind: 'del', line: a[i] as string });
    i += 1;
  }
  while (j < b.length) {
    ops.push({ kind: 'add', line: b[j] as string });
    j += 1;
  }
  return ops;
}

/** Unified diff of two texts, or an empty string when they match. */
export function unifiedDiff(name: string, before: string, after: string, context = 3): string {
  const a = splitLines(before);
  const b = splitLines(after);
  const ops = diffOps(a, b);
  if (ops.every((op) => op.kind === 'eq')) return '';

  const changeIdx: number[] = [];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i]?.kind !== 'eq') changeIdx.push(i);
  }

  const hunks: string[] = [`--- ${name}`, `+++ ${name}`];
  let cursor = 0;
  let oldLine = 1;
  let newLine = 1;

  while (cursor < changeIdx.length) {
    const startChange = changeIdx[cursor] as number;
    let endChange = startChange;
    let look = cursor + 1;
    while (look < changeIdx.length && (changeIdx[look] as number) <= endChange + context * 2 + 1) {
      endChange = changeIdx[look] as number;
      look += 1;
    }
    cursor = look;

    const hunkStart = Math.max(0, startChange - context);
    const hunkEnd = Math.min(ops.length, endChange + context + 1);

    for (let i = 0; i < hunkStart; i++) {
      const op = ops[i] as DiffOp;
      if (op.kind === 'eq' || op.kind === 'del') oldLine += 1;
      if (op.kind === 'eq' || op.kind === 'add') newLine += 1;
    }

    let oldCount = 0;
    let newCount = 0;
    const body: string[] = [];
    for (let i = hunkStart; i < hunkEnd; i++) {
      const op = ops[i] as DiffOp;
      if (op.kind === 'eq') {
        body.push(` ${op.line}`);
        oldCount += 1;
        newCount += 1;
      } else if (op.kind === 'del') {
        body.push(`-${op.line}`);
        oldCount += 1;
      } else {
        body.push(`+${op.line}`);
        newCount += 1;
      }
    }

    hunks.push(`@@ -${oldLine},${oldCount} +${newLine},${newCount} @@`);
    hunks.push(...body);

    for (let i = hunkStart; i < hunkEnd; i++) {
      const op = ops[i] as DiffOp;
      if (op.kind === 'eq' || op.kind === 'del') oldLine += 1;
      if (op.kind === 'eq' || op.kind === 'add') newLine += 1;
    }
  }

  return hunks.join('\n') + '\n';
}

function groupRemovals(edges: readonly ImpliesEdge[]): Map<string, Set<string>> {
  const grouped = new Map<string, Set<string>>();
  for (const edge of edges) {
    const set = grouped.get(edge.from) ?? new Set<string>();
    set.add(edge.to);
    grouped.set(edge.from, set);
  }
  return grouped;
}

/** Diff each source file after removing the given implication edges. */
export function diffImpliesRemovals(sources: readonly YamlSource[], edges: readonly ImpliesEdge[]): YamlDiffHunk[] {
  const removeByFrom = groupRemovals(edges);
  const hunks: YamlDiffHunk[] = [];
  for (const source of sources) {
    const next = applyImpliesRemovals(source.text, removeByFrom);
    if (next === source.text) continue;
    const diff = unifiedDiff(source.name, source.text, next);
    if (diff) hunks.push({ name: source.name, diff });
  }
  return hunks;
}
