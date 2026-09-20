import { Link } from 'react-router-dom';
import { CodeBlock } from '../components/CodeBlock';
import { SiteHeader } from '../components/SiteHeader';
import { BASIC_YAML, CATALOG } from '../catalog';
import { loadInstance } from '../model';

const RUNTIME_TS = `import { loadModel } from 'permission-framework-explainer';

// Build once at process startup. Closures are precomputed.
const model = await loadModel('config/permissions');

// In a request handler, pass the caller's granted ids:
const result = model.check(user.permissions, {
  kind: 'endpoint',
  id: 'DELETE /users/{id}',
});
if (!result.allowed) {
  deny(result.unmet); // permission ids the caller is missing
}

// Resource actions work the same way:
model.check(user.permissions, 'users.write');

// Explain prints the implication path that satisfied each requirement:
const why = model.explain(['admin'], 'GET /users/{id}');
// why.requirements[0].path === ['admin', 'users:write', 'users:read']`;

const RUNTIME_CLI = `$ permctl validate config/permissions
$ permctl check   config/permissions --has admin --endpoint "GET /users/{id}"
$ permctl explain config/permissions --has admin --endpoint "GET /users/{id}"

ALLOW  endpoint "GET /users/{id}"
  [ok] users:read   via admin -> users:write -> users:read`;

