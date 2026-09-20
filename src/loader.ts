/**
 * Loading configuration from disk: a single YAML/JSON file or a directory of
 * them (recursive, sorted by relative path, arrays concatenated).
 */
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { parseAllDocuments } from 'yaml';
import { ConfigError, diagnostic } from './errors.js';
import { buildModel, type PermissionModel } from './model.js';
import { parseConfig } from './schema.js';
import type { Config, Diagnostic } from './types.js';
import { provenanceKey, validateConfig, type Provenance } from './validate.js';

export interface LoadedDocument {
  /** Path as given for a file, or relative to the directory root for directory loads. */
  file: string;
  data: unknown;
}

export interface LoadOptions {
  /** File extensions to include when loading a directory. Default: .yaml, .yml, .json */
  extensions?: readonly string[];
}

export interface LoadedConfig {
  config: Config;
  diagnostics: Diagnostic[];
  provenance: Provenance;
  /** Files that were read, in load order. */
  files: string[];
}

const DEFAULT_EXTENSIONS = ['.yaml', '.yml', '.json'] as const;

export class LoadError extends Error {
  readonly diagnostics: Diagnostic[];

  constructor(diagnostics: Diagnostic[]) {
    super(diagnostics.map((d) => d.message).join('\n'));
    this.name = 'LoadError';
    this.diagnostics = diagnostics;
  }
}

function parseDocument(file: string, text: string): unknown {
  if (path.extname(file).toLowerCase() === '.json') {
    try {
      return JSON.parse(text) as unknown;
    } catch (e) {
      throw new LoadError([diagnostic('E_FILE', `${file}: invalid JSON: ${(e as Error).message}`, { file })]);
    }
  }
  const docs = parseAllDocuments(text, { prettyErrors: true });
  if (docs.length > 1) {
    throw new LoadError([
      diagnostic('E_FILE', `${file}: multi-document YAML is not supported; put each document in its own file`, { file }),
    ]);
  }
  const doc = docs[0];
  if (!doc) return null;
  if (doc.errors.length > 0) {
    throw new LoadError(
      doc.errors.map((e) => diagnostic('E_FILE', `${file}: invalid YAML: ${e.message.trim()}`, { file })),
    );
  }
  return doc.toJS() as unknown;
}

async function listFiles(root: string, extensions: readonly string[]): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && extensions.includes(path.extname(entry.name).toLowerCase())) out.push(full);
    }
  };
  await walk(root);
  return out.sort((a, b) => (path.relative(root, a) < path.relative(root, b) ? -1 : 1));
}

/** Read one file or every config file under a directory. Throws {@link LoadError}. */
export async function loadDocuments(target: string, opts: LoadOptions = {}): Promise<LoadedDocument[]> {
  const extensions = opts.extensions ?? DEFAULT_EXTENSIONS;
  let stat;
  try {
    stat = await fs.stat(target);
  } catch {
    throw new LoadError([diagnostic('E_FILE', `${target}: no such file or directory`)]);
  }
  if (stat.isDirectory()) {
    const files = await listFiles(target, extensions);
    const docs: LoadedDocument[] = [];
    for (const full of files) {
      const rel = path.relative(target, full);
      docs.push({ file: rel, data: parseDocument(full, await fs.readFile(full, 'utf8')) });
    }
    return docs;
  }
  return [{ file: target, data: parseDocument(target, await fs.readFile(target, 'utf8')) }];
}

/** Shape-validate each document and concatenate their sections. */
export function mergeDocuments(docs: readonly LoadedDocument[]): {
  config: Config;
  diagnostics: Diagnostic[];
  provenance: Provenance;
} {
  const config: Config = { permissions: [], resources: [], endpoints: [] };
  const diagnostics: Diagnostic[] = [];
  const provenance = new Map<string, string>();
  for (const doc of docs) {
    const parsed = parseConfig(doc.data, doc.file);
    diagnostics.push(...parsed.diagnostics);
    for (const p of parsed.config.permissions) {
      const key = provenanceKey('permission', p.id);
      if (!provenance.has(key)) provenance.set(key, doc.file);
      config.permissions.push(p);
    }
    for (const r of parsed.config.resources) {
      const key = provenanceKey('resource', r.id);
      if (!provenance.has(key)) provenance.set(key, doc.file);
      config.resources.push(r);
    }
    for (const e of parsed.config.endpoints) {
      const key = provenanceKey('endpoint', e.id);
      if (!provenance.has(key)) provenance.set(key, doc.file);
      config.endpoints.push(e);
    }
  }
  return { config, diagnostics, provenance };
}

/** Load and shape-validate. Cross-reference validation is left to the caller. Throws {@link LoadError} on I/O or syntax errors. */
export async function loadConfig(target: string, opts: LoadOptions = {}): Promise<LoadedConfig> {
  const docs = await loadDocuments(target, opts);
  const merged = mergeDocuments(docs);
  return { ...merged, files: docs.map((d) => d.file) };
}

/** Load, validate fully, and build the model. Throws {@link LoadError} or {@link ConfigError}. */
export async function loadModel(target: string, opts: LoadOptions = {}): Promise<PermissionModel> {
  const loaded = await loadConfig(target, opts);
  if (loaded.diagnostics.some((d) => d.severity === 'error')) throw new ConfigError(loaded.diagnostics);
  const validation = validateConfig(loaded.config, loaded.provenance);
  if (!validation.ok) throw new ConfigError([...loaded.diagnostics, ...validation.errors, ...validation.warnings]);
  return buildModel(loaded.config, loaded.provenance);
}
