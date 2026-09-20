import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { SiteHeader } from '../components/SiteHeader';
import { CATALOG, CATALOG_BY_ID } from '../catalog';
import { loadInstance } from '../model';
import { sourcePath, switchInstancePath } from '../paths';

function tabClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'active' : '';
}

export function AppLayout() {
  const { instance } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const loaded = instance ? loadInstance(instance) : undefined;

  if (!instance || !CATALOG_BY_ID.has(instance) || !loaded) {
    return (
      <div className="app">
        <SiteHeader />
        <div className="not-found">
          <h1>Unknown instance</h1>
          <p className="muted">There is no permission model named {instance ? <code>{instance}</code> : 'that'}.</p>
          <p>
            <Link to="/">Back to PermCTL</Link>
          </p>
        </div>
      </div>
    );
  }

  const isGraph = location.pathname.includes('/graph');

  return (
    <div className="app">
      <SiteHeader>
        <label>
          <span className="visually-hidden">Instance</span>
          <select
            className="instance-select"
            value={instance}
            onChange={(event) => navigate(switchInstancePath(location.pathname, event.target.value))}
          >
            {CATALOG.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
        </label>
        <nav className="nav-tabs">
          <NavLink to={`/${instance}`} end className={tabClass}>
            Overview
          </NavLink>
          <NavLink to={`/${instance}/permissions`} className={tabClass}>
            Permissions
          </NavLink>
          <NavLink to={`/${instance}/resources`} className={tabClass}>
            Resources
          </NavLink>
          <NavLink to={`/${instance}/endpoints`} className={tabClass}>
            Endpoints
          </NavLink>
          <NavLink to={`/${instance}/graph`} className={tabClass}>
            Graph
          </NavLink>
          <NavLink to={sourcePath(instance)} className={tabClass}>
            YAML
          </NavLink>
        </nav>
      </SiteHeader>
      <main className={isGraph ? 'page-graph' : 'main'}>
        <Outlet context={loaded} />
      </main>
    </div>
  );
}
