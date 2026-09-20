#!/usr/bin/env node
/**
 * permctl: validate a permission config, or check / explain whether a set of
 * granted permissions allows an endpoint or resource action.
 */
import { parseArgs } from 'node:util';
import { ConfigError, TargetNotFoundError } from './errors.js';
import { renderCheck, renderDiagnostics, renderExplain, renderValidate } from './cli-format.js';
import { LoadError, loadConfig } from './loader.js';
import { buildModel } from './model.js';
import { RESOURCE_ACTION_RE } from './refs.js';
import type { Target } from './types.js';
import { validateConfig } from './validate.js';

export const VERSION = '0.1.0';

export const EXIT_OK = 0;
export const EXIT_DENIED_OR_INVALID = 1;
export const EXIT_USAGE = 2;

export const USAGE = `permctl - declarative permission DAG for API endpoints and resources

Usage:
  permctl validate <path> [--json]
  permctl check   <path> --has <perm>[,<perm>...] [--has ...] <target> [--json]
  permctl explain <path> --has <perm>[,<perm>...] [--has ...] <target> [--json]
  permctl --help | --version

<path> is a YAML/JSON file or a directory of them (merged).
<target> is exactly one of:
  --endpoint "<id>"                 e.g. --endpoint "DELETE /users/{id}"
  --resource <id> --action <name>   e.g. --resource users --action write
  --target <resource>.<action>      e.g. --target users.write

Exit codes:
  validate        0 valid, 1 invalid, 2 usage or file error
  check/explain   0 allowed, 1 denied or invalid config, 2 usage, unknown target, or file error
`;

export interface CliIO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}

interface Parsed {
  command: string | undefined;
  path: string | undefined;
  has: string[];
  json: boolean;
  target: Target | undefined;
}

class UsageError extends Error {}

function parse(argv: string[]): Parsed {
  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        has: { type: 'string', multiple: true },
        endpoint: { type: 'string' },
        resource: { type: 'string' },
        action: { type: 'string' },
        target: { type: 'string' },
        json: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
    }));
  } catch (e) {
    throw new UsageError((e as Error).message);
  }
  if (values.help) return { command: 'help', path: undefined, has: [], json: false, target: undefined };
  if (values.version) return { command: 'version', path: undefined, has: [], json: false, target: undefined };

  const [command, path, ...rest] = positionals;
  if (rest.length) throw new UsageError(`unexpected argument "${rest[0]}"`);

  const has = (values.has ?? [])
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

  const forms = [values.endpoint !== undefined, values.resource !== undefined || values.action !== undefined, values.target !== undefined];
  const given = forms.filter(Boolean).length;
  if (given > 1) throw new UsageError('give exactly one of --endpoint, --resource/--action, or --target');

  let target: Target | undefined;
  if (values.endpoint !== undefined) {
    if (!values.endpoint) throw new UsageError('--endpoint requires a non-empty id');
    target = { kind: 'endpoint', id: values.endpoint };
  } else if (values.resource !== undefined || values.action !== undefined) {
    if (!values.resource || !values.action) throw new UsageError('--resource and --action must be given together');
    target = { kind: 'resourceAction', resource: values.resource, action: values.action };
  } else if (values.target !== undefined) {
    const m = RESOURCE_ACTION_RE.exec(values.target);
    if (!m) throw new UsageError(`--target must look like <resource>.<action>, got "${values.target}"`);
    target = { kind: 'resourceAction', resource: m[1] as string, action: m[2] as string };
  }

  return { command, path, has, json: values.json, target };
}

/** Run the CLI. Returns the process exit code; never throws for user errors. */
export async function main(argv: string[], io: CliIO = defaultIO()): Promise<number> {
  let parsed: Parsed;
  try {
    parsed = parse(argv);
  } catch (e) {
    io.stderr(`error: ${(e as Error).message}\n\n${USAGE}`);
    return EXIT_USAGE;
  }

  if (parsed.command === 'help' || parsed.command === undefined) {
    (parsed.command === 'help' ? io.stdout : io.stderr)(USAGE);
    return parsed.command === 'help' ? EXIT_OK : EXIT_USAGE;
  }
  if (parsed.command === 'version') {
    io.stdout(`permctl ${VERSION}\n`);
    return EXIT_OK;
  }
  if (!['validate', 'check', 'explain'].includes(parsed.command)) {
    io.stderr(`error: unknown command "${parsed.command}"\n\n${USAGE}`);
    return EXIT_USAGE;
  }
  if (!parsed.path) {
    io.stderr(`error: ${parsed.command} needs a <path>\n\n${USAGE}`);
    return EXIT_USAGE;
  }
  const opts = { json: parsed.json };

  let loaded;
  try {
    loaded = await loadConfig(parsed.path);
  } catch (e) {
    if (e instanceof LoadError) {
      const out = renderDiagnostics(e.diagnostics, opts);
      io.stdout(out.stdout);
      io.stderr(out.stderr);
      return EXIT_USAGE;
    }
    throw e;
  }

  const validation = validateConfig(loaded.config, loaded.provenance);
  const schemaErrors = loaded.diagnostics.filter((d) => d.severity === 'error');
  const full = {
    ok: validation.ok && schemaErrors.length === 0,
    errors: [...schemaErrors, ...validation.errors],
    warnings: [...loaded.diagnostics.filter((d) => d.severity === 'warning'), ...validation.warnings],
  };

  if (parsed.command === 'validate') {
    const out = renderValidate(full, loaded.files, opts);
    io.stdout(out.stdout);
    io.stderr(out.stderr);
    return full.ok ? EXIT_OK : EXIT_DENIED_OR_INVALID;
  }

  if (!full.ok) {
    const out = renderDiagnostics([...full.errors, ...full.warnings], opts);
    io.stdout(out.stdout);
    io.stderr(out.stderr);
    return EXIT_DENIED_OR_INVALID;
  }
  if (!parsed.target) {
    io.stderr(`error: ${parsed.command} needs a target (--endpoint, --resource/--action, or --target)\n\n${USAGE}`);
    return EXIT_USAGE;
  }

  const model = buildModel(loaded.config, loaded.provenance);
  try {
    if (parsed.command === 'check') {
      const result = model.check(parsed.has, parsed.target);
      io.stdout(renderCheck(result, opts).stdout);
      return result.allowed ? EXIT_OK : EXIT_DENIED_OR_INVALID;
    }
    const result = model.explain(parsed.has, parsed.target);
    io.stdout(renderExplain(result, parsed.has, opts).stdout);
    return result.allowed ? EXIT_OK : EXIT_DENIED_OR_INVALID;
  } catch (e) {
    if (e instanceof TargetNotFoundError) {
      if (opts.json) io.stdout(JSON.stringify({ error: e.message, target: e.target }, null, 2) + '\n');
      else io.stderr(`error: ${e.message}\n`);
      return EXIT_USAGE;
    }
    if (e instanceof ConfigError) {
      const out = renderDiagnostics(e.diagnostics, opts);
      io.stdout(out.stdout);
      io.stderr(out.stderr);
      return EXIT_DENIED_OR_INVALID;
    }
    throw e;
  }
}

function defaultIO(): CliIO {
  return {
    stdout: (s) => process.stdout.write(s),
    stderr: (s) => process.stderr.write(s),
  };
}

const invokedDirectly = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  const url = new URL(import.meta.url).pathname;
  return url === entry || url.endsWith('/dist/cli.js') && entry.endsWith('permctl') || url === new URL(`file://${entry}`).pathname;
})();

if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      process.stderr.write(`fatal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
      process.exit(EXIT_USAGE);
    },
  );
}
