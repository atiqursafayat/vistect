// ============================================================================
// Graph Layout - ELK.js + Dagre Fallback
// ============================================================================

import type { Diagram, GraphNode, GraphEdge } from '../index';
import { Elk, ElkNode, ElkEdge } from 'elkjs';
import { graphlib, layout as dagreLayout } from 'dagre';

let elkInstance: Elk | null = null;

async function getElk(): Promise<Elk> {
  if (!elkInstance) {
    elkInstance = new Elk();
  }
  return elkInstance;
}

export interface LayoutResult {
  nodes: Map<string, { x: number; y: number }>;
  edges: Map<string, Array<{ x: number; y: number }>>;
}

export async function computeLayout(
  diagram: Diagram,
  algorithm: 'elk' | 'dagre' = 'elk',
  seed = 42
): Promise<LayoutResult> {
  if (algorithm === 'elk') {
    try {
      return await computeElkLayout(diagram, seed);
    } catch (error) {
      console.warn('ELK layout failed, falling back to dagre:', error);
      return computeDagreLayout(diagram);
    }
  }
  return computeDagreLayout(diagram);
}

async function computeElkLayout(diagram: Diagram, seed: number): Promise<LayoutResult> {
  const elk = await getElk();

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.layered.spacing.nodeNodeBetweenLayers': '50',
      'elk.layered.spacing.edgeNodeBetweenLayers': '30',
      'elk.layered.edgeRouting': 'ORTHOGONAL',
      'elk.randomSeed': String(seed),
    },
    children: diagram.nodes.map(node => ({
      id: node.id,
      width: node.bounds.w,
      height: node.bounds.h,
    })),
    edges: diagram.edges.map(edge => ({
      id: edge.id,
      sources: [edge.from],
      targets: [edge.to],
    })),
  };

  const layouted = await elk.layout(elkGraph);

  const nodes = new Map<string, { x: number; y: number }>();
  const edges = new Map<string, Array<{ x: number; y: number }>>();

  if (layouted.children) {
    for (const child of layouted.children) {
      nodes.set(child.id, { x: child.x || 0, y: child.y || 0 });
    }
  }

  if (layouted.edges) {
    for (const edge of layouted.edges) {
      edges.set(edge.id, (edge.sections || []).map(s => ({
        x: s.startPoint?.x || 0,
        y: s.startPoint?.y || 0,
      })));
    }
  }

  return { nodes, edges };
}

function computeDagreLayout(diagram: Diagram): LayoutResult {
  const g = new graphlib.Graph({ compound: true, multigraph: true });
  g.setGraph({
    rankdir: 'TB',
    nodesep: 50,
    ranksep: 80,
    edgesep: 20,
    marginx: 50,
    marginy: 50,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of diagram.nodes) {
    g.setNode(node.id, { width: node.bounds.w, height: node.bounds.h });
  }

  for (const edge of diagram.edges) {
    g.setEdge(edge.from, edge.to, { id: edge.id });
  }

  dagreLayout(g);

  const nodes = new Map<string, { x: number; y: number }>();
  const edges = new Map<string, Array<{ x: number; y: number }>>();

  for (const node of diagram.nodes) {
    const n = g.node(node.id);
    if (n) nodes.set(node.id, { x: n.x - n.width / 2, y: n.y - n.height / 2 });
  }

  for (const edge of diagram.edges) {
    const e = g.edge(edge.from, edge.to);
    if (e && e.points) {
      edges.set(edge.id, e.points.map(p => ({ x: p.x, y: p.y })));
    }
  }

  return { nodes, edges };
}

export function applyLayout(diagram: Diagram, result: LayoutResult): Diagram {
  const nodes = diagram.nodes.map(node => {
    const pos = result.nodes.get(node.id);
    if (pos) {
      return { ...node, bounds: { ...node.bounds, x: pos.x, y: pos.y } };
    }
    return node;
  });

  return { ...diagram, nodes };
}