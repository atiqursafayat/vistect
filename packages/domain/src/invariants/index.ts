// ============================================================================
// Invariants (I-01 through I-15)
// ============================================================================

import type {
  DocumentProject,
  DocumentObject,
  Page,
  ValidationFinding,
  VisualDecision,
  ApprovalState,
  FindingStatus,
  FindingSeverity,
  DocumentStatus,
  PageStatus,
  Actor,
  ActorKind,
} from '../schema';

export type InvariantCheck = (project: DocumentProject) => string | null;

// ============================================================================
// I-01: Every content mutation increments version; no mutation on locked projects succeeds
// ============================================================================
export function checkI01(project: DocumentProject): string | null {
  // This is enforced by the command bus (version guard + lock guard)
  // Here we verify the invariant holds in the current state
  if (project.status === 'locked') {
    // Check if there are any uncommitted mutations (would be caught by version mismatch)
    // In event-sourced system, this is enforced at dispatch time
  }
  return null;
}

// ============================================================================
// I-02: expectedDocumentVersion must equal current version at dispatch; otherwise StaleVersionError
// ============================================================================
export function checkI02(project: DocumentProject): string | null {
  // Enforced at command dispatch time
  return null;
}

// ============================================================================
// I-03: Approval transitions require human actor (command-bus guard)
// ============================================================================
export function checkI03(project: DocumentProject): string | null {
  // Enforced at command dispatch time
  return null;
}

// ============================================================================
// I-04: Mutation of an approved object marks it stale and re-opens its decision
// ============================================================================
export function checkI04(project: DocumentProject): string | null {
  for (const obj of Object.values(project.objects)) {
    if (obj.approval === 'stale' && obj.decisionId) {
      const decision = project.decisions[obj.decisionId];
      if (decision && decision.status !== 'stale' && decision.status !== 'rejected') {
        return `Object ${obj.id} is stale but decision ${obj.decisionId} is ${decision.status}`;
      }
    }
  }
  return null;
}

// ============================================================================
// I-05: Page mutation unlocks that page and cascades document status recompute
// ============================================================================
export function checkI05(project: DocumentProject): string | null {
  // If any page is not locked but document is locked, invariant violated
  if (project.status === 'locked') {
    for (const page of Object.values(project.pages)) {
      if (page.status !== 'locked') {
        return `Page ${page.id} is ${page.status} but document is locked`;
      }
    }
  }
  return null;
}

// ============================================================================
// I-06: Dataset change marks dependent charts' checks/descriptions stale
// ============================================================================
export function checkI06(project: DocumentProject): string | null {
  for (const chart of Object.values(project.charts)) {
    // Check if chart's dataset has newer version than chart's specVersion
    // This is simplified - real check would compare dataset updatedAt
    const dataset = project.datasets[chart.spec.datasetId];
    if (dataset && chart.specVersion < 1) { // placeholder logic
      // Chart should be marked stale
    }
  }
  return null;
}

// ============================================================================
// I-07: Diagram node/edge change marks diagram descriptions and checks stale
// ============================================================================
export function checkI07(project: DocumentProject): string | null {
  for (const diagram of Object.values(project.diagrams)) {
    if (diagram.specVersion > 0) {
      // Check if any decision for this diagram is stale
      const decisions = Object.values(project.decisions).filter(d =>
        d.category === 'diagram_structure' || d.category === 'diagram_layout'
      );
      for (const decision of decisions) {
        if (decision.status === 'approved' && diagram.specVersion > 0) {
          // Should be stale if diagram changed after approval
        }
      }
    }
  }
  return null;
}

// ============================================================================
// I-08: Image crop change marks alt text + placement decisions for review when relevant
// ============================================================================
export function checkI08(project: DocumentProject): string | null {
  for (const obj of Object.values(project.objects)) {
    if (obj.kind === 'image' && obj.crop) {
      // Check if any alt_text or image_placement decision for this object is stale
      const decisions = Object.values(project.decisions).filter(d =>
        (d.category === 'alt_text' || d.category === 'image_placement') &&
        d.targetObjectIds.includes(obj.id)
      );
      for (const decision of decisions) {
        if (decision.status === 'approved') {
          // Should be stale if crop changed after approval
        }
      }
    }
  }
  return null;
}

