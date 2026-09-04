// ============================================================================
// Testing Utilities
// ============================================================================

import type { DocumentProject, DocumentObject, Page, Actor } from '@vistect/domain/schema';
import { expect } from 'vitest';

// ============================================================================
// Mock Factories
// ============================================================================

export function createMockActor(overrides: Partial<Actor> = {}): Actor {
  return {
    id: 'act_test123' as any,
    kind: 'human',
    label: 'Test User',
    ...overrides,
  };
}

export function createMockAgentActor(origin = 'https://chat.openai.com'): Actor {
  return {
    id: 'act_agent123' as any,
    kind: 'browser_agent',
    label: 'Test Agent',
    agentOrigin: origin,
  };
}

export function createMockPage(overrides: Partial<Page> = {}): Page {
  return {
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
  };
}

export function createMockObject(overrides: Partial<DocumentObject> = {}): DocumentObject {
  const base = {
    id: 'obj_test123' as any,
    role: 'paragraph' as const,
    kind: 'text' as const,
    content: '',
    purpose: 'Test paragraph',
    bounds: { x: 50, y: 50, w: 400, h: 100 },
    constraints: [],
    layer: 0,
    readingOrderIndex: 0,
    accessibility: {
      isDecorative: false,
      includedInReadingOrder: true,
      warnings: [],
    },
    provenance: {
      sourceType: 'user' as const,
      actorId: 'act_test123' as any,
      at: new Date().toISOString(),
    },
    approval: 'unreviewed' as const,
    createdBy: 'act_test123' as any,
    versionCreated: 1,
    versionModified: 1,
    ...overrides,
  };
  return base as DocumentObject;
}


export function createMockProject(overrides: Partial<DocumentProject> = {}): DocumentProject {
  const actor = createMockActor();
  return {
    id: 'pj_test123' as any,
    title: 'Test Project',
    language: 'en',
    documentType: 'impact-report',
    status: 'draft',
    intentContract: {
      documentType: 'impact-report',
      purpose: 'Test purpose',
      audience: 'Test audience',
      primaryMessage: 'Test message',
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
    actorId: actor.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    encrypted: false,
    ...overrides,
  };
}

// ============================================================================
// Mock WebMCP Context
// ============================================================================

export interface MockModelContext {
  tools: Map<string, any>;
  registerTool(tool: any, options?: { signal?: AbortSignal }): void;
  getTools(): any[];
  executeTool(name: string, input: string): Promise<string>;
  ontoolchange: ((tools: any[]) => void) | null;
}

export function createMockModelContext(): MockModelContext {
  const tools = new Map<string, any>();

  return {
    tools,
    registerTool(tool: any, options?: { signal?: AbortSignal }) {
      tools.set(tool.name, { tool, options });
    },
    getTools() {
      return Array.from(tools.values()).map(({ tool }) => tool);
    },
    executeTool(name: string, _input: string) {
      const entry = tools.get(name);
      if (!entry) throw new Error(`Tool ${name} not found`);
      return Promise.resolve(JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }));
    },
    ontoolchange: null,
  };
}

// ============================================================================
// Test Helpers
// ============================================================================

export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createTestProject() {
  return createMockProject();
}

export function createTestPage() {
  return createMockPage();
}

export function createTestObject() {
  return createMockObject();
}

// ============================================================================
// Assertion Helpers
// ============================================================================

export function expectValidProject(project: DocumentProject) {
  expect(project.id).toBeDefined();
  expect(project.title).toBeTruthy();
  expect(project.currentVersion).toBeGreaterThanOrEqual(0);
  expect(project.pages).toBeDefined();
  expect(project.objects).toBeDefined();
  expect(project.intentContract).toBeDefined();
}

export function expectValidObject(object: DocumentObject) {
  expect(object.id).toBeDefined();
  expect(object.kind).toBeTruthy();
  expect(object.purpose).toBeTruthy();
  expect(object.bounds).toBeDefined();
  expect(object.bounds.w).toBeGreaterThan(0);
  expect(object.bounds.h).toBeGreaterThan(0);
  expect(object.accessibility).toBeDefined();
  expect(object.provenance).toBeDefined();
  expect(object.approval).toBeDefined();
}

export function expectValidDecision(decision: any) {
  expect(decision.id).toBeDefined();
  expect(decision.category).toBeTruthy();
  expect(decision.options).toBeDefined();
  expect(decision.options.length).toBeGreaterThan(0);
  expect(decision.status).toBeTruthy();
}