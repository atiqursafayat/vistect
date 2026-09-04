// ============================================================================
// Invariants (I-01 through I-15)
// ============================================================================
//
// Each check inspects a project snapshot and returns a human-readable violation
// message, or `null` when the invariant holds.
//
// Some invariants (I-01, I-02, I-03, I-12, I-13, I-15) are *temporal* or
// *architectural*: they constrain how a transition may occur, not what a
// snapshot may contain, so they cannot be falsified by inspecting state alone.
// They are enforced at their real enforcement point (command bus, storage
// layer, module boundaries) and are represented here by explicit no-op checks
// with a documented `enforcedAt`, so that `allInvariants` stays a complete
// 15-item register rather than silently omitting them.
//
// See `docs/planning/04-domain-model.md` for the normative statements.

import { dictValues } from '../collections';
import type { DocumentProject } from '../schema';

export type InvariantCheck = (project: DocumentProject) => string | null;

/** Where an invariant is actually enforced, when a snapshot cannot verify it. */
export type EnforcementPoint = 'command-bus' | 'storage-layer' | 'module-boundaries';

export interface InvariantDescriptor {
  id: string;
  statement: string;
  check: InvariantCheck;
  /** Present only for invariants a snapshot cannot falsify. */
  enforcedAt?: EnforcementPoint;
}

// ============================================================================
// I-01: Every content mutation increments version; no mutation on a locked project succeeds
// ============================================================================

/**
 * Snapshot-unverifiable: a snapshot cannot show a mutation that was rejected.
 * Enforced by the command bus lock guard and version guard; covered by
 * `bus` tests, not by state inspection.
 */
export function checkI01(_project: DocumentProject): string | null {
  return null;
}

// ============================================================================
// I-02: expectedVersion must equal currentVersion at dispatch, else StaleVersionError
// ============================================================================

/** Snapshot-unverifiable. Enforced by the command bus version guard. */
export function checkI02(_project: DocumentProject): string | null {
  return null;
}

// ============================================================================
// I-03: Approval transitions require a human actor
// ============================================================================

/** Snapshot-unverifiable. Enforced by the command bus human-actor guard. */
export function checkI03(_project: DocumentProject): string | null {
  return null;
}

// ============================================================================
// I-04: Mutation of an approved object marks it stale and re-opens its decision
// ============================================================================

export function checkI04(project: DocumentProject): string | null {
  for (const obj of dictValues(project.objects)) {
    if (obj.approval !== 'stale' || obj.decisionId === undefined) continue;

    const decision = project.decisions[obj.decisionId];
    if (decision === undefined) {
      return `Object ${obj.id} references missing decision ${obj.decisionId}`;
    }
    if (decision.status !== 'stale' && decision.status !== 'rejected') {
      return `Object ${obj.id} is stale but decision ${obj.decisionId} is ${decision.status}`;
    }
  }
  return null;
}

// ============================================================================
// I-05: A locked document implies every page is locked
// ============================================================================

export function checkI05(project: DocumentProject): string | null {
  if (project.status !== 'locked') return null;

  for (const page of dictValues(project.pages)) {
    if (page.status !== 'locked') {
      return `Page ${page.id} has status "${page.status}" but document is locked`;
    }
  }
  return null;
}

// ============================================================================
// I-06: Dataset change marks dependent charts' checks/descriptions stale
// ============================================================================

/**
 * Snapshot-verifiable part: referential integrity plus approval coherence.
 *
 * The temporal cascade ("a dataset edit stales dependent chart decisions") needs
 * the change event and is enforced by `computeStaleness` in `../machines`,
 * invoked by the command bus. A snapshot has no record of *when* the dataset
 * changed, so asserting it here would require version fields the schema does
 * not carry. What a snapshot can prove is that no chart points at a missing
 * dataset, and that a stale chart object does not still hold an approved
 * chart decision.
 */
export function checkI06(project: DocumentProject): string | null {
  for (const chart of dictValues(project.charts)) {
    if (project.datasets[chart.spec.datasetId] === undefined) {
      return `Chart ${chart.id} references missing dataset ${chart.spec.datasetId}`;
    }
  }

  for (const obj of dictValues(project.objects)) {
    if (obj.kind !== 'chart' || obj.approval !== 'stale') continue;

    const approvedChartDecision = dictValues(project.decisions).find(
      (d) =>
        (d.category === 'chart_type' || d.category === 'chart_styling') &&
        d.status === 'approved' &&
        d.targetObjectIds.includes(obj.id)
    );
    if (approvedChartDecision !== undefined) {
      return `Chart object ${obj.id} is stale but ${approvedChartDecision.category} decision ${approvedChartDecision.id} is still approved`;
    }
  }
  return null;
}

// ============================================================================
// I-07: Diagram node/edge change marks diagram descriptions and checks stale
// ============================================================================

