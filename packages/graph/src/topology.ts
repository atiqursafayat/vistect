// ============================================================================
// Graph Topology Validation
// ============================================================================
//
// Structural checks from spec §12.4: disconnected nodes, unreachable nodes,
// cycles, missing decision outcomes, duplicate edges, ambiguous labels.
//
// Errors block; warnings surface for review. The distinction depends on diagram
// type: a cycle is invalid in a process flow but expected in a system
// architecture.

import type { Diagram, NodeId } from './model';
import { buildAdjacency, findReachableNodes, hasCycle } from './traversal';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** Diagram types that model a directed, acyclic flow with a single entry point. */
const ACYCLIC_FLOW_TYPES = new Set<Diagram['type']>(['process_flow', 'decision_tree']);

export function validateStructure(diagram: Diagram): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { nodes, edges } = diagram;
  const isAcyclicFlow = ACYCLIC_FLOW_TYPES.has(diagram.type);

  // Referential integrity first: later checks assume edges point at real nodes.
  const nodeIds = new Set<NodeId>(nodes.map((n) => n.id));
  for (const edge of edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push(`Edge ${edge.id} references missing source node ${edge.from}`);
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`Edge ${edge.id} references missing target node ${edge.to}`);
    }
  }
  if (diagram.entryNodeId !== undefined && !nodeIds.has(diagram.entryNodeId)) {
    errors.push(`Entry node ${diagram.entryNodeId} does not exist`);
  }
  for (const terminalId of diagram.terminalNodeIds) {
    if (!nodeIds.has(terminalId)) {
      errors.push(`Terminal node ${terminalId} does not exist`);
    }
  }
  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  // Disconnected nodes.
  if (nodes.length > 1) {
    const connected = new Set<NodeId>();
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

  // Reachability from the entry node.
  if (diagram.entryNodeId !== undefined) {
    const reachable = findReachableNodes(diagram, diagram.entryNodeId);
    for (const node of nodes) {
      if (nodes.length > 1 && !reachable.has(node.id)) {
        warnings.push(`Node ${node.id} (${node.label}) is unreachable from entry`);
      }
    }
  } else if (isAcyclicFlow) {
    // Reported once, as an error: a flow without an entry point has no defined
    // reading order. The duplicate warning that used to accompany it is gone.
    errors.push('Process/decision diagram missing entry node');
  }

  // Cycles.
  if (hasCycle(diagram)) {
    if (isAcyclicFlow) {
      errors.push('Diagram contains a cycle (invalid for process/decision types)');
    } else {
      warnings.push('Diagram contains a cycle');
    }
  }

  // Decision nodes need both outcomes so every branch is navigable.
  for (const node of nodes) {
    if (node.type !== 'decision') continue;

    const outgoing = edges.filter((e) => e.from === node.id);
    const hasAffirmative = outgoing.some(
      (e) => e.outcomeLabel === 'yes' || e.outcomeLabel === 'true'
    );
    const hasNegative = outgoing.some((e) => e.outcomeLabel === 'no' || e.outcomeLabel === 'false');

    // Report each missing branch separately; the previous single message named
    // only one even when both were absent.
    if (!hasAffirmative) {
      errors.push(`Decision node ${node.id} (${node.label}) missing yes/true outcome`);
    }
    if (!hasNegative) {
      errors.push(`Decision node ${node.id} (${node.label}) missing no/false outcome`);
    }
  }

  // Duplicate edges (same endpoints and label).
  const edgeKeys = new Set<string>();
  for (const edge of edges) {
    const key = `${edge.from}\u0000${edge.to}\u0000${edge.label ?? ''}`;
    if (edgeKeys.has(key)) {
      warnings.push(`Duplicate edge: ${edge.from} → ${edge.to}`);
    }
    edgeKeys.add(key);
  }

  // Ambiguous branching: an unlabelled edge leaving a node that has several
  // outgoing edges cannot be described unambiguously to a screen reader.
  const outgoingCounts = buildAdjacency(diagram);
  const reportedAmbiguous = new Set<NodeId>();
  for (const edge of edges) {
    if (edge.label !== undefined && edge.label !== '') continue;
    if ((outgoingCounts.get(edge.from)?.length ?? 0) <= 1) continue;
    if (reportedAmbiguous.has(edge.from)) continue;

    reportedAmbiguous.add(edge.from);
    warnings.push(`Node ${edge.from} has multiple outgoing edges but at least one is unlabelled`);
  }

  if (diagram.terminalNodeIds.length === 0) {
    warnings.push('Diagram missing terminal nodes');
  }

  return { valid: errors.length === 0, errors, warnings };
}
