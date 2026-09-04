import { describe, it, expect } from 'vitest';
import {
  canTransitionDocument,
  applyDocumentTransition,
  canTransitionPage,
  applyPageTransition,
  canTransitionApproval,
  applyApprovalTransition,
  canTransitionDecision,
  applyDecisionTransition,
  canTransitionFinding,
  applyFindingTransition,
  canTransitionExport,
  applyExportTransition,
  computeStaleness,
} from '../src/machines';
import type { DocumentStatus, PageStatus, ApprovalState, VisualDecision, ValidationFinding, FindingStatus, FindingSeverity, Actor, ActorKind, DocumentObject, Diagram, Chart, Dataset, ImageAsset } from '../src/schema';

// ============================================================================
// Test Helpers
// ============================================================================

const createMockActor = (kind: ActorKind): Actor => ({
  id: 'act_test' as any,
  kind,
  label: kind === 'human' ? 'You' : 'Agent',
  agentOrigin: kind === 'browser_agent' ? 'https://chat.openai.com' : undefined,
});

// ============================================================================
// Document Lifecycle Tests
// ============================================================================

describe('Document State Machine', () => {
  describe('canTransitionDocument', () => {
    it('allows ReviewRequested from draft', () => {
      expect(canTransitionDocument('draft', 'ReviewRequested')).toBe('review');
    });

    it('allows AllPagesApproved from review', () => {
      expect(canTransitionDocument('review', 'AllPagesApproved')).toBe('page_approved');
    });

    it('allows ReadinessConfirmed from page_approved', () => {
      expect(canTransitionDocument('page_approved', 'ReadinessConfirmed')).toBe('document_ready');
    });

    it('allows DocumentLocked from document_ready', () => {
      expect(canTransitionDocument('document_ready', 'DocumentLocked')).toBe('locked');
    });

    it('allows ExportFinalized from locked', () => {
      expect(canTransitionDocument('locked', 'ExportFinalized')).toBe('exported');
    });

    it('allows UnlockRequested from locked', () => {
      expect(canTransitionDocument('locked', 'UnlockRequested')).toBe('review');
    });

    it('allows UnlockRequested from exported', () => {
      expect(canTransitionDocument('exported', 'UnlockRequested')).toBe('review');
    });

    it('rejects invalid transitions', () => {
      expect(canTransitionDocument('draft', 'AllPagesApproved')).toBeNull();
      expect(canTransitionDocument('review', 'DocumentLocked')).toBeNull();
      expect(canTransitionDocument('locked', 'ReadinessConfirmed')).toBeNull();
    });
  });

  describe('applyDocumentTransition', () => {
    it('transitions draft → review with page count guard', () => {
      const result = applyDocumentTransition('draft', 'ReviewRequested', {
        pageCount: 1,
        allPagesApproved: false,
        blockingFindings: 0,
        requiredDecisionsApproved: false,
        manifestPreviewGenerated: false,
        userGesture: false,
      });
      expect(result).toBe('review');
    });

    it('throws when page count < 1 for ReviewRequested', () => {
      expect(() => applyDocumentTransition('draft', 'ReviewRequested', {
        pageCount: 0,
        allPagesApproved: false,
        blockingFindings: 0,
        requiredDecisionsApproved: false,
        manifestPreviewGenerated: false,
        userGesture: false,
      })).toThrow('At least one page required');
    });

    it('throws when not all pages approved for AllPagesApproved', () => {
      expect(() => applyDocumentTransition('review', 'AllPagesApproved', {
        pageCount: 2,
        allPagesApproved: false,
        blockingFindings: 0,
        requiredDecisionsApproved: false,
        manifestPreviewGenerated: false,
        userGesture: false,
      })).toThrow('Not all pages approved');
    });

    it('throws when blocking findings exist for ReadinessConfirmed', () => {
      expect(() => applyDocumentTransition('page_approved', 'ReadinessConfirmed', {
        pageCount: 2,
        allPagesApproved: true,
        blockingFindings: 1,
        requiredDecisionsApproved: true,
        manifestPreviewGenerated: false,
        userGesture: false,
      })).toThrow('Blocking findings must be resolved');
    });

    it('throws when required decisions not approved for ReadinessConfirmed', () => {
      expect(() => applyDocumentTransition('page_approved', 'ReadinessConfirmed', {
        pageCount: 2,
        allPagesApproved: true,
        blockingFindings: 0,
        requiredDecisionsApproved: false,
        manifestPreviewGenerated: false,
        userGesture: false,
      })).toThrow('All required decisions must be approved');
    });

    it('throws when manifest not generated for DocumentLocked', () => {
      expect(() => applyDocumentTransition('document_ready', 'DocumentLocked', {
        pageCount: 2,
        allPagesApproved: true,
        blockingFindings: 0,
        requiredDecisionsApproved: true,
        manifestPreviewGenerated: false,
        userGesture: true,
      })).toThrow('Manifest preview must be generated');
    });

    it('throws when no user gesture for DocumentLocked', () => {
      expect(() => applyDocumentTransition('document_ready', 'DocumentLocked', {
        pageCount: 2,
        allPagesApproved: true,
        blockingFindings: 0,
        requiredDecisionsApproved: true,
        manifestPreviewGenerated: true,
        userGesture: false,
      })).toThrow('User gesture required for locking');
    });

    it('throws when no user gesture for UnlockRequested', () => {
      expect(() => applyDocumentTransition('locked', 'UnlockRequested', {
        pageCount: 2,
        allPagesApproved: true,
        blockingFindings: 0,
        requiredDecisionsApproved: true,
        manifestPreviewGenerated: true,
        userGesture: false,
      })).toThrow('Only human can unlock');
    });
  });
});

