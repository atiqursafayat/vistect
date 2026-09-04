// ============================================================================
// Graph Model - Core Data Structures
// ============================================================================

import type { Diagram, GraphNode, GraphEdge, GraphGroup } from '../index';

// Re-export types
export type { Diagram, GraphNode, GraphEdge, GraphGroup };

// ============================================================================
// Factory Functions
// ============================================================================

export function createNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: `nd_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`,
    type: 'process',
    label: 'New Node',
    bounds: { x: 0, y: 0, w: 120, h: 60 },
    accessibility: { isDecorative: false, includedInReadingOrder: true },
    ...overrides,
  };
}

export function createEdge(overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: `eg_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`,
    from: '',
    to: '',
    style: 'solid',
    isDecisionOutcome: false,
    ...overrides,
  };
}

export function createGroup(overrides: Partial<GraphGroup> = {}): GraphGroup {
  return {
    id: `gr_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`,
    label: 'Group',
    children: [],
    ...overrides,
  };
}

export function createDiagram(type: Diagram['type'] = 'process_flow', overrides: Partial<Diagram> = {}): Diagram {
  return {
    type,
    nodes: [],
    edges: [],
    groups: [],
    terminalNodeIds: [],
    layout: 'layered',
    layoutSeed: 42,
    accessibility: { isDecorative: false, includedInReadingOrder: true },
    ...overrides,
  };
}

// ============================================================================
// Diagram Operations
// ============================================================================

export function addNode(diagram: Diagram, node: GraphNode): Diagram {
  return { ...diagram, nodes: [...diagram.nodes, node] };
}

export function removeNode(diagram: Diagram, nodeId: string): Diagram {
  return {
    ...diagram,
    nodes: diagram.nodes.filter(n => n.id !== nodeId),
    edges: diagram.edges.filter(e => e.from !== nodeId && e.to !== nodeId),
    groups: diagram.groups.map(g => ({ ...g, children: g.children.filter(id => id !== nodeId) })),
  };
}

export function addEdge(diagram: Diagram, edge: GraphEdge): Diagram {
  return { ...diagram, edges: [...diagram.edges, edge] };
}

export function removeEdge(diagram: Diagram, edgeId: string): Diagram {
  return { ...diagram, edges: diagram.edges.filter(e => e.id !== edgeId) };
}

export function addGroup(diagram: Diagram, group: GraphGroup): Diagram {
  return { ...diagram, groups: [...diagram.groups, group] };
}

export function removeGroup(diagram: Diagram, groupId: string): Diagram {
  return { ...diagram, groups: diagram.groups.filter(g => g.id !== groupId) };
}

export function updateNode(diagram: Diagram, nodeId: string, changes: Partial<GraphNode>): Diagram {
  return {
    ...diagram,
    nodes: diagram.nodes.map(n => n.id === nodeId ? { ...n, ...changes } : n),
  };
}

export function updateEdge(diagram: Diagram, edgeId: string, changes: Partial<GraphEdge>): Diagram {
  return {
    ...diagram,
    edges: diagram.edges.map(e => e.id === edgeId ? { ...e, ...changes } : e),
  };
}

// ============================================================================
// Entry/Terminal Helpers
// ============================================================================

export function setEntryNode(diagram: Diagram, nodeId: string): Diagram {
  return { ...diagram, entryNodeId: nodeId };
}

export function addTerminalNode(diagram: Diagram, nodeId: string): Diagram {
  if (diagram.terminalNodeIds.includes(nodeId)) return diagram;
  return { ...diagram, terminalNodeIds: [...diagram.terminalNodeIds, nodeId] };
}

export function removeTerminalNode(diagram: Diagram, nodeId: string): Diagram {
  return { ...diagram, terminalNodeIds: diagram.terminalNodeIds.filter(id => id !== nodeId) };
}