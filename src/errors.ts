import type { Diagnostic, DiagnosticCode, Severity, Target } from './types.js';

/** Thrown by `buildModel` / `loadModel` when the configuration is invalid. */
export class ConfigError extends Error {
  readonly diagnostics: Diagnostic[];

  constructor(diagnostics: Diagnostic[]) {
    const errors = diagnostics.filter((d) => d.severity === 'error');
    super(
      `invalid permission configuration (${errors.length} error${errors.length === 1 ? '' : 's'}):\n` +
        diagnostics.map((d) => '  ' + formatDiagnostic(d)).join('\n'),
    );
    this.name = 'ConfigError';
    this.diagnostics = diagnostics;
  }
}

/** Thrown by `check` / `explain` when the endpoint or resource action does not exist. */
export class TargetNotFoundError extends Error {
  readonly target: Target;

  constructor(target: Target, detail?: string) {
    super(`unknown target ${formatTarget(target)}${detail ? `: ${detail}` : ''}`);
    this.name = 'TargetNotFoundError';
    this.target = target;
  }
}

export function formatTarget(target: Target): string {
  return target.kind === 'endpoint'
    ? `endpoint "${target.id}"`
    : `resource action "${target.resource}.${target.action}"`;
}

export function severityOf(code: DiagnosticCode): Severity {
  return code.startsWith('W_') ? 'warning' : 'error';
}

export function diagnostic(
  code: DiagnosticCode,
  message: string,
  location: { path?: string; file?: string } = {},
): Diagnostic {
  const d: Diagnostic = { code, severity: severityOf(code), message };
  if (location.path !== undefined) d.path = location.path;
  if (location.file !== undefined) d.file = location.file;
  return d;
}

/** One-line rendering: `<severity> <CODE> [<file>] <path>: <message>`. */
export function formatDiagnostic(d: Diagnostic): string {
  const parts: string[] = [d.severity, d.code];
  if (d.file) parts.push(`[${d.file}]`);
  const location = d.path ? `${d.path}: ` : '';
  return `${parts.join(' ')} ${location}${d.message}`;
}

/** Levenshtein distance, used for "did you mean" hints. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = cur;
  }
  return prev[b.length] ?? 0;
}

/** Returns ` (did you mean "x"?)` for the closest candidate within distance 2, else an empty string. */
export function suggest(needle: string, candidates: Iterable<string>, maxDistance = 2): string {
  let best: { id: string; d: number } | undefined;
  for (const c of candidates) {
    const d = editDistance(needle, c);
    if (d <= maxDistance && (best === undefined || d < best.d)) best = { id: c, d };
  }
  return best ? ` (did you mean "${best.id}"?)` : '';
}
