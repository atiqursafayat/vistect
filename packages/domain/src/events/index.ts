// ============================================================================
// Domain Events
// ============================================================================

import { z } from 'zod';
import { nanoid } from 'nanoid';
import type { JsonValue } from 'type-fest';

// Re-export all schema types
export * from '../schema';

// ============================================================================
// Base Event Types
// ============================================================================

export const EventBaseSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  projectId: z.string().min(1),
  version: z.number().int().nonnegative(),
  timestamp: z.string().datetime({ offset: true }),
  actorId: z.string().min(1),
  payload: z.unknown(),
  hmac: z.string().length(64).optional(),
});
export type EventBase = z.infer<typeof EventBaseSchema>;

// ============================================================================
// Payload Schemas (discriminated union by type)
// ============================================================================

// Project Events
export const ProjectCreatedPayloadSchema = z.object({
  project: z.object({
    id: z.string(),
    title: z.string(),
    language: z.string(),
    documentType: z.string(),
    intentContract: z.unknown(),
    theme: z.unknown(),
    actorId: z.string(),
  }),
});

export const ProjectUpdatedPayloadSchema = z.object({
  changes: z.record(z.unknown()),
});

export const ProjectDeletedPayloadSchema = z.object({});

export const ProjectEncryptedPayloadSchema = z.object({
  keyHash: z.string().length(64),
});

export const ProjectImportedPayloadSchema = z.object({
  sourceHash: z.string().length(64),
});

// Page Events
export const PageCreatedPayloadSchema = z.object({
  pageId: z.string(),
  template: z.string(),
  insertAfter: z.string().optional(),
});

export const PageUpdatedPayloadSchema = z.object({
  pageId: z.string(),
  changes: z.record(z.unknown()),
});

export const PageDeletedPayloadSchema = z.object({
  pageId: z.string(),
});

export const PageReorderedPayloadSchema = z.object({
  pageOrder: z.array(z.string()),
});

export const PageStatusChangedPayloadSchema = z.object({
  pageId: z.string(),
  oldStatus: z.string(),
  newStatus: z.string(),
});

// Object Events
export const ObjectCreatedPayloadSchema = z.object({
  object: z.unknown(),
});

export const ObjectUpdatedPayloadSchema = z.object({
  objectId: z.string(),
  changes: z.record(z.unknown()),
});

export const ObjectDeletedPayloadSchema = z.object({
  objectId: z.string(),
  pageId: z.string(),
});

export const ObjectMovedPayloadSchema = z.object({
  objectId: z.string(),
  fromPageId: z.string(),
  toPageId: z.string(),
  insertAfter: z.string().optional(),
});

export const ObjectReadingOrderChangedPayloadSchema = z.object({
  pageId: z.string(),
  readingOrder: z.array(z.string()),
});

export const ObjectApprovalChangedPayloadSchema = z.object({
  objectId: z.string(),
  oldStatus: z.string(),
  newStatus: z.string(),
  actorId: z.string(),
  decisionId: z.string().optional(),
});

// Asset Events
export const AssetUploadedPayloadSchema = z.object({
  asset: z.unknown(),
});

export const AssetUpdatedPayloadSchema = z.object({
  assetId: z.string(),
  changes: z.record(z.unknown()),
});

export const AssetDeletedPayloadSchema = z.object({
  assetId: z.string(),
});

export const AssetCropRegisteredPayloadSchema = z.object({
  assetId: z.string(),
  crop: z.unknown(),
});

export const AssetAnalysisRecordedPayloadSchema = z.object({
  assetId: z.string(),
  observations: z.array(z.unknown()),
  interpretations: z.array(z.unknown()),
  uncertainties: z.array(z.unknown()),
});

// Dataset Events
export const DatasetCreatedPayloadSchema = z.object({
  dataset: z.unknown(),
});

export const DatasetUpdatedPayloadSchema = z.object({
  datasetId: z.string(),
  changes: z.record(z.unknown()),
});

