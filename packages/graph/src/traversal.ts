// ============================================================================
// Graph Traversal Primitives
// ============================================================================
//
// Shared BFS/DFS helpers. Extracted so topology validation, path tracing and
// description generation share one adjacency representation instead of rebuilding
// it (previously done with `diagram: any` in three places).

import type { Diagram, NodeId } from './model';

/** Adjacency list: node id → ids of its direct successors, in edge order. */
export function buildAdjacency(diagram: Pick<Diagram, 'edges'>): Map<NodeId, NodeId[]> {
  const adjacency = new Map<NodeId, NodeId[]>();
  for (const edge of diagram.edges) {
    const successors = adjacency.get(edge.from);
    if (successors === undefined) {
      adjacency.set(edge.from, [edge.to]);
    } else {
      successors.push(edge.to);
    }
  }
  return adjacency;
}

/** Reverse adjacency list: node id → ids of its direct predecessors. */
export function buildReverseAdjacency(diagram: Pick<Diagram, 'edges'>): Map<NodeId, NodeId[]> {
  const adjacency = new Map<NodeId, NodeId[]>();
  for (const edge of diagram.edges) {
    const predecessors = adjacency.get(edge.to);
    if (predecessors === undefined) {
      adjacency.set(edge.to, [edge.from]);
    } else {
      predecessors.push(edge.from);
    }
  }
  return adjacency;
}

/** Nodes reachable from `entryId`, inclusive. Breadth-first. */
export function findReachableNodes(diagram: Pick<Diagram, 'edges'>, entryId: NodeId): Set<NodeId> {
  const adjacency = buildAdjacency(diagram);
  const reachable = new Set<NodeId>();
  const queue: NodeId[] = [entryId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || reachable.has(current)) continue;
    reachable.add(current);
    for (const neighbour of adjacency.get(current) ?? []) {
      if (!reachable.has(neighbour)) queue.push(neighbour);
    }
  }

  return reachable;
}

/**
 * Whether the directed graph contains a cycle.
 *
 * Iterative DFS with an explicit stack: a deeply nested diagram would otherwise
 * risk exhausting the call stack, and this runs on the UI thread.
 */
export function hasCycle(diagram: Pick<Diagram, 'nodes' | 'edges'>): boolean {
  const adjacency = buildAdjacency(diagram);
  const visited = new Set<NodeId>();
  const onStack = new Set<NodeId>();

  for (const node of diagram.nodes) {
    if (visited.has(node.id)) continue;

    const stack: { id: NodeId; nextIndex: number }[] = [{ id: node.id, nextIndex: 0 }];
    visited.add(node.id);
    onStack.add(node.id);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame === undefined) break;

      const neighbours = adjacency.get(frame.id) ?? [];
      if (frame.nextIndex >= neighbours.length) {
        onStack.delete(frame.id);
        stack.pop();
        continue;
      }

      const neighbour = neighbours[frame.nextIndex];
      frame.nextIndex++;
      if (neighbour === undefined) continue;

      if (onStack.has(neighbour)) return true;
      if (!visited.has(neighbour)) {
        visited.add(neighbour);
        onStack.add(neighbour);
        stack.push({ id: neighbour, nextIndex: 0 });
      }
    }
  }

  return false;
}

/**
 * All simple paths from `fromId` to `toId`, shortest first.
 *
 * `maxPaths` bounds the result because path count is exponential in a dense
 * graph; callers present only the primary route plus a few alternatives (§12.4).
 */
export function findPaths(
  diagram: Pick<Diagram, 'edges'>,
  fromId: NodeId,
  toId: NodeId,
  maxPaths = 10
): NodeId[][] {
  const adjacency = buildAdjacency(diagram);
  const paths: NodeId[][] = [];
  const queue: NodeId[][] = [[fromId]];

  while (queue.length > 0 && paths.length < maxPaths) {
    const path = queue.shift();
    if (path === undefined) continue;

    const last = path[path.length - 1];
    if (last === undefined) continue;
    if (last === toId) {
      paths.push(path);
      continue;
    }

    for (const neighbour of adjacency.get(last) ?? []) {
      // Skip nodes already on this path: revisiting one would loop forever.
      if (path.includes(neighbour)) continue;
      queue.push([...path, neighbour]);
    }
  }

  return paths;
}
