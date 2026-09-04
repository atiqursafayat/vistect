// ============================================================================
// Layout Engine - Template Regions and Constraint Resolution
// ============================================================================
//
// Objects carry **semantic** constraints ("after the introduction"), never
// authored coordinates (I-14). This module turns those constraints into absolute
// geometry, which is then consumed by three things that must agree exactly:
// the HTML preview, the PDF renderer, and geometry validation. If any of them
// resolved layout differently, an author could approve a layout that exports
// differently — so there is one resolver and all three call it.
//
// Resolution is **deterministic**: same project, same geometry, every time. No
// clocks, no randomness, no iteration over unordered maps.

import type {
  Bounds,
  DocumentObject,
  DocumentProject,
  ObjectId,
  Page,
  PageTemplate,
} from '@vistect/domain/schema';

// ============================================================================
// Page geometry
// ============================================================================

/** A4 at 72 DPI, in points — the unit pdf-lib works in. */
export const PAGE_SIZE = { width: 595.28, height: 841.89 } as const;
export const PAGE_MARGIN = 72;

const CONTENT_WIDTH = PAGE_SIZE.width - 2 * PAGE_MARGIN;
const CONTENT_HEIGHT = PAGE_SIZE.height - 2 * PAGE_MARGIN;

/** Vertical gap between stacked objects, in points. */
const OBJECT_GAP = 16;

/** Text metrics for height estimation. Helvetica at the sizes below. */
const TEXT_METRICS = {
  /** Average glyph advance as a fraction of font size, for Helvetica lowercase. */
  averageCharWidthRatio: 0.5,
  lineHeightRatio: 1.4,
  fontSizeByRole: {
    heading1: 32,
    heading2: 24,
    heading3: 18,
    heading4: 15,
    body: 11,
    caption: 9,
  },
} as const;

/** Minimum object height, so an empty object still occupies a focusable box. */
const MIN_OBJECT_HEIGHT = 12;

export interface TemplateRegion {
  name: string;
  bounds: Bounds;
  /** Object roles this region is intended to hold, in priority order. */
  accepts: readonly string[];
}

export interface ResolvedObject {
  object: DocumentObject;
  resolvedBounds: Bounds;
  /** Paint order. Derived from layer then reading order, never authored. */
  zIndex: number;
  /** Region the object was placed in, for CSS hooks and debugging. */
  regionName: string;
}

export interface ResolvedPage {
  pageId: string;
  template: PageTemplate;
  objects: ResolvedObject[];
  bounds: Bounds;
  regions: TemplateRegion[];
}

export interface ResolvedLayout {
  pages: ResolvedPage[];
  globalStyles: string;
  /** Constraint problems found during resolution, for the finding registry. */
  diagnostics: LayoutDiagnostic[];
}

export interface LayoutDiagnostic {
  pageId: string;
  objectId?: ObjectId;
  code:
    | 'constraint_cycle'
    | 'unknown_anchor'
    | 'self_anchor'
    | 'region_overflow'
    | 'no_matching_region';
  message: string;
}

// ============================================================================
// Template definitions
// ============================================================================

const region = (
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  accepts: readonly string[]
): TemplateRegion => ({ name, bounds: { x, y, w, h }, accepts });

const M = PAGE_MARGIN;
const CW = CONTENT_WIDTH;
const CH = CONTENT_HEIGHT;
const HEADER_HEIGHT = 60;
const FOOTER_HEIGHT = 60;
const FOOTER_Y = PAGE_SIZE.height - M - FOOTER_HEIGHT;
const BODY_Y = M + HEADER_HEIGHT;
const BODY_HEIGHT = CH - HEADER_HEIGHT - FOOTER_HEIGHT;

const FOOTER_ROLES = ['footnote', 'source-note'] as const;
const TEXT_ROLES = [
  'heading',
  'paragraph',
  'bulleted-list',
  'numbered-list',
  'quotation',
  'callout',
  'statistic-card',
  'hyperlink',
] as const;

/**
 * The ten page templates (spec §10.1).
 *
 * Regions are ordered by reading order, and each declares the roles it accepts so
 * placement is driven by object semantics rather than by coordinates.
 */