export const DatasetDeletedPayloadSchema = z.object({
  datasetId: z.string(),
});

export const DatasetSchemaConfirmedPayloadSchema = z.object({
  datasetId: z.string(),
});

// Diagram Events
export const DiagramCreatedPayloadSchema = z.object({
  diagram: z.unknown(),
});

export const DiagramUpdatedPayloadSchema = z.object({
  diagramId: z.string(),
  changes: z.record(z.unknown()),
});

export const DiagramDeletedPayloadSchema = z.object({
  diagramId: z.string(),
});

export const DiagramNodeAddedPayloadSchema = z.object({
  diagramId: z.string(),
  node: z.unknown(),
});

export const DiagramNodeUpdatedPayloadSchema = z.object({
  diagramId: z.string(),
  nodeId: z.string(),
  changes: z.record(z.unknown()),
});

export const DiagramNodeRemovedPayloadSchema = z.object({
  diagramId: z.string(),
  nodeId: z.string(),
});

export const DiagramEdgeAddedPayloadSchema = z.object({
  diagramId: z.string(),
  edge: z.unknown(),
});

export const DiagramEdgeUpdatedPayloadSchema = z.object({
  diagramId: z.string(),
  edgeId: z.string(),
  changes: z.record(z.unknown()),
});

export const DiagramEdgeRemovedPayloadSchema = z.object({
  diagramId: z.string(),
  edgeId: z.string(),
});

export const DiagramLayoutAppliedPayloadSchema = z.object({
  diagramId: z.string(),
  layout: z.string(),
  seed: z.number(),
});

// Chart Events
export const ChartCreatedPayloadSchema = z.object({
  chart: z.unknown(),
});

export const ChartUpdatedPayloadSchema = z.object({
  chartId: z.string(),
  changes: z.record(z.unknown()),
});

export const ChartDeletedPayloadSchema = z.object({
  chartId: z.string(),
});

export const ChartSpecVersionBumpedPayloadSchema = z.object({
  chartId: z.string(),
  oldVersion: z.number(),
  newVersion: z.number(),
});

// Decision Events
export const DecisionCreatedPayloadSchema = z.object({
  decision: z.unknown(),
});

export const DecisionUpdatedPayloadSchema = z.object({
  decisionId: z.string(),
  changes: z.record(z.unknown()),
});

export const DecisionApprovedPayloadSchema = z.object({
  decisionId: z.string(),
  selectedOptionId: z.string(),
  reason: z.string().optional(),
  actorId: z.string(),
});

export const DecisionRejectedPayloadSchema = z.object({
  decisionId: z.string(),
  reason: z.string(),
  actorId: z.string(),
});

export const DecisionStaledPayloadSchema = z.object({
  decisionId: z.string(),
  reason: z.string(),
});

// Finding Events
export const FindingCreatedPayloadSchema = z.object({
  finding: z.unknown(),
});

export const FindingResolvedPayloadSchema = z.object({
  findingId: z.string(),
});

export const FindingAcceptedPayloadSchema = z.object({
  findingId: z.string(),
  reason: z.string(),
});

export const FindingDismissedPayloadSchema = z.object({
  findingId: z.string(),
});

export const FindingReopenedPayloadSchema = z.object({
  findingId: z.string(),
  reason: z.string(),
});

// Document Lifecycle Events
export const ReviewRequestedPayloadSchema = z.object({});
export const AllPagesApprovedPayloadSchema = z.object({});
export const ReadinessConfirmedPayloadSchema = z.object({});
export const DocumentLockedPayloadSchema = z.object({
  manifestHash: z.string().length(64),
});
export const DocumentUnlockedPayloadSchema = z.object({});
export const ExportFinalizedPayloadSchema = z.object({
  exportJobId: z.string(),
  manifestHash: z.string().length(64),
});

// Export Events
export const ExportJobCreatedPayloadSchema = z.object({
  exportJob: z.unknown(),
});
export const ExportJobUpdatedPayloadSchema = z.object({
  exportJobId: z.string(),
  changes: z.record(z.unknown()),
});
export const ExportManifestApprovedPayloadSchema = z.object({
  exportJobId: z.string(),
  actorId: z.string(),
  approvalToken: z.string(),
});