// ============================================================================
// Page State Machine Tests
// ============================================================================

describe('Page State Machine', () => {
  describe('canTransitionPage', () => {
    it('allows SubmitForReview from draft', () => {
      expect(canTransitionPage('draft', 'SubmitForReview')).toBe('review');
    });

    it('allows Approve from review', () => {
      expect(canTransitionPage('review', 'Approve')).toBe('approved');
    });

    it('allows Reject from review', () => {
      expect(canTransitionPage('review', 'Reject')).toBe('draft');
    });

    it('allows Lock from approved when document locked', () => {
      expect(canTransitionPage('approved', 'Lock')).toBe('locked');
    });

    it('allows Unlock from approved', () => {
      expect(canTransitionPage('approved', 'Unlock')).toBe('review');
    });

    it('allows Unlock from locked', () => {
      expect(canTransitionPage('locked', 'Unlock')).toBe('review');
    });

    it('rejects invalid transitions', () => {
      expect(canTransitionPage('draft', 'Approve')).toBeNull();
      expect(canTransitionPage('approved', 'SubmitForReview')).toBeNull();
    });
  });

  describe('applyPageTransition', () => {
    it('allows Lock when document locked', () => {
      expect(applyPageTransition('approved', 'Lock', { documentLocked: true })).toBe('locked');
    });

    it('throws Lock when document not locked', () => {
      expect(() => applyPageTransition('approved', 'Lock', { documentLocked: false }))
        .toThrow('Page can only be locked when document is locked');
    });
  });
});

// ============================================================================
// Approval State Machine Tests
// ============================================================================

describe('Approval State Machine', () => {
  describe('canTransitionApproval', () => {
    it('allows Propose from unreviewed', () => {
      expect(canTransitionApproval('unreviewed', 'Propose')).toBe('proposed');
    });

    it('allows Approve from proposed', () => {
      expect(canTransitionApproval('proposed', 'Approve')).toBe('approved');
    });

    it('allows Reject from proposed', () => {
      expect(canTransitionApproval('proposed', 'Reject')).toBe('rejected');
    });

    it('allows RequestAlternatives from rejected', () => {
      expect(canTransitionApproval('rejected', 'RequestAlternatives')).toBe('proposed');
    });

    it('allows Stale from approved', () => {
      expect(canTransitionApproval('approved', 'Stale')).toBe('stale');
    });

    it('allows ReApprove from stale', () => {
      expect(canTransitionApproval('stale', 'ReApprove')).toBe('approved');
    });

    it('allows RequestAlternatives from stale', () => {
      expect(canTransitionApproval('stale', 'RequestAlternatives')).toBe('proposed');
    });

    it('rejects invalid transitions', () => {
      expect(canTransitionApproval('unreviewed', 'Approve')).toBeNull();
      expect(canTransitionApproval('approved', 'Reject')).toBeNull();
    });
  });

  describe('applyApprovalTransition', () => {
    it('allows Approve with human actor', () => {
      expect(applyApprovalTransition('proposed', 'Approve', {
        actorKind: 'human',
      })).toBe('approved');
    });

    it('throws Approve with agent actor', () => {
      expect(() => applyApprovalTransition('proposed', 'Approve', {
        actorKind: 'browser_agent',
      })).toThrow('Only human actors can approve');
    });

    it('throws ReApprove with agent actor', () => {
      expect(() => applyApprovalTransition('stale', 'ReApprove', {
        actorKind: 'browser_agent',
      })).toThrow('Only human actors can re-approve');
    });
  });
});

