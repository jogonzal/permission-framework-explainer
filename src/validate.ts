/**
 * Cross-entity validation: duplicate ids, dangling references, endpoint
 * consistency, and cycles in the implication graph. Collects every problem
 * rather than stopping at the first one.
 */
import { diagnostic, suggest } from './errors.js';
import { buildGraph, findCycle } from './graph.js';
import { parseRequirementRef } from './refs.js';
import type { Config, Diagnostic, ValidationResult } from './types.js';

/** Maps `"<kind>:<id>"` (e.g. `permission:users:read`) to the file it was defined in. */
export type Provenance = ReadonlyMap<string, string>;

export function provenanceKey(kind: 'permission' | 'resource' | 'endpoint', id: string): string {
  return `${kind}:${id}`;
}

export function validateConfig(config: Config, provenance?: Provenance): ValidationResult {
  const diags: Diagnostic[] = [];
  const fileOf = (kind: 'permission' | 'resource' | 'endpoint', id: string): string | undefined =>
    provenance?.get(provenanceKey(kind, id));

  // 1. Duplicate ids.
  const checkDuplicates = (
    kind: 'permission' | 'resource' | 'endpoint',
    section: 'permissions' | 'resources' | 'endpoints',
    items: readonly { id: string }[],
  ): void => {
    const seen = new Map<string, number>();
    items.forEach((item, i) => {
      const first = seen.get(item.id);
      if (first === undefined) {
        seen.set(item.id, i);
        return;
      }
      const firstFile = fileOf(kind, item.id);
      const where = firstFile ? ` (first defined in ${firstFile})` : ` (first defined at ${section}[${first}])`;
      diags.push(
        diagnostic('E_DUPLICATE_ID', `duplicate ${kind} id "${item.id}"${where}`, {
          path: `${section}[${i}].id`,
          file: fileOf(kind, item.id),
        }),
      );
    });
  };
  checkDuplicates('permission', 'permissions', config.permissions);
  checkDuplicates('resource', 'resources', config.resources);
  checkDuplicates('endpoint', 'endpoints', config.endpoints);

  const permissionIds = new Set(config.permissions.map((p) => p.id));
  const resources = new Map(config.resources.map((r) => [r.id, r]));

  // 2. `implies` references.
  config.permissions.forEach((p, i) => {
    p.implies.forEach((target, j) => {
      if (!permissionIds.has(target)) {
        diags.push(
          diagnostic('E_UNKNOWN_PERMISSION', `permission "${target}" is not defined${suggest(target, permissionIds)}`, {
            path: `permissions[${i}].implies[${j}]`,
            file: fileOf('permission', p.id),
          }),
        );
      }
    });
  });

  // 3. Resource action targets.
  config.resources.forEach((r, i) => {
    for (const [action, target] of Object.entries(r.actions)) {
      if (!permissionIds.has(target)) {
        diags.push(
          diagnostic('E_UNKNOWN_PERMISSION', `permission "${target}" is not defined${suggest(target, permissionIds)}`, {
            path: `resources[${i}].actions.${action}`,
            file: fileOf('resource', r.id),
          }),
        );
      }
    }
  });

  // 4 & 5. Endpoint requirements and public/requires consistency.
  config.endpoints.forEach((e, i) => {
    const file = fileOf('endpoint', e.id);
    e.requires.forEach((raw, j) => {
      const path = `endpoints[${i}].requires[${j}]`;
      const ref = parseRequirementRef(raw);
      if (!ref) {
        diags.push(
          diagnostic('E_BAD_REF', `"${raw}" is neither a permission id (a:b) nor a resource action (a.b)`, { path, file }),
        );
        return;
      }
      if (ref.kind === 'permission') {
        if (!permissionIds.has(ref.permission)) {
          diags.push(
            diagnostic(
              'E_UNKNOWN_PERMISSION',
              `permission "${ref.permission}" is not defined${suggest(ref.permission, permissionIds)}`,
              { path, file },
            ),
          );
        }
        return;
      }
      const resource = resources.get(ref.resource);
      if (!resource) {
        diags.push(
          diagnostic('E_UNKNOWN_RESOURCE', `resource "${ref.resource}" is not defined${suggest(ref.resource, resources.keys())}`, {
            path,
            file,
          }),
        );
        return;
      }
      if (!(ref.action in resource.actions)) {
        const available = Object.keys(resource.actions);
        diags.push(
          diagnostic(
            'E_UNKNOWN_ACTION',
            `resource "${ref.resource}" has no action "${ref.action}" (actions: ${available.length ? available.join(', ') : 'none'})`,
            { path, file },
          ),
        );
      }
    });

    if (e.public && e.requires.length > 0) {
      diags.push(
        diagnostic('E_PUBLIC_WITH_REQUIRES', `endpoint "${e.id}" is public but lists requirements; remove one or the other`, {
          path: `endpoints[${i}]`,
          file,
        }),
      );
    } else if (!e.public && e.requires.length === 0) {
      diags.push(
        diagnostic('E_EMPTY_REQUIRES', `endpoint "${e.id}" has no requirements; add requires or set public: true`, {
          path: `endpoints[${i}]`,
          file,
        }),
      );
    }
  });

  // 6. Cycles (buildGraph already drops edges to undefined permissions).
  const cycle = findCycle(buildGraph(config.permissions));
  if (cycle) {
    diags.push(
      diagnostic('E_CYCLE', `implication cycle detected: ${cycle.join(' -> ')}`, {
        path: 'permissions',
        file: fileOf('permission', cycle[0] as string),
      }),
    );
  }

  const errors = diags.filter((d) => d.severity === 'error');
  const warnings = diags.filter((d) => d.severity === 'warning');
  return { ok: errors.length === 0, errors, warnings };
}
