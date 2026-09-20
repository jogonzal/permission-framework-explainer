import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
} from '@xyflow/react';
import { useCallback, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { graph } from 'permission-framework-explainer/core';
import { layoutGraph } from '../graph-layout';
import { useLoadedInstance } from '../instance';
import { graphPath, permissionPath } from '../paths';
import '@xyflow/react/dist/style.css';

type PermissionNodeData = {
  label: string;
  description?: string;
  selected: boolean;
  inClosure: boolean;
  dim: boolean;
  detailTo: string;
};

type PermNode = Node<PermissionNodeData, 'permission'>;

function PermissionNode({ data }: NodeProps<PermNode>) {
  const cls = ['perm-node'];
  if (data.selected) cls.push('selected');
  else if (data.inClosure) cls.push('in-closure');
  else if (data.dim) cls.push('dim');

  return (
    <div className={cls.join(' ')}>
      <Handle type="target" position={Position.Top} />
      <div className="node-id">{data.label}</div>
      {data.description ? <div className="node-desc">{data.description}</div> : null}
      <Link className="node-link" to={data.detailTo} onClick={(event) => event.stopPropagation()}>
        Details
      </Link>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { permission: PermissionNode };

function GraphCanvas() {
  const { permissionId } = useParams();
  const { meta, model } = useLoadedInstance();
  const navigate = useNavigate();
  const selectedId = permissionId;

  const { nodes, edges } = useMemo(() => {
    const permissions = model.permissions();
    const adj = graph.buildGraph(permissions);
    const closure = selectedId && model.hasPermission(selectedId) ? model.closure(selectedId) : null;

    const rawNodes: Node[] = permissions.map((permission) => {
      const selected = permission.id === selectedId;
      const inClosure = Boolean(closure?.has(permission.id) && !selected);
      return {
        id: permission.id,
        type: 'permission',
        position: { x: 0, y: 0 },
        data: {
          label: permission.id,
          description: permission.description,
          selected,
          inClosure,
          dim: Boolean(closure && !selected && !inClosure),
          detailTo: permissionPath(meta.id, permission.id),
        } satisfies PermissionNodeData,
      };
    });

    const rawEdges: Edge[] = [];
    for (const [from, tos] of adj) {
      for (const to of tos) {
        const highlighted = Boolean(closure?.has(from) && closure.has(to));
        rawEdges.push({
          id: `${from}->${to}`,
          source: from,
          target: to,
          style: {
            stroke: highlighted || !closure ? '#3ee0b0' : '#3a4250',
            strokeWidth: highlighted ? 2 : 1,
          },
        });
      }
    }

    return layoutGraph(rawNodes, rawEdges);
  }, [meta.id, model, selectedId]);

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      navigate(graphPath(meta.id, node.id));
    },
    [meta.id, navigate],
  );

  return (
    <>
      <div className="graph-toolbar">
        <div>
          <strong>Implication DAG</strong>
          <p className="muted">
            An arrow <code>A → B</code> means <code>A</code> implies <code>B</code>.
            {selectedId && model.hasPermission(selectedId) ? (
              <>
                {' '}
                Highlighting the closure of <code>{selectedId}</code>.
              </>
            ) : (
              ' Click a node to highlight what it grants.'
            )}
          </p>
        </div>
        {selectedId ? <Link to={graphPath(meta.id)}>Clear selection</Link> : null}
      </div>
      <div className="graph-shell">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          colorMode="dark"
          fitView
          minZoom={0.2}
          maxZoom={1.6}
        >
          <Background color="#2a3140" gap={20} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
    </>
  );
}

export function GraphPage() {
  return (
    <ReactFlowProvider>
      <GraphCanvas />
    </ReactFlowProvider>
  );
}
