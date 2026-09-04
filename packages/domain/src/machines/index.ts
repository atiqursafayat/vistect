// ============================================================================
// State Machines - Exhaustive Pure Functions
// ============================================================================

import { dictEntries, dictValues, type Dict } from '../collections';
import type {
  DocumentStatus,
  PageStatus,
  ApprovalState,
  VisualDecision,
  ValidationFinding,
  FindingStatus,
  ActorKind,
} from '../schema';

// ============================================================================
// Document Lifecycle (spec §27)
// ============================================================================

export type DocumentState = DocumentStatus;

export const DocumentTransitions: Readonly<Record<DocumentState, Readonly<Record<string, DocumentState>>>> = {
  draft: { ReviewRequested: 'review' },
  review: { AllPagesApproved: 'page_approved' },
  page_approved: { ReadinessConfirmed: 'document_ready' },
  document_ready: { DocumentLocked: 'locked' },
  locked: { ExportFinalized: 'exported', UnlockRequested: 'review' },
  exported: { UnlockRequested: 'review' },
} as const;

export type DocumentEvent = keyof typeof DocumentTransitions[keyof typeof DocumentTransitions];

export function canTransitionDocument(
  from: DocumentState,
  event: DocumentEvent
): DocumentState | null {
  return DocumentTransitions[from]?.[event] ?? null;
}

export function applyDocumentTransition(
  from: DocumentState,
  event: DocumentEvent,
  guards: { pageCount: number; allPagesApproved: boolean; blockingFindings: number; requiredDecisionsApproved: boolean; manifestPreviewGenerated: boolean; userGesture: boolean }
): DocumentState {
  const to = canTransitionDocument(from, event);
  if (!to) {
    throw new Error(`Invalid document transition: ${from} --${event}-->`);
  }

  // Guards per spec
  switch (event) {
    case 'ReviewRequested':
      if (guards.pageCount < 1) throw new Error('At least one page required');
      break;
    case 'AllPagesApproved':
      if (!guards.allPagesApproved) throw new Error('Not all pages approved');
      break;
    case 'ReadinessConfirmed':
      if (guards.blockingFindings > 0) throw new Error('Blocking findings must be resolved');
      if (!guards.requiredDecisionsApproved) throw new Error('All required decisions must be approved');
      break;
    case 'DocumentLocked':
      if (!guards.manifestPreviewGenerated) throw new Error('Manifest preview must be generated');
      if (!guards.userGesture) throw new Error('User gesture required for locking');
      break;
    case 'ExportFinalized':
      // Hash check done in command bus
      break;
    case 'UnlockRequested':
      if (!guards.userGesture) throw new Error('Only human can unlock');
      break;
  }

  return to;
}

// ============================================================================
// Page Status
// ============================================================================

export type PageState = PageStatus;

export const PageTransitions: Readonly<Record<PageState, Readonly<Record<string, PageState>>>> = {
  draft: { SubmitForReview: 'review' },
  review: { Approve: 'approved', Reject: 'draft' },
  approved: { Lock: 'locked', Unlock: 'review' },
  locked: { Unlock: 'review' },
} as const;

export type PageEvent = keyof typeof PageTransitions[keyof typeof PageTransitions];

export function canTransitionPage(from: PageState, event: PageEvent): PageState | null {
  return PageTransitions[from]?.[event] ?? null;
}

export function applyPageTransition(
  from: PageState,
  event: PageEvent,
  guards: { documentLocked: boolean }
): PageState {
  const to = canTransitionPage(from, event);
  if (!to) throw new Error(`Invalid page transition: ${from} --${event}-->`);

  if (event === 'Lock' && !guards.documentLocked) {
    throw new Error('Page can only be locked when document is locked');
  }

  return to;
}

// ============================================================================
// Object Approval State (spec §8.4 + §15)
// ============================================================================

export type ApprovalStateType = ApprovalState;