const TEMPLATES: Readonly<Record<PageTemplate, readonly TemplateRegion[]>> = {
  cover: [
    region('title', M, M, CW, CH * 0.4, ['heading']),
    region('subtitle', M, M + CH * 0.4, CW, CH * 0.2, ['paragraph', 'caption']),
    region('image', M, M + CH * 0.6, CW, CH * 0.3, ['image', 'icon', 'shape']),
    region('footer', M, M + CH * 0.9, CW, CH * 0.1, FOOTER_ROLES),
  ],
  'text-led': [
    region('header', M, M, CW, HEADER_HEIGHT, ['heading']),
    region('content', M, BODY_Y, CW, BODY_HEIGHT, TEXT_ROLES),
    region('footer', M, FOOTER_Y, CW, FOOTER_HEIGHT, FOOTER_ROLES),
  ],
  'text-side-image': [
    region('header', M, M, CW, HEADER_HEIGHT, ['heading']),
    region('text', M, BODY_Y, CW * 0.6, BODY_HEIGHT, TEXT_ROLES),
    region('image', M + CW * 0.65, BODY_Y, CW * 0.35, BODY_HEIGHT, ['image', 'icon', 'shape']),
    region('footer', M, FOOTER_Y, CW, FOOTER_HEIGHT, FOOTER_ROLES),
  ],
  'full-width-image-caption': [
    region('header', M, M, CW, HEADER_HEIGHT, ['heading']),
    region('image', M, BODY_Y, CW, BODY_HEIGHT - 80, ['image', 'icon', 'shape']),
    region('caption', M, BODY_Y + BODY_HEIGHT - 80, CW, 80, ['caption', 'source-note']),
    region('footer', M, FOOTER_Y, CW, FOOTER_HEIGHT, FOOTER_ROLES),
  ],
  statistics: [
    region('header', M, M, CW, HEADER_HEIGHT, ['heading']),
    region('stats-grid', M, BODY_Y, CW, BODY_HEIGHT, ['statistic-card', 'paragraph', 'icon']),
    region('footer', M, FOOTER_Y, CW, FOOTER_HEIGHT, FOOTER_ROLES),
  ],
  chart: [
    region('header', M, M, CW, HEADER_HEIGHT, ['heading']),
    region('chart', M, BODY_Y, CW, BODY_HEIGHT - 60, ['chart', 'table']),
    region('caption', M, BODY_Y + BODY_HEIGHT - 60, CW, 60, ['caption', 'source-note']),
    region('footer', M, FOOTER_Y, CW, FOOTER_HEIGHT, FOOTER_ROLES),
  ],
  diagram: [
    region('header', M, M, CW, HEADER_HEIGHT, ['heading']),
    region('diagram', M, BODY_Y, CW, BODY_HEIGHT - 60, ['diagram']),
    region('caption', M, BODY_Y + BODY_HEIGHT - 60, CW, 60, ['caption', 'source-note']),
    region('footer', M, FOOTER_Y, CW, FOOTER_HEIGHT, FOOTER_ROLES),
  ],
  'participant-story': [
    region('header', M, M, CW, HEADER_HEIGHT, ['heading']),
    region('quote', M, BODY_Y, CW, 150, ['quotation']),
    region('content', M, BODY_Y + 150, CW, BODY_HEIGHT - 150, TEXT_ROLES),
    region('footer', M, FOOTER_Y, CW, FOOTER_HEIGHT, FOOTER_ROLES),
  ],
  recommendations: [
    region('header', M, M, CW, HEADER_HEIGHT, ['heading']),
    region('list', M, BODY_Y, CW, BODY_HEIGHT, ['bulleted-list', 'numbered-list', 'paragraph']),
    region('footer', M, FOOTER_Y, CW, FOOTER_HEIGHT, FOOTER_ROLES),
  ],
  'conclusion-contact': [
    region('header', M, M, CW, HEADER_HEIGHT, ['heading']),
    region('conclusion', M, BODY_Y, CW, BODY_HEIGHT * 0.5, TEXT_ROLES),
    region('contact', M, BODY_Y + BODY_HEIGHT * 0.5, CW, BODY_HEIGHT * 0.5, [
      'paragraph',
      'hyperlink',
      'source-note',
    ]),
    region('footer', M, FOOTER_Y, CW, FOOTER_HEIGHT, FOOTER_ROLES),
  ],
};

export function getTemplateRegions(template: PageTemplate): readonly TemplateRegion[] {
  return TEMPLATES[template];
}

export function getPageBounds(): Bounds {
  return { x: 0, y: 0, w: PAGE_SIZE.width, h: PAGE_SIZE.height };
}

// ============================================================================
// Resolution
// ============================================================================

