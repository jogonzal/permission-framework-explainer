import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchField } from '../components/SearchField';
import { useLoadedInstance } from '../instance';
import { resourcePath } from '../paths';

export function ResourceList() {
  const { meta, model } = useLoadedInstance();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const rows = useMemo(() => {
    return model.resources().filter((resource) => {
      if (!q) return true;
      const actions = Object.keys(resource.actions).join(' ');
      return (
        resource.id.toLowerCase().includes(q) ||
        (resource.description ?? '').toLowerCase().includes(q) ||
        actions.toLowerCase().includes(q)
      );
    });
  }, [model, q]);

  return (
    <article>
      <header className="detail-head">
        <h1 className="page-title">Resources</h1>
        <p className="lede">Resource types in {meta.title} and the actions they expose.</p>
      </header>
      <div className="toolbar">
        <SearchField value={query} onChange={setQuery} placeholder="Filter by id, description, or action" />
        <p className="muted">
          {rows.length} of {model.resources().length}
        </p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Id</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((resource) => (
              <tr key={resource.id}>
                <td>
                  <Link to={resourcePath(meta.id, resource.id)}>{resource.id}</Link>
                </td>
                <td>{resource.description ?? <span className="muted">—</span>}</td>
                <td>{Object.keys(resource.actions).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="empty">No resources match that filter.</p> : null}
      </div>
    </article>
  );
}
