import type { RequirementRef, Target } from './types.js';

/** Permission ids: lowercase segments joined by `:`; dots are forbidden. */
export const PERMISSION_ID_RE = /^[a-z0-9_-]+(:[a-z0-9_-]+)*$/;
/** Resource ids and action names: a single lowercase segment. */
export const RESOURCE_ID_RE = /^[a-z0-9_-]+$/;
export const ACTION_ID_RE = RESOURCE_ID_RE;
/** Resource-action references: `resource.action`, exactly one dot. */
export const RESOURCE_ACTION_RE = /^([a-z0-9_-]+)\.([a-z0-9_-]+)$/;

export function isPermissionId(s: string): boolean {
  return PERMISSION_ID_RE.test(s);
}

export function isResourceId(s: string): boolean {
  return RESOURCE_ID_RE.test(s);
}

export function isActionId(s: string): boolean {
  return ACTION_ID_RE.test(s);
}

/**
 * Parse an entry of an endpoint's `requires` list.
 * Returns `null` when the string matches neither grammar.
 */
export function parseRequirementRef(raw: string): RequirementRef | null {
  const ra = RESOURCE_ACTION_RE.exec(raw);
  if (ra) {
    return { kind: 'resourceAction', raw, resource: ra[1] as string, action: ra[2] as string };
  }
  if (PERMISSION_ID_RE.test(raw)) {
    return { kind: 'permission', raw, permission: raw };
  }
  return null;
}

export function formatRef(ref: RequirementRef): string {
  return ref.raw;
}

/**
 * Convenience for programmatic callers: `users.write` becomes a resource-action
 * target, anything else is treated as an endpoint id.
 */
export function parseTarget(s: string): Target {
  const ra = RESOURCE_ACTION_RE.exec(s);
  if (ra) return { kind: 'resourceAction', resource: ra[1] as string, action: ra[2] as string };
  return { kind: 'endpoint', id: s };
}