export function resolveLayout(project: DocumentProject): ResolvedLayout {
  const pages: ResolvedPage[] = [];
  const diagnostics: LayoutDiagnostic[] = [];

  // `pageOrder` drives iteration, not `Object.values(project.pages)`: object key
  // order is not part of the domain model, and depending on it would make
  // geometry depend on insertion history.
  for (const pageId of project.pageOrder) {
    const page = project.pages[pageId];
    if (page === undefined) continue;
    pages.push(resolvePage(page, project, diagnostics));
  }

  return { pages, globalStyles: generateGlobalStyles(project), diagnostics };
}

function resolvePage(
  page: Page,
  project: DocumentProject,
  diagnostics: LayoutDiagnostic[]
): ResolvedPage {
  const regions = getTemplateRegions(page.template);
  const objects = orderObjects(page, project, diagnostics);

  // Objects are laid out region by region, each stacking vertically from the
  // region's top edge. Region assignment is by role, which is why an author never
  // needs coordinates.
  const resolved: ResolvedObject[] = [];
  const cursorByRegion = new Map<string, number>();

  for (const [index, object] of objects.entries()) {
    const target = pickRegion(regions, object, page.id, diagnostics);
    const cursor = cursorByRegion.get(target.name) ?? target.bounds.y;
    const height = estimateHeight(object, target.bounds.w);

    resolved.push({
      object,
      resolvedBounds: { x: target.bounds.x, y: cursor, w: target.bounds.w, h: height },
      zIndex: object.layer * 1000 + index,
      regionName: target.name,
    });

    const nextCursor = cursor + height + OBJECT_GAP;
    cursorByRegion.set(target.name, nextCursor);

    // Overflow is reported, not clipped: silently cropping content would hide it
    // from a user who cannot see the page.
    const regionBottom = target.bounds.y + target.bounds.h;
    if (cursor + height > regionBottom) {
      diagnostics.push({
        pageId: page.id,
        objectId: object.id,
        code: 'region_overflow',
        message: `Object ${object.id} overflows region "${target.name}" by ${Math.round(cursor + height - regionBottom)} points`,
      });
    }
  }

  return {
    pageId: page.id,
    template: page.template,
    objects: resolved,
    bounds: getPageBounds(),
    regions: [...regions],
  };
}

/**
 * Orders a page's objects: layer, then constraints, then reading order.
 *
 * Constraints are resolved by topological sort so that "after the introduction"
 * holds regardless of the order objects were created in. A cycle is reported and
 * the affected objects fall back to reading order, because refusing to lay out
 * the page would leave the author with nothing to inspect.
 */
function orderObjects(
  page: Page,
  project: DocumentProject,
  diagnostics: LayoutDiagnostic[]
): DocumentObject[] {
  const objects = page.objects
    .map((id) => project.objects[id])
    .filter((o): o is DocumentObject => o !== undefined);

  const onPage = new Set(objects.map((o) => o.id));
  const byId = new Map(objects.map((o) => [o.id, o]));

  // Baseline order: layer, then authored reading order, then id for stability.
  const baseline = [...objects].sort(
    (a, b) =>
      a.layer - b.layer ||
      a.readingOrderIndex - b.readingOrderIndex ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );

  // Edges from "must come before" constraints only; the others affect region
  // placement, not sequence.
  const dependencies = new Map<ObjectId, ObjectId[]>();
  for (const object of objects) {
    const predecessors: ObjectId[] = [];

    for (const constraint of object.constraints) {
      if (constraint.anchorId === object.id) {
        diagnostics.push({
          pageId: page.id,
          objectId: object.id,
          code: 'self_anchor',
          message: `Object ${object.id} is constrained relative to itself`,
        });
        continue;
      }
      if (!onPage.has(constraint.anchorId)) {
        diagnostics.push({
          pageId: page.id,
          objectId: object.id,
          code: 'unknown_anchor',
          message: `Object ${object.id} is constrained to ${constraint.anchorId}, which is not on this page`,
        });
        continue;
      }
      if (constraint.relationship === 'after' || constraint.relationship === 'below') {
        predecessors.push(constraint.anchorId);
      }
    }

    dependencies.set(object.id, predecessors);
  }

  const sorted = topologicalSort(baseline, dependencies);
  if (sorted === null) {
    diagnostics.push({
      pageId: page.id,
      code: 'constraint_cycle',
      message: 'Constraints form a cycle; falling back to authored reading order',
    });
    return baseline;
  }

  return sorted.map((id) => byId.get(id)).filter((o): o is DocumentObject => o !== undefined);
}

/**
 * Kahn's algorithm over the baseline order, returning `null` on a cycle.
 *
 * Candidates are taken in baseline order rather than from an unordered set, so
 * the result is deterministic for any graph with more than one valid ordering.
 */
