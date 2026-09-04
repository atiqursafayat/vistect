// ============================================================================
// Graph Describe - Semantic/Spatial Descriptions
// ============================================================================
//
// Deterministic prose describing a diagram's structure (spec §12.4, §9.3).
// Semantic descriptions state topology ("A leads to B when yes"); spatial
// descriptions state geometry ("positioned below A"). Both are template-driven,
// so they are deterministic claims (§16.1) that regenerate identically.

import type { Diagram, GraphNode, NodeId } from './model';
import { findPaths } from './traversal';

export interface NodeDescription {
  nodeId: NodeId;
  short: string;
  long: string;
}

export interface RouteDescription {
  from: NodeId;
  to: NodeId;
  description: string;
  steps: string[];
}

export interface TracedPaths {
  /** Shortest entry-to-terminal route, or `null` when no route exists. */
  primary: string[] | null;
  alternatives: string[][];
}

/** Index of nodes by id; avoids repeated O(n) `find` calls in description loops. */
function indexNodes(diagram: Diagram): Map<NodeId, GraphNode> {
  return new Map(diagram.nodes.map((node) => [node.id, node]));
}

function labelOf(nodes: Map<NodeId, GraphNode>, id: NodeId): string {
  return nodes.get(id)?.label ?? id;
}

/** Human-readable diagram type, e.g. `process_flow` → `process flow`. */
function readableType(type: Diagram['type']): string {
  return type.replace(/_/g, ' ');
}

export function generateShortDescription(diagram: Diagram): string {
  const nodes = indexNodes(diagram);
  const nodeCount = diagram.nodes.length;
  const edgeCount = diagram.edges.length;

  const entryLabel =
    diagram.entryNodeId === undefined ? 'an unspecified start' : labelOf(nodes, diagram.entryNodeId);
  const terminalLabels = diagram.terminalNodeIds.map((id) => labelOf(nodes, id)).join(', ');
  const endpointPhrase = terminalLabels === '' ? 'no marked endpoint' : terminalLabels;

  switch (diagram.type) {
    case 'process_flow':
      return `Process flow with ${nodeCount} steps and ${edgeCount} transitions, starting at ${entryLabel} and ending at ${endpointPhrase}.`;

    case 'decision_tree': {
      const decisions = diagram.nodes.filter((n) => n.type === 'decision').length;
      return `Decision tree with ${decisions} decision ${decisions === 1 ? 'point' : 'points'} and ${nodeCount - decisions} actions, branching from ${entryLabel}.`;
    }

    case 'journey_map':
      return `Journey map with ${nodeCount} stages and ${edgeCount} transitions, from ${entryLabel} to ${endpointPhrase}.`;

    case 'system_architecture':
    case 'org_structure':
      return `${readableType(diagram.type)} diagram with ${nodeCount} nodes and ${edgeCount} connections.`;
  }
}

export function generateLongDescription(diagram: Diagram): string {
  const nodes = indexNodes(diagram);
  const parts = [generateShortDescription(diagram)];

  const countsByType = new Map<GraphNode['type'], number>();
  for (const node of diagram.nodes) {
    countsByType.set(node.type, (countsByType.get(node.type) ?? 0) + 1);
  }
  if (countsByType.size > 0) {
    const summary = [...countsByType.entries()]
      .map(([type, count]) => `${count} ${type}${count === 1 ? '' : 's'}`)
      .join(', ');
    parts.push(`Nodes: ${summary}.`);
  }

  if (diagram.entryNodeId !== undefined) {
    parts.push(`Entry: ${labelOf(nodes, diagram.entryNodeId)}.`);
  }
  if (diagram.terminalNodeIds.length > 0) {
    parts.push(`Terminals: ${diagram.terminalNodeIds.map((id) => labelOf(nodes, id)).join(', ')}.`);
  }

  const { primary, alternatives } = tracePaths(diagram);
  if (primary !== null) {
    parts.push(`Primary path: ${primary.join(' → ')}.`);
  }
  if (alternatives.length > 0) {
    parts.push(`Alternative paths: ${alternatives.map((p) => p.join(' → ')).join('; ')}.`);
  }

  return parts.join(' ');
}

