import { z } from 'zod';
import { nanoid } from 'nanoid';

// Re-export all schema types
export * from '../schema';

// ============================================================================
// Event Envelope
// ============================================================================

export const EventEnvelopeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  projectId: z.string().min(1),
  version: z.number().int().nonnegative(),
  timestamp: z.string().datetime({ offset: true }),
  actorId: z.string().min(1),
  payload: z.unknown(),
  hmac: z.string().length(64).optional(), // HMAC-SHA256 of the event
});
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

// ============================================================================
// Event Types (discriminated union by type)
// ============================================================================

// Project Events
export const ProjectCreatedEventSchema = z.object({
  type: z.literal('ProjectCreated'),
  payload: z.object({
    project: z.object({
      id: z.string(),
      title: z.string(),
      language: z.string(),
      documentType: z.string(),
      intentContract: z.unknown(),
      theme: z.unknown(),
      actorId: z.string(),
    }),
  }),
});

export const ProjectUpdatedEventSchema = z.object({
  type: z.literal('ProjectUpdated'),
  payload: z.object({
    changes: z.record(z.unknown()),
  }),
});

export const ProjectDeletedEventSchema = z.object({
  type: z.literal('ProjectDeleted'),
  payload: z.object({}),
});

export const ProjectEncryptedEventSchema = z.object({
  type: z.literal('ProjectEncrypted'),
  payload: z.object({
    keyHash: z.string().length(64),
  }),
});

export const ProjectImportedEventSchema = z.object({
  type: z.literal('ProjectImported'),
  payload: z.object({
    sourceHash: z.string().length(64),
  }),
});

// Page Events
export const PageCreatedEventSchema = z.object({
  type: z.literal('PageCreated'),
  payload: z.object({
    pageId: z.string(),
    template: z.string(),
    insertAfter: z.string().optional(),
  }),
});

export const PageUpdatedEventSchema = z.object({
  type: z.literal('PageUpdated'),
  payload: z.object({
    pageId: z.string(),
    changes: z.record(z.unknown()),
  }),
});

export const PageDeletedEventSchema = z.object({
  type: z.literal('PageDeleted'),
  payload: z.object({
    pageId: z.string(),
  }),
});

export const PageReorderedEventSchema = z.object({
  type: z.literal('PageReordered'),
  payload: z.object({
    pageOrder: z.array(z.string()),
  }),
});

export const PageStatusChangedEventSchema = z.object({
  type: z.literal('PageStatusChanged'),
  payload: z.object({
    pageId: z.string(),
    oldStatus: z.string(),
    newStatus: z.string(),
  }),
});

// Object Events
export const ObjectCreatedEventSchema = z.object({
  type: z.literal('ObjectCreated'),
  payload: z.object({
    object: z.unknown(), // DocumentObject
  }),
});

export const ObjectUpdatedEventSchema = z.object({
  type: z.literal('ObjectUpdated'),
  payload: z.object({
    objectId: z.string(),
    changes: z.record(z.unknown()),
  }),
});

export const ObjectDeletedEventSchema = z.object({
  type: z.literal('ObjectDeleted'),
  payload: z.object({
    objectId: z.string(),
    pageId: z.string(),
  }),
});

export const ObjectMovedEventSchema = z.object({
  type: z.literal('ObjectMoved'),
  payload: z.object({
    objectId: z.string(),
    fromPageId: z.string(),
    toPageId: z.string(),
    insertAfter: z.string().optional(),
  }),
});

export const ObjectReadingOrderChangedEventSchema = z.object({
  type: z.literal('ObjectReadingOrderChanged'),
  payload: z.object({
    pageId: z.string(),
    readingOrder: z.array(z.string()),
  }),
});

export const ObjectApprovalChangedEventSchema = z.object({
  type: z.literal('ObjectApprovalChanged'),
  payload: z.object({
    objectId: z.string(),
    oldStatus: z.string(),
    newStatus: z.string(),
    actorId: z.string(),
    decisionId: z.string().optional(),
  }),
});

// Asset Events
export const AssetUploadedEventSchema = z.object({
  type: z.literal('AssetUploaded'),
  payload: z.object({
    asset: z.unknown(), // ImageAsset
  }),
});

export const AssetUpdatedEventSchema = z.object({
  type: z.literal('AssetUpdated'),
  payload: z.object({
    assetId: z.string(),
    changes: z.record(z.unknown()),
  }),
});

export const AssetDeletedEventSchema = z.object({
  type: z.literal('AssetDeleted'),
  payload: z.object({
    assetId: z.string(),
  }),
});

export const AssetCropRegisteredEventSchema = z.object({
  type: z.literal('AssetCropRegistered'),
  payload: z.object({
    assetId: z.string(),
    crop: z.unknown(), // CropSpec
  }),
});

export const AssetAnalysisRecordedEventSchema = z.object({
  type: z.literal('AssetAnalysisRecorded'),
  payload: z.object({
    assetId: z.string(),
    observations: z.array(z.unknown()),
    interpretations: z.array(z.unknown()),
    uncertainties: z.array(z.unknown()),
  }),
});