// Version/Snapshot Events
export const SnapshotCreatedPayloadSchema = z.object({
  version: z.number().int().nonnegative(),
  snapshotHash: z.string().length(64),
  eventCount: z.number().int().nonnegative(),
});
export const UndoPerformedPayloadSchema = z.object({
  undoneEventIds: z.array(z.string()),
  newVersion: z.number().int().nonnegative(),
});

// Privacy Events
export const PrivacyReceiptCreatedPayloadSchema = z.object({
  receiptId: z.string(),
  processingType: z.enum(['local', 'remote']),
  assetIds: z.array(z.string()).optional(),
  regionDescription: z.string().optional(),
  consentGiven: z.boolean(),
  retentionStatus: z.enum(['retained', 'deleted', 'pending']),
});

// Agent Activity Events
export const AgentToolExecutedPayloadSchema = z.object({
  toolName: z.string(),
  input: z.unknown(),
  result: z.unknown(),
  status: z.enum(['success', 'error']),
  versionBefore: z.number().int().nonnegative(),
  versionAfter: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
});

// ============================================================================
// Full Event Schemas (Base + Payload)
// ============================================================================

const createEventSchema = <T extends z.ZodTypeAny>(type: string, payloadSchema: T) =>
  EventBaseSchema.extend({
    type: z.literal(type),
    payload: payloadSchema,
  });

// Project
export const ProjectCreatedEventSchema = createEventSchema('ProjectCreated', ProjectCreatedPayloadSchema);
export const ProjectUpdatedEventSchema = createEventSchema('ProjectUpdated', ProjectUpdatedPayloadSchema);
export const ProjectDeletedEventSchema = createEventSchema('ProjectDeleted', ProjectDeletedPayloadSchema);
export const ProjectEncryptedEventSchema = createEventSchema('ProjectEncrypted', ProjectEncryptedPayloadSchema);
export const ProjectImportedEventSchema = createEventSchema('ProjectImported', ProjectImportedPayloadSchema);

// Page
export const PageCreatedEventSchema = createEventSchema('PageCreated', PageCreatedPayloadSchema);
export const PageUpdatedEventSchema = createEventSchema('PageUpdated', PageUpdatedPayloadSchema);
export const PageDeletedEventSchema = createEventSchema('PageDeleted', PageDeletedPayloadSchema);
export const PageReorderedEventSchema = createEventSchema('PageReordered', PageReorderedPayloadSchema);
export const PageStatusChangedEventSchema = createEventSchema('PageStatusChanged', PageStatusChangedPayloadSchema);

// Object
export const ObjectCreatedEventSchema = createEventSchema('ObjectCreated', ObjectCreatedPayloadSchema);
export const ObjectUpdatedEventSchema = createEventSchema('ObjectUpdated', ObjectUpdatedPayloadSchema);
export const ObjectDeletedEventSchema = createEventSchema('ObjectDeleted', ObjectDeletedPayloadSchema);
export const ObjectMovedEventSchema = createEventSchema('ObjectMoved', ObjectMovedPayloadSchema);
export const ObjectReadingOrderChangedEventSchema = createEventSchema('ObjectReadingOrderChanged', ObjectReadingOrderChangedPayloadSchema);
export const ObjectApprovalChangedEventSchema = createEventSchema('ObjectApprovalChanged', ObjectApprovalChangedPayloadSchema);

// Asset
export const AssetUploadedEventSchema = createEventSchema('AssetUploaded', AssetUploadedPayloadSchema);
export const AssetUpdatedEventSchema = createEventSchema('AssetUpdated', AssetUpdatedPayloadSchema);
export const AssetDeletedEventSchema = createEventSchema('AssetDeleted', AssetDeletedPayloadSchema);
export const AssetCropRegisteredEventSchema = createEventSchema('AssetCropRegistered', AssetCropRegisteredPayloadSchema);
export const AssetAnalysisRecordedEventSchema = createEventSchema('AssetAnalysisRecorded', AssetAnalysisRecordedPayloadSchema);

