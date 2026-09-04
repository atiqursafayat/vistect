// ============================================================================
// Domain Events
// ============================================================================
//
// Payload schemas compose the *same* schemas as the aggregate model rather than
// `z.unknown()`, so a replayed event is validated as strictly as the state it
// rebuilds. `z.unknown()` here would let a corrupted or tampered event pass
// validation and only fail later during projection.

import { nanoid } from 'nanoid';
import { z } from 'zod';

import {
  ActorId,
  ApprovalStateSchema,
  AssetId,
  ChartId,
  ChartSchema,
  CropSpecSchema,
  DatasetId,
  DatasetSchema,
  DecisionId,
  DiagramEdgeSchema,
  DiagramId,
  DiagramLayoutSchema,
  DiagramNodeSchema,
  DiagramSchema,
  DocumentObjectSchema,
  DocumentTypeSchema,
  EdgeId,
  ExportJobId,
  ExportJobSchema,
  FindingId,
  HashSchema,
  ImageAssetSchema,
  IntentContractSchema,
  InterpretationSchema,
  NodeId,
  ObjectId,
  ObservationSchema,
  OptionId,
  PageId,
  PageStatusSchema,
  PageTemplateSchema,
  ProjectId,
  ThemeSchema,
  UncertaintySchema,
  ValidationFindingSchema,
  VisualDecisionSchema,
} from '../schema';

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
    id: ProjectId,
    title: z.string(),
    language: z.string(),
    documentType: DocumentTypeSchema,
    intentContract: IntentContractSchema,
    theme: ThemeSchema,
    actorId: ActorId,
  }),
});

export const ProjectUpdatedPayloadSchema = z.object({
  changes: z.record(z.unknown()),
});

export const ProjectDeletedPayloadSchema = z.object({});

export const ProjectEncryptedPayloadSchema = z.object({
  keyHash: HashSchema,
});

export const ProjectImportedPayloadSchema = z.object({
  sourceHash: HashSchema,
});

// Page Events
export const PageCreatedPayloadSchema = z.object({
  pageId: PageId,
  template: PageTemplateSchema,
  insertAfter: PageId.optional(),
});

export const PageUpdatedPayloadSchema = z.object({
  pageId: PageId,
  changes: z.record(z.unknown()),
});

export const PageDeletedPayloadSchema = z.object({
  pageId: PageId,
});

export const PageReorderedPayloadSchema = z.object({
  pageOrder: z.array(PageId),
});

export const PageStatusChangedPayloadSchema = z.object({
  pageId: PageId,
  oldStatus: PageStatusSchema,
  newStatus: PageStatusSchema,
});

// Object Events
export const ObjectCreatedPayloadSchema = z.object({
  object: DocumentObjectSchema,
});

export const ObjectUpdatedPayloadSchema = z.object({
  objectId: ObjectId,
  changes: z.record(z.unknown()),
});

export const ObjectDeletedPayloadSchema = z.object({
  objectId: ObjectId,
  pageId: PageId,
});

export const ObjectMovedPayloadSchema = z.object({
  objectId: ObjectId,
  fromPageId: PageId,
  toPageId: PageId,
  // Sibling object to insert after within the destination page's reading order.
  insertAfter: ObjectId.optional(),
});

export const ObjectReadingOrderChangedPayloadSchema = z.object({
  pageId: PageId,
  readingOrder: z.array(ObjectId),
});

export const ObjectApprovalChangedPayloadSchema = z.object({
  objectId: ObjectId,
  oldStatus: ApprovalStateSchema,
  newStatus: ApprovalStateSchema,
  actorId: ActorId,
  decisionId: DecisionId.optional(),
});

// Asset Events
export const AssetUploadedPayloadSchema = z.object({
  asset: ImageAssetSchema,
});

export const AssetUpdatedPayloadSchema = z.object({
  assetId: AssetId,
  changes: z.record(z.unknown()),
});

export const AssetDeletedPayloadSchema = z.object({
  assetId: AssetId,
});

export const AssetCropRegisteredPayloadSchema = z.object({
  assetId: AssetId,
  crop: CropSpecSchema,
});

