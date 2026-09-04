import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  Actor,
  DocumentObject,
  DocumentProject,
  Page,
  ValidationFinding,
  VisualDecision,
} from '@vistect/domain/schema';
import {
  createActorId,
  createDecisionId,
  createFindingId,
  createObjectId,
  createOptionId,
  createPageId,
  createProjectId,
} from '@vistect/domain/schema';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { Navigator } from '../features/navigator/Navigator';
import { WarningQueue } from '../features/validation/WarningQueue';
import { useStore } from '../state';

// The announcement provider writes to live regions; components under test read it
// through context, so it is mocked to a spy that tests can assert on.
const announce = vi.fn();
vi.mock('../app/Providers', () => ({
  useAnnouncements: () => ({ announce }),
}));

// ============================================================================
// Fixtures
// ============================================================================

const actorId = createActorId();

const actor: Actor = { id: actorId, kind: 'human', label: 'Test user' };

function makePage(overrides: Partial<Page> = {}): Page {
  const now = new Date().toISOString();
  return {
    id: createPageId(),
    template: 'text-led',
    status: 'draft',
    objects: [],
    readingOrder: [],
    createdAt: now,
    updatedAt: now,
    versionCreated: 1,
    versionModified: 1,
    ...overrides,
  };
}

function makeTextObject(overrides: Partial<Extract<DocumentObject, { kind: 'text' }>> = {}) {
  const object: Extract<DocumentObject, { kind: 'text' }> = {
    id: createObjectId(),
    kind: 'text',
    role: 'paragraph',
    content: 'Body copy',
    purpose: 'Introductory paragraph',
    bounds: { x: 72, y: 72, w: 451, h: 40 },
    constraints: [],
    layer: 0,
    readingOrderIndex: 0,
    accessibility: { isDecorative: false, includedInReadingOrder: true, warnings: [] },
    provenance: { sourceType: 'user', actorId, at: new Date().toISOString() },
    approval: 'unreviewed',
    createdBy: actorId,
    versionCreated: 1,
    versionModified: 1,
    ...overrides,
  };
  return object;
}

