// ============================================================================
// Graph Geometry - Bounds, Intersection, Distance
// ============================================================================
//
// Pure planar geometry used by layout validation (edge crossings, node overlap,
// label collision). `Bounds` is re-exported from the domain schema so geometry
// results can flow into findings without conversion.

import type { Bounds } from '@vistect/domain/schema';

export type { Bounds };

export interface Point {
  x: number;
  y: number;
}

export function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

export function boundsWithin(inner: Bounds, outer: Bounds): boolean {
  return inner.x >= outer.x &&
         inner.y >= outer.y &&
         inner.x + inner.w <= outer.x + outer.w &&
         inner.y + inner.h <= outer.y + outer.h;
}

export function getBoundsCenter(bounds: Bounds): Point {
  return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
}

export function expandBounds(bounds: Bounds, padding: number): Bounds {
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    w: bounds.w + 2 * padding,
    h: bounds.h + 2 * padding,
  };
}

export function intersectBounds(a: Bounds, b: Bounds): Bounds | null {
  if (!boundsOverlap(a, b)) return null;
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.w, b.x + b.w) - x;
  const h = Math.min(a.y + a.h, b.y + b.h) - y;
  return { x, y, w, h };
}

export function unionBounds(a: Bounds, b: Bounds): Bounds {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.max(a.x + a.w, b.x + b.w) - x;
  const h = Math.max(a.y + a.h, b.y + b.h) - y;
  return { x, y, w, h };
}

export function boundsFromNodes(nodes: { bounds: Bounds }[]): Bounds {
  if (nodes.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.bounds.x);
    minY = Math.min(minY, node.bounds.y);
    maxX = Math.max(maxX, node.bounds.x + node.bounds.w);
    maxY = Math.max(maxY, node.bounds.y + node.bounds.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Intersection point of two line segments, or `null` when they do not cross.
 *
 * Collinear-overlapping segments return `null` (the determinant is zero); they
 * are reported separately as an overlap, not a crossing.
 */
export function segmentIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const x4 = p4.x, y4 = p4.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (denom === 0) return null; // Parallel

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
  }
  return null;
}

/** Number of pairwise crossings among the given segments. */
export function countEdgeCrossings(edges: { from: Point; to: Point }[]): number {
  let crossings = 0;
  for (let i = 0; i < edges.length; i++) {
    const a = edges[i];
    if (a === undefined) continue;
    for (let j = i + 1; j < edges.length; j++) {
      const b = edges[j];
      if (b === undefined) continue;
      if (segmentIntersection(a.from, a.to, b.from, b.to) !== null) {
        crossings++;
      }
    }
  }
  return crossings;
}