export const AssetAnalysisRecordedPayloadSchema = z.object({
  assetId: AssetId,
  observations: z.array(ObservationSchema),
  interpretations: z.array(InterpretationSchema),
  uncertainties: z.array(UncertaintySchema),
});

// Dataset Events
export const DatasetCreatedPayloadSchema = z.object({
  dataset: DatasetSchema,
});

export const DatasetUpdatedPayloadSchema = z.object({
  datasetId: DatasetId,
  changes: z.record(z.unknown()),
});

export const DatasetDeletedPayloadSchema = z.object({
  datasetId: DatasetId,
});

export const DatasetSchemaConfirmedPayloadSchema = z.object({
  datasetId: DatasetId,
});

// Diagram Events
export const DiagramCreatedPayloadSchema = z.object({
  diagram: DiagramSchema,
});

export const DiagramUpdatedPayloadSchema = z.object({
  diagramId: DiagramId,
  changes: z.record(z.unknown()),
});

export const DiagramDeletedPayloadSchema = z.object({
  diagramId: DiagramId,
});

export const DiagramNodeAddedPayloadSchema = z.object({
  diagramId: DiagramId,
  node: DiagramNodeSchema,
});

export const DiagramNodeUpdatedPayloadSchema = z.object({
  diagramId: DiagramId,
  nodeId: NodeId,
  changes: z.record(z.unknown()),
});

export const DiagramNodeRemovedPayloadSchema = z.object({
  diagramId: DiagramId,
  nodeId: NodeId,
});

export const DiagramEdgeAddedPayloadSchema = z.object({
  diagramId: DiagramId,
  edge: DiagramEdgeSchema,
});

export const DiagramEdgeUpdatedPayloadSchema = z.object({
  diagramId: DiagramId,
  edgeId: EdgeId,
  changes: z.record(z.unknown()),
});

export const DiagramEdgeRemovedPayloadSchema = z.object({
  diagramId: DiagramId,
  edgeId: EdgeId,
});

export const DiagramLayoutAppliedPayloadSchema = z.object({
  diagramId: DiagramId,
  layout: DiagramLayoutSchema,
  seed: z.number().int(),
});

// Chart Events
export const ChartCreatedPayloadSchema = z.object({
  chart: ChartSchema,
});

export const ChartUpdatedPayloadSchema = z.object({
  chartId: ChartId,
  changes: z.record(z.unknown()),
});

export const ChartDeletedPayloadSchema = z.object({
  chartId: ChartId,
});

export const ChartSpecVersionBumpedPayloadSchema = z.object({
  chartId: ChartId,
  oldVersion: z.number(),
  newVersion: z.number(),
});

// Decision Events
export const DecisionCreatedPayloadSchema = z.object({
  decision: VisualDecisionSchema,
});

export const DecisionUpdatedPayloadSchema = z.object({
  decisionId: DecisionId,
  changes: z.record(z.unknown()),
});

export const DecisionApprovedPayloadSchema = z.object({
  decisionId: DecisionId,
  selectedOptionId: OptionId,
  reason: z.string().optional(),
  actorId: ActorId,
});

export const DecisionRejectedPayloadSchema = z.object({
  decisionId: DecisionId,
  reason: z.string(),
  actorId: ActorId,
});

export const DecisionStaledPayloadSchema = z.object({
  decisionId: DecisionId,
  reason: z.string(),
});

// Finding Events
export const FindingCreatedPayloadSchema = z.object({
  finding: ValidationFindingSchema,
});

export const FindingResolvedPayloadSchema = z.object({
  findingId: FindingId,
});

export const FindingAcceptedPayloadSchema = z.object({
  findingId: FindingId,
  reason: z.string(),
});

export const FindingDismissedPayloadSchema = z.object({
  findingId: FindingId,
});

export const FindingReopenedPayloadSchema = z.object({
  findingId: FindingId,
  reason: z.string(),
});

// Document Lifecycle Events
export const ReviewRequestedPayloadSchema = z.object({});
export const AllPagesApprovedPayloadSchema = z.object({});
export const ReadinessConfirmedPayloadSchema = z.object({});
export const DocumentLockedPayloadSchema = z.object({
  manifestHash: HashSchema,
});
export const DocumentUnlockedPayloadSchema = z.object({});
export const ExportFinalizedPayloadSchema = z.object({
  exportJobId: ExportJobId,
  manifestHash: HashSchema,
});

