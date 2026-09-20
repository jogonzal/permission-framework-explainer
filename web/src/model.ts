import {
  buildModel,
  graph,
  parseConfig,
  parseRequirementRef,
  type EndpointDef,
  type PermissionModel,
  type ResourceDef,
} from 'permission-framework-explainer/core';
import { parse } from 'yaml';
import { CATALOG_BY_ID, type CatalogEntry, type CatalogFile } from './catalog';

export interface ResourceActionRef {
  resource: string;
  action: string;
}

export interface Indexes {
  impliedBy: Map<string, string[]>;
  resourceActionsByPermission: Map<string, ResourceActionRef[]>;
  endpointsByPermission: Map<string, string[]>;
  endpointsByResource: Map<string, string[]>;
}

export interface LoadedInstance {
  meta: CatalogEntry;
  model: PermissionModel;
  indexes: Indexes;
}

const cache = new Map<string, LoadedInstance>();

function mergeYamlFiles(files: readonly CatalogFile[]) {
  const permissions: unknown[] = [];
  const resources: unknown[] = [];
  const endpoints: unknown[] = [];
  for (const file of files) {
    const data = parse(file.text) as Record<string, unknown> | null;
    if (!data || typeof data !== 'object') continue;
    if (Array.isArray(data.permissions)) permissions.push(...data.permissions);
    if (Array.isArray(data.resources)) resources.push(...data.resources);
    if (Array.isArray(data.endpoints)) endpoints.push(...data.endpoints);
  }
  return { permissions, resources, endpoints };
}

function pushUnique(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key);
  if (!list) {
    map.set(key, [value]);
    return;
  }
  if (!list.includes(value)) list.push(value);
}

function buildIndexes(model: PermissionModel): Indexes {
  const impliedBy = new Map<string, string[]>();
  const resourceActionsByPermission = new Map<string, ResourceActionRef[]>();
  const endpointsByPermission = new Map<string, string[]>();
  const endpointsByResource = new Map<string, string[]>();

  for (const permission of model.permissions()) {
    impliedBy.set(permission.id, []);
    resourceActionsByPermission.set(permission.id, []);
    endpointsByPermission.set(permission.id, []);
  }
  for (const resource of model.resources()) {
    endpointsByResource.set(resource.id, []);
  }

  for (const [from, tos] of graph.buildGraph(model.permissions())) {
    for (const to of tos) {
      impliedBy.get(to)?.push(from);
    }
  }

  for (const resource of model.resources()) {
    for (const [action, permission] of Object.entries(resource.actions)) {
      const list = resourceActionsByPermission.get(permission);
      if (list) list.push({ resource: resource.id, action });
    }
  }

  for (const endpoint of model.endpoints()) {
    for (const raw of endpoint.requires) {
      const ref = parseRequirementRef(raw);
      if (!ref) continue;
      if (ref.kind === 'permission') {
        pushUnique(endpointsByPermission, ref.permission, endpoint.id);
        continue;
      }
      pushUnique(endpointsByResource, ref.resource, endpoint.id);
      const permission = model.resources().find((r) => r.id === ref.resource)?.actions[ref.action];
      if (permission) pushUnique(endpointsByPermission, permission, endpoint.id);
    }
  }

  return { impliedBy, resourceActionsByPermission, endpointsByPermission, endpointsByResource };
}

export function loadInstance(id: string): LoadedInstance | undefined {
  const cached = cache.get(id);
  if (cached) return cached;
  const meta = CATALOG_BY_ID.get(id);
  if (!meta) return undefined;
  const merged = mergeYamlFiles(meta.files);
  const { config, diagnostics } = parseConfig(merged);
  if (diagnostics.length > 0) {
    throw new Error(diagnostics.map((d) => d.message).join('\n'));
  }
  const model = buildModel(config);
  const loaded = { meta, model, indexes: buildIndexes(model) };
  cache.set(id, loaded);
  return loaded;
}

export function resourceById(model: PermissionModel, id: string): ResourceDef | undefined {
  return model.resources().find((resource) => resource.id === id);
}

export function endpointById(model: PermissionModel, id: string): EndpointDef | undefined {
  return model.endpoints().find((endpoint) => endpoint.id === id);
}

export function resolveEndpointRequirements(model: PermissionModel, endpoint: EndpointDef) {
  return endpoint.requires.map((raw) => {
    const ref = parseRequirementRef(raw);
    if (!ref) return { raw, ref: null, permission: undefined as string | undefined };
    if (ref.kind === 'permission') return { raw, ref, permission: ref.permission };
    const permission = resourceById(model, ref.resource)?.actions[ref.action];
    return { raw, ref, permission };
  });
}
