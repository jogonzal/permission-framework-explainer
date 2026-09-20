import { Link, useParams } from 'react-router-dom';
import { ChipList } from '../components/ChipList';
import { useLoadedInstance } from '../instance';
import { endpointById, resourceById } from '../model';
import { endpointPath, permissionPath } from '../paths';

export function ResourceDetail() {
  const { resourceId = '' } = useParams();
  const { meta, model, indexes } = useLoadedInstance();
  const resource = resourceById(model, resourceId);

  if (!resource) {
    return (
      <article className="not-found">
        <h1>Resource not found</h1>
        <p className="muted">
          <code>{resourceId}</code> is not defined in {meta.title}.
        </p>
        <p>
          <Link to={`/${meta.id}/resources`}>Back to resources</Link>
        </p>
      </article>
    );
  }

  const actions = Object.entries(resource.actions);
  const endpoints = (indexes.endpointsByResource.get(resource.id) ?? []).filter((id) => endpointById(model, id));

  return (
    <article>
      <header className="detail-head">
        <p className="crumb">
          <Link to={`/${meta.id}/resources`}>Resources</Link>
        </p>
        <h1>{resource.id}</h1>
        <p className="lede">{resource.description ?? 'No description.'}</p>
      </header>

      <section className="section">
        <h2>Actions</h2>
        {actions.length === 0 ? (
          <p className="muted">This resource has no actions.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Permission</th>
                </tr>
              </thead>
              <tbody>
                {actions.map(([action, permission]) => (
                  <tr key={action}>
                    <td>
                      <code>{resource.id}.{action}</code>
                    </td>
                    <td>
                      <Link to={permissionPath(meta.id, permission)}>{permission}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <h2>Used by endpoints</h2>
        <ChipList
          items={endpoints}
          to={(id) => endpointPath(meta.id, id)}
          empty="No endpoint references this resource."
        />
      </section>
    </article>
  );
}
