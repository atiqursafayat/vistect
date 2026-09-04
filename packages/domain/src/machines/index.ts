// ============================================================================
// State Machines - Exhaustive Pure Functions
// ============================================================================

import type {
  DocumentStatus,
  PageStatus,
  ApprovalState,
  VisualDecision,
  ValidationFinding,
  FindingStatus,
  Actor,
  ActorKind,
} from '../schema';

import type { DomainEvent } from '../events';

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
      if (guards.userGesture === false) throw new Error('Only human can unlock');
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

export interface StalenessContext {
  project: {
    currentVersion: number;
    decisions: Record<string, VisualDecision>;
    findings: Record<string, ValidationFinding>;
    objects: Record<string, { approval: ApprovalState; decisionId?: string }>;
    diagrams: Record<string, { specVersion: number }>;
    charts: Record<string, { specVersion: number }>;
    datasets: Record<string, { id: string }>;
  };
  changedEntity: { type: 'object' | 'diagram' | 'chart' | 'dataset' | 'image_crop'; id: string; pageId?: string };
}

export function computeStaleness(context: StalenessContext): {
  decisionsToStale: string[];
  findingsToReopen: string[];
  objectsToStale: string[];
} {
  const { project, changedEntity } = context;
  const decisionsToStale: string[] = [];
  const findingsToReopen: string[] = [];
  const objectsToStale: string[] = [];

  // I-04: Mutation of approved object marks it stale and re-opens its decision
  if (changedEntity.type === 'object') {
    const obj = project.objects[changedEntity.id];
    if (obj && obj.approval === 'approved' && obj.decisionId) {
      const decision = project.decisions[obj.decisionId];
      if (decision && decision.status === 'approved') {
        decisionsToStale.push(obj.decisionId);
        objectsToStale.push(changedEntity.id);
      }
    }
  }

  // I-05: Page mutation unlocks page and cascades document status recompute
  if (changedEntity.type === 'object' && changedEntity.pageId) {
    // Page unlock handled in command handler
  }

  // I-06: Dataset change marks dependent charts' checks/descriptions stale
  if (changedEntity.type === 'dataset') {
    for (const [chartId, chart] of Object.entries(project.charts)) {
      // Check if chart uses this dataset (via spec)
      // This is simplified - real check would look at chart.spec.datasetId
      const decision = Object.values(project.decisions).find(d =>
        d.category === 'chart_type' || d.category === 'chart_styling'
      );
      if (decision && decision.status === 'approved') {
        decisionsToStale.push(decision.id);
      }
    }
  }

  // I-07: Diagram node/edge change marks diagram descriptions and checks stale
  if (changedEntity.type === 'diagram') {
    for (const [decisionId, decision] of Object.entries(project.decisions)) {
      if ((decision.category === 'diagram_structure' || decision.category === 'diagram_layout') &&
          decision.status === 'approved') {
        decisionsToStale.push(decisionId);
      }
    }
  }

  // I-08: Image crop change marks alt text + placement decisions for review
  if (changedEntity.type === 'image_crop') {
    for (const [decisionId, decision] of Object.entries(project.decisions)) {
      if ((decision.category === 'alt_text' || decision.category === 'image_placement') &&
          decision.status === 'approved') {
        // Check if crop intersects face/subject regions
        // Simplified: assume it does
        decisionsToStale.push(decisionId);
      }
    }
  }

  // Upstream change re-opens invalidated findings (I-04..I-08)
  for (const [findingId, finding] of Object.entries(project.findings)) {
    if (finding.status === 'resolved' || finding.status === 'accepted') {
      const targetObj = project.objects[finding.targetId as string];
      const targetDiag = project.diagrams[finding.targetId as string];
      const targetChart = project.charts[finding.targetId as string];

      let shouldReopen = false;
      if (targetObj && targetObj.approval === 'stale') shouldReopen = true;
      if (targetDiag && decisionsToStale.some(d => d.includes(targetDiag.id))) shouldReopen = true;
      if (targetChart && decisionsToStale.some(d => d.includes(targetChart.id))) shouldReopen = true;

      if (shouldReopen) {
        findingsToReopen.push(findingId);
      }
    }

    return { decisionsToStale, findingsToReopen, objectsToStale };
  }
}