import { describe, it, expect } from 'vitest';

import {
  checkI01,
  checkI02,
  checkI03,
  checkI04,
  checkI05,
  checkI06,
  checkI07,
  checkI08,
  checkI09,
  checkI10,
  checkI11,
  checkI12,
  checkI13,
  checkI14,
  checkI15,
  checkAll,
} from '../src/invariants';
import type {
  ApprovalState,
  DocumentObject,
  DocumentProject,
  ExportJobId,
  ObjectId,
  Page,
  ValidationFinding,
  VisualDecision,
} from '../src/schema';

// ============================================================================
// Test Helpers
// ============================================================================

const createMockProject = (overrides: Partial<DocumentProject> = {}): DocumentProject => ({
  id: 'pj_test123' as any,
  title: 'Test Project',
  language: 'en',
  documentType: 'impact-report',
  status: 'draft',
  intentContract: {
    documentType: 'impact-report',
    purpose: 'Test',
    audience: 'Test',
    primaryMessage: 'Test',
    secondaryMessages: [],
    tone: 'professional',
    conceptsToAvoid: [],
    brandColors: {},
    brandFonts: {},
    visualStyle: 'clean',
    requiredVisuals: [],
    accessibilityRequirements: [],
    imageSourcingPreference: 'mixed',
    privacySensitivity: 'internal',
    exportRequirements: { pdf: true, html: true, svgDiagrams: true, chartTables: true },
  },
  theme: { colors: {}, fonts: {}, spacing: {} },
  pages: {},
  pageOrder: [],
  objects: {},
  assets: {},
  datasets: {},
  diagrams: {},
  charts: {},
  decisions: {},
  findings: {},
  versions: [],
  exportJobs: {},
  currentVersion: 1,
  actorId: 'act_test123' as any,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  encrypted: false,
  ...overrides,
});

/**
 * Builds a document object fixture.
 *
 * `overrides` is loosely typed and the result is cast: `DocumentObject` is a
 * discriminated union, so a partial spread cannot satisfy any single member, and
 * fixtures deliberately construct partial shapes to exercise validation.
 */
const createMockObject = (overrides: Record<string, unknown> = {}): DocumentObject =>
  ({
  id: 'obj_test123' as any,
  role: 'paragraph',
  kind: 'text',
  purpose: 'Test paragraph',
  bounds: { x: 50, y: 50, w: 400, h: 100 },
  constraints: [],
  layer: 0,
  readingOrderIndex: 0,
  accessibility: { isDecorative: false, includedInReadingOrder: true, warnings: [] },
  provenance: {
    sourceType: 'user',
    actorId: 'act_test123' as any,
    at: new Date().toISOString(),
  },
  approval: 'unreviewed' as ApprovalState,
  createdBy: 'act_test123' as any,
    content: 'Test content',
    versionCreated: 1,
    versionModified: 1,
    ...overrides,
  }) as DocumentObject;

const createMockPage = (overrides: Partial<Page> = {}): Page => ({
  id: 'pg_test123' as any,
  template: 'text-led',
  status: 'draft',
  objects: [],
  readingOrder: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  versionCreated: 1,
  versionModified: 1,
  ...overrides,
});