function topologicalSort(
  objects: DocumentObject[],
  dependencies: Map<ObjectId, ObjectId[]>
): ObjectId[] | null {
  const remaining = new Set(objects.map((o) => o.id));
  const order: ObjectId[] = [];

  while (remaining.size > 0) {
    const ready = objects.find(
      (o) =>
        remaining.has(o.id) &&
        (dependencies.get(o.id) ?? []).every((dep) => !remaining.has(dep))
    );

    if (ready === undefined) return null;

    order.push(ready.id);
    remaining.delete(ready.id);
  }

  return order;
}

/**
 * Chooses the region for an object by role.
 *
 * Falls back to the largest region that accepts anything, so an unexpected role
 * still lands somewhere inspectable, with a diagnostic explaining why.
 */
function pickRegion(
  regions: readonly TemplateRegion[],
  object: DocumentObject,
  pageId: string,
  diagnostics: LayoutDiagnostic[]
): TemplateRegion {
  const match = regions.find((r) => r.accepts.includes(object.role));
  if (match !== undefined) return match;

  const fallback = regions.reduce<TemplateRegion | undefined>(
    (largest, current) =>
      largest === undefined || current.bounds.h > largest.bounds.h ? current : largest,
    undefined
  );

  diagnostics.push({
    pageId,
    objectId: object.id,
    code: 'no_matching_region',
    message: `No region on this template accepts role "${object.role}"; placed in "${fallback?.name ?? 'none'}"`,
  });

  // A template always declares at least one region, so `fallback` is present;
  // the explicit throw documents that rather than asserting it away.
  if (fallback === undefined) {
    throw new Error(`Template for page ${pageId} declares no regions`);
  }
  return fallback;
}

/** Font size for a text object's role and heading level. */
function fontSizeFor(object: DocumentObject): number {
  if (object.kind !== 'text') return TEXT_METRICS.fontSizeByRole.body;

  switch (object.role) {
    case 'heading': {
      const level = object.headingLevel ?? 1;
      if (level === 1) return TEXT_METRICS.fontSizeByRole.heading1;
      if (level === 2) return TEXT_METRICS.fontSizeByRole.heading2;
      if (level === 3) return TEXT_METRICS.fontSizeByRole.heading3;
      return TEXT_METRICS.fontSizeByRole.heading4;
    }
    case 'caption':
    case 'footnote':
    case 'source-note':
      return TEXT_METRICS.fontSizeByRole.caption;
    case 'paragraph':
    case 'bulleted-list':
    case 'numbered-list':
    case 'quotation':
    case 'callout':
    case 'statistic-card':
    case 'page-break':
    case 'section-break':
    case 'hyperlink':
      return TEXT_METRICS.fontSizeByRole.body;
  }
}

/**
 * Estimated rendered height, in points.
 *
 * Character-count estimation, not true text measurement: this package is pure and
 * has no font metrics or canvas. The estimate is deliberately generous so
 * overflow is reported rather than missed, and PDF rendering re-measures with the
 * embedded font before drawing.
 */
export function estimateHeight(object: DocumentObject, availableWidth: number): number {
  switch (object.kind) {
    case 'text': {
      const fontSize = fontSizeFor(object);
      const lineHeight = fontSize * TEXT_METRICS.lineHeightRatio;
      const charsPerLine = Math.max(
        1,
        Math.floor(availableWidth / (fontSize * TEXT_METRICS.averageCharWidthRatio))
      );

      // List items each start a new line regardless of length.
      const segments =
        object.listItems !== undefined && object.listItems.length > 0
          ? object.listItems
          : [object.content];

      const lines = segments.reduce(
        (total, segment) => total + Math.max(1, Math.ceil(segment.length / charsPerLine)),
        0
      );

      return Math.max(MIN_OBJECT_HEIGHT, lines * lineHeight);
    }

    case 'image':
      // Preserve the aspect ratio the author placed, scaled to the region width.
      return object.bounds.w > 0 && object.bounds.h > 0
        ? (object.bounds.h / object.bounds.w) * availableWidth
        : availableWidth * 0.618;

    case 'chart':
    case 'diagram':
      return Math.min(availableWidth * 0.75, CONTENT_HEIGHT * 0.6);

    case 'table': {
      const rowHeight = TEXT_METRICS.fontSizeByRole.body * TEXT_METRICS.lineHeightRatio + 8;
      return (object.rows.length + 1) * rowHeight;
    }

    case 'icon':
      return Math.max(MIN_OBJECT_HEIGHT, object.bounds.h > 0 ? object.bounds.h : 24);

    case 'shape':
      return Math.max(MIN_OBJECT_HEIGHT, object.bounds.h > 0 ? object.bounds.h : 48);
  }
}

