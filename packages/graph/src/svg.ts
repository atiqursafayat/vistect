// ============================================================================
// Graph SVG Export
// ============================================================================
//
// Produces a sanitised, screen-reader-labelled SVG plus a keyboard-navigable
// HTML fallback (spec §12, AC F-3.x §2/§3).
//
// SECURITY: node and edge labels are authored or agent-supplied, so every
// interpolated value is XML-escaped via `@vistect/domain/text`. This module
// previously carried its own `escapeXml`, which had been reduced to an identity
// function and left SVG export unescaped.

import { escapeXml } from '@vistect/domain/text';

import { getBoundsCenter } from './geometry';
import type { Bounds, Diagram, GraphEdge, GraphNode } from './model';

export interface SVGExportOptions {
  padding?: number;
  showLabels?: boolean;
  showEdgeLabels?: boolean;
  theme?: 'light' | 'dark';
}

interface ThemeColors {
  background: string;
  nodeFill: string;
  nodeStroke: string;
  nodeText: string;
  edgeStroke: string;
  edgeText: string;
  decisionFill: string;
  startFill: string;
  endFill: string;
  decisionEdgeStroke: string;
}

/**
 * Palettes chosen for WCAG 2.2 AA contrast (>= 4.5:1) between each fill and its
 * paired text colour, so labels stay legible in both themes.
 */
const THEMES: Readonly<Record<'light' | 'dark', ThemeColors>> = {
  light: {
    background: '#ffffff',
    nodeFill: '#ffffff',
    nodeStroke: '#1a1a2e',
    nodeText: '#1a1a2e',
    edgeStroke: '#495057',
    edgeText: '#343a40',
    decisionFill: '#fff3cd',
    startFill: '#d4edda',
    endFill: '#f8d7da',
    decisionEdgeStroke: '#a61e1e',
  },
  dark: {
    background: '#1a1a2e',
    nodeFill: '#2d2d4a',
    nodeStroke: '#e9ecef',
    nodeText: '#f8f9fa',
    edgeStroke: '#adb5bd',
    edgeText: '#ced4da',
    decisionFill: '#664d03',
    startFill: '#155724',
    endFill: '#721c24',
    decisionEdgeStroke: '#ff8787',
  },
};

const EMPTY_DIAGRAM_BOUNDS: Bounds = { x: 0, y: 0, w: 400, h: 300 };

/** Stroke width and dash pattern for each edge style. */
function edgeStrokeStyle(style: GraphEdge['style']): { width: number; dashArray: string | null } {
  switch (style) {
    case 'dashed':
      return { width: 2, dashArray: '5,5' };
    case 'dotted':
      return { width: 1, dashArray: '2,2' };
    case 'solid':
      return { width: 2, dashArray: null };
  }
}

function nodeFill(node: GraphNode, colors: ThemeColors): string {
  switch (node.type) {
    case 'decision':
      return colors.decisionFill;
    case 'start':
      return colors.startFill;
    case 'end':
      return colors.endFill;
    case 'process':
    case 'input_output':
    case 'group':
      return colors.nodeFill;
  }
}

