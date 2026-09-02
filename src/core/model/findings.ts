/**
 * Validation findings (spec §16.1) and the Visual Decision Ledger (spec §15).
 *
 * These two types are why the product can claim "the user remains the visual author":
 * a finding says what is measurably wrong, a decision records what was chosen, by whom,
 * from what alternatives, and whether a human has signed it off.
 */
import type { EvidenceType, Provenance } from './primitives.js';

export type FindingScope = 'object' | 'page' | 'document';
export type FindingSeverity = 'info' | 'warning' | 'error' | 'blocking';
export type FindingStatus = 'open' | 'accepted' | 'resolved' | 'dismissed';

/** A concrete next step, expressed as a tool call the agent or UI can offer. */
export type SuggestedAction = {
  label: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
};

/** Spec §16.1. */
export type ValidationFinding = {
  id: string;
  scope: FindingScope;
  targetId: string;
  /** Stable machine key, e.g. 'text-truncation', 'contrast-insufficient'. */
  category: string;
  severity: FindingSeverity;
  evidenceType: EvidenceType;
  summary: string;
  /** Measured numbers where possible — "722px of text in a 200px box". */
  evidence: string[];
  /** Only meaningful for `model_assessment`; a measurement has no confidence. */
  confidence?: number;
  suggestedActions: SuggestedAction[];
  status: FindingStatus;
  /** Version the finding was computed against, so a stale finding is detectable. */
  computedAtVersion: number;
};

/** Spec §15 decision types. */
export const DECISION_TYPES = [
  'page-structure',
  'page-template',
  'image-selection',
  'image-crop',
  'image-placement',
  'icon-metaphor',
  'icon-family',
  'chart-type',
  'chart-styling',
  'diagram-structure',
  'diagram-layout',
  'visual-priority',
  'reading-order',
  'alt-text',
  'long-description',
  'export-format',
] as const;

export type DecisionType = (typeof DECISION_TYPES)[number];

export type DecisionOption = {
  id: string;
  label: string;
  /** Deterministic metrics only. Model opinion belongs in `interpretation`. */
  metrics?: Record<string, string | number>;
  /** The agent's read of this option, kept separate from the metrics above (§4.3). */
  interpretation?: string;
  /** Why this option was not chosen. Present on rejected options only. */
  rejectionReason?: string;
};

export type DecisionStatus = 'proposed' | 'approved' | 'rejected' | 'stale';

/** Spec §15. Every consequential visual decision gets one of these. */
export type VisualDecision = {
  id: string;
  decisionType: DecisionType;
  /** One readable sentence — this is what a screen reader announces. */
  summary: string;
  /** Objects, assets or pages this decision governs. */
  targetIds: string[];
  optionsReviewed: DecisionOption[];
  selectedOptionId?: string;
  selectionReason?: string;
  evidenceType: EvidenceType;
  suggestedBy: Provenance;
  status: DecisionStatus;
  approvedBy?: string;
  approvedAt?: string;
  /** Version at which the decision was staged. */
  stagedAtVersion: number;
  approvedVersion?: number;
  /** Set when an upstream change invalidated an approval (§27). */
  staleReason?: string;
};

export const isUnresolved = (decision: VisualDecision): boolean =>
  decision.status === 'proposed' || decision.status === 'stale';

export const blocksExport = (finding: ValidationFinding): boolean =>
  finding.severity === 'blocking' && finding.status === 'open';
