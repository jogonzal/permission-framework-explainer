import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchField } from '../components/SearchField';
import { useLoadedInstance } from '../instance';
import { endpointPath } from '../paths';

export function EndpointList() {
  const { meta, model } = useLoadedInstance();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const rows = useMemo(() => {
    return model.endpoints().filter((endpoint) => {
      if (!q) return true;
      return (
        endpoint.id.toLowerCase().includes(q) ||
        (endpoint.description ?? '').toLowerCase().includes(q) ||
        endpoint.requires.join(' ').toLowerCase().includes(q)
      );
    });
  }, [model, q]);

  return (
    <article>
      <header className="detail-head">
        <h1 className="page-title">Endpoints</h1>
        <p className="lede">API routes in {meta.title}. Every listed requirement must be satisfied.</p>
      </header>
      <div className="toolbar">
        <SearchField value={query} onChange={setQuery} placeholder="Filter by id, description, or requirement" />
        <p className="muted">
          {rows.length} of {model.endpoints().length}
        </p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Id</th>
              <th>Access</th>
              <th>Requires</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((endpoint) => (
              <tr key={endpoint.id}>
                <td>
                  <Link to={endpointPath(meta.id, endpoint.id)}>{endpoint.id}</Link>
                </td>
                <td>
                  {endpoint.public ? <span className="badge badge-ok">public</span> : <span className="badge badge-muted">protected</span>}
                </td>
                <td>{endpoint.public ? <span className="muted">none</span> : endpoint.requires.join(', ') || <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="empty">No endpoints match that filter.</p> : null}
      </div>
    </article>
  );
}
