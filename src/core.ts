/**
 * Browser-safe public API. Excludes the filesystem loader and CLI.
 */
export type {
  CheckResult,
  Config,
  Diagnostic,
  DiagnosticCode,
  EndpointDef,
  ExplainResult,
  PermissionDef,
  RequirementRef,
  RequirementResult,
  ResolvedRequirement,
  ResourceDef,
  Severity,
  Target,
  ValidationResult,
} from './types.js';
export { ConfigError, TargetNotFoundError, formatDiagnostic, formatTarget } from './errors.js';
export {
  ACTION_ID_RE,
  PERMISSION_ID_RE,
  RESOURCE_ACTION_RE,
  RESOURCE_ID_RE,
  formatRef,
  isActionId,
  isPermissionId,
  isResourceId,
  parseRequirementRef,
  parseTarget,
} from './refs.js';
export { ConfigSchema, EndpointSchema, PermissionSchema, ResourceSchema, parseConfig } from './schema.js';
export type { RawConfig } from './schema.js';
export { validateConfig, provenanceKey } from './validate.js';
export type { Provenance } from './validate.js';
export { buildModel } from './model.js';
export type { PermissionModel } from './model.js';
export * as graph from './graph.js';