// ============================================================================
// Decision State Machine Tests
// ============================================================================

describe('Decision State Machine', () => {
  describe('canTransitionDecision', () => {
    it('allows Propose from open', () => {
      expect(canTransitionDecision('open', 'Propose')).toBe('proposed');
    });

    it('allows Approve from proposed', () => {
      expect(canTransitionDecision('proposed', 'Approve')).toBe('approved');
    });

    it('allows Reject from proposed', () => {
      expect(canTransitionDecision('proposed', 'Reject')).toBe('rejected');
    });

    it('allows RequestAlternatives from rejected', () => {
      expect(canTransitionDecision('rejected', 'RequestAlternatives')).toBe('proposed');
    });

    it('allows Stale from approved', () => {
      expect(canTransitionDecision('approved', 'Stale')).toBe('stale');
    });

    it('allows ReReview from stale', () => {
      expect(canTransitionDecision('stale', 'ReReview')).toBe('proposed');
    });

    it('rejects invalid transitions', () => {
      expect(canTransitionDecision('open', 'Approve')).toBeNull();
      expect(canTransitionDecision('approved', 'Reject')).toBeNull();
    });
  });

  describe('applyDecisionTransition', () => {
    it('allows transitions when document not locked', () => {
      expect(applyDecisionTransition('proposed', 'Approve', {
        documentLocked: false,
        actorKind: 'human',
      })).toBe('approved');
    });

    it('throws when document locked and proposing', () => {
      expect(() => applyDecisionTransition('open', 'Propose', {
        documentLocked: true,
        actorKind: 'human',
      })).toThrow('Decisions frozen on locked document');
    });

    it('throws when document locked and approving', () => {
      expect(() => applyDecisionTransition('proposed', 'Approve', {
        documentLocked: true,
        actorKind: 'human',
      })).toThrow('Decisions frozen on locked document');
    });

    it('throws when agent tries to approve', () => {
      expect(() => applyDecisionTransition('proposed', 'Approve', {
        documentLocked: false,
        actorKind: 'browser_agent',
      })).toThrow('Only human actors can approve decisions');
    });
  });
});

// ============================================================================
// Finding State Machine Tests
// ============================================================================

describe('Finding State Machine', () => {
  describe('canTransitionFinding', () => {
    it('allows Resolve from open', () => {
      expect(canTransitionFinding('open', 'Resolve')).toBe('resolved');
    });

    it('allows Accept from open', () => {
      expect(canTransitionFinding('open', 'Accept')).toBe('accepted');
    });

    it('allows Dismiss from open', () => {
      expect(canTransitionFinding('open', 'Dismiss')).toBe('dismissed');
    });

    it('allows Reopen from resolved', () => {
      expect(canTransitionFinding('resolved', 'Reopen')).toBe('open');
    });

    it('allows Reopen from accepted', () => {
      expect(canTransitionFinding('accepted', 'Reopen')).toBe('open');
    });

    it('allows Reopen from dismissed', () => {
      expect(canTransitionFinding('dismissed', 'Reopen')).toBe('open');
    });

    it('rejects invalid transitions', () => {
      expect(canTransitionFinding('resolved', 'Accept')).toBeNull();
      expect(canTransitionFinding('dismissed', 'Resolve')).toBeNull();
    });
  });

  describe('applyFindingTransition', () => {
    it('allows Accept for blocking findings', () => {
      expect(applyFindingTransition('open', 'Accept', {
        isSubjective: false,
        isBlocking: true,
      })).toBe('accepted');
    });

    it('throws Dismiss for non-subjective findings', () => {
      expect(() => applyFindingTransition('open', 'Dismiss', {
        isSubjective: false,
        isBlocking: false,
      })).toThrow('Only subjective findings can be dismissed');
    });

    it('allows Dismiss for subjective findings', () => {
      expect(applyFindingTransition('open', 'Dismiss', {
        isSubjective: true,
        isBlocking: false,
      })).toBe('dismissed');
    });
  });
});

