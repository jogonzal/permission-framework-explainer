import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchField } from '../components/SearchField';
import { useLoadedInstance } from '../instance';
import { permissionPath } from '../paths';

export function PermissionList() {
  const { meta, model, indexes } = useLoadedInstance();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const rows = useMemo(() => {
    return model.permissions().filter((permission) => {
      if (!q) return true;
      return (
        permission.id.toLowerCase().includes(q) || (permission.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [model, q]);

  return (
    <article>
      <header className="detail-head">
        <h1 className="page-title">Permissions</h1>
        <p className="lede">Every permission in {meta.title}, including implication edges.</p>
      </header>
      <div className="toolbar">
        <SearchField value={query} onChange={setQuery} placeholder="Filter by id or description" />
        <p className="muted">
          {rows.length} of {model.permissions().length}
        </p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Id</th>
              <th>Description</th>
              <th>Implies</th>
              <th>Implied by</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((permission) => (
              <tr key={permission.id}>
                <td>
                  <Link to={permissionPath(meta.id, permission.id)}>{permission.id}</Link>
                </td>
                <td>{permission.description ?? <span className="muted">—</span>}</td>
                <td>{permission.implies.length}</td>
                <td>{indexes.impliedBy.get(permission.id)?.length ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="empty">No permissions match that filter.</p> : null}
      </div>
    </article>
  );
}