// Dataset
export const DatasetCreatedEventSchema = createEventSchema('DatasetCreated', DatasetCreatedPayloadSchema);
export const DatasetUpdatedEventSchema = createEventSchema('DatasetUpdated', DatasetUpdatedPayloadSchema);
export const DatasetDeletedEventSchema = createEventSchema('DatasetDeleted', DatasetDeletedPayloadSchema);
export const DatasetSchemaConfirmedEventSchema = createEventSchema('DatasetSchemaConfirmed', DatasetSchemaConfirmedPayloadSchema);

// Diagram
export const DiagramCreatedEventSchema = createEventSchema('DiagramCreated', DiagramCreatedPayloadSchema);
export const DiagramUpdatedEventSchema = createEventSchema('DiagramUpdated', DiagramUpdatedPayloadSchema);
export const DiagramDeletedEventSchema = createEventSchema('DiagramDeleted', DiagramDeletedPayloadSchema);
export const DiagramNodeAddedEventSchema = createEventSchema('DiagramNodeAdded', DiagramNodeAddedPayloadSchema);
export const DiagramNodeUpdatedEventSchema = createEventSchema('DiagramNodeUpdated', DiagramNodeUpdatedPayloadSchema);
export const DiagramNodeRemovedEventSchema = createEventSchema('DiagramNodeRemoved', DiagramNodeRemovedPayloadSchema);
export const DiagramEdgeAddedEventSchema = createEventSchema('DiagramEdgeAdded', DiagramEdgeAddedPayloadSchema);
export const DiagramEdgeUpdatedEventSchema = createEventSchema('DiagramEdgeUpdated', DiagramEdgeUpdatedPayloadSchema);
export const DiagramEdgeRemovedEventSchema = createEventSchema('DiagramEdgeRemoved', DiagramEdgeRemovedPayloadSchema);
export const DiagramLayoutAppliedEventSchema = createEventSchema('DiagramLayoutApplied', DiagramLayoutAppliedPayloadSchema);

// Chart
export const ChartCreatedEventSchema = createEventSchema('ChartCreated', ChartCreatedPayloadSchema);
export const ChartUpdatedEventSchema = createEventSchema('ChartUpdated', ChartUpdatedPayloadSchema);
export const ChartDeletedEventSchema = createEventSchema('ChartDeleted', ChartDeletedPayloadSchema);
export const ChartSpecVersionBumpedEventSchema = createEventSchema('ChartSpecVersionBumped', ChartSpecVersionBumpedPayloadSchema);

// Decision
export const DecisionCreatedEventSchema = createEventSchema('DecisionCreated', DecisionCreatedPayloadSchema);
export const DecisionUpdatedEventSchema = createEventSchema('DecisionUpdated', DecisionUpdatedPayloadSchema);
export const DecisionApprovedEventSchema = createEventSchema('DecisionApproved', DecisionApprovedPayloadSchema);
export const DecisionRejectedEventSchema = createEventSchema('DecisionRejected', DecisionRejectedPayloadSchema);
export const DecisionStaledEventSchema = createEventSchema('DecisionStaled', DecisionStaledPayloadSchema);

// Finding
export const FindingCreatedEventSchema = createEventSchema('FindingCreated', FindingCreatedPayloadSchema);
export const FindingResolvedEventSchema = createEventSchema('FindingResolved', FindingResolvedPayloadSchema);
export const FindingAcceptedEventSchema = createEventSchema('FindingAccepted', FindingAcceptedPayloadSchema);
export const FindingDismissedEventSchema = createEventSchema('FindingDismissed', FindingDismissedPayloadSchema);
export const FindingReopenedEventSchema = createEventSchema('FindingReopened', FindingReopenedPayloadSchema);

