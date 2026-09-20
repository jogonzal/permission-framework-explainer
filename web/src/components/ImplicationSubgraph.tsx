import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
} from '@xyflow/react';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { graph } from 'permission-framework-explainer/core';
import { layoutGraph } from '../graph-layout';
import { permissionPath } from '../paths';
import '@xyflow/react/dist/style.css';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 48;

type CompactNodeData = {
  label: string;
  description?: string;
  kind: 'source' | 'target' | 'mid';
};

type CompactNode = Node<CompactNodeData, 'compact'>;

function CompactPermissionNode({ data }: NodeProps<CompactNode>) {
  const cls = ['perm-node', 'compact'];
  if (data.kind === 'source' || data.kind === 'target') cls.push('selected');
  else cls.push('in-closure');

  return (
    <div className={cls.join(' ')}>
      <Handle type="target" position={Position.Top} />
      <div className="node-id">{data.label}</div>
      {data.description ? <div className="node-desc">{data.description}</div> : null}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { compact: CompactPermissionNode };

type ImplicationSubgraphProps = {
  instanceId: string;
  sourceId: string;
  targetId: string;
  paths: readonly (readonly string[])[];
  descriptions: ReadonlyMap<string, string | undefined>;
};

function ImplicationSubgraphCanvas({
  instanceId,
  sourceId,
  targetId,
  paths,
  descriptions,
}: ImplicationSubgraphProps) {
  const navigate = useNavigate();
  const { nodes, edges } = useMemo(() => {
    const ids = new Set<string>();
    for (const path of paths) {
      for (const id of path) ids.add(id);
    }

    const rawNodes: Node[] = [...ids].map((id) => {
      const kind = id === sourceId ? 'source' : id === targetId ? 'target' : 'mid';
      return {
        id,
        type: 'compact',
        position: { x: 0, y: 0 },
        data: {
          label: id,
          description: descriptions.get(id),
          kind,
        } satisfies CompactNodeData,
      };
    });

    const rawEdges: Edge[] = graph.edgesOnPaths(paths).map((edge) => ({
      id: `${edge.from}->${edge.to}`,
      source: edge.from,
      target: edge.to,
      style: { stroke: '#3ee0b0', strokeWidth: 2 },
    }));

    return layoutGraph(rawNodes, rawEdges, {
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
      nodesep: 24,
      ranksep: 48,
    });
  }, [descriptions, paths, sourceId, targetId]);

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      navigate(permissionPath(instanceId, node.id));
    },
    [instanceId, navigate],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      colorMode="dark"
      fitView
      minZoom={0.3}
      maxZoom={1.6}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#2a3140" gap={20} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export function ImplicationSubgraph(props: ImplicationSubgraphProps) {
  return (
    <div className="implication-subgraph">
      <ReactFlowProvider>
        <ImplicationSubgraphCanvas {...props} />
      </ReactFlowProvider>
    </div>
  );
}
