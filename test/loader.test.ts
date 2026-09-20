import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ConfigError } from '../src/errors.js';
import { LoadError, loadConfig, loadDocuments, loadModel } from '../src/loader.js';
import { validateConfig } from '../src/validate.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = (...p: string[]) => path.join(here, 'fixtures', ...p);
const examples = (...p: string[]) => path.join(here, '..', 'examples', ...p);

describe('loadDocuments / loadConfig', () => {
  it('loads a YAML file', async () => {
    const loaded = await loadConfig(examples('basic.yaml'));
    expect(loaded.diagnostics).toEqual([]);
    expect(loaded.files).toEqual([examples('basic.yaml')]);
    expect(loaded.config.permissions.map((p) => p.id)).toEqual(['users:read', 'users:write', 'billing:write', 'admin']);
  });

  it('loads JSON and YAML to the same config', async () => {
    const yaml = await loadConfig(examples('basic.yaml'));
    const json = await loadConfig(examples('basic.json'));
    expect(json.config).toEqual(yaml.config);
  });

  it('merges a directory recursively, in sorted order, skipping other files', async () => {
    const loaded = await loadConfig(fixtures('dir'));
    expect(loaded.files).toEqual(['10-permissions.yaml', '20-resources.json', path.join('nested', '30-endpoints.yml')]);
    expect(loaded.config.permissions).toHaveLength(2);
    expect(loaded.config.resources).toHaveLength(1);
    expect(loaded.config.endpoints).toHaveLength(1);
    expect(validateConfig(loaded.config).ok).toBe(true);
    expect(loaded.provenance.get('endpoint:GET /users/{id}')).toBe(path.join('nested', '30-endpoints.yml'));
  });

  it('matches the split example to the single-file example', async () => {
    const single = await loadConfig(examples('basic.yaml'));
    const split = await loadConfig(examples('split'));
    expect(split.config).toEqual(single.config);
  });

  it('reports duplicates across files with both file names', async () => {
    const loaded = await loadConfig(fixtures('dup'));
    const r = validateConfig(loaded.config, loaded.provenance);
    expect(r.errors[0]).toMatchObject({ code: 'E_DUPLICATE_ID', file: 'a.yaml' });
    expect(r.errors[0]?.message).toContain('first defined in a.yaml');
  });

  it('loads an empty directory as an empty config', async () => {
    const loaded = await loadConfig(fixtures('empty'));
    expect(loaded.config).toEqual({ permissions: [], resources: [], endpoints: [] });
    expect(validateConfig(loaded.config).ok).toBe(true);
  });

  it('fails on a missing path', async () => {
    await expect(loadDocuments(fixtures('nope.yaml'))).rejects.toBeInstanceOf(LoadError);
    await expect(loadDocuments(fixtures('nope.yaml'))).rejects.toThrow('no such file or directory');
  });

  it('fails on malformed YAML with position info', async () => {
    const err = await loadDocuments(fixtures('bad.yaml')).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LoadError);
    expect((err as LoadError).diagnostics[0]).toMatchObject({ code: 'E_FILE', file: fixtures('bad.yaml') });
    expect((err as LoadError).message).toMatch(/line \d+/);
  });

  it('fails on malformed JSON', async () => {
    await expect(loadDocuments(fixtures('bad.json'))).rejects.toThrow('invalid JSON');
  });

  it('rejects multi-document YAML', async () => {
    await expect(loadDocuments(fixtures('multi.yaml'))).rejects.toThrow('multi-document YAML is not supported');
  });
});

describe('loadModel', () => {
  it('builds a working model from the example', async () => {
    const model = await loadModel(examples('basic.yaml'));
    expect(model.check(['admin'], 'DELETE /users/{id}').allowed).toBe(true);
  });

  it('throws ConfigError for the invalid examples', async () => {
    for (const name of ['cycle.yaml', 'dangling.yaml', 'duplicate.yaml']) {
      await expect(loadModel(examples('invalid', name)), name).rejects.toBeInstanceOf(ConfigError);
    }
    const err = (await loadModel(examples('invalid', 'dangling.yaml')).catch((e: unknown) => e)) as ConfigError;
    expect(err.diagnostics.map((d) => d.code).sort()).toEqual([
      'E_EMPTY_REQUIRES',
      'E_UNKNOWN_ACTION',
      'E_UNKNOWN_PERMISSION',
      'E_UNKNOWN_RESOURCE',
    ]);
  });

  it('throws ConfigError for schema problems', async () => {
    const err = (await loadModel(fixtures('schema-bad.yaml')).catch((e: unknown) => e)) as ConfigError;
    expect(err).toBeInstanceOf(ConfigError);
    expect(err.diagnostics[0]).toMatchObject({ code: 'E_SCHEMA', path: 'permissions[0]' });
  });
});

describe('examples/github', () => {
  it('validates and models GitHub roles', async () => {
    const model = await loadModel(examples('github'));
    expect(model.check(['role:write'], 'PUT /repos/{owner}/{repo}/pulls/{number}/merge').allowed).toBe(true);
    expect(model.check(['role:triage'], 'PUT /repos/{owner}/{repo}/pulls/{number}/merge').allowed).toBe(false);
    const transfer = model.explain(['role:admin'], 'POST /repos/{owner}/{repo}/transfer');
    expect(transfer.allowed).toBe(false);
    expect(transfer.requirements.map((r) => r.satisfied)).toEqual([true, false]);
    expect(model.explain(['org:owner'], 'POST /repos/{owner}/{repo}/transfer').allowed).toBe(true);
    // An org owner holds everything except the authenticated user's own profile permissions.
    const notImplied = model.permissions().map((p) => p.id).filter((id) => !model.closure('org:owner').has(id));
    expect(notImplied).toEqual(['users:read', 'users:write']);
  });
});
