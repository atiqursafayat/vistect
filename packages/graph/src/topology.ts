// ============================================================================
// Graph Topology Validation
// ============================================================================

import type { Diagram, GraphNode, GraphEdge } from '../index';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateStructure(diagram: Diagram): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { nodes, edges } = diagram;

  // Check for disconnected nodes
  if (nodes.length > 1) {
    const connected = new Set<string>();
    for (const edge of edges) {
      connected.add(edge.from);
      connected.add(edge.to);
    }
    for (const node of nodes) {
      if (!connected.has(node.id)) {
        warnings.push(`Node ${node.id} (${node.label}) is disconnected`);
      }
    }
  }

  // Check unreachable nodes from entry
  if (diagram.entryNodeId) {
    const reachable = findReachableNodes(diagram, diagram.entryNodeId);
    for (const node of nodes) {
      if (!reachable.has(node.id) && nodes.length > 1) {
        warnings.push(`Node ${node.id} (${node.label}) is unreachable from entry`);
      }
    }
  } else if (diagram.type === 'process_flow' || diagram.type === 'decision_tree') {
    warnings.push('Diagram missing entry node');
  }

  // Check for cycles
  if (hasCycle(diagram)) {
    if (diagram.type === 'process_flow' || diagram.type === 'decision_tree') {
      errors.push('Diagram contains a cycle (invalid for process/decision types)');
    } else {
      warnings.push('Diagram contains a cycle');
    }
  }

  // Check decision nodes have outcomes
  for (const node of nodes) {
    if (node.type === 'decision') {
      const outgoing = edges.filter(e => e.from === node.id);
      const hasYes = outgoing.some(e => e.outcomeLabel === 'yes' || e.outcomeLabel === 'true');
      const hasNo = outgoing.some(e => e.outcomeLabel === 'no' || e.outcomeLabel === 'false');
      if (!hasYes || !hasNo) {
        errors.push(`Decision node ${node.id} missing ${!hasYes ? 'yes/true' : 'no/false'} outcome`);
      }
    }
  }

  // Check for duplicate edges
  const edgeKeys = new Set<string>();
  for (const edge of edges) {
    const key = `${edge.from}-${edge.to}-${edge.label || ''}`;
    if (edgeKeys.has(key)) {
      warnings.push(`Duplicate edge: ${edge.from} → ${edge.to}`);
    }
    edgeKeys.add(key);
  }

  // Check for ambiguous edge labels
  for (const edge of edges) {
    if (!edge.label) {
      const outgoing = edges.filter(e => e.from === edge.from);
      if (outgoing.length > 1) {
        warnings.push(`Edge from ${edge.from} has no label but multiple outgoing edges exist`);
      }
    }
  }

  // Check entry/terminal nodes
  if (!diagram.entryNodeId && (diagram.type === 'process_flow' || diagram.type === 'decision_tree')) {
    errors.push('Process/decision diagram missing entry node');
  }
  if (diagram.terminalNodeIds.length === 0) {
    warnings.push('Diagram missing terminal nodes');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function findReachableNodes(diagram: any, entryId: string): Set<string> {
  const reachable = new Set<string>();
  const queue = [entryId];
  const adjacency = new Map<string, string[]>();

  for (const edge of diagram.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push(edge.to);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    const neighbors = adjacency.get(current) || [];
    for (const neighbor of neighbors) {
      if (!reachable.has(neighbor)) queue.push(neighbor);
    }
  }

  return reachable;
}

function hasCycle(diagram: any): boolean {
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const adjacency = new Map<string, string[]>();

  for (const edge of diagram.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push(edge.to);
  }

  function dfs(node: string): boolean {
    visited.add(node);
    recStack.add(node);

    for (const neighbor of adjacency.get(node) || []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        return true;
      }
    }

    recStack.delete(node);
    return false;
  }

  for (const node of diagram.nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) return true;
    }
  }

  return false;
}