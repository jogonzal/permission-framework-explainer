import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';

export const DEFAULT_NODE_WIDTH = 240;
export const DEFAULT_NODE_HEIGHT = 72;

export type LayoutOptions = {
  nodeWidth?: number;
  nodeHeight?: number;
  nodesep?: number;
  ranksep?: number;
};

export function layoutGraph(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {},
): { nodes: Node[]; edges: Edge[] } {
  const nodeWidth = options.nodeWidth ?? DEFAULT_NODE_WIDTH;
  const nodeHeight = options.nodeHeight ?? DEFAULT_NODE_HEIGHT;
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'TB',
    nodesep: options.nodesep ?? 36,
    ranksep: options.ranksep ?? 72,
    marginx: 24,
    marginy: 24,
  });

  for (const node of nodes) {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }
  dagre.layout(g);

  return {
    nodes: nodes.map((node) => {
      const placed = g.node(node.id);
      return {
        ...node,
        position: { x: placed.x - nodeWidth / 2, y: placed.y - nodeHeight / 2 },
        style: { width: nodeWidth, height: nodeHeight },
      };
    }),
    edges,
  };
}