export function generateNodeDescriptions(diagram: Diagram): NodeDescription[] {
  const nodes = indexNodes(diagram);

  return diagram.nodes.map((node) => {
    const outgoing = diagram.edges.filter((e) => e.from === node.id);
    const incoming = diagram.edges.filter((e) => e.to === node.id);

    let short = `${node.label} (${node.type})`;
    if (outgoing.length > 0) {
      short += ` → ${outgoing.map((e) => labelOf(nodes, e.to)).join(', ')}`;
    }

    const longParts = [
      `Node ${node.id}: ${node.label}, type ${node.type}.`,
      `Positioned at (${node.bounds.x}, ${node.bounds.y}) with size ${node.bounds.w}×${node.bounds.h}.`,
    ];

    if (incoming.length > 0) {
      longParts.push(`Reached from ${incoming.map((e) => labelOf(nodes, e.from)).join(', ')}.`);
    }

    if (outgoing.length > 0) {
      const targets = outgoing
        .map((e) => {
          const target = labelOf(nodes, e.to);
          return e.label !== undefined && e.label !== '' ? `${e.label}: ${target}` : target;
        })
        .join('; ');
      longParts.push(`Leads to ${targets}.`);
    }

    return { nodeId: node.id, short, long: longParts.join(' ') };
  });
}

/**
 * Entry-to-terminal routes, shortest first.
 *
 * Routes are enumerated with a shared BFS (`findPaths`) rather than a DFS with a
 * global `visited` set. The previous DFS marked nodes visited across *all*
 * branches, so any node shared by two routes silenced every route after the
 * first — a diamond-shaped flow reported one path instead of two.
 */
export function tracePaths(diagram: Diagram, maxAlternatives = 5): TracedPaths {
  if (diagram.entryNodeId === undefined) return { primary: null, alternatives: [] };

  const nodes = indexNodes(diagram);
  const terminals =
    diagram.terminalNodeIds.length > 0
      ? diagram.terminalNodeIds
      : // No marked terminals: treat sinks (no outgoing edges) as endpoints.
        diagram.nodes
          .filter((node) => !diagram.edges.some((edge) => edge.from === node.id))
          .map((node) => node.id);

  const routes: NodeId[][] = [];
  for (const terminal of terminals) {
    routes.push(...findPaths(diagram, diagram.entryNodeId, terminal, maxAlternatives + 1));
  }

  if (routes.length === 0) return { primary: null, alternatives: [] };

  routes.sort((a, b) => a.length - b.length);
  const asLabels = (route: NodeId[]) => route.map((id) => labelOf(nodes, id));

  const [shortest, ...rest] = routes;
  if (shortest === undefined) return { primary: null, alternatives: [] };

  return {
    primary: asLabels(shortest),
    alternatives: rest.slice(0, maxAlternatives).map(asLabels),
  };
}

export function getConnectionSummary(diagram: Diagram, nodeId: NodeId): string {
  const nodes = indexNodes(diagram);
  if (!nodes.has(nodeId)) return 'Unknown node';

  const describeEdge = (label: string | undefined, otherLabel: string): string =>
    label !== undefined && label !== '' ? `${otherLabel} (${label})` : otherLabel;

  const incoming = diagram.edges.filter((e) => e.to === nodeId);
  const outgoing = diagram.edges.filter((e) => e.from === nodeId);

  const parts: string[] = [];
  if (incoming.length > 0) {
    parts.push(
      `from ${incoming.map((e) => describeEdge(e.label, labelOf(nodes, e.from))).join(', ')}`
    );
  }
  if (outgoing.length > 0) {
    parts.push(`to ${outgoing.map((e) => describeEdge(e.label, labelOf(nodes, e.to))).join(', ')}`);
  }

  return parts.length > 0 ? parts.join('; ') : 'No connections';
}

/** Describes a specific route between two nodes, step by step. */
export function describeRoute(diagram: Diagram, from: NodeId, to: NodeId): RouteDescription | null {
  const paths = findPaths(diagram, from, to, 1);
  const path = paths[0];
  if (path === undefined) return null;

  const nodes = indexNodes(diagram);
  const steps: string[] = [];

  for (let i = 0; i < path.length - 1; i++) {
    const current = path[i];
    const next = path[i + 1];
    if (current === undefined || next === undefined) continue;
    const edge = diagram.edges.find((e) => e.from === current && e.to === next);
    const condition =
      edge?.label !== undefined && edge.label !== '' ? ` when ${edge.label}` : '';
    steps.push(`${labelOf(nodes, current)} leads to ${labelOf(nodes, next)}${condition}.`);
  }

  return {
    from,
    to,
    description: `Route from ${labelOf(nodes, from)} to ${labelOf(nodes, to)} in ${steps.length} ${steps.length === 1 ? 'step' : 'steps'}.`,
    steps,
  };
}