// ============================================================================
// Styles
// ============================================================================

/**
 * Theme-derived CSS custom properties plus the base stylesheet.
 *
 * Colours come from the project's theme with accessible fallbacks; the defaults
 * meet WCAG 2.2 AA contrast against the default background.
 */
export function generateGlobalStyles(project: DocumentProject): string {
  const colors = project.theme.colors;
  const fonts = project.theme.fonts;
  const spacingUnit = project.theme.spacing['unit'] ?? '8';

  const color = (key: string, fallback: string): string => colors[key] ?? fallback;
  const font = (key: string, fallback: string): string => fonts[key] ?? fallback;

  return `
    :root {
      --color-primary: ${color('primary', '#1a1a2e')};
      --color-secondary: ${color('secondary', '#16213e')};
      --color-accent: ${color('accent', '#c1121f')};
      --color-background: ${color('background', '#ffffff')};
      --color-text: ${color('text', '#1a1a2e')};
      --color-text-muted: ${color('textMuted', '#595959')};
      --color-border: ${color('border', '#767676')};
      --font-primary: ${font('primary', 'system-ui, -apple-system, sans-serif')};
      --font-heading: ${font('heading', 'Georgia, serif')};
      --font-mono: ${font('mono', 'ui-monospace, monospace')};
      --spacing-unit: ${spacingUnit}px;
      --page-width: ${PAGE_SIZE.width}px;
      --page-height: ${PAGE_SIZE.height}px;
      --page-margin: ${PAGE_MARGIN}px;
    }

    *, *::before, *::after { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: var(--font-primary);
      color: var(--color-text);
      background: var(--color-background);
      line-height: 1.5;
    }

    /* Visually hidden but available to assistive technology. */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }

    .skip-link {
      position: absolute;
      top: -100px;
      left: 0;
      background: var(--color-primary);
      color: #ffffff;
      padding: 8px 16px;
      z-index: 100;
    }
    .skip-link:focus { top: 0; }

    /* Visible focus indicator meeting WCAG 2.2 SC 2.4.11. */
    :focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px; }

    main { max-width: var(--page-width); margin: 0 auto; }

    .page {
      position: relative;
      width: 100%;
      min-height: var(--page-height);
      margin-bottom: calc(var(--spacing-unit) * 6);
      background: #ffffff;
      border: 1px solid var(--color-border);
      break-after: page;
    }

    .region { position: relative; }
    .object { position: absolute; }

    .object-text h1 { font-size: ${TEXT_METRICS.fontSizeByRole.heading1}px; font-family: var(--font-heading); margin: 0; }
    .object-text h2 { font-size: ${TEXT_METRICS.fontSizeByRole.heading2}px; font-family: var(--font-heading); margin: 0; }
    .object-text h3 { font-size: ${TEXT_METRICS.fontSizeByRole.heading3}px; font-family: var(--font-heading); margin: 0; }
    .object-text h4 { font-size: ${TEXT_METRICS.fontSizeByRole.heading4}px; font-family: var(--font-heading); margin: 0; }
    .object-text p { margin: 0; }
    .object-text ul, .object-text ol { margin: 0; padding-left: 1.5em; }
    .object-text blockquote {
      margin: 0;
      padding-left: 1em;
      border-left: 4px solid var(--color-accent);
      font-style: italic;
    }
    .object-text figcaption, .object-source-note, .object-footnote {
      font-size: ${TEXT_METRICS.fontSizeByRole.caption}px;
      color: var(--color-text-muted);
    }
    .object-callout {
      padding: var(--spacing-unit);
      border: 1px solid var(--color-border);
      background: color-mix(in srgb, var(--color-accent) 8%, transparent);
    }

    .object-image img { max-width: 100%; height: auto; display: block; }
    .object-image figure, figure { margin: 0; }

    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid var(--color-border); padding: 6px 8px; text-align: left; }
    caption { caption-side: top; text-align: left; font-weight: 600; padding-bottom: 4px; }

    .chart-svg, .diagram-svg { max-width: 100%; height: auto; }
    .diagram-nodes ul { list-style: none; padding-left: 0; }

    /* Honour the user's motion preference (WCAG 2.3.3). */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation: none !important; transition: none !important; }
    }

    @media print {
      .page { border: none; margin: 0; }
      body { background: #ffffff; }
      .skip-link { display: none; }
    }
  `;
}