function makeFinding(overrides: Partial<ValidationFinding> = {}): ValidationFinding {
  const now = new Date().toISOString();
  return {
    id: createFindingId(),
    scope: 'object',
    targetId: createObjectId(),
    category: 'layout.overlap',
    severity: 'warning',
    evidenceType: 'deterministic',
    summary: 'Two objects overlap',
    evidence: ['Objects A and B intersect by 12 points'],
    suggestedActions: [],
    status: 'open',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeDecision(overrides: Partial<VisualDecision> = {}): VisualDecision {
  const now = new Date().toISOString();
  return {
    id: createDecisionId(),
    category: 'image_selection',
    targetObjectIds: [],
    targetPageIds: [],
    status: 'proposed',
    suggestedBy: actorId,
    options: [{ id: createOptionId(), description: 'Option A', evidence: [], isSelected: true }],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeProject(overrides: Partial<DocumentProject> = {}): DocumentProject {
  const now = new Date().toISOString();
  return {
    id: createProjectId(),
    title: 'Test report',
    language: 'en',
    documentType: 'impact-report',
    status: 'draft',
    intentContract: {
      documentType: 'impact-report',
      purpose: 'Report on programme outcomes for 2026',
      audience: 'Funders and partner organisations',
      primaryMessage: 'The programme reached twice as many people this year',
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
    actorId,
    createdAt: now,
    updatedAt: now,
    encrypted: false,
    ...overrides,
  };
}

/** Loads a project into the store, since components read it from there. */
function openProject(project: DocumentProject | null): void {
  const store = useStore.getState();
  if (project === null) {
    store.closeProject();
  } else {
    store.openProject(project);
  }
}

// ============================================================================
// Navigator
// ============================================================================

describe('Navigator', () => {
  beforeEach(() => {
    announce.mockClear();
    useStore.setState({ project: null, actor, selectedPageId: null, selectedObjectId: null });
  });

  afterEach(() => {
    useStore.getState().closeProject();
  });

  it('prompts to open a project when none is open', () => {
    render(<Navigator id="navigator" />);
    expect(screen.getByRole('heading', { name: /no project open/i })).toBeTruthy();
  });

  it('announces an empty document rather than rendering silence', () => {
    openProject(makeProject());
    render(<Navigator id="navigator" />);

    // `role="status"` so a screen reader learns the document is empty rather than
    // encountering an unexplained void.
    expect(screen.getByRole('status').textContent).toMatch(/no pages yet/i);
  });

  it('lists pages in authored order with human-readable template names', () => {
    const cover = makePage({ template: 'cover' });
    const body = makePage({ template: 'text-led' });
    openProject(
      makeProject({
        pages: { [cover.id]: cover, [body.id]: body },
        pageOrder: [cover.id, body.id],
      })
    );

    render(<Navigator id="navigator" />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText('Cover page')).toBeTruthy();
    expect(within(items[1]!).getByText('Text-led page')).toBeTruthy();
  });

  it('announces which page was selected', async () => {
    const user = userEvent.setup();
    const page = makePage({ template: 'cover' });
    openProject(makeProject({ pages: { [page.id]: page }, pageOrder: [page.id] }));

    render(<Navigator id="navigator" />);
    // The row button and its reorder controls all mention the template name, so
    // the row is addressed by exact accessible name.
    await user.click(screen.getByRole('button', { name: 'Cover page 0 objects, draft' }));

    expect(announce).toHaveBeenCalledWith(expect.stringContaining('Page 1'));
    expect(useStore.getState().selectedPageId).toBe(page.id);
  });

  it('disables reorder controls at the ends of the list', () => {
    const first = makePage();
    const last = makePage();
    openProject(
      makeProject({
        pages: { [first.id]: first, [last.id]: last },
        pageOrder: [first.id, last.id],
      })
    );

    render(<Navigator id="navigator" />);

    const items = screen.getAllByRole('listitem');
    expect(
      within(items[0]!).getByRole('button', { name: /move .* up/i })
    ).toHaveProperty('disabled', true);
    expect(
      within(items[1]!).getByRole('button', { name: /move .* down/i })
    ).toHaveProperty('disabled', true);
  });

  it('reorders a page and reports the new position', async () => {
    const user = userEvent.setup();
    const first = makePage({ template: 'cover' });
    const second = makePage({ template: 'statistics' });
    const onReorderPages = vi.fn();

    openProject(
      makeProject({
        pages: { [first.id]: first, [second.id]: second },
        pageOrder: [first.id, second.id],
      })
    );

    render(<Navigator id="navigator" onReorderPages={onReorderPages} />);
    await user.click(screen.getByRole('button', { name: /move statistics page up/i }));

    expect(onReorderPages).toHaveBeenCalledWith([second.id, first.id]);
    expect(announce).toHaveBeenCalledWith(expect.stringContaining('position 2 to 1'));
  });

  it('does not nest interactive controls', () => {
    const page = makePage();
    openProject(makeProject({ pages: { [page.id]: page }, pageOrder: [page.id] }));

    render(<Navigator id="navigator" />);

    // A button inside a button is invalid HTML and the inner control becomes
    // unreachable by keyboard, which would strip out page reordering entirely.
    for (const button of screen.getAllByRole('button')) {
      expect(button.querySelector('button')).toBeNull();
    }
  });
});

// ============================================================================
// Warning queue
// ============================================================================

describe('WarningQueue', () => {
  beforeEach(() => {
    announce.mockClear();
    useStore.setState({ project: null, actor });
  });

  it('prompts to open a project when none is open', () => {
    render(<WarningQueue id="warnings" />);
    expect(screen.getByRole('heading', { name: /no project open/i })).toBeTruthy();
  });

  it('shows a finding with its evidence', () => {
    const object = makeTextObject();
    const finding = makeFinding({ scope: 'object', targetId: object.id });

    openProject(
      makeProject({
        objects: { [object.id]: object },
        findings: { [finding.id]: finding },
      })
    );

    render(<WarningQueue id="warnings" />);
    expect(screen.getByText('Two objects overlap')).toBeTruthy();
  });

  it('resolves a page-scoped target without mis-reading it as an object', () => {
    const page = makePage();
    const finding = makeFinding({ scope: 'page', targetId: page.id, summary: 'Page overflows' });

    openProject(
      makeProject({
        pages: { [page.id]: page },
        pageOrder: [page.id],
        findings: { [finding.id]: finding },
      })
    );

    // Regression guard: the previous code looked the target up in *both*
    // dictionaries, so a page id could accidentally match an object id.
    expect(() => render(<WarningQueue id="warnings" />)).not.toThrow();
    expect(screen.getByText('Page overflows')).toBeTruthy();
  });
});

// ============================================================================
// Store projections
// ============================================================================

describe('store projections', () => {
  beforeEach(() => {
    useStore.setState({ project: null, actor });
  });

  it('counts decisions awaiting a human verdict', async () => {
    const proposed = makeDecision({ status: 'proposed' });
    const approved = makeDecision({ status: 'approved' });
    const rejected = makeDecision({ status: 'rejected' });

    openProject(
      makeProject({
        decisions: {
          [proposed.id]: proposed,
          [approved.id]: approved,
          [rejected.id]: rejected,
        },
      })
    );

    const { useUnapprovedDecisionCount } = await import('../state');
    const { result } = renderHookValue(useUnapprovedDecisionCount);
    // Approved and rejected are both settled; only `proposed` still needs review.
    expect(result).toBe(1);
  });

  it('selects only open blocking findings', async () => {
    const blockingOpen = makeFinding({ severity: 'blocking', status: 'open' });
    const blockingResolved = makeFinding({ severity: 'blocking', status: 'resolved' });
    const warningOpen = makeFinding({ severity: 'warning', status: 'open' });

    openProject(
      makeProject({
        findings: {
          [blockingOpen.id]: blockingOpen,
          [blockingResolved.id]: blockingResolved,
          [warningOpen.id]: warningOpen,
        },
      })
    );

    const { useOpenBlockingFindings } = await import('../state');
    const { result } = renderHookValue(useOpenBlockingFindings);
    expect(result).toHaveLength(1);
    expect((result as ValidationFinding[])[0]?.id).toBe(blockingOpen.id);
  });
});

/** Renders a hook in a throwaway component and returns its value. */
function renderHookValue<T>(hook: () => T): { result: T } {
  const captured: { result: T } = { result: undefined as T };

  function Probe() {
    captured.result = hook();
    return null;
  }

  render(<Probe />);
  return captured;
}
