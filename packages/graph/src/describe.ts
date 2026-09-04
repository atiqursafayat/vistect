// ============================================================================
// Graph Describe - Semantic/Spatial Descriptions
// ============================================================================

import type { Diagram, GraphNode, GraphEdge } from '../index';

export interface NodeDescription {
  nodeId: string;
  short: string;
  long: string;
}

export interface RouteDescription {
  from: string;
  to: string;
  description: string;
  steps: string[];
}

export function generateShortDescription(diagram: Diagram): string {
  const { nodes, edges, type } = diagram;
  const nodeCount = nodes.length;
  const edgeCount = edges.length;
  const entryLabel = nodes.find(n => n.id === diagram.entryNodeId)?.label || 'start';
  const terminalLabels = diagram.terminalNodeIds.map(id => nodes.find(n => n.id === id)?.label || id).join(', ');

  switch (type) {
    case 'process_flow':
      return `Process flow with ${nodeCount} steps and ${edgeCount} transitions, starting at ${entryLabel} and ending at ${terminalLabels || 'multiple endpoints'}.`;
    case 'decision_tree':
      const decisions = nodes.filter(n => n.type === 'decision').length;
      return `Decision tree with ${decisions} decision points and ${nodeCount - decisions} actions, branching from ${entryLabel}.`;
    case 'journey_map':
      return `Journey map with ${nodeCount} stages and ${edgeCount} transitions, from ${entryLabel} to ${terminalLabels}.`;
    default:
      return `${type.replace('_', ' ')} diagram with ${nodeCount} nodes and ${edgeCount} connections.`;
  }
}

export function generateLongDescription(diagram: Diagram): string {
  const parts = [generateShortDescription(diagram)];

  // Node list
  const nodesByType = new Map<string, number>();
  for (const node of diagram.nodes) {
    nodesByType.set(node.type, (nodesByType.get(node.type) || 0) + 1);
  }
  parts.push(`Nodes: ${Array.from(nodesByType.entries()).map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`).join(', ')}.`);

  // Entry/exit
  if (diagram.entryNodeId) {
    const entry = diagram.nodes.find(n => n.id === diagram.entryNodeId);
    parts.push(`Entry: ${entry?.label || diagram.entryNodeId}.`);
  }
  if (diagram.terminalNodeIds.length > 0) {
    const terminals = diagram.terminalNodeIds.map(id => {
      const node = diagram.nodes.find(n => n.id === id);
      return node?.label || id;
    }).join(', ');
    parts.push(`Terminals: ${terminals}.`);
  }

  // Key paths
  const paths = tracePaths(diagram);
  if (paths.primary) {
    parts.push(`Primary path: ${paths.primary.join(' → ')}.`);
  }
  if (paths.alternatives.length > 0) {
    parts.push(`Alternative paths: ${paths.alternatives.map(p => p.join(' → ')).join('; ')}.`);
  }

  return parts.join(' ');
}

export function generateNodeDescriptions(diagram: Diagram): NodeDescription[] {
  return diagram.nodes.map(node => {
    const outgoing = diagram.edges.filter(e => e.from === node.id);
    const incoming = diagram.edges.filter(e => e.to === node.id);

    let short = `${node.label} (${node.type})`;
    if (outgoing.length > 0) {
      const targets = outgoing.map(e => {
        const target = diagram.nodes.find(n => n.id === e.to);
        return target?.label || e.to;
      }).join(', ');
      short += ` → ${targets}`;
    }

    let long = `Node ${node.id}: ${node.label}, type ${node.type}. `;
    long += `Positioned at (${node.bounds.x}, ${node.bounds.y}) with size ${node.bounds.w}×${node.bounds.h}. `;

    if (incoming.length > 0) {
      const sources = incoming.map(e => {
        const source = diagram.nodes.find(n => n.id === e.from);
        return source?.label || e.from;
      }).join(', ');
      long += `Reached from ${sources}. `;
    }

    if (outgoing.length > 0) {
      const targets = outgoing.map(e => {
        const target = diagram.nodes.find(n => n.id === e.to);
        return `${e.label || ''} ${target?.label || e.to}`.trim();
      }).join('; ');
      long += `Leads to ${targets}. `;
    }

    return { nodeId: node.id, short, long };
  });
}

export function tracePaths(diagram: Diagram): { primary: string[]; alternatives: string[][] } {
  if (!diagram.entryNodeId) return { primary: [], alternatives: [] };

  const paths: string[][] = [];
  const visited = new Set<string>();

  function dfs(nodeId: string, path: string[]) {
    const node = diagram.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const newPath = [...path, node.label];
    visited.add(nodeId);

    const outgoing = diagram.edges.filter(e => e.from === nodeId);
    if (outgoing.length === 0 || diagram.terminalNodeIds.includes(nodeId)) {
      paths.push(newPath);
      return;
    }

    for (const edge of outgoing) {
      if (!visited.has(edge.to)) {
        dfs(edge.to, newPath);
      }
    }
  }

  dfs(diagram.entryNodeId, []);

  if (paths.length === 0) return { primary: [], alternatives: [] };
  if (paths.length === 1) return { primary: paths[0], alternatives: [] };

  // Find shortest as primary
  const primary = paths.reduce((shortest, current) => current.length < shortest.length ? current : shortest);
  const alternatives = paths.filter(p => p !== primary);

  return { primary, alternatives };
}

export function getConnectionSummary(diagram: Diagram, nodeId: string): string {
  const node = diagram.nodes.find(n => n.id === nodeId);
  if (!node) return 'Unknown node';

  const incoming = diagram.edges.filter(e => e.to === nodeId);
  const outgoing = diagram.edges.filter(e => e.from === nodeId);

  const parts = [];
  if (incoming.length > 0) {
    parts.push(`from ${incoming.map(e => {
      const source = diagram.nodes.find(n => n.id === e.from);
      return `${source?.label || e.from} (${e.label || '→'})`;
    }).join(', ')}`);
  }
  if (outgoing.length > 0) {
    parts.push(`to ${outgoing.map(e => {
      const target = diagram.nodes.find(n => n.id === e.to);
      return `${target?.label || e.to} (${e.label || '→'})`;
    }).join(', ')}`);
  }

  return parts.length > 0 ? parts.join('; ') : 'No connections';
}