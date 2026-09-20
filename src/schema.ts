/**
 * Shape validation of raw config input (parsed YAML/JSON) using zod.
 * Only structure, defaults, and id grammar are checked here; cross-entity
 * checks (dangling references, cycles) live in validate.ts.
 */
import { z } from 'zod';
import { diagnostic } from './errors.js';
import { ACTION_ID_RE, PERMISSION_ID_RE, RESOURCE_ID_RE } from './refs.js';
import type { Config, Diagnostic } from './types.js';

const permissionId = z
  .string()
  .regex(PERMISSION_ID_RE, 'permission ids are lowercase segments joined by ":" (e.g. "users:read")');
const resourceId = z
  .string()
  .regex(RESOURCE_ID_RE, 'resource ids are a single lowercase segment (e.g. "users")');
const actionId = z
  .string()
  .regex(ACTION_ID_RE, 'action names are a single lowercase segment (e.g. "read")');

export const PermissionSchema = z
  .object({
    id: permissionId,
    description: z.string().optional(),
    implies: z.array(permissionId).default([]),
  })
  .strict();

export const ResourceSchema = z
  .object({
    id: resourceId,
    description: z.string().optional(),
    actions: z.record(actionId, permissionId).default({}),
  })
  .strict();

export const EndpointSchema = z
  .object({
    id: z.string().min(1, 'endpoint id must not be empty'),
    description: z.string().optional(),
    requires: z.array(z.string().min(1)).default([]),
    public: z.boolean().default(false),
  })
  .strict();

export const ConfigSchema = z
  .object({
    permissions: z.array(PermissionSchema).default([]),
    resources: z.array(ResourceSchema).default([]),
    endpoints: z.array(EndpointSchema).default([]),
  })
  .strict();

export type RawConfig = z.input<typeof ConfigSchema>;

const EMPTY: Config = { permissions: [], resources: [], endpoints: [] };

/** Render a zod path like `endpoints[1].requires[0]`. */
export function formatPath(path: readonly (string | number)[]): string {
  let out = '';
  for (const seg of path) {
    if (typeof seg === 'number') out += `[${seg}]`;
    else out += out ? `.${seg}` : seg;
  }
  return out;
}

/**
 * Parse raw input into a defaulted {@link Config}. Never throws: on failure the
 * config is empty and every issue is reported as a diagnostic.
 */
export function parseConfig(input: unknown, file?: string): { config: Config; diagnostics: Diagnostic[] } {
  if (input === null || input === undefined) {
    return { config: { ...EMPTY }, diagnostics: [] };
  }
  const result = ConfigSchema.safeParse(input);
  if (result.success) {
    const c = result.data;
    const config: Config = {
      permissions: c.permissions.map((p) => ({ ...p })),
      resources: c.resources.map((r) => ({ ...r, actions: { ...r.actions } })),
      endpoints: c.endpoints.map((e) => ({ ...e })),
    };
    return { config, diagnostics: [] };
  }
  const diagnostics = result.error.issues.map((issue) => {
    const path = formatPath(issue.path);
    const isIdIssue = issue.code === 'invalid_string' && /\.id$|^id$|actions\.[^.]+$/.test(path);
    const code = isIdIssue ? 'E_BAD_ID' : 'E_SCHEMA';
    let message = issue.message;
    if (issue.code === 'unrecognized_keys') {
      message = `unknown key${issue.keys.length === 1 ? '' : 's'} ${issue.keys.map((k) => `"${k}"`).join(', ')}`;
    } else if (issue.code === 'invalid_type') {
      message = `expected ${issue.expected}, received ${issue.received}`;
    }
    return diagnostic(code, message, { path: path || undefined, file });
  });
  return { config: { ...EMPTY }, diagnostics };
}
