import { Link, useParams } from 'react-router-dom';
import { ChipList } from '../components/ChipList';
import { IdLink } from '../components/IdLink';
import { useLoadedInstance } from '../instance';
import { endpointPath, graphPath, permissionPath, resourcePath } from '../paths';

export function PermissionDetail() {
  const { permissionId = '' } = useParams();
  const { meta, model, indexes } = useLoadedInstance();
  const permission = model.permissions().find((item) => item.id === permissionId);

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
  const closure = [...model.closure(permission.id)].filter((id) => id !== permission.id);
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
        <h2>Implies</h2>
        <ChipList items={permission.implies} to={(id) => permissionPath(meta.id, id)} empty="This permission implies nothing else." />
      </section>

      <section className="section">
        <h2>Implied by</h2>
        <ChipList items={impliedBy} to={(id) => permissionPath(meta.id, id)} empty="No other permission implies this one." />
      </section>

      <section className="section">
        <h2>Transitive closure</h2>
        <p className="muted">Holding {permission.id} also grants these permissions.</p>
        <ChipList items={closure} to={(id) => permissionPath(meta.id, id)} empty="Only itself." />
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