export function HomePage() {
  return (
    <div className="app">
      <SiteHeader>
        <nav className="nav-tabs">
          <a href="#examples">Examples</a>
          <a href="#how-it-works">How it works</a>
        </nav>
      </SiteHeader>
      <main className="main main-home">
        <section className="home-hero">
          <p className="eyebrow">Declarative permission DAG</p>
          <h1>PermCTL</h1>
          <p className="lede">
            Browse a complete permission model — every permission, resource, endpoint, and the implication
            DAG — then read how to define the YAML and check it at runtime.
          </p>
        </section>

        <section id="examples" className="docs-section docs-section-flush">
          <header>
            <p className="eyebrow">Examples</p>
            <h2>Explore an instance</h2>
            <p className="lede">
              Each example is a complete model. Open one to browse every permission, resource, and endpoint,
              or view the implication DAG.
            </p>
          </header>
          <div className="card-grid">
            {CATALOG.map((entry) => {
              const loaded = loadInstance(entry.id);
              if (!loaded) return null;
              const { model } = loaded;
              return (
                <Link key={entry.id} className="card" to={`/${entry.id}`}>
                  <p className="card-kicker">{entry.id}</p>
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
        </section>

        <section id="how-it-works" className="docs-section">
          <header>
            <p className="eyebrow">How it works</p>
            <h2>Define the model, then check it at runtime</h2>
            <p className="lede">
              Describe permissions, resources, and API endpoints in YAML. Permissions form a DAG:{' '}
              <code>implies</code> is transitive, endpoint <code>requires</code> is AND. Load the model once
              and call <code>check</code> / <code>explain</code> — or use the <code>permctl</code> CLI.
            </p>
          </header>

          <div className="concept-grid" aria-label="Core concepts">
            <article className="concept">
              <h2>Permission</h2>
              <p>
                A node in the DAG. <code>implies</code> lists the permissions it grants, including everything
                those grant in turn. Cycles are an error.
              </p>
              <p className="mono-note">users:write → users:read</p>
            </article>
            <article className="concept">
              <h2>Resource</h2>
              <p>
                A type with named actions. Each action maps to one permission, so every endpoint that uses{' '}
                <code>users.write</code> stays consistent when that mapping changes.
              </p>
              <p className="mono-note">users.write → users:write</p>
            </article>
            <article className="concept">
              <h2>Endpoint</h2>
              <p>
                An API route. <code>requires</code> is AND-only: every entry must be satisfied. Use{' '}
                <code>public: true</code> for open routes. Empty <code>requires</code> without public is invalid.
              </p>
              <p className="mono-note">DELETE /users/&#123;id&#125;</p>
            </article>
          </div>

          <section id="define">
          <header>
            <p className="eyebrow">01</p>
            <h2>Define the YAML</h2>
            <p className="lede">
              Config is YAML or JSON. Pass a file or a directory: directories are walked recursively, files
              are sorted by path, and the <code>permissions</code>, <code>resources</code>, and{' '}
              <code>endpoints</code> arrays are concatenated. Multi-document YAML (<code>---</code>) and
              unknown keys are rejected.
            </p>
          </header>

          <CodeBlock filename="examples/basic.yaml">{BASIC_YAML}</CodeBlock>

          <div className="docs-split">
            <div>
              <h3>Field reference</h3>
              <ul className="docs-list">
                <li>
                  <code>permissions[].id</code> — lowercase segments joined by <code>:</code>, no dots.
                  Example: <code>users:read</code>, <code>role:admin</code>.
                </li>
                <li>
                  <code>permissions[].implies</code> — permission ids this node grants transitively. Default{' '}
                  <code>[]</code>.
                </li>
                <li>
                  <code>resources[].id</code> / action names — a single <code>[a-z0-9_-]+</code> segment.
                </li>
                <li>
                  <code>resources[].actions</code> — map of action name → permission id.
                </li>
                <li>
                  <code>endpoints[].id</code> — any non-empty unique string, usually <code>METHOD /path</code>.
                </li>
                <li>
                  <code>endpoints[].requires</code> — permission ids (<code>users:read</code>) and/or resource
                  actions (<code>users.write</code>, exactly one dot). All must hold.
                </li>
                <li>
                  <code>endpoints[].public</code> — if <code>true</code>, no permissions are required. Cannot
                  be combined with <code>requires</code>.
                </li>
              </ul>
            </div>
            <div>
              <h3>Id grammar</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Kind</th>
                      <th>Shape</th>
                      <th>Example</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Permission</td>
                      <td>segments + <code>:</code></td>
                      <td>
                        <code>org:repo:write</code>
                      </td>
                    </tr>
                    <tr>
                      <td>Resource / action</td>
                      <td>one segment</td>
                      <td>
                        <code>users</code>, <code>force-push</code>
                      </td>
                    </tr>
                    <tr>
                      <td>Resource action</td>
                      <td>
                        <code>resource.action</code>
                      </td>
                      <td>
                        <code>users.write</code>
                      </td>
                    </tr>
                    <tr>
                      <td>Endpoint</td>
                      <td>any unique string</td>
                      <td>
                        <code>GET /users/&#123;id&#125;</code>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          </section>

          <section id="runtime">
          <header>
            <p className="eyebrow">02</p>
            <h2>Check permissions at runtime</h2>
            <p className="lede">
              Load and validate the config once when the process starts. <code>check</code> unions the
              transitive closures of the granted ids and tests each requirement. It is O(number of
              requirements). Unknown granted ids are ignored for the decision and reported as{' '}
              <code>unknownGranted</code>.
            </p>
          </header>

          <div className="docs-split">
            <div>
              <h3>In a request handler</h3>
              <CodeBlock filename="server.ts">{RUNTIME_TS}</CodeBlock>
            </div>
            <div>
              <h3>With the CLI</h3>
              <CodeBlock filename="shell">{RUNTIME_CLI}</CodeBlock>
              <ul className="docs-list">
                <li>
                  <code>validate</code> — collect every diagnostic (cycles, dangling refs, bad ids).
                </li>
                <li>
                  <code>check</code> — allow or deny a target for a granted set.
                </li>
                <li>
                  <code>explain</code> — same decision, plus the shortest implication path per requirement.
                </li>
                <li>
                  Target is <code>--endpoint</code>, <code>--resource</code> + <code>--action</code>, or{' '}
                  <code>--target resource.action</code>.
                </li>
              </ul>
            </div>
          </div>
          </section>
        </section>
      </main>
    </div>
  );
}