export function checkI07(project: DocumentProject): string | null {
  for (const diagram of dictValues(project.diagrams)) {
    // Every edge must connect existing nodes; a dangling edge means a node was
    // removed without the dependent topology being revalidated.
    const nodeIds = new Set(diagram.nodes.map((n) => n.id));
    for (const edge of diagram.edges) {
      if (!nodeIds.has(edge.from)) {
        return `Diagram ${diagram.id} edge ${edge.id} references missing source node ${edge.from}`;
      }
      if (!nodeIds.has(edge.to)) {
        return `Diagram ${diagram.id} edge ${edge.id} references missing target node ${edge.to}`;
      }
    }
  }
  return null;
}

// ============================================================================
// I-08: Image crop change marks alt text + placement decisions for review
// ============================================================================

export function checkI08(project: DocumentProject): string | null {
  for (const obj of dictValues(project.objects)) {
    if (obj.kind !== 'image' || obj.crop === undefined) continue;

    // A crop changes the visible region, so an alt-text or placement approval
    // granted before it no longer describes what is shown. The temporal
    // cascade runs in `computeStaleness`; what a snapshot can prove is that a
    // stale image does not still carry an approved dependent decision.
    const affected = dictValues(project.decisions).filter(
      (d) =>
        (d.category === 'alt_text' || d.category === 'image_placement') &&
        d.targetObjectIds.includes(obj.id)
    );
    for (const decision of affected) {
      if (decision.status === 'approved' && obj.approval === 'stale') {
        return `Image ${obj.id} is stale but ${decision.category} decision ${decision.id} is still approved`;
      }
    }
  }
  return null;
}

// ============================================================================
// I-09: Reading order contains exactly the ids of objects with
//       includedInReadingOrder=true on that page, once each
// ============================================================================

export function checkI09(project: DocumentProject): string | null {
  for (const page of dictValues(project.pages)) {
    // Dangling references first — silently filtering them (the previous
    // behaviour) hid genuine violations.
    for (const id of page.readingOrder) {
      if (project.objects[id] === undefined) {
        return `Page ${page.id}: reading order contains ${id}, which is not an object in this project`;
      }
      if (!page.objects.includes(id)) {
        return `Page ${page.id}: reading order contains ${id}, which is not on this page`;
      }
    }

    // Duplicates.
    const seen = new Set<string>();
    for (const id of page.readingOrder) {
      if (seen.has(id)) {
        return `Page ${page.id}: duplicate reading order entry ${id}`;
      }
      seen.add(id);
    }

    // Completeness: every included object on the page must appear.
    const included = page.objects.filter(
      (id) => project.objects[id]?.accessibility.includedInReadingOrder === true
    );
    const missing = included.filter((id) => !seen.has(id));
    if (missing.length > 0) {
      return `Page ${page.id}: objects missing from reading order: ${missing.join(', ')}`;
    }

    // Exclusions: a decorative / excluded object must not appear.
    const excluded = page.readingOrder.filter(
      (id) => project.objects[id]?.accessibility.includedInReadingOrder === false
    );
    if (excluded.length > 0) {
      return `Page ${page.id}: excluded objects present in reading order: ${excluded.join(', ')}`;
    }
  }
  return null;
}

// ============================================================================
// I-10: Non-decorative Image/Chart/Diagram objects need accessible
//       alternatives before document_ready
// ============================================================================

export function checkI10(project: DocumentProject): string | null {
  const enforcedStatuses = new Set(['document_ready', 'locked', 'exported']);
  if (!enforcedStatuses.has(project.status)) return null;

  for (const obj of dictValues(project.objects)) {
    if (obj.accessibility.isDecorative) continue;

    switch (obj.kind) {
      case 'image': {
        if (obj.altTextApproved === undefined || obj.altTextApproved.trim() === '') {
          return `Image ${obj.id} missing approved alt text`;
        }
        break;
      }
      case 'chart': {
        const altText = obj.accessibility.altText;
        if (altText === undefined || altText.trim() === '') {
          return `Chart ${obj.id} missing alt text`;
        }
        if (project.charts[obj.chartId] === undefined) {
          return `Chart object ${obj.id} references missing chart ${obj.chartId}`;
        }
        break;
      }
      case 'diagram': {
        const longDescription = obj.accessibility.longDescription;
        if (longDescription === undefined || longDescription.trim() === '') {
          return `Diagram ${obj.id} missing long description`;
        }
        if (project.diagrams[obj.diagramId] === undefined) {
          return `Diagram object ${obj.id} references missing diagram ${obj.diagramId}`;
        }
        break;
      }
      case 'text':
      case 'icon':
      case 'table':
      case 'shape':
        break;
    }
  }
  return null;
}

// ============================================================================
// I-11: Export finalize preconditions
// ============================================================================

