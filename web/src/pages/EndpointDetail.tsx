import { Link, useParams } from 'react-router-dom';
import { useLoadedInstance } from '../instance';
import { endpointById, resolveEndpointRequirements } from '../model';
import { permissionPath, resourcePath } from '../paths';

export function EndpointDetail() {
  const params = useParams();
  const encoded = params['*'] ?? '';
  const endpointId = decodeURIComponent(encoded);
  const { meta, model } = useLoadedInstance();
  const endpoint = endpointById(model, endpointId);

  if (!endpoint) {
    return (
      <article className="not-found">
        <h1>Endpoint not found</h1>
        <p className="muted">
          <code>{endpointId || '(empty)'}</code> is not defined in {meta.title}.
        </p>
        <p>
          <Link to={`/${meta.id}/endpoints`}>Back to endpoints</Link>
        </p>
      </article>
    );
  }

  const requirements = resolveEndpointRequirements(model, endpoint);

  return (
    <article>
      <header className="detail-head">
        <p className="crumb">
          <Link to={`/${meta.id}/endpoints`}>Endpoints</Link>
        </p>
        <h1>{endpoint.id}</h1>
        <p className="lede">{endpoint.description ?? 'No description.'}</p>
        <p>
          {endpoint.public ? <span className="badge badge-ok">public</span> : <span className="badge badge-muted">protected</span>}
        </p>
      </header>

      <section className="section">
        <h2>Requires</h2>
        {endpoint.public ? (
          <p className="muted">This endpoint is public and does not require permissions.</p>
        ) : requirements.length === 0 ? (
          <p className="muted">No requirements listed.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Requirement</th>
                  <th>Kind</th>
                  <th>Permission</th>
                </tr>
              </thead>
              <tbody>
                {requirements.map((item) => (
                  <tr key={item.raw}>
                    <td>
                      {item.ref?.kind === 'resourceAction' ? (
                        <Link to={resourcePath(meta.id, item.ref.resource)}>{item.raw}</Link>
                      ) : (
                        <code>{item.raw}</code>
                      )}
                    </td>
                    <td>{item.ref?.kind === 'resourceAction' ? 'resource action' : 'permission'}</td>
                    <td>
                      {item.permission ? (
                        <Link to={permissionPath(meta.id, item.permission)}>{item.permission}</Link>
                      ) : (
                        <span className="muted">unresolved</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </article>
  );
}
