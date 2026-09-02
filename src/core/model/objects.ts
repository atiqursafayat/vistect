/**
 * The document object union — spec §8.2.
 *
 * §8.2 lists the seven object kinds but gives the union no discriminant, so `type` is
 * added here. Only `TextObject` is constructible on Day 1; the rest are defined now so
 * that reading-order, validation and export code is written against the final shape
 * rather than being widened later.
 */
import type {
  AccessibilityMetadata,
  ApprovalState,
  Bounds,
  Provenance,
  RelativeConstraint,
} from './primitives.js';

export type BaseObject = {
  id: string;
  pageId: string;
  /** Semantic role, e.g. 'page-heading', 'body', 'cover-image', 'figure-caption'. */
  role: string;
  /** Why this object is on the page. Spec §21.4 exposes it in the object explorer. */
  purpose?: string;
  bounds: Bounds;
  relativeConstraints: RelativeConstraint[];
  layer: number;
  readingOrderIndex?: number;
  accessibility: AccessibilityMetadata;
  source: Provenance;
  approval: ApprovalState;
  createdBy: 'user' | 'agent' | 'import';
  versionCreated: number;
  versionModified: number;
};

export const TEXT_ROLES = [
  'heading',
  'paragraph',
  'list',
  'quote',
  'callout',
  'statistic',
  'caption',
  'source-note',
  'footnote',
] as const;

export type TextRole = (typeof TEXT_ROLES)[number];
export type HeadingLevel = 1 | 2 | 3 | 4;

export type TextObject = BaseObject & {
  type: 'text';
  textRole: TextRole;
  /** Required when `textRole` is 'heading'. Spec §10.2 allows levels 1–4. */
  headingLevel?: HeadingLevel;
  /** Plain text. Never HTML: imported content is untrusted data (§23.2). */
  content: string;
  /** Used instead of `content` when `textRole` is 'list'. */
  items?: string[];
  ordered?: boolean;
};

export type CropRect = { x: number; y: number; width: number; height: number };

export type ImageObject = BaseObject & {
  type: 'image';
  assetId: string;
  /** Crop in the asset's own pixel space, not the page's. */
  crop?: CropRect;
  fit: 'contain' | 'cover';
};

export type IconObject = BaseObject & {
  type: 'icon';
  iconId: string;
  meaning: string;
  sizeClass: 'sm' | 'md' | 'lg';
};

export type ChartObject = BaseObject & {
  type: 'chart';
  chartId: string;
  datasetId: string;
};

export type DiagramObject = BaseObject & {
  type: 'diagram';
  diagramId: string;
};

export type TableObject = BaseObject & {
  type: 'table';
  datasetId: string;
  caption?: string;
};

export type ShapeObject = BaseObject & {
  type: 'shape';
  shape: 'rule' | 'rect';
  /** Decorative by default; §16.2 flags a decorative object exposed to the reader. */
  fill?: string;
};

export type DocumentObject =
  | TextObject
  | ImageObject
  | IconObject
  | ChartObject
  | DiagramObject
  | TableObject
  | ShapeObject;

export type DocumentObjectType = DocumentObject['type'];

/** Objects that carry meaning a reader must receive, so alt text is mandatory. */
export function requiresAlternativeText(object: DocumentObject): boolean {
  if (object.accessibility.isDecorative) return false;
  return (
    object.type === 'image' ||
    object.type === 'icon' ||
    object.type === 'chart' ||
    object.type === 'diagram'
  );
}

export function objectText(object: DocumentObject): string | undefined {
  if (object.type !== 'text') return undefined;
  return object.items && object.items.length > 0 ? object.items.join(' ') : object.content;
}