export function exportDiagramSVG(diagram: Diagram, options: SVGExportOptions = {}): string {
  const { padding = 40, showLabels = true, showEdgeLabels = true, theme = 'light' } = options;
  const colors = THEMES[theme];

  const bounds = getDiagramBounds(diagram);
  const width = bounds.w + 2 * padding;
  const height = bounds.h + 2 * padding;
  const originX = bounds.x - padding;
  const originY = bounds.y - padding;

  const accessibleName = diagram.accessibility.altText ?? `${diagram.type} diagram`;
  const parts: string[] = [];

  parts.push(
    `<svg width="${width}" height="${height}" viewBox="${originX} ${originY} ${width} ${height}" ` +
      `xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(accessibleName)}">`
  );
  parts.push(`<title>${escapeXml(accessibleName)}</title>`);
  if (diagram.accessibility.longDescription !== undefined) {
    parts.push(`<desc>${escapeXml(diagram.accessibility.longDescription)}</desc>`);
  }

  // A single `<defs>` block: two markers with the same id previously made the
  // second definition dead, so decision edges silently lost their arrowhead.
  parts.push('<defs>');
  parts.push(
    '<marker id="vistect-arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth">' +
      `<polygon points="0 0, 10 3.5, 0 7" fill="${colors.edgeStroke}" />` +
      '</marker>'
  );
  parts.push(
    '<marker id="vistect-arrowhead-decision" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth">' +
      `<polygon points="0 0, 10 3.5, 0 7" fill="${colors.decisionEdgeStroke}" />` +
      '</marker>'
  );
  parts.push('</defs>');

  parts.push(
    `<rect x="${originX}" y="${originY}" width="${width}" height="${height}" fill="${colors.background}" />`
  );

  const nodesById = new Map(diagram.nodes.map((node) => [node.id, node]));

  // Edges are drawn before nodes so node fills occlude line ends.
  for (const edge of diagram.edges) {
    const from = nodesById.get(edge.from);
    const to = nodesById.get(edge.to);
    if (from === undefined || to === undefined) continue;

    const fromCenter = getBoundsCenter(from.bounds);
    const toCenter = getBoundsCenter(to.bounds);
    const { width: strokeWidth, dashArray } = edgeStrokeStyle(edge.style);
    const stroke = edge.isDecisionOutcome ? colors.decisionEdgeStroke : colors.edgeStroke;
    const marker = edge.isDecisionOutcome ? 'vistect-arrowhead-decision' : 'vistect-arrowhead';

    parts.push(
      `<line x1="${fromCenter.x}" y1="${fromCenter.y}" x2="${toCenter.x}" y2="${toCenter.y}" ` +
        `stroke="${stroke}" stroke-width="${strokeWidth}"` +
        (dashArray === null ? '' : ` stroke-dasharray="${dashArray}"`) +
        ` marker-end="url(#${marker})" />`
    );

    if (showEdgeLabels && edge.label !== undefined && edge.label !== '') {
      const midX = (fromCenter.x + toCenter.x) / 2;
      const midY = (fromCenter.y + toCenter.y) / 2;
      parts.push(
        `<text x="${midX}" y="${midY}" text-anchor="middle" dominant-baseline="middle" ` +
          `font-size="11" font-family="system-ui, sans-serif" fill="${colors.edgeText}">${escapeXml(edge.label)}</text>`
      );
    }
  }

  for (const node of diagram.nodes) {
    const { x, y, w, h } = node.bounds;
    const fill = nodeFill(node, colors);

    if (node.type === 'decision') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      parts.push(
        `<polygon points="${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}" ` +
          `fill="${fill}" stroke="${colors.nodeStroke}" stroke-width="2" />`
      );
    } else {
      parts.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" ry="4" ` +
          `fill="${fill}" stroke="${colors.nodeStroke}" stroke-width="2" />`
      );
    }

    if (showLabels) {
      parts.push(
        `<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="middle" ` +
          `font-size="12" font-family="system-ui, sans-serif" fill="${colors.nodeText}">${escapeXml(node.label)}</text>`
      );
    }
  }

  parts.push('</svg>');
  return parts.join('');
}

function getDiagramBounds(diagram: Pick<Diagram, 'nodes'>): Bounds {
  if (diagram.nodes.length === 0) return EMPTY_DIAGRAM_BOUNDS;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of diagram.nodes) {
    minX = Math.min(minX, node.bounds.x);
    minY = Math.min(minY, node.bounds.y);
    maxX = Math.max(maxX, node.bounds.x + node.bounds.w);
    maxY = Math.max(maxY, node.bounds.y + node.bounds.h);
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Keyboard-navigable HTML rendering of the graph (AC F-3.x §2).
 *
 * Nested lists expose each node with its outgoing connections, so a screen
 * reader user can traverse the topology without the SVG.
 */
export function exportAccessibleHTML(diagram: Diagram): string {
  const nodesById = new Map(diagram.nodes.map((node) => [node.id, node]));
  const parts: string[] = ['<nav class="diagram-nodes" aria-label="Diagram nodes"><ul>'];

  for (const node of diagram.nodes) {
    parts.push(`<li><span class="node-label">${escapeXml(node.label)}</span>`);
    parts.push(` <span class="node-type">(${escapeXml(node.type)})</span>`);

    const outgoing = diagram.edges.filter((edge) => edge.from === node.id);
    if (outgoing.length > 0) {
      parts.push('<ul class="node-connections">');
      for (const edge of outgoing) {
        const target = nodesById.get(edge.to);
        const targetLabel = target?.label ?? edge.to;
        const condition =
          edge.label !== undefined && edge.label !== '' ? `${escapeXml(edge.label)}: ` : '';
        parts.push(`<li>${condition}leads to ${escapeXml(targetLabel)}</li>`);
      }
      parts.push('</ul>');
    }

    parts.push('</li>');
  }

  parts.push('</ul></nav>');
  return parts.join('');
}