const createMockFinding = (overrides: Partial<ValidationFinding> = {}): ValidationFinding => ({
  id: 'fnd_test123' as any,
  scope: 'object',
  targetId: 'obj_test123' as any,
  category: 'layout.overlap',
  severity: 'error',
  evidenceType: 'deterministic',
  summary: 'Test finding',
  evidence: [],
  suggestedActions: [],
  status: 'open',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const createMockDecision = (overrides: Partial<VisualDecision> = {}): VisualDecision => ({
  id: 'dec_test123' as any,
  category: 'image_selection',
  targetObjectIds: [],
  targetPageIds: [],
  status: 'proposed',
  suggestedBy: 'act_test123' as any,
  options: [
    { id: 'opt_1' as any, description: 'Option 1', evidence: [], isSelected: true },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

// ============================================================================
// Invariant Tests
// ============================================================================

describe('Domain Invariants', () => {
  describe('I-01: Version increments on mutation, no mutation on locked', () => {
    it('passes for draft project', () => {
      const project = createMockProject({ status: 'draft' });
      expect(checkI01(project)).toBeNull();
    });

    it('passes for locked project (invariant is about command-time enforcement)', () => {
      const project = createMockProject({ status: 'locked' });
      expect(checkI01(project)).toBeNull();
    });
  });

  describe('I-02: Stale version guard', () => {
    it('passes (enforced at dispatch time)', () => {
      const project = createMockProject();
      expect(checkI02(project)).toBeNull();
    });
  });

  describe('I-03: Human-only approvals', () => {
    it('passes (enforced at dispatch time)', () => {
      const project = createMockProject();
      expect(checkI03(project)).toBeNull();
    });
  });

  describe('I-04: Approved object mutation marks stale and re-opens decision', () => {
    it('passes when approved object has stale decision', () => {
      const obj = createMockObject({
        approval: 'stale',
        decisionId: 'dec_1' as any,
      });
      const decision = createMockDecision({
        id: 'dec_1' as any,
        status: 'stale',
      });
      const project = createMockProject({
        objects: { [obj.id]: obj },
        decisions: { [decision.id]: decision },
      });
      expect(checkI04(project)).toBeNull();
    });

    it('fails when approved object has non-stale decision', () => {
      const obj = createMockObject({
        approval: 'stale',
        decisionId: 'dec_1' as any,
      });
      const decision = createMockDecision({
        id: 'dec_1' as any,
        status: 'approved',
      });
      const project = createMockProject({
        objects: { [obj.id]: obj },
        decisions: { [decision.id]: decision },
      });
      expect(checkI04(project)).toContain('stale but decision');
    });

    it('passes when object is approved and decision is approved', () => {
      const obj = createMockObject({
        approval: 'approved',
        decisionId: 'dec_1' as any,
      });
      const decision = createMockDecision({
        id: 'dec_1' as any,
        status: 'approved',
      });
      const project = createMockProject({
        objects: { [obj.id]: obj },
        decisions: { [decision.id]: decision },
      });
      expect(checkI04(project)).toBeNull();
    });
  });

  describe('I-05: Page mutation unlocks page when document locked', () => {
    it('fails when document locked but page not locked', () => {
      const page = createMockPage({ status: 'approved' });
      const project = createMockProject({
        status: 'locked',
        pages: { [page.id]: page },
      });
      const violation = checkI05(project);
      expect(violation).not.toBeNull();
      expect(violation).toContain(page.id);
      expect(violation).toContain('document is locked');
    });

    it('passes when document and page both locked', () => {
      const page = createMockPage({ status: 'locked' });
      const project = createMockProject({
        status: 'locked',
        pages: { [page.id]: page },
      });
      expect(checkI05(project)).toBeNull();
    });

    it('passes when document not locked', () => {
      const page = createMockPage({ status: 'approved' });
      const project = createMockProject({
        status: 'draft',
        pages: { [page.id]: page },
      });
      expect(checkI05(project)).toBeNull();
    });
  });

  describe('I-06: Dataset change marks dependent charts stale', () => {
    it('passes (placeholder check)', () => {
      const project = createMockProject();
      expect(checkI06(project)).toBeNull();
    });
  });

  describe('I-07: Diagram change marks descriptions/checks stale', () => {
    it('passes (placeholder check)', () => {
      const project = createMockProject();
      expect(checkI07(project)).toBeNull();
    });
  });

  describe('I-08: Image crop change marks alt/placement decisions stale', () => {
    it('passes (placeholder check)', () => {
      const project = createMockProject();
      expect(checkI08(project)).toBeNull();
    });
  });

  describe('I-09: Reading order consistency', () => {
    it('passes when reading order matches included objects', () => {
      const obj1 = createMockObject({ id: 'obj_1' as any, accessibility: { isDecorative: false, includedInReadingOrder: true, warnings: [] } });
      const obj2 = createMockObject({ id: 'obj_2' as any, accessibility: { isDecorative: false, includedInReadingOrder: true, warnings: [] } });
      const page = createMockPage({
        id: 'pg_1' as any,
        objects: ['obj_1' as ObjectId, 'obj_2' as ObjectId],
        readingOrder: ['obj_1' as ObjectId, 'obj_2' as ObjectId],
      });
      const project = createMockProject({
        pages: { [page.id]: page },
        objects: { [obj1.id]: obj1, [obj2.id]: obj2 },
      });
      expect(checkI09(project)).toBeNull();
    });

    it('fails when reading order has extra object', () => {
      const obj1 = createMockObject({ id: 'obj_1' as any, accessibility: { isDecorative: false, includedInReadingOrder: true, warnings: [] } });
      const page = createMockPage({
        id: 'pg_1' as any,
        objects: ['obj_1' as ObjectId],
        readingOrder: ['obj_1' as ObjectId, 'obj_2' as ObjectId],
      });
      const project = createMockProject({
        pages: { [page.id]: page },
        objects: { [obj1.id]: obj1 },
      });
      expect(checkI09(project)).toContain('reading order contains');
    });

    it('fails when reading order has duplicate', () => {
      const obj1 = createMockObject({ id: 'obj_1' as any, accessibility: { isDecorative: false, includedInReadingOrder: true, warnings: [] } });
      const page = createMockPage({
        id: 'pg_1' as any,
        objects: ['obj_1' as ObjectId],
        readingOrder: ['obj_1' as ObjectId, 'obj_1' as ObjectId],
      });
      const project = createMockProject({
        pages: { [page.id]: page },
        objects: { [obj1.id]: obj1 },
      });
      expect(checkI09(project)).toContain('duplicate reading order');
    });

    it('fails when included object missing from reading order', () => {
      const obj1 = createMockObject({ id: 'obj_1' as any, accessibility: { isDecorative: false, includedInReadingOrder: true, warnings: [] } });
      const obj2 = createMockObject({ id: 'obj_2' as any, accessibility: { isDecorative: false, includedInReadingOrder: true, warnings: [] } });
      const page = createMockPage({
        id: 'pg_1' as any,
        objects: ['obj_1' as ObjectId, 'obj_2' as ObjectId],
        readingOrder: ['obj_1' as ObjectId],
      });
      const project = createMockProject({
        pages: { [page.id]: page },
        objects: { [obj1.id]: obj1, [obj2.id]: obj2 },
      });
      const violation = checkI09(project);
      expect(violation).toContain('reading order');
      expect(violation).toContain('obj_2');
    });
  });

  describe('I-10: Non-decorative objects require accessibility before document_ready', () => {
    it('passes for draft document', () => {
      const obj = createMockObject({ kind: 'image', accessibility: { isDecorative: false, includedInReadingOrder: true, warnings: [] } });
      const project = createMockProject({
        status: 'draft',
        objects: { [obj.id]: obj },
      });
      expect(checkI10(project)).toBeNull();
    });

    it('fails for document_ready with image missing alt text', () => {
      const obj = createMockObject({
        kind: 'image',
        accessibility: { isDecorative: false, includedInReadingOrder: true, warnings: [] },
        altTextApproved: undefined,
      });
      const project = createMockProject({
        status: 'document_ready',
        objects: { [obj.id]: obj },
      });
      expect(checkI10(project)).toContain('missing approved alt text');
    });

    it('passes for document_ready with approved alt text', () => {
      const obj = createMockObject({
        kind: 'image',
        accessibility: { isDecorative: false, includedInReadingOrder: true, warnings: [] },
        altTextApproved: 'Test image',
      });
      const project = createMockProject({
        status: 'document_ready',
        objects: { [obj.id]: obj },
      });
      expect(checkI10(project)).toBeNull();
    });

    it('passes for decorative images', () => {
      const obj = createMockObject({
        kind: 'image',
        accessibility: { isDecorative: true, includedInReadingOrder: false, warnings: [] },
      });
      const project = createMockProject({
        status: 'document_ready',
        objects: { [obj.id]: obj },
      });
      expect(checkI10(project)).toBeNull();
    });

    it('fails for chart missing alt text at document_ready', () => {
      const obj = createMockObject({
        kind: 'chart',
        accessibility: { isDecorative: false, includedInReadingOrder: true, warnings: [] },
        chartId: 'ch_1' as any,
      });
      const project = createMockProject({
        status: 'document_ready',
        objects: { [obj.id]: obj },
        charts: {},
      });
      expect(checkI10(project)).toContain('missing alt text');
    });

    it('fails for diagram missing long description at document_ready', () => {
      const obj = createMockObject({
        kind: 'diagram',
        accessibility: { isDecorative: false, includedInReadingOrder: true, warnings: [] },
        diagramId: 'dg_1' as any,
      });
      const project = createMockProject({
        status: 'document_ready',
        objects: { [obj.id]: obj },
        diagrams: {},
      });
      expect(checkI10(project)).toContain('missing long description');
    });
  });

  describe('I-11: Export finalize requirements', () => {
    it('passes for project without completed exports', () => {
      const project = createMockProject();
      expect(checkI11(project)).toBeNull();
    });

    it('fails when export completed but manifest missing', () => {
      const project = createMockProject({
        exportJobs: {
          ['exp_1' as ExportJobId]: {
            id: 'exp_1' as any,
            projectId: 'pj_test123' as any,
            status: 'completed',
            manifest: undefined,
            artifacts: [],
            createdAt: new Date().toISOString(),
          } as any,
        },
      });
      expect(checkI11(project)).toContain('without manifest');
    });

    it('fails when export approved version mismatch', () => {
      const project = createMockProject({
        currentVersion: 5,
        exportJobs: {
          ['exp_1' as ExportJobId]: {
            id: 'exp_1' as any,
            projectId: 'pj_test123' as any,
            status: 'completed',
            manifest: {} as any,
            approvedVersion: 3,
            artifacts: [],
            createdAt: new Date().toISOString(),
          } as any,
        },
      });
      expect(checkI11(project)).toContain('approved version mismatch');
    });

    it('fails when export completed with open blocking findings', () => {
      const finding = createMockFinding({
        severity: 'blocking',
        status: 'open',
      });
      const project = createMockProject({
        exportJobs: {
          ['exp_1' as ExportJobId]: {
            id: 'exp_1' as any,
            projectId: 'pj_test123' as any,
            status: 'completed',
            manifest: {} as any,
            approvedVersion: 1,
            artifacts: [],
            createdAt: new Date().toISOString(),
          } as any,
        },
        findings: { [finding.id]: finding },
      });
      const violation = checkI11(project);
      expect(violation).not.toBeNull();
      expect(violation).toContain('1 open blocking finding');
    });
  });

  describe('I-12: Decision ledger append-only', () => {
    it('passes (architectural)', () => {
      const project = createMockProject();
      expect(checkI12(project)).toBeNull();
    });
  });

  describe('I-13: Event log durability', () => {
    it('passes (storage layer)', () => {
      const project = createMockProject();
      expect(checkI13(project)).toBeNull();
    });
  });

  describe('I-14: Object bounds template-resolved', () => {
    it('passes (architectural)', () => {
      const project = createMockProject();
      expect(checkI14(project)).toBeNull();
    });
  });

  describe('I-15: Tools never mutate outside command bus', () => {
    it('passes (architectural)', () => {
      const project = createMockProject();
      expect(checkI15(project)).toBeNull();
    });
  });

  describe('checkAll', () => {
    it('returns empty array for valid project', () => {
      const project = createMockProject();
      expect(checkAll(project)).toEqual([]);
    });

    it('collects all violations', () => {
      const obj = createMockObject({
        kind: 'image',
        accessibility: { isDecorative: false, includedInReadingOrder: true, warnings: [] },
      });
      const project = createMockProject({
        status: 'document_ready',
        objects: { [obj.id]: obj },
      });
      const errors = checkAll(project);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('alt text'))).toBe(true);
    });
  });
});