export function checkI11(project: DocumentProject): string | null {
  for (const exportJob of dictValues(project.exportJobs)) {
    if (exportJob.status !== 'completed') continue;

    if (exportJob.manifest === undefined) {
      return `Export ${exportJob.id} completed without manifest`;
    }
    if (exportJob.approvedVersion !== project.currentVersion) {
      return `Export ${exportJob.id} approved version mismatch: manifest ${String(exportJob.approvedVersion)} vs current ${project.currentVersion}`;
    }

    const blocking = dictValues(project.findings).filter(
      (f) => f.severity === 'blocking' && f.status === 'open'
    );
    if (blocking.length > 0) {
      return `Export ${exportJob.id} completed with ${blocking.length} open blocking finding(s)`;
    }
  }
  return null;
}

// ============================================================================
// I-12: Decision ledger entries are append-only; corrections are new entries
// ============================================================================

/** Snapshot-unverifiable. Enforced by the append-only event log. */
export function checkI12(_project: DocumentProject): string | null {
  return null;
}

// ============================================================================
// I-13: Event log appends are durable before a command returns success
// ============================================================================

/** Snapshot-unverifiable. Enforced by the IndexedDB transaction in `@vistect/storage`. */
export function checkI13(_project: DocumentProject): string | null {
  return null;
}

// ============================================================================
// I-14: Object bounds are template-resolved; authored input is constraints only
// ============================================================================

export function checkI14(project: DocumentProject): string | null {
  for (const obj of dictValues(project.objects)) {
    // Bounds are an *output* of the layout engine. Negative or zero extents
    // mean the object was never resolved, which would place it off-page.
    if (obj.bounds.w <= 0 || obj.bounds.h <= 0) {
      return `Object ${obj.id} has unresolved bounds (w=${obj.bounds.w}, h=${obj.bounds.h})`;
    }

    for (const constraint of obj.constraints) {
      if (project.objects[constraint.anchorId] === undefined) {
        return `Object ${obj.id} constraint anchors to missing object ${constraint.anchorId}`;
      }
      if (constraint.anchorId === obj.id) {
        return `Object ${obj.id} constraint anchors to itself`;
      }
    }
  }
  return null;
}

// ============================================================================
// I-15: Tool executions never mutate state outside the command bus
// ============================================================================

/**
 * Snapshot-unverifiable. Enforced by module boundaries: engine packages
 * (`graph`, `charting`, `render-*`) are pure and hold no writable references,
 * and ESLint `no-restricted-paths` forbids them importing `storage`.
 */
export function checkI15(_project: DocumentProject): string | null {
  return null;
}

// ============================================================================
// Register
// ============================================================================

export const invariantRegister: readonly InvariantDescriptor[] = [
  { id: 'I-01', statement: 'Mutations increment version; locked projects reject mutations', check: checkI01, enforcedAt: 'command-bus' },
  { id: 'I-02', statement: 'expectedVersion must match currentVersion at dispatch', check: checkI02, enforcedAt: 'command-bus' },
  { id: 'I-03', statement: 'Approval transitions require a human actor', check: checkI03, enforcedAt: 'command-bus' },
  { id: 'I-04', statement: 'Stale objects have stale or rejected decisions', check: checkI04 },
  { id: 'I-05', statement: 'A locked document implies all pages locked', check: checkI05 },
  { id: 'I-06', statement: 'Charts track their dataset version', check: checkI06 },
  { id: 'I-07', statement: 'Diagram edges reference existing nodes', check: checkI07 },
  { id: 'I-08', statement: 'Crop changes invalidate alt-text and placement approvals', check: checkI08 },
  { id: 'I-09', statement: 'Reading order matches included objects exactly, once each', check: checkI09 },
  { id: 'I-10', statement: 'Non-decorative visuals have accessible alternatives at document_ready', check: checkI10 },
  { id: 'I-11', statement: 'Completed exports satisfy finalize preconditions', check: checkI11 },
  { id: 'I-12', statement: 'Decision ledger is append-only', check: checkI12, enforcedAt: 'storage-layer' },
  { id: 'I-13', statement: 'Event appends are durable before command success', check: checkI13, enforcedAt: 'storage-layer' },
  { id: 'I-14', statement: 'Bounds are layout-resolved; constraints reference real anchors', check: checkI14 },
  { id: 'I-15', statement: 'Tool executions mutate only via the command bus', check: checkI15, enforcedAt: 'module-boundaries' },
];

export const allInvariants: readonly InvariantCheck[] = invariantRegister.map((i) => i.check);

/** Runs every invariant and returns all violations found. */
export function checkAll(project: DocumentProject): string[] {
  const errors: string[] = [];
  for (const { id, check } of invariantRegister) {
    const error = check(project);
    if (error !== null) errors.push(`${id}: ${error}`);
  }
  return errors;
}
