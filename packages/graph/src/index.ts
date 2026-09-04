// ============================================================================
// Graph Package - Diagram Topology, Geometry, Layout
// ============================================================================

export * from './model';
export * from './topology';
export * from './geometry';
export * from './layout';
export * from './describe';
export * from './svg';

// ============================================================================
// Types
// ============================================================================

export interface GraphNode {
  id: string;
  type: 'start' | 'end' | 'process' | 'decision' | 'input_output' | 'group';
  label: string;
  bounds: { x: number; y: number; w: number; h: number };
  groupId?: string;
  accessibility: any;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  style: 'solid' | 'dashed' | 'dotted';
  isDecisionOutcome: boolean;
  outcomeLabel?: 'yes' | 'no' | 'true' | 'false' | 'other';
}

export interface GraphGroup {
  id: string;
  label: string;
  bounds?: { x: number; y: number; w: number; h: number };
  children: string[];
}

export interface Diagram {
  type: 'process_flow' | 'decision_tree' | 'journey_map' | 'system_architecture' | 'org_structure';
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: GraphGroup[];
  entryNodeId?: string;
  terminalNodeIds: string[];
  layout: 'layered' | 'force' | 'hierarchical';
  layoutSeed: number;
  accessibility: any;
}