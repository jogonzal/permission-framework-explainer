import { Link } from 'react-router-dom';
import { CATALOG } from '../catalog';
import { loadInstance } from '../model';

export function HomePage() {
  return (
    <div className="main">
      <section className="home-hero">
        <h1>Permission explainer</h1>
        <p className="lede">
          Browse an instance of the permission framework: every permission, resource, and endpoint, plus the
          implication DAG.
        </p>
      </section>
      <div className="card-grid">
        {CATALOG.map((entry) => {
          const loaded = loadInstance(entry.id);
          if (!loaded) return null;
          const { model } = loaded;
          return (
            <Link key={entry.id} className="card" to={`/${entry.id}`}>
              <h2>{entry.title}</h2>
              <p>{entry.description}</p>
              <div className="counts">
                <span>{model.permissions().length} permissions</span>
                <span>{model.resources().length} resources</span>
                <span>{model.endpoints().length} endpoints</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
