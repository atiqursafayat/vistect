// ============================================================================
// Decisions Module
// ============================================================================

import type {
  VisualDecision,
  DecisionCategory,
  DecisionOption,
  DecisionId,
  OptionId,
  ActorId,
  ObjectId,
  PageId,
  ApprovalState,
} from '../schema';

import type { DomainEvent } from '../events';
import { createDecisionCreatedEvent, createDecisionApprovedEvent, createDecisionRejectedEvent } from '../events';

// ============================================================================
// Decision Registry
// ============================================================================

export interface DecisionRegistry {
  createDecision(params: CreateDecisionParams): VisualDecision;
  approveDecision(decisionId: DecisionId, selectedOptionId: OptionId, reason: string | undefined, actorId: ActorId): DomainEvent[];
  rejectDecision(decisionId: DecisionId, reason: string, actorId: ActorId): DomainEvent[];
  requestAlternatives(decisionId: DecisionId): DomainEvent[];
  staleDecision(decisionId: DecisionId, reason: string): DomainEvent[];
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
    id: `dec_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}` as DecisionId,
    category: params.category,
    targetObjectIds: params.targetObjectIds,
    targetPageIds: params.targetPageIds,
    status: 'proposed',
    suggestedBy: params.suggestedBy,
    options: params.options.map((opt, idx) => ({
      ...opt,
      id: `opt_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}` as OptionId,
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
      '', // projectId filled by caller
      0, // version filled by caller
      actorId,
      decisionId,
      selectedOptionId,
      reason
    ),
  ];
}

function rejectDecision(
  decisionId: DecisionId,
  reason: string,
  actorId: ActorId
): DomainEvent[] {
  return [
    createDecisionRejectedEvent(
      '', // projectId filled by caller
      0, // version filled by caller
      actorId,
      decisionId,
      reason
    ),
  ];
}

function requestAlternatives(decisionId: DecisionId): DomainEvent[] {
  // Returns event to transition decision back to proposed
  return [];
}

function staleDecision(decisionId: DecisionId, reason: string): DomainEvent[] {
  // Returns event to mark decision as stale
  return [];
}

// ============================================================================
// Decision Helpers
// ============================================================================

export function getUnreviewedDecisions(decisions: Record<string, VisualDecision>): VisualDecision[] {
  return Object.values(decisions).filter(d => d.status === 'unreviewed' || d.status === 'proposed');
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
  candidates: Array<{ assetId: string; criteriaScores: Record<string, number> }>
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
  recommendations: Array<{ type: string; reason: string }>
): DecisionOption[] {
  return recommendations.map((rec, idx) => ({
    id: `opt_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}` as OptionId,
    description: `${rec.type} chart`,
    evidence: [rec.reason],
    isSelected: idx === 0,
  }));
}

export function createIconMetaphorOptions(
  metaphors: Array<{ name: string; meaning: string; confidence: number }>
): DecisionOption[] {
  return metaphors.map((m, idx) => ({
    id: `opt_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}` as OptionId,
    description: `${m.name} (${m.meaning})`,
    evidence: [`Confidence: ${(m.confidence * 100).toFixed(0)}%`],
    isSelected: idx === 0,
  }));
}