// Dataset Events
export const DatasetCreatedEventSchema = z.object({
  type: z.literal('DatasetCreated'),
  payload: z.object({
    dataset: z.unknown(), // Dataset
  }),
});

export const DatasetUpdatedEventSchema = z.object({
  type: z.literal('DatasetUpdated'),
  payload: z.object({
    datasetId: z.string(),
    changes: z.record(z.unknown()),
  }),
});

export const DatasetDeletedEventSchema = z.object({
  type: z.literal('DatasetDeleted'),
  payload: z.object({
    datasetId: z.string(),
  }),
});

export const DatasetSchemaConfirmedEventSchema = z.object({
  type: z.literal('DatasetSchemaConfirmed'),
  payload: z.object({
    datasetId: z.string(),
  }),
});

// Diagram Events
export const DiagramCreatedEventSchema = z.object({
  type: z.literal('DiagramCreated'),
  payload: z.object({
    diagram: z.unknown(), // Diagram
  }),
});

export const DiagramUpdatedEventSchema = z.object({
  type: z.literal('DiagramUpdated'),
  payload: z.object({
    diagramId: z.string(),
    changes: z.record(z.unknown()),
  }),
});

export const DiagramDeletedEventSchema = z.object({
  type: z.literal('DiagramDeleted'),
  payload: z.object({
    diagramId: z.string(),
  }),
});

export const DiagramNodeAddedEventSchema = z.object({
  type: z.literal('DiagramNodeAdded'),
  payload: z.object({
    diagramId: z.string(),
    node: z.unknown(), // DiagramNode
  }),
});

export const DiagramNodeUpdatedEventSchema = z.object({
  type: z.literal('DiagramNodeUpdated'),
  payload: z.object({
    diagramId: z.string(),
    nodeId: z.string(),
    changes: z.record(z.unknown()),
  }),
});

export const DiagramNodeRemovedEventSchema = z.object({
  type: z.literal('DiagramNodeRemoved'),
  payload: z.object({
    diagramId: z.string(),
    nodeId: z.string(),
  }),
});

export const DiagramEdgeAddedEventSchema = z.object({
  type: z.literal('DiagramEdgeAdded'),
  payload: z.object({
    diagramId: z.string(),
    edge: z.unknown(), // DiagramEdge
  }),
});

export const DiagramEdgeUpdatedEventSchema = z.object({
  type: z.literal('DiagramEdgeUpdated'),
  payload: z.object({
    diagramId: z.string(),
    edgeId: z.string(),
    changes: z.record(z.unknown()),
  }),
});

export const DiagramEdgeRemovedEventSchema = z.object({
  type: z.literal('DiagramEdgeRemoved'),
  payload: z.object({
    diagramId: z.string(),
    edgeId: z.string(),
  }),
});

export const DiagramLayoutAppliedEventSchema = z.object({
  type: z.literal('DiagramLayoutApplied'),
  payload: z.object({
    diagramId: z.string(),
    layout: z.string(),
    seed: z.number(),
  }),
});

// Chart Events
export const ChartCreatedEventSchema = z.object({
  type: z.literal('ChartCreated'),
  payload: z.object({
    chart: z.unknown(), // Chart
  }),
});

export const ChartUpdatedEventSchema = z.object({
  type: z.literal('ChartUpdated'),
  payload: z.object({
    chartId: z.string(),
    changes: z.record(z.unknown()),
  }),
});

export const ChartDeletedEventSchema = z.object({
  type: z.literal('ChartDeleted'),
  payload: z.object({
    chartId: z.string(),
  }),
});

export const ChartSpecVersionBumpedEventSchema = z.object({
  type: z.literal('ChartSpecVersionBumped'),
  payload: z.object({
    chartId: z.string(),
    oldVersion: z.number(),
    newVersion: z.number(),
  }),
});

// Decision Events
export const DecisionCreatedEventSchema = z.object({
  type: z.literal('DecisionCreated'),
  payload: z.object({
    decision: z.unknown(), // VisualDecision
  }),
});

export const DecisionUpdatedEventSchema = z.object({
  type: z.literal('DecisionUpdated'),
  payload: z.object({
    decisionId: z.string(),
    changes: z.record(z.unknown()),
  }),
});

export const DecisionApprovedEventSchema = z.object({
  type: z.literal('DecisionApproved'),
  payload: z.object({
    decisionId: z.string(),
    selectedOptionId: z.string(),
    reason: z.string().optional(),
    actorId: z.string(),
  }),
});

export const DecisionRejectedEventSchema = z.object({
  type: z.literal('DecisionRejected'),
  payload: z.object({
    decisionId: z.string(),
    reason: z.string(),
    actorId: z.string(),
  }),
});

export const DecisionStaledEventSchema = z.object({
  type: z.literal('DecisionStaled'),
  payload: z.object({
    decisionId: z.string(),
    reason: z.string(),
  }),
});

