// ============================================================================
// Decisions Module
// ============================================================================
//
// Decision creation is a pure function; state transitions emit events that the
// command bus stamps with the real `projectId` and `version`. Handlers that
// cannot yet emit a correct event throw rather than returning `[]`, so a
// silently-dropped transition cannot masquerade as success.

import { nanoid } from 'nanoid';


import type { DomainEvent } from '../events';
import {
  createDecisionApprovedEvent,
  createDecisionRejectedEvent,
  createDecisionStaledEvent,
  createDecisionUpdatedEvent,
} from '../events';
import type {
  VisualDecision,
  DecisionCategory,
  DecisionOption,
  DecisionId,
  OptionId,
  ActorId,
  ObjectId,
  PageId,
} from '../schema';

// ============================================================================
// Decision Registry
// ============================================================================

export interface DecisionRegistry {
  createDecision(params: CreateDecisionParams): VisualDecision;
  approveDecision(
    decisionId: DecisionId,
    selectedOptionId: OptionId,
    reason: string | undefined,
    actorId: ActorId
  ): DomainEvent[];
  rejectDecision(decisionId: DecisionId, reason: string, actorId: ActorId): DomainEvent[];
  requestAlternatives(decisionId: DecisionId, actorId: ActorId): DomainEvent[];
  staleDecision(decisionId: DecisionId, reason: string, actorId: ActorId): DomainEvent[];
}

export interface CreateDecisionParams {
  projectId: string;
  category: DecisionCategory;
  targetObjectIds: ObjectId[];
  targetPageIds: PageId[];
  suggestedBy: ActorId;
  options: DecisionOption[];
  version: number;
}

/**
 * Placeholder identifiers stamped by the command bus.
 *
 * Registry functions do not know the project or version they will be appended
 * at; the bus rewrites these fields when it appends. They are constants rather
 * than empty strings so an unstamped event is obvious in a log.
 */
const PENDING_PROJECT_ID = '__pending_project__';
const PENDING_VERSION = -1;

export function createDecisionRegistry(): DecisionRegistry {
  return {
    createDecision,
    approveDecision,
    rejectDecision,
    requestAlternatives,
    staleDecision,
  };
}

function createDecision(params: CreateDecisionParams): VisualDecision {
  const now = new Date().toISOString();
  return {
    id: `dec_${nanoid(12)}` as DecisionId,
    category: params.category,
    targetObjectIds: params.targetObjectIds,
    targetPageIds: params.targetPageIds,
    status: 'proposed',
    suggestedBy: params.suggestedBy,
    options: params.options.map((opt, idx) => ({
      ...opt,
      id: `opt_${nanoid(12)}` as OptionId,
      isSelected: idx === 0,
    })),
    createdAt: now,
    updatedAt: now,
  };
}

function approveDecision(
  decisionId: DecisionId,
  selectedOptionId: OptionId,
  reason: string | undefined,
  actorId: ActorId
): DomainEvent[] {
  return [
    createDecisionApprovedEvent(
      PENDING_PROJECT_ID,
      PENDING_VERSION,
      actorId,
      decisionId,
      selectedOptionId,
      reason
    ),
  ];
}

function rejectDecision(decisionId: DecisionId, reason: string, actorId: ActorId): DomainEvent[] {
  return [
    createDecisionRejectedEvent(PENDING_PROJECT_ID, PENDING_VERSION, actorId, decisionId, reason),
  ];
}

function requestAlternatives(decisionId: DecisionId, actorId: ActorId): DomainEvent[] {
  // Rejecting-with-alternatives returns the decision to `proposed` so the agent
  // can supply new options; recorded as an update, not a new decision (I-12).
  return [
    createDecisionUpdatedEvent(PENDING_PROJECT_ID, PENDING_VERSION, actorId, decisionId, {
      status: 'proposed',
      options: [],
    }),
  ];
}