// Export Events
export const ExportJobCreatedPayloadSchema = z.object({
  exportJob: ExportJobSchema,
});
export const ExportJobUpdatedPayloadSchema = z.object({
  exportJobId: ExportJobId,
  changes: z.record(z.unknown()),
});
export const ExportManifestApprovedPayloadSchema = z.object({
  exportJobId: ExportJobId,
  actorId: ActorId,
  approvalToken: z.string(),
});

// Version/Snapshot Events
export const SnapshotCreatedPayloadSchema = z.object({
  version: z.number().int().nonnegative(),
  snapshotHash: HashSchema,
  eventCount: z.number().int().nonnegative(),
});
export const UndoPerformedPayloadSchema = z.object({
  undoneEventIds: z.array(z.string()),
  newVersion: z.number().int().nonnegative(),
});

// Privacy Events
export const PrivacyReceiptCreatedPayloadSchema = z.object({
  receiptId: z.string().min(1),
  processingType: z.enum(['local', 'remote']),
  assetIds: z.array(AssetId).optional(),
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

/**
 * Builds an event schema from a literal type tag and its payload schema.
 *
 * `T extends string` must be inferred as the *literal* (e.g. `'PageCreated'`),
 * not widened to `string` — otherwise `z.literal(type)` produces
 * `ZodLiteral<string>` for every member and `z.discriminatedUnion` collapses,
 * making every payload resolve to `never`.
 */
const createEventSchema = <const T extends string, P extends z.ZodTypeAny>(type: T, payloadSchema: P) =>
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

/** Event discriminator, e.g. `'PageCreated' | 'DecisionApproved' | …`. */
export type DomainEventType = DomainEvent['type'];

/** Payload type for one specific event type. */
export type EventPayloadFor<T extends DomainEventType> = Extract<DomainEvent, { type: T }>['payload'];

/**
 * A persisted event as the storage layer sees it.
 *
 * Identical to {@link DomainEvent}; the alias exists so `packages/storage` can
 * name what it writes without depending on the union's internal structure. It
 * was previously `EventBase & { payload: JsonValue }`, which required the
 * `type-fest` dependency (never installed) and erased the type→payload link
 * that makes replay type-safe.
 */
export type EventEnvelope = DomainEvent;

// ============================================================================
// Event Factory Function
// ============================================================================

export function createEvent<T extends DomainEventType>(
  type: T,
  projectId: string,
  version: number,
  actorId: string,
  payload: EventPayloadFor<T>
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
//
// Thin wrappers over `createEvent` that name their payload fields. Parameter
// types derive from the event union via `EventPayloadFor`, so id parameters keep
// their brands and a schema change surfaces here as a compile error.

type PayloadOf<T extends DomainEventType> = EventPayloadFor<T>;

export const createProjectCreatedEvent = (
  projectId: string,
  actorId: string,
  project: PayloadOf<'ProjectCreated'>['project']
) => createEvent('ProjectCreated', projectId, 1, actorId, { project });

export const createPageCreatedEvent = (
  projectId: string,
  version: number,
  actorId: string,
  pageId: PayloadOf<'PageCreated'>['pageId'],
  template: PayloadOf<'PageCreated'>['template'],
  insertAfter?: PayloadOf<'PageCreated'>['insertAfter']
) => createEvent('PageCreated', projectId, version, actorId, { pageId, template, insertAfter });

export const createPageStatusChangedEvent = (
  projectId: string,
  version: number,
  actorId: string,
  pageId: PayloadOf<'PageStatusChanged'>['pageId'],
  oldStatus: PayloadOf<'PageStatusChanged'>['oldStatus'],
  newStatus: PayloadOf<'PageStatusChanged'>['newStatus']
) =>
  createEvent('PageStatusChanged', projectId, version, actorId, { pageId, oldStatus, newStatus });

export const createObjectCreatedEvent = (
  projectId: string,
  version: number,
  actorId: string,
  object: PayloadOf<'ObjectCreated'>['object']
) => createEvent('ObjectCreated', projectId, version, actorId, { object });

export const createObjectUpdatedEvent = (
  projectId: string,
  version: number,
  actorId: string,
  objectId: PayloadOf<'ObjectUpdated'>['objectId'],
  changes: Record<string, unknown>
) => createEvent('ObjectUpdated', projectId, version, actorId, { objectId, changes });

export const createObjectDeletedEvent = (
  projectId: string,
  version: number,
  actorId: string,
  objectId: PayloadOf<'ObjectDeleted'>['objectId'],
  pageId: PayloadOf<'ObjectDeleted'>['pageId']
) => createEvent('ObjectDeleted', projectId, version, actorId, { objectId, pageId });

export const createObjectApprovalChangedEvent = (
  projectId: string,
  version: number,
  actorId: PayloadOf<'ObjectApprovalChanged'>['actorId'],
  objectId: PayloadOf<'ObjectApprovalChanged'>['objectId'],
  oldStatus: PayloadOf<'ObjectApprovalChanged'>['oldStatus'],
  newStatus: PayloadOf<'ObjectApprovalChanged'>['newStatus'],
  decisionId?: PayloadOf<'ObjectApprovalChanged'>['decisionId']
) =>
  createEvent('ObjectApprovalChanged', projectId, version, actorId, {
    objectId,
    oldStatus,
    newStatus,
    actorId,
    decisionId,
  });

export const createAssetUploadedEvent = (
  projectId: string,
  version: number,
  actorId: string,
  asset: PayloadOf<'AssetUploaded'>['asset']
) => createEvent('AssetUploaded', projectId, version, actorId, { asset });

export const createAssetCropRegisteredEvent = (
  projectId: string,
  version: number,
  actorId: string,
  assetId: PayloadOf<'AssetCropRegistered'>['assetId'],
  crop: PayloadOf<'AssetCropRegistered'>['crop']
) => createEvent('AssetCropRegistered', projectId, version, actorId, { assetId, crop });

export const createDecisionCreatedEvent = (
  projectId: string,
  version: number,
  actorId: string,
  decision: PayloadOf<'DecisionCreated'>['decision']
) => createEvent('DecisionCreated', projectId, version, actorId, { decision });

export const createDecisionApprovedEvent = (
  projectId: string,
  version: number,
  actorId: PayloadOf<'DecisionApproved'>['actorId'],
  decisionId: PayloadOf<'DecisionApproved'>['decisionId'],
  selectedOptionId: PayloadOf<'DecisionApproved'>['selectedOptionId'],
  reason: string | undefined
) =>
  createEvent('DecisionApproved', projectId, version, actorId, {
    decisionId,
    selectedOptionId,
    reason,
    actorId,
  });

export const createDecisionRejectedEvent = (
  projectId: string,
  version: number,
  actorId: PayloadOf<'DecisionRejected'>['actorId'],
  decisionId: PayloadOf<'DecisionRejected'>['decisionId'],
  reason: string
) => createEvent('DecisionRejected', projectId, version, actorId, { decisionId, reason, actorId });

export const createDecisionStaledEvent = (
  projectId: string,
  version: number,
  actorId: string,
  decisionId: PayloadOf<'DecisionStaled'>['decisionId'],
  reason: string
) => createEvent('DecisionStaled', projectId, version, actorId, { decisionId, reason });

export const createDecisionUpdatedEvent = (
  projectId: string,
  version: number,
  actorId: string,
  decisionId: PayloadOf<'DecisionUpdated'>['decisionId'],
  changes: Record<string, unknown>
) => createEvent('DecisionUpdated', projectId, version, actorId, { decisionId, changes });

export const createFindingCreatedEvent = (
  projectId: string,
  version: number,
  actorId: string,
  finding: PayloadOf<'FindingCreated'>['finding']
) => createEvent('FindingCreated', projectId, version, actorId, { finding });

export const createFindingReopenedEvent = (
  projectId: string,
  version: number,
  actorId: string,
  findingId: PayloadOf<'FindingReopened'>['findingId'],
  reason: string
) => createEvent('FindingReopened', projectId, version, actorId, { findingId, reason });

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
) =>
  createEvent('AgentToolExecuted', projectId, version, actorId, {
    toolName,
    input,
    result,
    status,
    versionBefore,
    versionAfter,
    durationMs,
  });
