// ============================================================================
// Graph SVG Export
// ============================================================================

import type { Diagram, GraphNode, GraphEdge } from '../index';
import { getBoundsCenter } from './geometry';

export interface SVGExportOptions {
  padding?: number;
  showLabels?: boolean;
  showEdgeLabels?: boolean;
  theme?: 'light' | 'dark';
}

const DEFAULT_COLORS = {
  light: {
    background: '#ffffff',
    nodeFill: '#ffffff',
    nodeStroke: '#1a1a2e',
    nodeText: '#1a1a2e',
    edgeStroke: '#495057',
    edgeText: '#495057',
    decisionFill: '#fff3cd',
    startFill: '#d4edda',
    endFill: '#f8d7da',
  },
  dark: {
    background: '#1a1a2e',
    nodeFill: '#2d2d4a',
    nodeStroke: '#e9ecef',
    nodeText: '#f8f9fa',
    edgeStroke: '#adb5bd',
    edgeText: '#adb5bd',
    decisionFill: '#664d03',
    startFill: '#155724',
    endFill: '#721c24',
  },
};

export function exportDiagramSVG(diagram: Diagram, options: SVGExportOptions = {}): string {
  const { padding = 40, showLabels = true, showEdgeLabels = true, theme = 'light' } = options;
  const colors = DEFAULT_COLORS[theme];

  // Calculate bounds
  const bounds = getDiagramBounds(diagram);
  const width = bounds.w + 2 * padding;
  const height = bounds.h + 2 * padding;

  let svg = `<svg width="${width}" height="${height}" viewBox="${-padding} ${-padding} ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${diagram.type} diagram">`;
  svg += `<title>${diagram.type} diagram</title>`;
  svg += `<defs>`;
  svg += `<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">`;
  svg += `<polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />`;
  svg += `</marker>`;
  svg += `</defs>`;

  // Background
  svg += `<rect x="${-padding}" y="${-padding}" width="${width}" height="${height}" fill="${colors.background}" />`;

  // Edges
  for (const edge of diagram.edges) {
    const from = diagram.nodes.find(n => n.id === edge.from);
    const to = diagram.nodes.find(n => n.id === edge.to);
    if (!from || !to) continue;

    const fromCenter = getBoundsCenter(from.bounds);
    const toCenter = getBoundsCenter(to.bounds);

    const strokeColor = edge.isDecisionOutcome ? '#c92a2a' : colors.edgeStroke;
    const strokeWidth = edge.style === 'dashed' ? '2' : edge.style === 'dotted' ? '1' : '2';
    const strokeDash = edge.style === 'dashed' ? '5,5' : edge.style === 'dotted' ? '2,2' : 'none';

    svg += `<line x1="${fromCenter.x}" y1="${fromCenter.y}" x2="${toCenter.x}" y2="${toCenter.y}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDash}" marker-end="url(#arrowhead)" />`;

    if (showEdgeLabels && edge.label) {
      const midX = (fromCenter.x + toCenter.x) / 2;
      const midY = (fromCenter.y + toCenter.y) / 2;
      svg += `<text x="${midX}" y="${midY}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="${colors.edgeText}" font-family="system-ui, sans-serif">${edge.label}</text>`;
    }
  }

  // Arrowhead marker
  svg += `<defs>`;
  svg += `<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth">`;
  svg += `<polygon points="0 0, 10 3.5, 0 7" fill="${colors.edgeStroke}" />`;
  svg += `</marker>`;
  svg += `</defs>`;

  // Nodes
  for (const node of diagram.nodes) {
    const { x, y, w, h } = node.bounds;
    const center = { x: x + w / 2, y: y + h / 2 };

    // Node fill based on type
    let fill = colors.nodeFill;
    let stroke = colors.nodeStroke;
    if (node.type === 'decision') fill = colors.decisionFill;
    else if (node.type === 'start') fill = colors.startFill;
    else if (node.type === 'end') fill = colors.endFill;

    const rx = node.type === 'decision' ? 0 : 4;

    // Node shape
    if (node.type === 'decision') {
      // Diamond
      const cx = x + w / 2;
      const cy = y + h / 2;
      svg += `<polygon points="${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}" fill="${fill}" stroke="${colors.nodeStroke}" stroke-width="2" />`;
    } else {
      // Rectangle
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="2" />`;
    }

    // Label
    if (showLabels) {
      svg += `<text x="${x + w / 2}" y="${y + h / 2 + 5}" text-anchor="middle" dominant-baseline="middle" font-size="12" font-family="system-ui, sans-serif" fill="${colors.nodeText}">${escapeXml(node.label)}</text>`;
    }
  }

  svg += `</svg>`;
  return svg;
}

function getDiagramBounds(diagram: { nodes: { bounds: { x: number; y: number; w: number; h: number } }[] }): { x: number; y: number; w: number; h: number } {
  if (!diagram.nodes.length) return { x: 0, y: 0, w: 400, h: 300 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of diagram.nodes) {
    minX = Math.min(minX, node.bounds.x);
    minY = Math.min(minY, node.bounds.y);
    maxX = Math.max(maxX, node.bounds.x + node.bounds.w);
    maxY = Math.max(maxY, node.bounds.y + node.bounds.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&apos;');
}

export function exportAccessibleHTML(diagram: any): string {
  let html = `<nav class="diagram-nodes" aria-label="Diagram nodes">`;
  html += `<ul>`;
  for (const node of diagram.nodes) {
    html += `<li>${node.label} (${node.type})`;
    const outgoing = diagram.edges.filter(e => e.from === node.id);
    if (outgoing.length > 0) {
      html += ` → ${outgoing.map(e => {
        const target = diagram.nodes.find(n => n.id === e.to);
        return `${e.label || ''} ${target?.label || e.to}`.trim();
      }).join(', ')}`;
    }
    html += `</li>`;
  }
  html += `</ul>`;
  html += `</nav>`;
  return html;
}