// ============================================================================
// Export State Machine Tests
// ============================================================================

describe('Export State Machine', () => {
  describe('canTransitionExport', () => {
    it('allows Approve from prepared', () => {
      expect(canTransitionExport('prepared', 'Approve')).toBe('approved');
    });

    it('allows Render from approved', () => {
      expect(canTransitionExport('approved', 'Render')).toBe('rendering');
    });

    it('allows Complete from rendering', () => {
      expect(canTransitionExport('rendering', 'Complete')).toBe('completed');
    });

    it('allows Fail from rendering', () => {
      expect(canTransitionExport('rendering', 'Fail')).toBe('failed');
    });

    it('allows RePrepare from completed', () => {
      expect(canTransitionExport('completed', 'RePrepare')).toBe('prepared');
    });

    it('allows RePrepare from failed', () => {
      expect(canTransitionExport('failed', 'RePrepare')).toBe('prepared');
    });

    it('rejects invalid transitions', () => {
      expect(canTransitionExport('prepared', 'Render')).toBeNull();
      expect(canTransitionExport('approved', 'Complete')).toBeNull();
    });
  });

  describe('applyExportTransition', () => {
    it('throws Approve with invalid token', () => {
      expect(() => applyExportTransition('prepared', 'Approve', {
        hashMatches: true,
        approvalTokenValid: false,
      })).toThrow('Invalid approval token');
    });

    it('throws Complete with hash mismatch', () => {
      expect(() => applyExportTransition('rendering', 'Complete', {
        hashMatches: false,
        approvalTokenValid: true,
      })).toThrow('Export hash mismatch');
    });
  });
});

// ============================================================================
// Staleness Computation Tests
// ============================================================================

