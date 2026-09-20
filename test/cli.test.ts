import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { main } from '../src/cli.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const basic = path.join(root, 'examples', 'basic.yaml');
const split = path.join(root, 'examples', 'split');
const invalid = (name: string) => path.join(root, 'examples', 'invalid', name);

async function run(...argv: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = '';
  let stderr = '';
  const code = await main(argv, { stdout: (s) => (stdout += s), stderr: (s) => (stderr += s) });
  return { code, stdout, stderr };
}

describe('permctl validate', () => {
  it('exits 0 for a valid file and directory', async () => {
    const file = await run('validate', basic);
    expect(file.code).toBe(0);
    expect(file.stdout).toContain('valid: 1 file');
    const dir = await run('validate', split);
    expect(dir.code).toBe(0);
    expect(dir.stdout).toContain('valid: 3 files');
  });

  it('exits 1 and prints diagnostics for invalid configs', async () => {
    const r = await run('validate', invalid('cycle.yaml'));
    expect(r.code).toBe(1);
    expect(r.stdout).toBe('');
    expect(r.stderr).toContain('E_CYCLE');
    expect(r.stderr).toContain('users:write -> admin -> users:write');
    const d = await run('validate', invalid('dangling.yaml'));
    expect(d.code).toBe(1);
    expect(d.stderr).toContain('invalid: 4 errors');
    expect(d.stderr).toContain('did you mean "users:read"?');
  });

  it('exits 2 for a missing path', async () => {
    const r = await run('validate', path.join(root, 'nope.yaml'));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('no such file or directory');
  });

  it('emits a single JSON document with --json', async () => {
    const r = await run('validate', invalid('duplicate.yaml'), '--json');
    expect(r.code).toBe(1);
    expect(r.stderr).toBe('');
    const parsed = JSON.parse(r.stdout) as { ok: boolean; errors: { code: string }[]; files: string[] };
    expect(parsed.ok).toBe(false);
    expect(parsed.errors[0]?.code).toBe('E_DUPLICATE_ID');
    expect(parsed.files).toHaveLength(1);
  });
});

describe('permctl check', () => {
  it('allows and denies with exit codes', async () => {
    const allow = await run('check', basic, '--has', 'admin', '--endpoint', 'DELETE /users/{id}');
    expect(allow.code).toBe(0);
    expect(allow.stdout).toMatch(/^ALLOW\s+endpoint "DELETE \/users\/\{id\}"/);
    const deny = await run('check', basic, '--has', 'users:read', '--endpoint', 'DELETE /users/{id}');
    expect(deny.code).toBe(1);
    expect(deny.stdout).toContain('DENY');
    expect(deny.stdout).toContain('unmet: users:write');
  });

  it('supports --resource/--action and --target', async () => {
    expect((await run('check', basic, '--has', 'users:write', '--resource', 'users', '--action', 'write')).code).toBe(0);
    expect((await run('check', basic, '--has', 'users:read', '--target', 'users.write')).code).toBe(1);
  });

  it('flattens comma-separated and repeated --has', async () => {
    const r = await run('check', basic, '--has', 'users:read,billing:write', '--has', 'x', '--endpoint', 'POST /users/{id}/invoices');
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('unknown granted permission: x');
  });

  it('exits 2 on usage errors', async () => {
    expect((await run('check', basic, '--has', 'admin')).code).toBe(2);
    expect((await run('check', basic, '--has', 'admin', '--endpoint', 'x', '--resource', 'users', '--action', 'read')).code).toBe(2);
    expect((await run('check', basic, '--has', 'admin', '--resource', 'users')).code).toBe(2);
    expect((await run('check', basic, '--has', 'admin', '--target', 'users:read')).code).toBe(2);
    expect((await run('frobnicate', basic)).code).toBe(2);
    expect((await run()).code).toBe(2);
    expect((await run('check')).code).toBe(2);
    expect((await run('check', basic, '--bogus')).code).toBe(2);
  });

  it('exits 2 for an unknown target', async () => {
    const r = await run('check', basic, '--has', 'admin', '--endpoint', 'GET /nope');
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('unknown target endpoint "GET /nope"');
    const a = await run('check', basic, '--has', 'admin', '--target', 'users.delete');
    expect(a.code).toBe(2);
    expect(a.stderr).toContain('has no action "delete"');
  });

  it('exits 1 with diagnostics when the config is invalid', async () => {
    const r = await run('check', invalid('cycle.yaml'), '--has', 'admin', '--endpoint', 'GET /users/{id}');
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('E_CYCLE');
  });

  it('prints JSON with --json', async () => {
    const r = await run('check', basic, '--has', 'admin', '--endpoint', 'DELETE /users/{id}', '--json');
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout)).toMatchObject({ allowed: true, unmet: [], target: { kind: 'endpoint', id: 'DELETE /users/{id}' } });
  });
});

describe('permctl explain', () => {
  it('prints the implication path', async () => {
    const r = await run('explain', basic, '--has', 'admin', '--endpoint', 'GET /users/{id}');
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('[ok] users:read   via admin -> users:write -> users:read');
  });

  it('prints unmet requirements on deny', async () => {
    const r = await run('explain', basic, '--has', 'users:read', '--endpoint', 'DELETE /users/{id}');
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('DENY');
    expect(r.stdout).toContain('[--] users.write -> users:write   unmet (granted: users:read)');
  });

  it('reports public endpoints', async () => {
    const r = await run('explain', basic, '--endpoint', 'GET /health');
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('public endpoint');
  });

  it('prints JSON with --json', async () => {
    const r = await run('explain', basic, '--has', 'admin', '--resource', 'users', '--action', 'read', '--json');
    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.stdout) as { requirements: { path: string[] }[] };
    expect(parsed.requirements[0]?.path).toEqual(['admin', 'users:write', 'users:read']);
  });
});

describe('permctl misc', () => {
  it('handles --help and --version', async () => {
    const h = await run('--help');
    expect(h.code).toBe(0);
    expect(h.stdout).toContain('Usage:');
    const v = await run('--version');
    expect(v.code).toBe(0);
    expect(v.stdout).toMatch(/^permctl \d+\.\d+\.\d+/);
  });

  const built = path.join(root, 'dist', 'cli.js');
  it.skipIf(!existsSync(built))('runs as a built executable (dist/cli.js)', async () => {
    const exec = promisify(execFile);
    const ok = await exec(process.execPath, [built, 'check', basic, '--has', 'admin', '--endpoint', 'DELETE /users/{id}']);
    expect(ok.stdout).toContain('ALLOW');
    await expect(exec(process.execPath, [built, 'check', basic, '--has', 'users:read', '--target', 'users.write'])).rejects.toMatchObject({ code: 1 });
  });
});
