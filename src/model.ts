/**
 * The in-memory permission model: precomputed closures plus `check` / `explain`.
 * Build it once at startup; `check` is O(number of requirements).
 */
import { ConfigError, TargetNotFoundError } from './errors.js';
import { buildGraph, computeClosures, findPath, type Graph } from './graph.js';
import { parseRequirementRef, parseTarget } from './refs.js';
import type {
  CheckResult,
  Config,
  EndpointDef,
  ExplainResult,
  PermissionDef,
  RequirementResult,
  ResolvedRequirement,
  ResourceDef,
  Target,
} from './types.js';
import { validateConfig, type Provenance } from './validate.js';

export interface PermissionModel {
  readonly config: Config;
  permissions(): readonly PermissionDef[];
  resources(): readonly ResourceDef[];
  endpoints(): readonly EndpointDef[];
  hasPermission(id: string): boolean;
  /** All permissions implied by `id`, including `id` itself. Throws on an unknown id. */
  closure(id: string): ReadonlySet<string>;
  /** Union of closures over a granted set; unknown ids are collected, not thrown. */
  expand(granted: Iterable<string>): { effective: Set<string>; unknown: string[] };
  /** The permissions a target needs. Throws {@link TargetNotFoundError}. */
  resolveTarget(target: Target | string): { target: Target; requirements: ResolvedRequirement[]; public: boolean };
  check(granted: Iterable<string>, target: Target | string): CheckResult;
  explain(granted: Iterable<string>, target: Target | string): ExplainResult;
}

/** Validate a config and build the model. Throws {@link ConfigError} when invalid. */
export function buildModel(config: Config, provenance?: Provenance): PermissionModel {
  const validation = validateConfig(config, provenance);
  if (!validation.ok) throw new ConfigError([...validation.errors, ...validation.warnings]);
  return new Model(config);
}

class Model implements PermissionModel {
  readonly config: Config;
  private readonly graph: Graph;
  private readonly closures: Map<string, Set<string>>;
  private readonly resourceIndex: Map<string, ResourceDef>;
  private readonly endpointIndex: Map<string, EndpointDef>;

  constructor(config: Config) {
    this.config = config;
    this.graph = buildGraph(config.permissions);
    this.closures = computeClosures(this.graph);
    this.resourceIndex = new Map(config.resources.map((r) => [r.id, r]));
    this.endpointIndex = new Map(config.endpoints.map((e) => [e.id, e]));
  }

  permissions(): readonly PermissionDef[] {
    return this.config.permissions;
  }

  resources(): readonly ResourceDef[] {
    return this.config.resources;
  }

  endpoints(): readonly EndpointDef[] {
    return this.config.endpoints;
  }

  hasPermission(id: string): boolean {
    return this.closures.has(id);
  }

  closure(id: string): ReadonlySet<string> {
    const c = this.closures.get(id);
    if (!c) throw new Error(`unknown permission "${id}"`);
    return c;
  }

  expand(granted: Iterable<string>): { effective: Set<string>; unknown: string[] } {
    const effective = new Set<string>();
    const unknown: string[] = [];
    for (const g of granted) {
      const c = this.closures.get(g);
      if (!c) {
        if (!unknown.includes(g)) unknown.push(g);
        continue;
      }
      for (const p of c) effective.add(p);
    }
    return { effective, unknown };
  }

  resolveTarget(input: Target | string): { target: Target; requirements: ResolvedRequirement[]; public: boolean } {
    const target = typeof input === 'string' ? parseTarget(input) : input;
    if (target.kind === 'resourceAction') {
      const resource = this.resourceIndex.get(target.resource);
      if (!resource) throw new TargetNotFoundError(target, `resource "${target.resource}" is not defined`);
      const permission = resource.actions[target.action];
      if (permission === undefined) {
        const available = Object.keys(resource.actions);
        throw new TargetNotFoundError(
          target,
          `resource "${target.resource}" has no action "${target.action}" (actions: ${available.length ? available.join(', ') : 'none'})`,
        );
      }
      const raw = `${target.resource}.${target.action}`;
      return {
        target,
        public: false,
        requirements: [{ ref: { kind: 'resourceAction', raw, resource: target.resource, action: target.action }, permission }],
      };
    }
    const endpoint = this.endpointIndex.get(target.id);
    if (!endpoint) throw new TargetNotFoundError(target);
    const requirements: ResolvedRequirement[] = endpoint.requires.map((raw) => {
      // Validation guarantees these parse and resolve.
      const ref = parseRequirementRef(raw) as NonNullable<ReturnType<typeof parseRequirementRef>>;
      const permission =
        ref.kind === 'permission'
          ? ref.permission
          : ((this.resourceIndex.get(ref.resource) as ResourceDef).actions[ref.action] as string);
      return { ref, permission };
    });
    return { target, requirements, public: endpoint.public };
  }

  check(granted: Iterable<string>, input: Target | string): CheckResult {
    const { target, requirements, public: isPublic } = this.resolveTarget(input);
    const { effective, unknown } = this.expand(granted);
    const unmet: string[] = [];
    for (const r of requirements) {
      if (!effective.has(r.permission) && !unmet.includes(r.permission)) unmet.push(r.permission);
    }
    return { allowed: isPublic || unmet.length === 0, target, public: isPublic, unmet, unknownGranted: unknown };
  }

  explain(granted: Iterable<string>, input: Target | string): ExplainResult {
    const { target, requirements, public: isPublic } = this.resolveTarget(input);
    const grantedList = [...granted];
    const { effective, unknown } = this.expand(grantedList);
    const results: RequirementResult[] = requirements.map((r) => {
      const satisfied = effective.has(r.permission);
      const result: RequirementResult = { ref: r.ref, permission: r.permission, satisfied };
      if (!satisfied) return result;
      // A direct grant always wins; otherwise the shortest implication chain, in granted order.
      if (grantedList.includes(r.permission)) {
        result.grantedVia = r.permission;
        result.path = [r.permission];
        return result;
      }
      let best: string[] | undefined;
      let via: string | undefined;
      for (const g of grantedList) {
        const path = findPath(this.graph, g, r.permission);
        if (path && (best === undefined || path.length < best.length)) {
          best = path;
          via = g;
        }
      }
      if (best && via !== undefined) {
        result.grantedVia = via;
        result.path = best;
      }
      return result;
    });
    const allowed = isPublic || results.every((r) => r.satisfied);
    return { allowed, target, public: isPublic, requirements: results, unknownGranted: unknown };
  }
}