describe('Staleness Computation', () => {
  const createMockProject = (overrides: any = {}) => ({
    currentVersion: 10,
    decisions: {},
    findings: {},
    objects: {},
    diagrams: {},
    charts: {},
    datasets: {},
    ...overrides,
  });

  const createMockDecision = (overrides: Partial<VisualDecision> = {}): VisualDecision => ({
    id: 'dec_1' as any,
    category: 'image_selection',
    targetObjectIds: ['obj_1' as any],
    targetPageIds: [],
    status: 'approved',
    suggestedBy: 'act_1' as any,
    options: [{ id: 'opt_1' as any, description: 'Opt 1', evidence: [], isSelected: true }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  const createMockFinding = (overrides: Partial<ValidationFinding> = {}): ValidationFinding => ({
    id: 'fnd_1' as any,
    scope: 'object',
    targetId: 'obj_1' as any,
    category: 'layout.overlap',
    severity: 'error' as FindingSeverity,
    evidenceType: 'deterministic',
    summary: 'Test',
    evidence: [],
    suggestedActions: [],
    status: 'resolved',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  const createMockObject = (overrides: Partial<DocumentObject> = {}): DocumentObject => ({
    id: 'obj_1' as any,
    role: 'paragraph',
    kind: 'text',
    purpose: 'Test',
    bounds: { x: 0, y: 0, w: 100, h: 100 },
    constraints: [],
    layer: 0,
    readingOrderIndex: 0,
    accessibility: { isDecorative: false, includedInReadingOrder: true },
    provenance: { sourceType: 'user', actorId: 'act_1' as any, at: new Date().toISOString() },
    approval: 'approved' as ApprovalState,
    createdBy: 'act_1' as any,
    versionCreated: 1,
    versionModified: 1,
    ...overrides,
  });

  it('stales decision when approved object mutated', () => {
    const decision = createMockDecision({ id: 'dec_1' as any, status: 'approved', targetObjectIds: ['obj_1' as any] });
    const obj = createMockObject({ id: 'obj_1' as any, approval: 'approved', decisionId: 'dec_1' as any });
    const project = createMockProject({
      decisions: { [decision.id]: decision },
      objects: { [obj.id]: obj },
    });

    const result = computeStaleness({
      project,
      changedEntity: { type: 'object', id: 'obj_1', pageId: 'pg_1' },
    });

    expect(result.decisionsToStale).toContain('dec_1');
    expect(result.objectsToStale).toContain('obj_1');
  });

  it('does not stale decision when object not approved', () => {
    const decision = createMockDecision({ id: 'dec_1' as any, status: 'approved', targetObjectIds: ['obj_1' as any] });
    const obj = createMockObject({ id: 'obj_1' as any, approval: 'proposed', decisionId: 'dec_1' as any });
    const project = createMockProject({
      decisions: { [decision.id]: decision },
      objects: { [obj.id]: obj },
    });

    const result = computeStaleness({
      project,
      changedEntity: { type: 'object', id: 'obj_1', pageId: 'pg_1' },
    });

    expect(result.decisionsToStale).not.toContain('dec_1');
  });

  it('stales chart decisions when dataset changes', () => {
    const decision = createMockDecision({ id: 'dec_1' as any, category: 'chart_type', status: 'approved' });
    const chart = { id: 'ch_1' as any, spec: { datasetId: 'ds_1' as any }, specVersion: 0 } as unknown as Chart;
    const dataset = { id: 'ds_1' as any } as Dataset;
    const project = createMockProject({
      decisions: { [decision.id]: decision },
      charts: { [chart.id]: chart },
      datasets: { [dataset.id]: dataset },
    });

    const result = computeStaleness({
      project,
      changedEntity: { type: 'dataset', id: 'ds_1' },
    });

    expect(result.decisionsToStale).toContain('dec_1');
  });

  it('stales diagram decisions when diagram changes', () => {
    const decision = createMockDecision({ id: 'dec_1' as any, category: 'diagram_structure', status: 'approved' });
    const diagram = { id: 'dg_1' as any, specVersion: 1 } as unknown as Diagram;
    const project = createMockProject({
      decisions: { [decision.id]: decision },
      diagrams: { [diagram.id]: diagram },
    });

    const result = computeStaleness({
      project,
      changedEntity: { type: 'diagram', id: 'dg_1' },
    });

    expect(result.decisionsToStale).toContain('dec_1');
  });

  it('stales alt_text/image_placement decisions when image crop changes', () => {
    const altDecision = createMockDecision({ id: 'dec_alt' as any, category: 'alt_text', status: 'approved' });
    const placeDecision = createMockDecision({ id: 'dec_place' as any, category: 'image_placement', status: 'approved' });
    const project = createMockProject({
      decisions: { [altDecision.id]: altDecision, [placeDecision.id]: placeDecision },
    });

    const result = computeStaleness({
      project,
      changedEntity: { type: 'image_crop', id: 'ast_1' },
    });

    expect(result.decisionsToStale).toContain('dec_alt');
    expect(result.decisionsToStale).toContain('dec_place');
  });

  it('reopens resolved findings when target object becomes stale', () => {
    const decision = createMockDecision({ id: 'dec_1' as any, status: 'approved', targetObjectIds: ['obj_1' as any] });
    const obj = createMockObject({ id: 'obj_1' as any, approval: 'approved', decisionId: 'dec_1' as any });
    const finding = createMockFinding({ id: 'fnd_1' as any, targetId: 'obj_1', status: 'resolved' });
    const project = createMockProject({
      decisions: { [decision.id]: decision },
      objects: { [obj.id]: obj },
      findings: { [finding.id]: finding },
    });

    const result = computeStaleness({
      project,
      changedEntity: { type: 'object', id: 'obj_1', pageId: 'pg_1' },
    });

    expect(result.findingsToReopen).toContain('fnd_1');
  });

  it('does not reopen findings for unaffected objects', () => {
    const finding = createMockFinding({ id: 'fnd_1' as any, targetId: 'obj_2', status: 'resolved' });
    const project = createMockProject({
      findings: { [finding.id]: finding },
    });

    const result = computeStaleness({
      project,
      changedEntity: { type: 'object', id: 'obj_1', pageId: 'pg_1' },
    });

    expect(result.findingsToReopen).not.toContain('fnd_1');
  });
});