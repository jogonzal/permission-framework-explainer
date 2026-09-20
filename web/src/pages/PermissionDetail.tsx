import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { graph } from 'permission-framework-explainer/core';
import { ChipList } from '../components/ChipList';
import { IdLink } from '../components/IdLink';
import { ImplicationDebugList } from '../components/ImplicationDebugList';
import { useLoadedInstance } from '../instance';
import { endpointPath, graphPath, permissionPath, resourcePath } from '../paths';

export function PermissionDetail() {
  const { permissionId = '' } = useParams();
  const { meta, model, indexes } = useLoadedInstance();
  const permission = model.permissions().find((item) => item.id === permissionId);

  const adj = useMemo(() => graph.buildGraph(model.permissions()), [model]);
  const descriptions = useMemo(
    () => new Map(model.permissions().map((item) => [item.id, item.description])),
    [model],
  );

  if (!permission) {
    return (
      <article className="not-found">
        <h1>Permission not found</h1>
        <p className="muted">
          <code>{permissionId}</code> is not defined in {meta.title}.
        </p>
        <p>
          <Link to={`/${meta.id}/permissions`}>Back to permissions</Link>
        </p>
      </article>
    );
  }

  const impliedBy = indexes.impliedBy.get(permission.id) ?? [];
  const implied = [...model.closure(permission.id)]
    .filter((id) => id !== permission.id)
    .sort()
    .map((id) => ({ from: permission.id, to: id, label: id }));
  const ancestors = model
    .permissions()
    .map((item) => item.id)
    .filter((id) => id !== permission.id && model.closure(id).has(permission.id))
    .sort()
    .map((id) => ({ from: id, to: permission.id, label: id }));
  const actions = indexes.resourceActionsByPermission.get(permission.id) ?? [];
  const endpoints = indexes.endpointsByPermission.get(permission.id) ?? [];

  return (
    <article>
      <header className="detail-head">
        <p className="crumb">
          <Link to={`/${meta.id}/permissions`}>Permissions</Link>
        </p>
        <h1>{permission.id}</h1>
        <p className="lede">{permission.description ?? 'No description.'}</p>
        <p>
          <Link to={graphPath(meta.id, permission.id)}>View in graph</Link>
        </p>
      </header>

      <section className="section">
        <h2>Directly implies</h2>
        <ChipList items={permission.implies} to={(id) => permissionPath(meta.id, id)} empty="This permission implies nothing else." />
      </section>

      <section className="section">
        <h2>Directly implied by</h2>
        <ChipList items={impliedBy} to={(id) => permissionPath(meta.id, id)} empty="No other permission implies this one." />
      </section>

      <section className="section">
        <h2>Implies</h2>
        <p className="muted">
          Holding <code>{permission.id}</code> grants these permissions directly or transitively —
          including ones reached only through other <code>implies</code> edges. Expand one to see
          every implication path.
        </p>
        <ImplicationDebugList
          instanceId={meta.id}
          adj={adj}
          pairs={implied}
          empty="Only itself."
          descriptions={descriptions}
        />
      </section>

      <section className="section">
        <h2>Implied by</h2>
        <p className="muted">
          These permissions grant <code>{permission.id}</code> directly or transitively. Expand one to
          see every implication path.
        </p>
        <ImplicationDebugList
          instanceId={meta.id}
          adj={adj}
          pairs={ancestors}
          empty="No other permission implies this one."
          descriptions={descriptions}
        />
      </section>

      <section className="section">
        <h2>Resource actions</h2>
        {actions.length === 0 ? (
          <p className="muted">No resource action maps to this permission.</p>
        ) : (
          <ul className="chip-list">
            {actions.map((item) => (
              <li key={`${item.resource}.${item.action}`}>
                <IdLink to={resourcePath(meta.id, item.resource)}>
                  {`${item.resource}.${item.action}`}
                </IdLink>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <h2>Required by endpoints</h2>
        <ChipList items={endpoints} to={(id) => endpointPath(meta.id, id)} empty="No endpoint requires this permission." />
      </section>
    </article>
  );
}