export const ApprovalTransitions: Readonly<Record<ApprovalStateType, Readonly<Record<string, ApprovalStateType>>>> = {
  unreviewed: { Propose: 'proposed' },
  proposed: { Approve: 'approved', Reject: 'rejected' },
  rejected: { RequestAlternatives: 'proposed' },
  approved: { Stale: 'stale' },
  stale: { ReApprove: 'approved', RequestAlternatives: 'proposed' },
} as const;

export type ApprovalEvent = keyof typeof ApprovalTransitions[keyof typeof ApprovalTransitions];

export function canTransitionApproval(from: ApprovalStateType, event: ApprovalEvent): ApprovalStateType | null {
  return ApprovalTransitions[from]?.[event] ?? null;
}

export function applyApprovalTransition(
  from: ApprovalStateType,
  event: ApprovalEvent,
  guards: { actorKind: ActorKind; decisionId?: string }
): ApprovalStateType {
  const to = canTransitionApproval(from, event);
  if (!to) throw new Error(`Invalid approval transition: ${from} --${event}-->`);

  // Guards
  if (event === 'Approve' && guards.actorKind !== 'human') {
    throw new Error('Only human actors can approve');
  }
  if (event === 'ReApprove' && guards.actorKind !== 'human') {
    throw new Error('Only human actors can re-approve');
  }

  return to;
}

// ============================================================================
// Visual Decision Status
// ============================================================================

export type DecisionState = VisualDecision['status'];

export const DecisionTransitions: Readonly<Record<DecisionState, Readonly<Record<string, DecisionState>>>> = {
  open: { Propose: 'proposed' },
  proposed: { Approve: 'approved', Reject: 'rejected' },
  rejected: { RequestAlternatives: 'proposed' },
  approved: { Stale: 'stale' },
  stale: { ReReview: 'proposed' },
} as const;

export type DecisionEvent = keyof typeof DecisionTransitions[keyof typeof DecisionTransitions];

export function canTransitionDecision(from: DecisionState, event: DecisionEvent): DecisionState | null {
  return DecisionTransitions[from]?.[event] ?? null;
}

export function applyDecisionTransition(
  from: DecisionState,
  event: DecisionEvent,
  guards: { documentLocked: boolean; actorKind: ActorKind }
): DecisionState {
  const to = canTransitionDecision(from, event);
  if (!to) throw new Error(`Invalid decision transition: ${from} --${event}-->`);

  if (guards.documentLocked && (event === 'Propose' || event === 'Approve' || event === 'Reject')) {
    throw new Error('Decisions frozen on locked document');
  }
  if (event === 'Approve' && guards.actorKind !== 'human') {
    throw new Error('Only human actors can approve decisions');
  }

  return to;
}

// ============================================================================
// Validation Finding Status
// ============================================================================

export type FindingState = FindingStatus;

export const FindingTransitions: Readonly<Record<FindingState, Readonly<Record<string, FindingState>>>> = {
  open: { Resolve: 'resolved', Accept: 'accepted', Dismiss: 'dismissed' },
  resolved: { Reopen: 'open' },
  accepted: { Reopen: 'open' },
  dismissed: { Reopen: 'open' },
} as const;

export type FindingEvent = keyof typeof FindingTransitions[keyof typeof FindingTransitions];

export function canTransitionFinding(from: FindingState, event: FindingEvent): FindingState | null {
  return FindingTransitions[from]?.[event] ?? null;
}

export function applyFindingTransition(
  from: FindingState,
  event: FindingEvent,
  guards: { isSubjective: boolean; isBlocking: boolean }
): FindingState {
  const to = canTransitionFinding(from, event);
  if (!to) throw new Error(`Invalid finding transition: ${from} --${event}-->`);

  if (event === 'Accept' && guards.isBlocking) {
    // Blocking findings can be accepted but require manifest entry
  }
  if (event === 'Dismiss' && !guards.isSubjective) {
    throw new Error('Only subjective findings can be dismissed');
  }

  return to;
}

// ============================================================================
// Export Lifecycle
// ============================================================================

