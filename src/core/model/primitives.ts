/**
 * Geometry, provenance, approval and accessibility primitives.
 *
 * Spec references are to `docs/vistect_pts.md`.
 */

/** A rectangle in page-local CSS pixels, origin at the page's top-left corner. */
export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * US Letter at 96 dpi. 816 x 1056 px is exactly 612 x 792 pt, so the HTML preview
 * that geometry validation measures and the PDF that pdf-lib emits share one integer
 * coordinate space (see `docs/day-0-findings.md` D0-2/D0-3). Switching to A4 is a
 * change to this constant and nothing else.
 */
export const PAGE_GEOMETRY = {
  widthPx: 816,
  heightPx: 1056,
  marginPx: 72,
  pxPerPt: 96 / 72,
} as const;

export type PageGeometry = typeof PAGE_GEOMETRY;

/** The page's printable area, in the same page-local pixels as `Bounds`. */
export function contentBox(geometry: PageGeometry = PAGE_GEOMETRY): Bounds {
  return {
    x: geometry.marginPx,
    y: geometry.marginPx,
    width: geometry.widthPx - geometry.marginPx * 2,
    height: geometry.heightPx - geometry.marginPx * 2,
  };
}

export const pxToPt = (px: number, geometry: PageGeometry = PAGE_GEOMETRY): number =>
  px / geometry.pxPerPt;

/**
 * Spec §4.2: users express placement semantically. The enum matches the §19
 * `place_image_relative_to` schema exactly — agents see these strings, never x/y.
 */
export const RELATIVE_RELATIONSHIPS = [
  'before',
  'after',
  'above',
  'below',
  'left_of',
  'right_of',
  'inside_same_region',
] as const;

export type RelativeRelationship = (typeof RELATIVE_RELATIONSHIPS)[number];

export type RelativeConstraint = {
  relationship: RelativeRelationship;
  anchorObjectId: string;
  gapPx?: number;
};

/** Who or what produced a thing, and by which tool. Spec §4.4. */
export type ProvenanceOrigin = 'user' | 'agent' | 'import' | 'system';

export type Provenance = {
  origin: ProvenanceOrigin;
  /** The agent's self-reported name. Untrusted display data, never an authorisation. */
  agentName?: string;
  toolName?: string;
  sourceReference?: string;
  createdAt: string;
  note?: string;
};

/** Spec §8.4. */
export type ApprovalStatus = 'unreviewed' | 'proposed' | 'approved' | 'rejected' | 'stale';

export type ApprovalState = {
  status: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
  approvedVersion?: number;
  decisionId?: string;
};

export const unreviewed = (): ApprovalState => ({ status: 'unreviewed' });

/** Spec §8.3. Part of the data model, not export-time metadata (§4.5). */
export type AccessibilityMetadata = {
  isDecorative: boolean;
  altText?: string;
  longDescription?: string;
  accessibleName?: string;
  accessibleRole?: string;
  includedInReadingOrder: boolean;
  language?: string;
  warnings: string[];
};

export const defaultAccessibility = (): AccessibilityMetadata => ({
  isDecorative: false,
  includedInReadingOrder: true,
  warnings: [],
});

/**
 * Spec §16.1 / §4.3: the one field that keeps a model's opinion from being read as a
 * measurement. Required everywhere, never defaulted.
 */
export type EvidenceType = 'deterministic' | 'model_assessment' | 'human_review';