// Document Lifecycle
export const ReviewRequestedEventSchema = createEventSchema('ReviewRequested', ReviewRequestedPayloadSchema);
export const AllPagesApprovedEventSchema = createEventSchema('AllPagesApproved', AllPagesApprovedPayloadSchema);
export const ReadinessConfirmedEventSchema = createEventSchema('ReadinessConfirmed', ReadinessConfirmedPayloadSchema);
export const DocumentLockedEventSchema = createEventSchema('DocumentLocked', DocumentLockedPayloadSchema);
export const DocumentUnlockedEventSchema = createEventSchema('DocumentUnlocked', DocumentUnlockedPayloadSchema);
export const ExportFinalizedEventSchema = createEventSchema('ExportFinalized', ExportFinalizedPayloadSchema);

// Export
export const ExportJobCreatedEventSchema = createEventSchema('ExportJobCreated', ExportJobCreatedPayloadSchema);
export const ExportJobUpdatedEventSchema = createEventSchema('ExportJobUpdated', ExportJobUpdatedPayloadSchema);
export const ExportManifestApprovedEventSchema = createEventSchema('ExportManifestApproved', ExportManifestApprovedPayloadSchema);

// Version/Snapshot
export const SnapshotCreatedEventSchema = createEventSchema('SnapshotCreated', SnapshotCreatedPayloadSchema);
export const UndoPerformedEventSchema = createEventSchema('UndoPerformed', UndoPerformedPayloadSchema);

// Privacy
export const PrivacyReceiptCreatedEventSchema = createEventSchema('PrivacyReceiptCreated', PrivacyReceiptCreatedPayloadSchema);

// Agent Activity
export const AgentToolExecutedEventSchema = createEventSchema('AgentToolExecuted', AgentToolExecutedPayloadSchema);

// ============================================================================
// Union Types
// ============================================================================

export const DomainEventSchema = z.discriminatedUnion('type', [
  ProjectCreatedEventSchema,
  ProjectUpdatedEventSchema,
  ProjectDeletedEventSchema,
  ProjectEncryptedEventSchema,
  ProjectImportedEventSchema,
  PageCreatedEventSchema,
  PageUpdatedEventSchema,
  PageDeletedEventSchema,
  PageReorderedEventSchema,
  PageStatusChangedEventSchema,
  ObjectCreatedEventSchema,
  ObjectUpdatedEventSchema,
  ObjectDeletedEventSchema,
  ObjectMovedEventSchema,
  ObjectReadingOrderChangedEventSchema,
  ObjectApprovalChangedEventSchema,
  AssetUploadedEventSchema,
  AssetUpdatedEventSchema,
  AssetDeletedEventSchema,
  AssetCropRegisteredEventSchema,
  AssetAnalysisRecordedEventSchema,
  DatasetCreatedEventSchema,
  DatasetUpdatedEventSchema,
  DatasetDeletedEventSchema,
  DatasetSchemaConfirmedEventSchema,
  DiagramCreatedEventSchema,
  DiagramUpdatedEventSchema,
  DiagramDeletedEventSchema,
  DiagramNodeAddedEventSchema,
  DiagramNodeUpdatedEventSchema,
  DiagramNodeRemovedEventSchema,
  DiagramEdgeAddedEventSchema,
  DiagramEdgeUpdatedEventSchema,
  DiagramEdgeRemovedEventSchema,
  DiagramLayoutAppliedEventSchema,
  ChartCreatedEventSchema,
  ChartUpdatedEventSchema,
  ChartDeletedEventSchema,
  ChartSpecVersionBumpedEventSchema,
  DecisionCreatedEventSchema,
  DecisionUpdatedEventSchema,
  DecisionApprovedEventSchema,
  DecisionRejectedEventSchema,
  DecisionStaledEventSchema,
  FindingCreatedEventSchema,
  FindingResolvedEventSchema,
  FindingAcceptedEventSchema,
  FindingDismissedEventSchema,
  FindingReopenedEventSchema,
  ReviewRequestedEventSchema,
  AllPagesApprovedEventSchema,
  ReadinessConfirmedEventSchema,
  DocumentLockedEventSchema,
  DocumentUnlockedEventSchema,
  ExportFinalizedEventSchema,
  ExportJobCreatedEventSchema,
  ExportJobUpdatedEventSchema,
  ExportManifestApprovedEventSchema,
  SnapshotCreatedEventSchema,
  UndoPerformedEventSchema,
  PrivacyReceiptCreatedEventSchema,
  AgentToolExecutedEventSchema,
]);

