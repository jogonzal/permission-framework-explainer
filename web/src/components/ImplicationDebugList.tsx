import { useMemo, useState } from 'react';
import { diffImpliesRemovals, graph, type Graph } from 'permission-framework-explainer/core';
import { useLoadedInstance } from '../instance';
import { permissionPath, sourcePath } from '../paths';
import { DiffBlock } from './DiffBlock';
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
  descriptions: ReadonlyMap<string, string | undefined>;
};

function pathCountLabel(count: number, truncated: boolean): string {
  if (truncated) return `${count}+ paths`;
  return count === 1 ? '1 path' : `${count} paths`;
}

function ImplicationDebugRow({
  instanceId,
  adj,
  pair,
  descriptions,
}: {
  instanceId: string;
  adj: Graph;
  pair: ImplicationPair;
  descriptions: ReadonlyMap<string, string | undefined>;
}) {
  const { meta } = useLoadedInstance();
  const [open, setOpen] = useState(false);
  const [showSourceDiff, setShowSourceDiff] = useState(false);
  const result = useMemo(() => graph.findAllPaths(adj, pair.from, pair.to), [adj, pair.from, pair.to]);
  const sourceDiffs = useMemo(
    () => diffImpliesRemovals(meta.files, graph.edgesOnPaths(result.paths)),
    [meta.files, result.paths],
  );

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
              <p className="debug-actions">
                <button type="button" className="debug-btn" onClick={() => setShowSourceDiff((value) => !value)}>
                  {showSourceDiff ? 'Hide YAML changes' : 'Show changes required to remove this connection'}
                </button>
              </p>
              {showSourceDiff ? (
                <div className="yaml-panel">
                  <p className="muted">
                    Unified diff against the model&apos;s existing YAML. Removed lines are{' '}
                    <code>implies</code> entries that participate in this implication; added lines are the
                    same list with those targets taken out.
                  </p>
                  {sourceDiffs.length === 0 ? (
                    <p className="muted">No source YAML changes were found for these edges.</p>
                  ) : (
                    sourceDiffs.map((hunk) => (
                      <DiffBlock key={hunk.name} filename={hunk.name} filenameTo={sourcePath(instanceId, hunk.name)}>
                        {hunk.diff}
                      </DiffBlock>
                    ))
                  )}
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
          descriptions={descriptions}
        />
      ))}
    </div>
  );
}
