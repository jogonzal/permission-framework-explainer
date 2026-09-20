export function permissionPath(instance: string, id: string): string {
  return `/${instance}/permissions/${encodeURIComponent(id)}`;
}

export function endpointPath(instance: string, id: string): string {
  return `/${instance}/endpoints/${encodeURIComponent(id)}`;
}

export function resourcePath(instance: string, id: string): string {
  return `/${instance}/resources/${encodeURIComponent(id)}`;
}

export function graphPath(instance: string, id?: string): string {
  return id ? `/${instance}/graph/${encodeURIComponent(id)}` : `/${instance}/graph`;
}

export function sourcePath(instance: string, filename?: string): string {
  if (!filename) return `/${instance}/source`;
  return `/${instance}/source/${filename.split('/').map(encodeURIComponent).join('/')}`;
}

export function instancePath(instance: string, rest = ''): string {
  return rest ? `/${instance}/${rest}` : `/${instance}`;
}

/** Keep the current section when switching instances. */
export function switchInstancePath(pathname: string, nextInstance: string): string {
  const parts = pathname.split('/').filter(Boolean);
  const section = parts[1];
  if (!section) return `/${nextInstance}`;
  return `/${nextInstance}/${section}`;
}