export type DomainEvent = z.infer<typeof DomainEventSchema>;

// Alias for storage
export type EventEnvelope = EventBase & { payload: JsonValue };

// ============================================================================
// Event Factory Function
// ============================================================================

export function createEvent<T extends DomainEvent['type']>(
  type: T,
  projectId: string,
  version: number,
  actorId: string,
  payload: z.infer<typeof DomainEventSchema> extends { type: T; payload: infer P } ? P : never
): DomainEvent {
  return {
    id: `evt_${nanoid(16)}`,
    type,
    projectId,
    version,
    timestamp: new Date().toISOString(),
    actorId,
    payload,
    hmac: undefined,
  } as DomainEvent;
}

// ============================================================================
// Event Factory Functions (Typed)
// ============================================================================

export const createProjectCreatedEvent = (
  projectId: string,
  actorId: string,
  project: {
    id: string;
    title: string;
    language: string;
    documentType: string;
    intentContract: unknown;
    theme: unknown;
    actorId: string;
  }
) => createEvent('ProjectCreated', projectId, 1, actorId, { project });

export const createPageCreatedEvent = (
  projectId: string,
  version: number,
  actorId: string,
  pageId: string,
  template: string,
  insertAfter?: string
) => createEvent('PageCreated', projectId, version, actorId, { pageId, template, insertAfter });

export const createObjectCreatedEvent = (
  projectId: string,
  version: number,
  actorId: string,
  object: z.infer<typeof import('../schema').DocumentObjectSchema>
) => createEvent('ObjectCreated', projectId, version, actorId, { object });

export const createObjectUpdatedEvent = (
  projectId: string,
  version: number,
  actorId: string,
  objectId: string,
  changes: Record<string, unknown>
) => createEvent('ObjectUpdated', projectId, version, actorId, { objectId, changes });

export const createObjectDeletedEvent = (
  projectId: string,
  version: number,
  actorId: string,
  objectId: string,
  pageId: string
) => createEvent('ObjectDeleted', projectId, version, actorId, { objectId, pageId });

export const createAssetUploadedEvent = (
  projectId: string,
  version: number,
  actorId: string,
  asset: z.infer<typeof import('../schema').ImageAssetSchema>
) => createEvent('AssetUploaded', projectId, version, actorId, { asset });

export const createDecisionCreatedEvent = (
  projectId: string,
  version: number,
  actorId: string,
  decision: z.infer<typeof import('../schema').VisualDecisionSchema>
) => createEvent('DecisionCreated', projectId, version, actorId, { decision });

export const createDecisionApprovedEvent = (
  projectId: string,
  version: number,
  actorId: string,
  decisionId: string,
  selectedOptionId: string,
  reason: string | undefined
) => createEvent('DecisionApproved', projectId, version, actorId, { decisionId, selectedOptionId, reason, actorId });

export const createFindingCreatedEvent = (
  projectId: string,
  version: number,
  actorId: string,
  finding: z.infer<typeof import('../schema').ValidationFindingSchema>
) => createEvent('FindingCreated', projectId, version, actorId, { finding });

export const createAgentToolExecutedEvent = (
  projectId: string,
  version: number,
  actorId: string,
  toolName: string,
  input: unknown,
  result: unknown,
  status: 'success' | 'error',
  versionBefore: number,
  versionAfter: number,
  durationMs: number
) => createEvent('AgentToolExecuted', projectId, version, actorId, {
  toolName,
  input,
  result,
  status,
  versionBefore,
  versionAfter,
  durationMs,
});