export type ExportState = 'prepared' | 'approved' | 'rendering' | 'completed' | 'failed';

export const ExportTransitions: Readonly<Record<ExportState, Readonly<Record<string, ExportState>>>> = {
  prepared: { Approve: 'approved' },
  approved: { Render: 'rendering' },
  rendering: { Complete: 'completed', Fail: 'failed' },
  completed: { RePrepare: 'prepared' },
  failed: { RePrepare: 'prepared' },
} as const;

export type ExportEvent = keyof typeof ExportTransitions[keyof typeof ExportTransitions];

export function canTransitionExport(from: ExportState, event: ExportEvent): ExportState | null {
  return ExportTransitions[from]?.[event] ?? null;
}

export function applyExportTransition(
  from: ExportState,
  event: ExportEvent,
  guards: { hashMatches: boolean; approvalTokenValid: boolean }
): ExportState {
  const to = canTransitionExport(from, event);
  if (!to) throw new Error(`Invalid export transition: ${from} --${event}-->`);

  if (event === 'Approve' && !guards.approvalTokenValid) {
    throw new Error('Invalid approval token');
  }
  if (event === 'Complete' && !guards.hashMatches) {
    throw new Error('Export hash mismatch');
  }

  return to;
}

// ============================================================================
// Staleness Rules (cascade)
// ============================================================================
//
// When an upstream entity changes, previously approved decisions and previously
// resolved findings must be re-surfaced: an approval given against an older
// version is no longer evidence about the current one (I-04 … I-08).

/**
 * Minimal object shape these rules need.
 *
 * The discriminating fields are optional so callers can pass either a real
 * `DocumentObject` or a small test fixture. When they are absent, attribution
 * falls back to document scope (see {@link objectIdsAffectedBy}).
 */
export interface StalenessObject {
  approval: ApprovalState;
  decisionId?: string;
  kind?: string;
  chartId?: string;
  diagramId?: string;
  assetId?: string;
}

/** Minimal shape these rules need from a chart. */
export interface StalenessChart {
  id: string;
  spec: { datasetId: string };
}

export interface StalenessProject {
  currentVersion: number;
  decisions: Dict<string, VisualDecision>;
  findings: Dict<string, ValidationFinding>;
  objects: Dict<string, StalenessObject>;
  diagrams: Dict<string, { id: string }>;
  charts: Dict<string, StalenessChart>;
  datasets: Dict<string, { id: string }>;
}

export type ChangedEntityType = 'object' | 'diagram' | 'chart' | 'dataset' | 'image_crop';

export interface StalenessContext {
  project: StalenessProject;
  changedEntity: { type: ChangedEntityType; id: string; pageId?: string };
}

export interface StalenessResult {
  decisionsToStale: string[];
  findingsToReopen: string[];
  objectsToStale: string[];
}

/** Decision categories invalidated by a change to each entity type. */
const AFFECTED_CATEGORIES: Readonly<Record<ChangedEntityType, readonly string[]>> = {
  // Object mutations are handled by the I-04 rule below, which walks the
  // object's own decision rather than matching on category.
  object: [],
  dataset: ['chart_type', 'chart_styling'],
  chart: ['chart_type', 'chart_styling'],
  diagram: ['diagram_structure', 'diagram_layout'],
  image_crop: ['alt_text', 'image_placement'],
};

