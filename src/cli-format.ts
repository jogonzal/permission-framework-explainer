/** Renderers for CLI output: human-readable text or a single JSON document. */
import { formatDiagnostic, formatTarget } from './errors.js';
import type { CheckResult, Diagnostic, ExplainResult, RequirementResult, ValidationResult } from './types.js';

export interface RenderOptions {
  json: boolean;
}

export interface Rendered {
  stdout: string;
  stderr: string;
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

export function renderValidate(result: ValidationResult, files: string[], opts: RenderOptions): Rendered {
  if (opts.json) return { stdout: json({ ...result, files }), stderr: '' };
  const lines: string[] = [];
  const all = [...result.errors, ...result.warnings];
  for (const d of all) lines.push(formatDiagnostic(d));
  const summary = result.ok
    ? `valid: ${files.length} file${files.length === 1 ? '' : 's'}, ${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`
    : `invalid: ${result.errors.length} error${result.errors.length === 1 ? '' : 's'}, ${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`;
  return result.ok
    ? { stdout: [...lines, summary].join('\n') + '\n', stderr: '' }
    : { stdout: '', stderr: [...lines, summary].join('\n') + '\n' };
}

export function renderDiagnostics(diagnostics: Diagnostic[], opts: RenderOptions): Rendered {
  if (opts.json) return { stdout: json({ ok: false, errors: diagnostics.filter((d) => d.severity === 'error'), warnings: diagnostics.filter((d) => d.severity === 'warning') }), stderr: '' };
  return { stdout: '', stderr: diagnostics.map(formatDiagnostic).join('\n') + '\n' };
}

function verdict(allowed: boolean): string {
  return allowed ? 'ALLOW ' : 'DENY  ';
}

function unknownLine(unknownGranted: string[]): string[] {
  return unknownGranted.length ? [`  warning W_UNKNOWN_GRANTED: unknown granted permission${unknownGranted.length === 1 ? '' : 's'}: ${unknownGranted.join(', ')}`] : [];
}

export function renderCheck(result: CheckResult, opts: RenderOptions): Rendered {
  if (opts.json) return { stdout: json(result), stderr: '' };
  const lines = [`${verdict(result.allowed)} ${formatTarget(result.target)}`];
  if (result.public) lines.push('  public endpoint; no permissions required');
  else if (result.unmet.length) lines.push(`  unmet: ${result.unmet.join(', ')}`);
  lines.push(...unknownLine(result.unknownGranted));
  return { stdout: lines.join('\n') + '\n', stderr: '' };
}

function requirementLine(r: RequirementResult, granted: string[]): string {
  const label = r.ref.kind === 'resourceAction' ? `${r.ref.raw} -> ${r.permission}` : r.permission;
  if (!r.satisfied) return `  [--] ${label}   unmet (granted: ${granted.length ? granted.join(', ') : 'nothing'})`;
  const path = r.path ?? [];
  const via = path.length <= 1 ? 'granted directly' : `via ${path.join(' -> ')}`;
  return `  [ok] ${label}   ${via}`;
}

export function renderExplain(result: ExplainResult, granted: string[], opts: RenderOptions): Rendered {
  if (opts.json) return { stdout: json(result), stderr: '' };
  const lines = [`${verdict(result.allowed)} ${formatTarget(result.target)}`];
  if (result.public) lines.push('  public endpoint; no permissions required');
  for (const r of result.requirements) lines.push(requirementLine(r, granted));
  lines.push(...unknownLine(result.unknownGranted));
  return { stdout: lines.join('\n') + '\n', stderr: '' };
}
