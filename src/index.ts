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
export { LoadError, loadConfig, loadDocuments, loadModel, mergeDocuments } from './loader.js';
export type { LoadOptions, LoadedConfig, LoadedDocument } from './loader.js';
export * as graph from './graph.js';
export type { AllPathsResult, Graph, GraphEdge } from './graph.js';
export { applyImpliesRemovals, diffImpliesRemovals, unifiedDiff } from './yaml-implies-diff.js';
export type { ImpliesEdge, YamlDiffHunk, YamlSource } from './yaml-implies-diff.js';
export { main as cliMain, USAGE as CLI_USAGE } from './cli.js';
