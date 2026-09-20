/**
 * Domain types for the permission framework.
 *
 * The model is a DAG of permissions (edges = `implies`), a set of resources
 * whose named actions map to permissions, and a set of endpoints that each
 * require a list of permissions (directly, or through a resource action).
 */

/** A permission node in the DAG. `implies` lists permissions this one grants transitively. */
export interface PermissionDef {
  id: string;
  description?: string;
  implies: string[];
}

/** A resource type. Each action name maps to the permission id it requires. */
export interface ResourceDef {
  id: string;
  description?: string;
  actions: Record<string, string>;
}

/** An API endpoint. `requires` holds requirement references (see {@link RequirementRef}). */
export interface EndpointDef {
  id: string;
  description?: string;
  requires: string[];
  public: boolean;
}

/** The fully-defaulted, shape-validated configuration. */
export interface Config {
  permissions: PermissionDef[];
  resources: ResourceDef[];
  endpoints: EndpointDef[];
}

/**
 * A parsed entry from an endpoint's `requires` list.
 * - `users:read`  -> permission reference
 * - `users.write` -> resource-action reference
 */
export type RequirementRef =
  | { kind: 'permission'; raw: string; permission: string }
  | { kind: 'resourceAction'; raw: string; resource: string; action: string };

/** A requirement with the permission it ultimately resolves to. */
export interface ResolvedRequirement {
  ref: RequirementRef;
  permission: string;
}

/** What a check or explain call is asked about. */
export type Target =
  | { kind: 'endpoint'; id: string }
  | { kind: 'resourceAction'; resource: string; action: string };

/** Per-requirement outcome from {@link ExplainResult}. */
export interface RequirementResult {
  ref: RequirementRef;
  permission: string;
  satisfied: boolean;
  /** The granted permission id that satisfies this requirement, when satisfied. */
  grantedVia?: string;
  /** Implication chain from `grantedVia` to `permission`, inclusive. Length 1 means a direct grant. */
  path?: string[];
}

export interface CheckResult {
  allowed: boolean;
  target: Target;
  /** Whether the target is a public endpoint (always allowed). */
  public: boolean;
  /** Required permission ids that the granted set does not cover. */
  unmet: string[];
  /** Granted ids that are not defined in the model. Ignored for the decision. */
  unknownGranted: string[];
}

export interface ExplainResult {
  allowed: boolean;
  target: Target;
  public: boolean;
  requirements: RequirementResult[];
  unknownGranted: string[];
}

export type Severity = 'error' | 'warning';

export type DiagnosticCode =
  | 'E_SCHEMA'
  | 'E_BAD_ID'
  | 'E_BAD_REF'
  | 'E_DUPLICATE_ID'
  | 'E_UNKNOWN_PERMISSION'
  | 'E_UNKNOWN_RESOURCE'
  | 'E_UNKNOWN_ACTION'
  | 'E_CYCLE'
  | 'E_EMPTY_REQUIRES'
  | 'E_PUBLIC_WITH_REQUIRES'
  | 'E_FILE'
  | 'W_UNKNOWN_GRANTED';

export interface Diagnostic {
  code: DiagnosticCode;
  severity: Severity;
  message: string;
  /** Location inside the config, e.g. `endpoints[1].requires[0]`. */
  path?: string;
  /** Source file, when the config was loaded from disk. */
  file?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: Diagnostic[];
  warnings: Diagnostic[];
}
