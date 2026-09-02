/**
 * Project, page, intent contract and supporting records — spec §7, §8.1, §8.2, §11.3.
 */
import type { DocumentObject } from './objects.js';
import type { ValidationFinding, VisualDecision } from './findings.js';
import type { EvidenceType, PageGeometry, Provenance } from './primitives.js';

/** Spec §7. The brief every recommendation is evaluated against — never as fact (§7). */
export type IntentContract = {
  documentType: string;
  purpose: string;
  audience: string[];
  primaryMessage: string;
  secondaryMessages: string[];
  tone: string[];
  /** Concepts and framings to avoid: 'charity framing', 'pity', 'medical imagery'. */
  avoid: string[];
  brandColors: { primary: string; accent: string; background: string; text: string };
  brandFonts: { heading: string; body: string };
  visualStyle?: string;
  requiredVisuals: Record<string, number>;
  accessibilityRequirements: {
    contextualAltText: boolean;
    chartDataTables: boolean;
    diagramLongDescriptions: boolean;
    noColorOnlyMeaning: boolean;
    minimumContrastRatio: number;
  };
  imageSourcingPreference?: string;
  privacySensitivity: 'standard' | 'sensitive';
  exportRequirements: string[];
};

export type Theme = {
  colors: { primary: string; accent: string; background: string; text: string; muted: string };
  fonts: { heading: string; body: string };
  headingScalePx: [number, number, number, number];
  bodySizePx: number;
  baselinePx: number;
};

export type PageStatus = 'draft' | 'review' | 'approved' | 'locked';

/** Spec §8.2. */
export type Page = {
  id: string;
  pageNumber: number;
  templateId: string;
  title?: string;
  objects: DocumentObject[];
  /**
   * Object ids in the order a screen reader should encounter them. Spec §10.3 allows
   * this to differ from visual order deliberately, so it is stored, not derived.
   */
  readingOrder: string[];
  status: PageStatus;
};

export type Dataset = {
  id: string;
  name: string;
  columns: { key: string; label: string; kind: 'categorical' | 'numeric' | 'temporal' }[];
  rows: Record<string, string | number>[];
  source: Provenance;
  /** Free-text attribution printed as the chart's source note (§13.4). */
  sourceNote?: string;
};

/** Spec §11.3. */
export type Asset = {
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  sourceType: 'upload' | 'generated' | 'library' | 'import';
  sourceReference?: string;
  license?: string;
  localOnly: boolean;
  /** Deterministic metrics only — see architecture decision 4. */
  metrics: Record<string, string | number>;
  /** Agent-supplied readings, each tagged with its evidence type and confidence. */
  interpretations: {
    id: string;
    observations: string[];
    interpretations: string[];
    uncertainties: string[];
    evidenceType: EvidenceType;
    confidence?: number;
    by: Provenance;
  }[];
};

export type ApprovalStatusDocument = 'draft' | 'review' | 'locked' | 'exported';

export type DocumentVersion = {
  version: number;
  at: string;
  /** One readable sentence describing what changed. */
  summary: string;
  by: Provenance;
};

/** Spec §8.2. */
export type DocumentProject = {
  id: string;
  title: string;
  language: string;
  documentType: 'impact-report';
  geometry: PageGeometry;
  intentContract: IntentContract;
  theme: Theme;
  pages: Page[];
  assets: Asset[];
  datasets: Dataset[];
  decisions: VisualDecision[];
  findings: ValidationFinding[];
  versions: DocumentVersion[];
  activeVersion: number;
  approvalStatus: ApprovalStatusDocument;
  /** Set by `lock_document_version`; export is bound to exactly this version (§23.3). */
  lockedVersion?: number;
  createdAt: string;
  updatedAt: string;
};

export function findPage(project: DocumentProject, pageId: string): Page | undefined {
  return project.pages.find((p) => p.id === pageId);
}

export function findObject(
  project: DocumentProject,
  objectId: string,
): { page: Page; object: DocumentObject } | undefined {
  for (const page of project.pages) {
    const object = page.objects.find((o) => o.id === objectId);
    if (object) return { page, object };
  }
  return undefined;
}

export function allObjects(project: DocumentProject): DocumentObject[] {
  return project.pages.flatMap((p) => p.objects);
}
