import { useMemo, useState } from 'react';
import { graph, type Graph } from 'permission-framework-explainer/core';
import { permissionPath } from '../paths';
import { CodeBlock } from './CodeBlock';
import { IdLink } from './IdLink';
import { ImplicationSubgraph } from './ImplicationSubgraph';

export type ImplicationPair = {
  from: string;
  to: string;
  label: string;
};

type ImplicationDebugListProps = {
  instanceId: string;
  adj: Graph;
  pairs: readonly ImplicationPair[];
  empty: string;
  yamlButtonLabel: string;
  descriptions: ReadonlyMap<string, string | undefined>;
};

function yamlForPaths(paths: readonly (readonly string[])[]): string {
  const grouped = new Map<string, string[]>();
  for (const edge of graph.edgesOnPaths(paths)) {
    const targets = grouped.get(edge.from) ?? [];
    if (!targets.includes(edge.to)) targets.push(edge.to);
    grouped.set(edge.from, targets);
  }

  return [...grouped.entries()]
    .map(([id, targets]) => {
      const items = targets.map((target) => `  - ${target}`).join('\n');
      return `# ${id}\nimplies:\n${items}`;
    })
    .join('\n\n');
}

function pathCountLabel(count: number, truncated: boolean): string {
  if (truncated) return `${count}+ paths`;
  return count === 1 ? '1 path' : `${count} paths`;
}

function ImplicationDebugRow({
  instanceId,
  adj,
  pair,
  yamlButtonLabel,
  descriptions,
}: {
  instanceId: string;
  adj: Graph;
  pair: ImplicationPair;
  yamlButtonLabel: string;
  descriptions: ReadonlyMap<string, string | undefined>;
}) {
  const [open, setOpen] = useState(false);
  const [showYaml, setShowYaml] = useState(false);
  const result = useMemo(() => graph.findAllPaths(adj, pair.from, pair.to), [adj, pair.from, pair.to]);

  return (
    <details
      className="debug-row"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span className="debug-row-label">
          <code>{pair.label}</code>
        </span>
        <span className="debug-row-meta">{pathCountLabel(result.paths.length, result.truncated)}</span>
      </summary>
      {open ? (
        <div className="debug-row-body">
          <h3>Implication paths</h3>
          {result.truncated ? (
            <p className="muted">Showing the first {result.paths.length} paths; more exist in the DAG.</p>
          ) : null}
          {result.paths.length === 0 ? (
            <p className="muted">No path found.</p>
          ) : (
            <ol className="implication-paths">
              {result.paths.map((path) => (
                <li key={path.join('\0')}>
                  <span className="implication-path">
                    {path.map((id, index) => (
                      <span key={`${id}-${index}`} className="implication-path-hop">
                        {index > 0 ? <span className="implication-path-arrow" aria-hidden="true">→</span> : null}
                        <IdLink to={permissionPath(instanceId, id)}>{id}</IdLink>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {result.paths.length > 0 ? (
            <>
              <ImplicationSubgraph
                instanceId={instanceId}
                sourceId={pair.from}
                targetId={pair.to}
                paths={result.paths}
                descriptions={descriptions}
              />
              <p>
                <button type="button" className="debug-btn" onClick={() => setShowYaml((value) => !value)}>
                  {showYaml ? 'Hide YAML changes' : yamlButtonLabel}
                </button>
              </p>
              {showYaml ? (
                <div className="yaml-panel">
                  <p className="muted">
                    These are all <code>implies</code> edges that participate in this implication. Removing
                    all of them disconnects <code>{pair.from}</code> from <code>{pair.to}</code>; breaking
                    every path (at least one edge per path) is enough.
                  </p>
                  <CodeBlock>{yamlForPaths(result.paths)}</CodeBlock>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}

export function ImplicationDebugList({
  instanceId,
  adj,
  pairs,
  empty,
  yamlButtonLabel,
  descriptions,
}: ImplicationDebugListProps) {
  if (pairs.length === 0) return <p className="muted">{empty}</p>;

  return (
    <div className="debug-list">
      {pairs.map((pair) => (
        <ImplicationDebugRow
          key={`${pair.from}->${pair.to}`}
          instanceId={instanceId}
          adj={adj}
          pair={pair}
          yamlButtonLabel={yamlButtonLabel}
          descriptions={descriptions}
        />
      ))}
    </div>
  );
}