export function computeStaleness(context: StalenessContext): StalenessResult {
  const { project, changedEntity } = context;
  const decisionsToStale = new Set<string>();
  const objectsToStale = new Set<string>();

  // I-04: mutating an approved object stales it and its decision.
  if (changedEntity.type === 'object') {
    const obj = project.objects[changedEntity.id];
    if (obj?.approval === 'approved' && obj.decisionId !== undefined) {
      const decision = project.decisions[obj.decisionId];
      if (decision?.status === 'approved') {
        decisionsToStale.add(obj.decisionId);
        objectsToStale.add(changedEntity.id);
      }
    }
  }

  // I-06 / I-07 / I-08: category-scoped cascades.
  const categories = AFFECTED_CATEGORIES[changedEntity.type];
  if (categories.length > 0) {
    const scopedObjectIds = objectIdsAffectedBy(project, changedEntity);

    for (const [decisionId, decision] of dictEntries(project.decisions)) {
      if (decision.status !== 'approved') continue;
      if (!categories.includes(decision.category)) continue;

      // When the change resolves to specific objects, only stale decisions that
      // actually target them. A decision with no object targets is
      // document-scoped and always affected.
      const targetsChanged =
        scopedObjectIds === null ||
        decision.targetObjectIds.length === 0 ||
        decision.targetObjectIds.some((id) => scopedObjectIds.has(String(id)));

      if (targetsChanged) {
        decisionsToStale.add(decisionId);
      }
    }
  }

  // Any upstream change re-opens findings that were closed against the old state:
  // a "resolved" verdict is evidence about a version that no longer exists.
  const findingsToReopen: string[] = [];
  for (const [findingId, finding] of dictEntries(project.findings)) {
    if (finding.status !== 'resolved' && finding.status !== 'accepted') continue;

    const targetId = String(finding.targetId);
    const targetObjectStaled = objectsToStale.has(targetId);
    const targetIsChangedEntity = targetId === changedEntity.id;
    const targetCoveredByStaledDecision = dictEntries(project.decisions).some(
      ([decisionId, decision]) =>
        decisionsToStale.has(decisionId) &&
        (decision.targetObjectIds.some((id) => String(id) === targetId) ||
          decision.targetPageIds.some((id) => String(id) === targetId))
    );

    if (targetObjectStaled || targetIsChangedEntity || targetCoveredByStaledDecision) {
      findingsToReopen.push(findingId);
    }
  }

  return {
    decisionsToStale: [...decisionsToStale],
    findingsToReopen,
    objectsToStale: [...objectsToStale],
  };
}

/**
 * Object ids downstream of a change, or `null` when object-level attribution is
 * unavailable and the cascade must fall back to document scope.
 *
 * Decisions target **object** ids, so a change to a chart, diagram or dataset
 * has to be resolved forward to the objects that render it. Returning the
 * chart/diagram/dataset id directly would never intersect
 * `decision.targetObjectIds`, silently skipping every cascade.
 *
 * `null` (document scope) is returned when no rendering object can be found —
 * for example a chart that exists but is not yet placed on a page. Widening is
 * the safe direction: an unnecessary re-review costs the user a confirmation,
 * whereas a missed one lets an approval stand against changed content.
 */
function objectIdsAffectedBy(
  project: StalenessProject,
  changedEntity: StalenessContext['changedEntity']
): Set<string> | null {
  switch (changedEntity.type) {
    case 'object':
      return new Set([changedEntity.id]);

    case 'chart':
      return objectIdsOrNull(project, (obj) => obj.chartId === changedEntity.id);

    case 'diagram':
      return objectIdsOrNull(project, (obj) => obj.diagramId === changedEntity.id);

    case 'dataset': {
      const chartIds = new Set(
        dictValues(project.charts)
          .filter((chart) => chart.spec.datasetId === changedEntity.id)
          .map((chart) => chart.id)
      );
      if (chartIds.size === 0) return null;
      return objectIdsOrNull(project, (obj) =>
        obj.chartId !== undefined && chartIds.has(obj.chartId)
      );
    }

    case 'image_crop':
      // A crop identifies an asset; objects reference assets by `assetId`.
      return objectIdsOrNull(project, (obj) => obj.assetId === changedEntity.id);
  }
}

/** Matching object ids, or `null` when nothing matches (document scope). */
function objectIdsOrNull(
  project: StalenessProject,
  predicate: (obj: StalenessObject) => boolean
): Set<string> | null {
  const ids = dictEntries(project.objects)
    .filter(([, obj]) => predicate(obj))
    .map(([id]) => id);
  return ids.length > 0 ? new Set(ids) : null;
}