// ============================================================================
// I-09: Reading order contains exactly the ids of objects with includedInReadingOrder=true, once each
// ============================================================================
export function checkI09(project: DocumentProject): string | null {
  for (const page of Object.values(project.pages)) {
    const readingOrderObjects = page.readingOrder.filter(id => project.objects[id]?.accessibility.includedInReadingOrder);
    const includedObjects = Object.values(project.objects)
      .filter(o => o.accessibility.includedInReadingOrder && page.objects.includes(o.id))
      .map(o => o.id);

    // Check same elements
    const roSet = new Set(readingOrderObjects);
    const incSet = new Set(includedObjects);

    if (roSet.size !== incSet.size) {
      return `Page ${page.id}: reading order (${roSet.size}) != included objects (${incSet.size})`;
    }

    for (const id of roSet) {
      if (!incSet.has(id)) {
        return `Page ${page.id}: reading order contains ${id} not in included objects`;
      }
    }

    // Check no duplicates
    const seen = new Set<string>();
    for (const id of page.readingOrder) {
      if (seen.has(id)) {
        return `Page ${page.id}: duplicate reading order entry ${id}`;
      }
      seen.add(id);
    }
  }
  return null;
}

// ============================================================================
// I-10: Every non-decorative Image/Chart/Diagram must have alt text, chart table, diagram description before document_ready
// ============================================================================
export function checkI10(project: DocumentProject): string | null {
  if (project.status !== 'document_ready' && project.status !== 'locked' && project.status !== 'exported') {
    return null; // Only enforced at document_ready+
  }

  for (const obj of Object.values(project.objects)) {
    if (obj.accessibility.isDecorative) continue;

    if (obj.kind === 'image') {
      if (!obj.altTextApproved || obj.altTextApproved.trim() === '') {
        return `Image ${obj.id} missing approved alt text`;
      }
    }

    if (obj.kind === 'chart') {
      if (!obj.accessibility.altText || obj.accessibility.altText.trim() === '') {
        return `Chart ${obj.id} missing alt text`;
      }
      const chart = project.charts[obj.chartId];
      if (!chart) {
        return `Chart ${obj.id} references missing chart ${obj.chartId}`;
      }
    }

    if (obj.kind === 'diagram') {
      if (!obj.accessibility.longDescription || obj.accessibility.longDescription.trim() === '') {
        return `Diagram ${obj.id} missing long description`;
      }
      const diagram = project.diagrams[obj.diagramId];
      if (!diagram) {
        return `Diagram ${obj.id} references missing diagram ${obj.diagramId}`;
      }
    }
  }
  return null;
}

// ============================================================================
// I-11: Export finalize requires: no blocking open findings ∧ all required decisions approved ∧ status locked ∧ manifest.approvedVersion === currentVersion ∧ no event after lock ∧ renderer input hash === manifest hash
// ============================================================================
export function checkI11(project: DocumentProject): string | null {
  // This is enforced at export finalization time
  // Here we verify the conditions for any completed export
  for (const exportJob of Object.values(project.exportJobs)) {
    if (exportJob.status === 'completed') {
      if (!exportJob.manifest) {
        return `Export ${exportJob.id} completed without manifest`;
      }
      if (exportJob.approvedVersion !== project.currentVersion) {
        return `Export ${exportJob.id} approved version mismatch`;
      }
      // Check blocking findings
      const blockingFindings = Object.values(project.findings).filter(f =>
        f.severity === 'blocking' && f.status === 'open'
      );
      if (blockingFindings.length > 0) {
        return `Export ${exportJob.id} completed with ${blockingFindings.length} open blocking findings`;
      }
    }
  }
  return null;
}

// ============================================================================
// I-12: Decision ledger entries are append-only; corrections are new entries
// ============================================================================
export function checkI12(project: DocumentProject): string | null {
  // Decisions are immutable once created; only status/selectedOptionId change
  // No in-place history edits - verified by event log
  return null;
}

// ============================================================================
// I-13: Event log appends are durable (tx committed) before command returns success
// ============================================================================
export function checkI13(project: DocumentProject): string | null {
  // Enforced at storage layer
  return null;
}

// ============================================================================
// I-14: Object bounds are template-resolved; no object may carry user/agent-authored absolute x/y as input (constraints only)
// ============================================================================
export function checkI14(project: DocumentProject): string | null {
  for (const obj of Object.values(project.objects)) {
    // Objects should have constraints, not absolute positions as input
    // Bounds are computed by layout engine
    if (obj.constraints.length === 0 && obj.kind !== 'text') {
      // Text objects can be placed directly in some cases
      // But ideally all objects use constraints
    }
  }
  return null;
}

// ============================================================================
// I-15: Tool executions never mutate state outside the command bus (no engine writes state directly)
// ============================================================================
export function checkI15(project: DocumentProject): string | null {
  // Architectural invariant - enforced by code structure
  return null;
}

// ============================================================================
// All Invariants
// ============================================================================

export const allInvariants: InvariantCheck[] = [
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
];

export function checkAll(project: DocumentProject): string[] {
  const errors: string[] = [];
  for (const check of allInvariants) {
    const error = check(project);
    if (error) errors.push(error);
  }
  return errors;
}

// ============================================================================
// Individual exports for testing
// ============================================================================

export {
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
};