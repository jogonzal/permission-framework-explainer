import { Link } from 'react-router-dom';
import { useLoadedInstance } from '../instance';

export function InstanceOverview() {
  const { meta, model } = useLoadedInstance();
  const permissions = model.permissions().length;
  const resources = model.resources().length;
  const endpoints = model.endpoints().length;

  return (
    <article>
      <header className="detail-head">
        <h1 className="page-title">{meta.title}</h1>
        <p className="lede">{meta.description}</p>
      </header>
      <div className="card-grid">
        <Link className="card" to={`/${meta.id}/permissions`}>
          <p className="card-kicker">{permissions} nodes</p>
          <h2>Permissions</h2>
          <p>Nodes in the implication DAG.</p>
          <div className="counts">
            <span>{permissions} defined</span>
          </div>
        </Link>
        <Link className="card" to={`/${meta.id}/resources`}>
          <h2>Resources</h2>
          <p>Types whose actions map to permissions.</p>
          <div className="counts">
            <span>{resources} defined</span>
          </div>
        </Link>
        <Link className="card" to={`/${meta.id}/endpoints`}>
          <h2>Endpoints</h2>
          <p>API routes and the requirements they AND together.</p>
          <div className="counts">
            <span>{endpoints} defined</span>
          </div>
        </Link>
        <Link className="card" to={`/${meta.id}/graph`}>
          <h2>Graph</h2>
          <p>Interactive view of every implies edge.</p>
          <div className="counts">
            <span>{permissions} nodes</span>
          </div>
        </Link>
      </div>
    </article>
  );
}
