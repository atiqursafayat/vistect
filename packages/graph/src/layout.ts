// ============================================================================
// Graph Layout - ELK.js with dagre fallback
// ============================================================================
//
// Layout must be **deterministic**: the same diagram and seed must produce the
// same geometry, because geometry feeds visual validation and PDF export, and
// both are hash-bound to a document version (ADR-003).
//
// ELK is loaded lazily (`import('elkjs')`) so its ~500 kB bundle is only fetched
// when a diagram is laid out. If ELK fails — worker unavailable, WASM blocked —
// dagre runs synchronously as a fallback (ADR-007), and the caller is told which
// engine produced the result so a degraded layout can be surfaced in the UI.

import { graphlib, layout as dagreLayout } from 'dagre';

import type { Diagram, NodeId } from './model';

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutResult {
  /** Node id → top-left corner in layout units. */
  nodes: Map<NodeId, LayoutPoint>;
  /** Edge id → polyline waypoints, source to target. */
  edges: Map<string, LayoutPoint[]>;
  /** Engine that produced this result; `dagre` indicates ELK was unavailable. */
  engine: 'elk' | 'dagre';
}

export type LayoutAlgorithm = 'elk' | 'dagre';

/** Spacing constants shared by both engines so fallback geometry stays comparable. */
const SPACING = {
  betweenLayers: 50,
  betweenNodes: 50,
  edgeNode: 30,
  margin: 50,
} as const;

// ELK's public types are not exported in a form usable without importing the
// module, so the minimal request/response shapes are declared locally.
interface ElkGraphNode {
  id: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
}

interface ElkGraphEdge {
  id: string;
  sources: string[];
  targets: string[];
  sections?: {
    startPoint: LayoutPoint;
    endPoint: LayoutPoint;
    bendPoints?: LayoutPoint[];
  }[];
}

interface ElkGraph {
  id: string;
  layoutOptions: Record<string, string>;
  children: ElkGraphNode[];
  edges: ElkGraphEdge[];
}

interface ElkEngine {
  layout(graph: ElkGraph): Promise<ElkGraph>;
}

let elkInstance: ElkEngine | null = null;

/** Lazily constructs the ELK engine. `elkjs` exports its constructor as default. */
async function getElk(): Promise<ElkEngine> {
  if (elkInstance === null) {
    const { default: ELKConstructor } = await import('elkjs');
    elkInstance = new ELKConstructor() as ElkEngine;
  }
  return elkInstance;
}

/** Resets the cached engine. Test-only seam. */
export function resetLayoutEngine(): void {
  elkInstance = null;
}

export async function computeLayout(
  diagram: Diagram,
  algorithm: LayoutAlgorithm = 'elk',
  seed = diagram.layoutSeed
): Promise<LayoutResult> {
  if (algorithm === 'dagre') {
    return computeDagreLayout(diagram);
  }

  try {
    return await computeElkLayout(diagram, seed);
  } catch (error) {
    // Surfaced rather than swallowed: a silent fallback would hide the fact that
    // geometry came from a different engine than the golden files assume.
    console.warn('ELK layout failed; falling back to dagre.', error);
    return computeDagreLayout(diagram);
  }
}

async function computeElkLayout(diagram: Diagram, seed: number): Promise<LayoutResult> {
  const elk = await getElk();

  const request: ElkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.layered.spacing.nodeNodeBetweenLayers': String(SPACING.betweenLayers),
      'elk.layered.spacing.edgeNodeBetweenLayers': String(SPACING.edgeNode),
      'elk.spacing.nodeNode': String(SPACING.betweenNodes),
      'elk.layered.edgeRouting': 'ORTHOGONAL',
      'elk.randomSeed': String(seed),
    },
    children: diagram.nodes.map((node) => ({
      id: node.id,
      width: node.bounds.w,
      height: node.bounds.h,
    })),
    edges: diagram.edges.map((edge) => ({
      id: edge.id,
      sources: [edge.from],
      targets: [edge.to],
    })),
  };

  const laid = await elk.layout(request);

  const nodes = new Map<NodeId, LayoutPoint>();
  for (const child of laid.children) {
    nodes.set(child.id as NodeId, { x: child.x ?? 0, y: child.y ?? 0 });
  }

  const edges = new Map<string, LayoutPoint[]>();
  for (const edge of laid.edges) {
    const waypoints: LayoutPoint[] = [];
    for (const section of edge.sections ?? []) {
      // Full polyline: start, any bend points, end. Keeping only `startPoint`
      // (the previous behaviour) discarded orthogonal routing entirely.
      waypoints.push(section.startPoint);
      waypoints.push(...(section.bendPoints ?? []));
      waypoints.push(section.endPoint);
    }
    edges.set(edge.id, waypoints);
  }

  return { nodes, edges, engine: 'elk' };
}

function computeDagreLayout(diagram: Diagram): LayoutResult {
  const g = new graphlib.Graph({ multigraph: true });
  g.setGraph({
    rankdir: 'TB',
    nodesep: SPACING.betweenNodes,
    ranksep: SPACING.betweenLayers + SPACING.edgeNode,
    edgesep: 20,
    marginx: SPACING.margin,
    marginy: SPACING.margin,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of diagram.nodes) {
    g.setNode(node.id, { width: node.bounds.w, height: node.bounds.h });
  }

  // `multigraph` plus the edge id as name keeps parallel edges distinct; without
  // it, two edges between the same pair collapsed into one.
  for (const edge of diagram.edges) {
    g.setEdge(edge.from, edge.to, {}, edge.id);
  }

  dagreLayout(g);

  const nodes = new Map<NodeId, LayoutPoint>();
  for (const node of diagram.nodes) {
    const laid = g.node(node.id);
    if (laid === undefined) continue;
    // dagre reports centres; the rest of the pipeline uses top-left corners.
    nodes.set(node.id, { x: laid.x - laid.width / 2, y: laid.y - laid.height / 2 });
  }

  const edges = new Map<string, LayoutPoint[]>();
  for (const edge of diagram.edges) {
    const laid = g.edge(edge.from, edge.to, edge.id);
    if (laid?.points === undefined) continue;
    edges.set(
      edge.id,
      laid.points.map((p) => ({ x: p.x, y: p.y }))
    );
  }

  return { nodes, edges, engine: 'dagre' };
}

/** Applies computed positions to a diagram, returning a new diagram. */
export function applyLayout(diagram: Diagram, result: LayoutResult): Diagram {
  return {
    ...diagram,
    nodes: diagram.nodes.map((node) => {
      const position = result.nodes.get(node.id);
      if (position === undefined) return node;
      return { ...node, bounds: { ...node.bounds, x: position.x, y: position.y } };
    }),
  };
}