// Finding Events
export const FindingCreatedEventSchema = z.object({
  type: z.literal('FindingCreated'),
  payload: z.object({
    finding: z.unknown(), // ValidationFinding
  }),
});

export const FindingResolvedEventSchema = z.object({
  type: z.literal('FindingResolved'),
  payload: z.object({
    findingId: z.string(),
  }),
});

export const FindingAcceptedEventSchema = z.object({
  type: z.literal('FindingAccepted'),
  payload: z.object({
    findingId: z.string(),
    reason: z.string(),
  }),
});

export const FindingDismissedEventSchema = z.object({
  type: z.literal('FindingDismissed'),
  payload: z.object({
    findingId: z.string(),
  }),
});

export const FindingReopenedEventSchema = z.object({
  type: z.literal('FindingReopened'),
  payload: z.object({
    findingId: z.string(),
    reason: z.string(),
  }),
});

// Document Lifecycle Events
export const ReviewRequestedEventSchema = z.object({
  type: z.literal('ReviewRequested'),
  payload: z.object({}),
});

export const AllPagesApprovedEventSchema = z.object({
  type: z.literal('AllPagesApproved'),
  payload: z.object({}),
});

export const ReadinessConfirmedEventSchema = z.object({
  type: z.literal('ReadinessConfirmed'),
  payload: z.object({}),
});

export const DocumentLockedEventSchema = z.object({
  type: z.literal('DocumentLocked'),
  payload: z.object({
    manifestHash: z.string().length(64),
  }),
});

export const DocumentUnlockedEventSchema = z.object({
  type: z.literal('DocumentUnlocked'),
  payload: z.object({}),
});

export const ExportFinalizedEventSchema = z.object({
  type: z.literal('ExportFinalized'),
  payload: z.object({
    exportJobId: z.string(),
    manifestHash: z.string().length(64),
  }),
});

// Export Events
export const ExportJobCreatedEventSchema = z.object({
  type: z.literal('ExportJobCreated'),
  payload: z.object({
    exportJob: z.unknown(), // ExportJob
  }),
});

export const ExportJobUpdatedEventSchema = z.object({
  type: z.literal('ExportJobUpdated'),
  payload: z.object({
    exportJobId: z.string(),
    changes: z.record(z.unknown()),
  }),
});

export const ExportManifestApprovedEventSchema = z.object({
  type: z.literal('ExportManifestApproved'),
  payload: z.object({
    exportJobId: z.string(),
    actorId: z.string(),
    approvalToken: z.string(),
  }),
});

// Version/Snapshot Events
export const SnapshotCreatedEventSchema = z.object({
  type: z.literal('SnapshotCreated'),
  payload: z.object({
    version: z.number().int().nonnegative(),
    snapshotHash: z.string().length(64),
    eventCount: z.number().int().nonnegative(),
  }),
});

export const UndoPerformedEventSchema = z.object({
  type: z.literal('UndoPerformed'),
  payload: z.object({
    undoneEventIds: z.array(z.string()),
    newVersion: z.number().int().nonnegative(),
  }),
});

// Privacy Events
export const PrivacyReceiptCreatedEventSchema = z.object({
  type: z.literal('PrivacyReceiptCreated'),
  payload: z.object({
    receiptId: z.string(),
    processingType: z.enum(['local', 'remote']),
    assetIds: z.array(z.string()).optional(),
    regionDescription: z.string().optional(),
    consentGiven: z.boolean(),
    retentionStatus: z.enum(['retained', 'deleted', 'pending']),
  }),
});

// Agent Activity Events
export const AgentToolExecutedEventSchema = z.object({
  type: z.literal('AgentToolExecuted'),
  payload: z.object({
    toolName: z.string(),
    input: z.unknown(),
    result: z.unknown(),
    status: z.enum(['success', 'error']),
    versionBefore: z.number().int().nonnegative(),
    versionAfter: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative(),
  }),
});

// ============================================================================
// Union Type
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

// ============================================================================
// Event Factory Functions
// ============================================================================

const createEvent = <T extends DomainEvent['type']>(
  type: T,
  projectId: string,
  version: number,
  actorId: string,
  payload: z.infer<typeof DomainEventSchema> extends { type: T; payload: infer P } ? P : never,
  hmac?: string
): DomainEvent => ({
  id: `evt_${nanoid(16)}`,
  type,
  projectId,
  version,
  timestamp: new Date().toISOString(),
  actorId,
  payload,
  hmac,
});

export const createProjectCreatedEvent = (
  projectId: string,
  actorId: string,
  project: DocumentProject
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
  object: DocumentObject
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
  asset: ImageAsset
) => createEvent('AssetUploaded', projectId, version, actorId, { asset });

export const createDecisionCreatedEvent = (
  projectId: string,
  version: number,
  actorId: string,
  decision: VisualDecision
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
  finding: ValidationFinding
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

// Import types for factory functions
import type {
  DocumentProject,
  DocumentObject,
  ImageAsset,
  VisualDecision,
  ValidationFinding,
} from '../schema';