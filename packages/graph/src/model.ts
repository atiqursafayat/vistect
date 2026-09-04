// ============================================================================
// Graph Model - Core Data Structures
// ============================================================================
//
// Types are **aliases of the domain schema**, not parallel definitions. This
// package previously declared its own `Diagram`/`GraphNode`/`GraphEdge`
// interfaces, which drifted from `@vistect/domain` (no `id`, unbranded ids,
// different accessibility shape) and made every value crossing the boundary
// require a cast.
//
// Pure module: no DOM, no React, no I/O.

import {
  createEdgeId,
  createGroupId,
  createNodeId,
  type Bounds,
  type Diagram,
  type DiagramEdge,
  type DiagramGroup,
  type DiagramNode,
  type DiagramType,
  type NodeId,
} from '@vistect/domain/schema';

export type { Bounds, Diagram, DiagramType, NodeId };

/** Diagram node. Named `GraphNode` locally for readability in graph algorithms. */
export type GraphNode = DiagramNode;
export type GraphEdge = DiagramEdge;
export type GraphGroup = DiagramGroup;

/** Default node footprint in layout units; ELK/dagre reposition but do not resize. */
export const DEFAULT_NODE_BOUNDS: Bounds = { x: 0, y: 0, w: 120, h: 60 };

/**
 * Deterministic default layout seed.
 *
 * Layout must be reproducible so geometry validation and PDF export produce
 * byte-identical output for an unchanged diagram (ADR-003).
 */
export const DEFAULT_LAYOUT_SEED = 42;

const defaultAccessibility = (): GraphNode['accessibility'] => ({
  isDecorative: false,
  includedInReadingOrder: true,
  warnings: [],
});

// ============================================================================
// Factory Functions
// ============================================================================

export function createNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: createNodeId(),
    type: 'process',
    label: 'New Node',
    bounds: { ...DEFAULT_NODE_BOUNDS },
    accessibility: defaultAccessibility(),
    ...overrides,
  };
}

/**
 * Creates an edge between two existing nodes.
 *
 * `from` and `to` are required: an edge with empty endpoints is not a valid
 * graph element, and defaulting them to `''` (the previous behaviour) produced
 * dangling edges that only surfaced later in topology validation.
 */
export function createEdge(from: NodeId, to: NodeId, overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: createEdgeId(),
    from,
    to,
    style: 'solid',
    isDecisionOutcome: false,
    ...overrides,
  };
}

export function createGroup(overrides: Partial<GraphGroup> = {}): GraphGroup {
  return {
    id: createGroupId(),
    label: 'Group',
    children: [],
    ...overrides,
  };
}

// ============================================================================
// Diagram Operations (immutable)
// ============================================================================

export function addNode(diagram: Diagram, node: GraphNode): Diagram {
  return { ...diagram, nodes: [...diagram.nodes, node] };
}

/** Removes a node and every reference to it: edges, group membership, entry/terminal marks. */
export function removeNode(diagram: Diagram, nodeId: NodeId): Diagram {
  const next: Diagram = {
    ...diagram,
    nodes: diagram.nodes.filter((n) => n.id !== nodeId),
    edges: diagram.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
    groups: diagram.groups.map((g) => ({
      ...g,
      children: g.children.filter((id) => id !== nodeId),
    })),
    terminalNodeIds: diagram.terminalNodeIds.filter((id) => id !== nodeId),
  };

  if (next.entryNodeId === nodeId) {
    delete next.entryNodeId;
  }
  return next;
}

export function addEdge(diagram: Diagram, edge: GraphEdge): Diagram {
  return { ...diagram, edges: [...diagram.edges, edge] };
}

export function removeEdge(diagram: Diagram, edgeId: GraphEdge['id']): Diagram {
  return { ...diagram, edges: diagram.edges.filter((e) => e.id !== edgeId) };
}

export function addGroup(diagram: Diagram, group: GraphGroup): Diagram {
  return { ...diagram, groups: [...diagram.groups, group] };
}

export function removeGroup(diagram: Diagram, groupId: GraphGroup['id']): Diagram {
  return { ...diagram, groups: diagram.groups.filter((g) => g.id !== groupId) };
}

export function updateNode(
  diagram: Diagram,
  nodeId: NodeId,
  changes: Partial<Omit<GraphNode, 'id'>>
): Diagram {
  return {
    ...diagram,
    nodes: diagram.nodes.map((n) => (n.id === nodeId ? { ...n, ...changes } : n)),
  };
}

export function updateEdge(
  diagram: Diagram,
  edgeId: GraphEdge['id'],
  changes: Partial<Omit<GraphEdge, 'id'>>
): Diagram {
  return {
    ...diagram,
    edges: diagram.edges.map((e) => (e.id === edgeId ? { ...e, ...changes } : e)),
  };
}

// ============================================================================
// Entry / Terminal Helpers
// ============================================================================

export function setEntryNode(diagram: Diagram, nodeId: NodeId): Diagram {
  return { ...diagram, entryNodeId: nodeId };
}

export function addTerminalNode(diagram: Diagram, nodeId: NodeId): Diagram {
  if (diagram.terminalNodeIds.includes(nodeId)) return diagram;
  return { ...diagram, terminalNodeIds: [...diagram.terminalNodeIds, nodeId] };
}

export function removeTerminalNode(diagram: Diagram, nodeId: NodeId): Diagram {
  return {
    ...diagram,
    terminalNodeIds: diagram.terminalNodeIds.filter((id) => id !== nodeId),
  };
}