function staleDecision(decisionId: DecisionId, reason: string, actorId: ActorId): DomainEvent[] {
  return [
    createDecisionStaledEvent(PENDING_PROJECT_ID, PENDING_VERSION, actorId, decisionId, reason),
  ];
}

// ============================================================================
// Decision Helpers
// ============================================================================

export function getUnreviewedDecisions(
  decisions: Record<string, VisualDecision>
): VisualDecision[] {
  return Object.values(decisions).filter((d) => d.status === 'open' || d.status === 'proposed');
}

export function getStaleDecisions(decisions: Record<string, VisualDecision>): VisualDecision[] {
  return Object.values(decisions).filter(d => d.status === 'stale');
}

export function getDecisionsByCategory(decisions: Record<string, VisualDecision>, category: DecisionCategory): VisualDecision[] {
  return Object.values(decisions).filter(d => d.category === category);
}

export function getDecisionsForObject(decisions: Record<string, VisualDecision>, objectId: ObjectId): VisualDecision[] {
  return Object.values(decisions).filter(d => d.targetObjectIds.includes(objectId));
}

export function getDecisionsForPage(decisions: Record<string, VisualDecision>, pageId: PageId): VisualDecision[] {
  return Object.values(decisions).filter(d => d.targetPageIds.includes(pageId));
}

export function countUnapprovedDecisions(decisions: Record<string, VisualDecision>): number {
  return Object.values(decisions).filter(d => d.status !== 'approved' && d.status !== 'rejected').length;
}

export function allRequiredDecisionsApproved(decisions: Record<string, VisualDecision>, requiredCategories: DecisionCategory[]): boolean {
  for (const category of requiredCategories) {
    const categoryDecisions = Object.values(decisions).filter(d => d.category === category);
    if (categoryDecisions.length === 0) continue; // No decision of this category yet
    const allApproved = categoryDecisions.every(d => d.status === 'approved');
    if (!allApproved) return false;
  }
  return true;
}

// ============================================================================
// Required Decision Categories (spec §15)
// ============================================================================

export const REQUIRED_DECISION_CATEGORIES: DecisionCategory[] = [
  'page_structure',
  'image_selection',
  'image_crop',
  'image_placement',
  'icon_metaphor',
  'icon_family',
  'chart_type',
  'chart_styling',
  'diagram_structure',
  'diagram_layout',
  'template_selection',
  'visual_priority',
  'reading_order',
  'alt_text',
  'long_description',
  'export_format',
];

// ============================================================================
// Decision Option Builders
// ============================================================================

export function createDecisionOption(
  description: string,
  evidence: string[] = [],
  isSelected = false
): DecisionOption {
  return {
    id: `opt_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}` as OptionId,
    description,
    evidence,
    isSelected,
  };
}

export function createImageSelectionOptions(
  candidates: { assetId: string; criteriaScores: Record<string, number> }[]
): DecisionOption[] {
  return candidates.map((candidate, idx) => ({
    id: `opt_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}` as OptionId,
    description: `Image candidate ${idx + 1} (${candidate.assetId})`,
    evidence: Object.entries(candidate.criteriaScores).map(([criterion, score]) =>
      `${criterion}: ${score.toFixed(2)}`
    ),
    isSelected: idx === 0,
  }));
}

export function createChartTypeOptions(
  recommendations: { type: string; reason: string }[]
): DecisionOption[] {
  return recommendations.map((rec, idx) => ({
    id: `opt_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}` as OptionId,
    description: `${rec.type} chart`,
    evidence: [rec.reason],
    isSelected: idx === 0,
  }));
}

export function createIconMetaphorOptions(
  metaphors: { name: string; meaning: string; confidence: number }[]
): DecisionOption[] {
  return metaphors.map((m, idx) => ({
    id: `opt_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}` as OptionId,
    description: `${m.name} (${m.meaning})`,
    evidence: [`Confidence: ${(m.confidence * 100).toFixed(0)}%`],
    isSelected: idx === 0,
  }));
}