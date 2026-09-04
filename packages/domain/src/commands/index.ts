import { z } from 'zod';
import type {
  ProjectId,
  PageId,
  ObjectId,
  AssetId,
  DatasetId,
  DiagramId,
  ChartId,
  DecisionId,
  FindingId,
  VersionId,
  ActorId,
  ExportJobId,
  DataColumnId,
  NodeId,
  EdgeId,
  GroupId,
  OptionId,
  Bounds,
  RelativeConstraint,
  AccessibilityMetadata,
  ApprovalState,
  Provenance,
  Observation,
  Interpretation,
  Uncertainty,
  Theme,
  CropSpec,
  FindingSeverity,
  EvidenceType,
  Hash,
  ActorKind,
  Actor,
  DocumentType,
  DocumentStatus,
  PageStatus,
  IntentContract,
  PageTemplate,
  Page,
  ObjectRole,
  ObjectKind,
  TextObject,
  ImageObject,
  IconObject,
  ChartObject,
  DiagramObject,
  TableObject,
  ShapeObject,
  DocumentObject,
  AssetSourceType,
  ImageAsset,
  DataColumnType,
  DataColumn,
  Dataset,
  DiagramType,
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  Diagram,
  ChartType,
  ChartAxis,
  ChartSeries,
  ChartSpec,
  ChartGeometry,
  Chart,
  DecisionCategory,
  DecisionOption,
  VisualDecision,
  FindingCategory,
  FindingStatus,
  SuggestedAction,
  ValidationFinding,
  DocumentVersion,
  ExportManifest,
  ExportJob,
  DocumentProject,
  isWriteTool,
  isReadTool,
} from '../schema';

import type { DomainEvent } from '../events';

// ============================================================================
// Command Envelope
// ============================================================================

export const CommandEnvelopeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  projectId: ProjectId,
  expectedVersion: z.number().int().nonnegative(),
  actorId: ActorId,
  payload: z.unknown(),
  timestamp: z.string().datetime({ offset: true }),
});
export type CommandEnvelope = z.infer<typeof CommandEnvelopeSchema>;

// ============================================================================
// Command Result Types
// ============================================================================

export const CommandResultSchema = z.object({
  ok: z.boolean(),
  version: z.number().int().nonnegative().optional(),
  changedIds: z.array(z.string()).default([]),
  error: z.string().optional(),
  errorCode: z.string().optional(),
});
export type CommandResult = z.infer<typeof CommandResultSchema>;

export const StaleVersionErrorSchema = z.object({
  code: z.literal('StaleVersionError'),
  message: z.string(),
  currentVersion: z.number().int().nonnegative(),
});
export type StaleVersionError = z.infer<typeof StaleVersionErrorSchema>;

export const LockViolationErrorSchema = z.object({
  code: z.literal('LockViolation'),
  message: z.string(),
});
export type LockViolationError = z.infer<typeof LockViolationErrorSchema>;

export const ApprovalDeniedErrorSchema = z.object({
  code: z.literal('ApprovalDenied'),
  message: z.string(),
});
export type ApprovalDeniedError = z.infer<typeof ApprovalDeniedErrorSchema>;

export const NotFoundErrorSchema = z.object({
  code: z.literal('NotFound'),
  message: z.string(),
});
export type NotFoundError = z.infer<typeof NotFoundErrorSchema>;

export const RateLimitedErrorSchema = z.object({
  code: z.literal('RateLimited'),
  message: z.string(),
  retryAfterMs: z.number().int().positive(),
});
export type RateLimitedError = z.infer<typeof RateLimitedErrorSchema>;

export const SchemaValidationErrorSchema = z.object({
  code: z.literal('SchemaValidationError'),
  message: z.string(),
  fieldPaths: z.array(z.array(z.string())).default([]),
});
export type SchemaValidationError = z.infer<typeof SchemaValidationErrorSchema>;

export const DomainErrorSchema = z.discriminatedUnion('code', [
  StaleVersionErrorSchema,
  LockViolationErrorSchema,
  ApprovalDeniedErrorSchema,
  NotFoundErrorSchema,
  RateLimitedErrorSchema,
  SchemaValidationErrorSchema,
]);
export type DomainError = z.infer<typeof DomainErrorSchema>;

// ============================================================================
// Command Types (discriminated union by type)
// ============================================================================

// Project Commands
export const CreateProjectCommandSchema = z.object({
  type: z.literal('CreateProject'),
  payload: z.object({
    title: z.string().min(1).max(200),
    language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).default('en'),
    documentType: DocumentTypeSchema,
    intentContract: z.unknown(), // IntentContract
    theme: Theme,
    actorId: ActorId,
  }),
});

export const UpdateProjectCommandSchema = z.object({
  type: z.literal('UpdateProject'),
  payload: z.object({
    changes: z.record(z.unknown()),
  }),
});

export const DeleteProjectCommandSchema = z.object({
  type: z.literal('DeleteProject'),
  payload: z.object({}),
});

export const EncryptProjectCommandSchema = z.object({
  type: z.literal('EncryptProject'),
  payload: z.object({
    passphrase: z.string().min(8).max(128),
  }),
});

export const ImportProjectCommandSchema = z.object({
  type: z.literal('ImportProject'),
  payload: z.object({
    projectData: z.unknown(), // serialized DocumentProject
    sourceHash: Hash,
  }),
});

// Page Commands
export const CreatePageCommandSchema = z.object({
  type: z.literal('CreatePage'),
  payload: z.object({
    template: PageTemplate,
    insertAfter: PageId.optional(),
  }),
});

export const UpdatePageCommandSchema = z.object({
  type: z.literal('UpdatePage'),
  payload: z.object({
    pageId: PageId,
    changes: z.record(z.unknown()),
  }),
});

export const DeletePageCommandSchema = z.object({
  type: z.literal('DeletePage'),
  payload: z.object({
    pageId: PageId,
  }),
});

export const ReorderPagesCommandSchema = z.object({
  type: z.literal('ReorderPages'),
  payload: z.object({
    pageOrder: z.array(PageId),
  }),
});

export const ChangePageStatusCommandSchema = z.object({
  type: z.literal('ChangePageStatus'),
  payload: z.object({
    pageId: PageId,
    newStatus: PageStatus,
  }),
});

// Object Commands
export const CreateObjectCommandSchema = z.object({
  type: z.literal('CreateObject'),
  payload: z.object({
    object: z.unknown(), // DocumentObject
  }),
});

export const UpdateObjectCommandSchema = z.object({
  type: z.literal('UpdateObject'),
  payload: z.object({
    objectId: ObjectId,
    changes: z.record(z.unknown()),
  }),
});

export const DeleteObjectCommandSchema = z.object({
  type: z.literal('DeleteObject'),
  payload: z.object({
    objectId: ObjectId,
  }),
});

export const MoveObjectCommandSchema = z.object({
  type: z.literal('MoveObject'),
  payload: z.object({
    objectId: ObjectId,
    toPageId: PageId,
    insertAfter: ObjectId.optional(),
  }),
});

export const SetObjectConstraintsCommandSchema = z.object({
  type: z.literal('SetObjectConstraints'),
  payload: z.object({
    objectId: ObjectId,
    constraints: z.array(z.unknown()), // RelativeConstraint[]
  }),
});

export const ReorderObjectReadingOrderCommandSchema = z.object({
  type: z.literal('ReorderObjectReadingOrder'),
  payload: z.object({
    pageId: PageId,
    readingOrder: z.array(ObjectId),
  }),
});

export const ChangeObjectApprovalCommandSchema = z.object({
  type: z.literal('ChangeObjectApproval'),
  payload: z.object({
    objectId: ObjectId,
    newStatus: ApprovalState,
    actorId: ActorId,
    decisionId: DecisionId.optional(),
  }),
});

// Asset Commands
export const UploadAssetCommandSchema = z.object({
  type: z.literal('UploadAsset'),
  payload: z.object({
    fileName: z.string(),
    mimeType: z.string(),
    data: z.instanceof(Uint8Array), // or ArrayBuffer
    sourceType: AssetSourceType,
    sourceReference: z.string().optional(),
    license: z.string().optional(),
  }),
});

export const UpdateAssetCommandSchema = z.object({
  type: z.literal('UpdateAsset'),
  payload: z.object({
    assetId: AssetId,
    changes: z.record(z.unknown()),
  }),
});

export const DeleteAssetCommandSchema = z.object({
  type: z.literal('DeleteAsset'),
  payload: z.object({
    assetId: AssetId,
  }),
});

export const RegisterAssetCropCommandSchema = z.object({
  type: z.literal('RegisterAssetCrop'),
  payload: z.object({
    assetId: AssetId,
    crop: CropSpec,
  }),
});

export const RecordAssetAnalysisCommandSchema = z.object({
  type: z.literal('RecordAssetAnalysis'),
  payload: z.object({
    assetId: AssetId,
    observations: z.array(z.unknown()), // Observation[]
    interpretations: z.array(z.unknown()), // Interpretation[]
    uncertainties: z.array(z.unknown()), // Uncertainty[]
  }),
});

// Dataset Commands
export const CreateDatasetCommandSchema = z.object({
  type: z.literal('CreateDataset'),
  payload: z.object({
    name: z.string(),
    columns: z.array(z.unknown()), // DataColumn[]
    source: z.enum(['csv_upload', 'manual_entry', 'pasted_table', 'extracted_table']),
    sourceReference: z.string().optional(),
  }),
});

export const UpdateDatasetCommandSchema = z.object({
  type: z.literal('UpdateDataset'),
  payload: z.object({
    datasetId: DatasetId,
    changes: z.record(z.unknown()),
  }),
});

export const DeleteDatasetCommandSchema = z.object({
  type: z.literal('DeleteDataset'),
  payload: z.object({
    datasetId: DatasetId,
  }),
});

export const ConfirmDatasetSchemaCommandSchema = z.object({
  type: z.literal('ConfirmDatasetSchema'),
  payload: z.object({
    datasetId: DatasetId,
  }),
});

// Diagram Commands
export const CreateDiagramCommandSchema = z.object({
  type: z.literal('CreateDiagram'),
  payload: z.object({
    type: DiagramType,
    layout: z.enum(['layered', 'force', 'hierarchical']).default('layered'),
    layoutSeed: z.number().int().default(42),
  }),
});

export const UpdateDiagramCommandSchema = z.object({
  type: z.literal('UpdateDiagram'),
  payload: z.object({
    diagramId: DiagramId,
    changes: z.record(z.unknown()),
  }),
});

export const DeleteDiagramCommandSchema = z.object({
  type: z.literal('DeleteDiagram'),
  payload: z.object({
    diagramId: DiagramId,
  }),
});

export const AddDiagramNodeCommandSchema = z.object({
  type: z.literal('AddDiagramNode'),
  payload: z.object({
    diagramId: DiagramId,
    node: z.unknown(), // DiagramNode
  }),
});

export const UpdateDiagramNodeCommandSchema = z.object({
  type: z.literal('UpdateDiagramNode'),
  payload: z.object({
    diagramId: DiagramId,
    nodeId: NodeId,
    changes: z.record(z.unknown()),
  }),
});

export const RemoveDiagramNodeCommandSchema = z.object({
  type: z.literal('RemoveDiagramNode'),
  payload: z.object({
    diagramId: DiagramId,
    nodeId: NodeId,
  }),
});

export const AddDiagramEdgeCommandSchema = z.object({
  type: z.literal('AddDiagramEdge'),
  payload: z.object({
    diagramId: DiagramId,
    edge: z.unknown(), // DiagramEdge
  }),
});

export const UpdateDiagramEdgeCommandSchema = z.object({
  type: z.literal('UpdateDiagramEdge'),
  payload: z.object({
    diagramId: DiagramId,
    edgeId: EdgeId,
    changes: z.record(z.unknown()),
  }),
});

export const RemoveDiagramEdgeCommandSchema = z.object({
  type: z.literal('RemoveDiagramEdge'),
  payload: z.object({
    diagramId: DiagramId,
    edgeId: EdgeId,
  }),
});

export const ApplyDiagramLayoutCommandSchema = z.object({
  type: z.literal('ApplyDiagramLayout'),
  payload: z.object({
    diagramId: DiagramId,
    layout: z.enum(['layered', 'force', 'hierarchical']),
    seed: z.number().int(),
  }),
});

// Chart Commands
export const CreateChartCommandSchema = z.object({
  type: z.literal('CreateChart'),
  payload: z.object({
    spec: z.unknown(), // ChartSpec
  }),
});

export const UpdateChartCommandSchema = z.object({
  type: z.literal('UpdateChart'),
  payload: z.object({
    chartId: ChartId,
    changes: z.record(z.unknown()),
  }),
});

export const DeleteChartCommandSchema = z.object({
  type: z.literal('DeleteChart'),
  payload: z.object({
    chartId: ChartId,
  }),
});

export const BumpChartSpecVersionCommandSchema = z.object({
  type: z.literal('BumpChartSpecVersion'),
  payload: z.object({
    chartId: ChartId,
  }),
});

// Decision Commands
export const CreateDecisionCommandSchema = z.object({
  type: z.literal('CreateDecision'),
  payload: z.object({
    category: DecisionCategory,
    targetObjectIds: z.array(ObjectId).default([]),
    targetPageIds: z.array(PageId).default([]),
    suggestedBy: ActorId,
    options: z.array(z.unknown()).min(1), // DecisionOption[]
  }),
});

export const UpdateDecisionCommandSchema = z.object({
  type: z.literal('UpdateDecision'),
  payload: z.object({
    decisionId: DecisionId,
    changes: z.record(z.unknown()),
  }),
});

export const ApproveDecisionCommandSchema = z.object({
  type: z.literal('ApproveDecision'),
  payload: z.object({
    decisionId: DecisionId,
    selectedOptionId: OptionId,
    reason: z.string().optional(),
    actorId: ActorId,
  }),
});

export const RejectDecisionCommandSchema = z.object({
  type: z.literal('RejectDecision'),
  payload: z.object({
    decisionId: DecisionId,
    reason: z.string(),
    actorId: ActorId,
  }),
});

export const RequestDecisionAlternativesCommandSchema = z.object({
  type: z.literal('RequestDecisionAlternatives'),
  payload: z.object({
    decisionId: DecisionId,
  }),
});

// Finding Commands
export const CreateFindingCommandSchema = z.object({
  type: z.literal('CreateFinding'),
  payload: z.object({
    finding: z.unknown(), // ValidationFinding
  }),
});

export const ResolveFindingCommandSchema = z.object({
  type: z.literal('ResolveFinding'),
  payload: z.object({
    findingId: FindingId,
  }),
});

export const AcceptFindingCommandSchema = z.object({
  type: z.literal('AcceptFinding'),
  payload: z.object({
    findingId: FindingId,
    reason: z.string(),
  }),
});

export const DismissFindingCommandSchema = z.object({
  type: z.literal('DismissFinding'),
  payload: z.object({
    findingId: FindingId,
  }),
});

// Document Lifecycle Commands
export const RequestReviewCommandSchema = z.object({
  type: z.literal('RequestReview'),
  payload: z.object({}),
});

export const ConfirmReadinessCommandSchema = z.object({
  type: z.literal('ConfirmReadiness'),
  payload: z.object({}),
});

export const LockDocumentCommandSchema = z.object({
  type: z.literal('LockDocument'),
  payload: z.object({
    manifestHash: Hash,
  }),
});

export const UnlockDocumentCommandSchema = z.object({
  type: z.literal('UnlockDocument'),
  payload: z.object({}),
});

export const FinalizeExportCommandSchema = z.object({
  type: z.literal('FinalizeExport'),
  payload: z.object({
    exportJobId: ExportJobId,
    approvalToken: z.string(),
  }),
});

// Export Commands
export const CreateExportJobCommandSchema = z.object({
  type: z.literal('CreateExportJob'),
  payload: z.object({
    manifest: z.unknown(), // ExportManifest
  }),
});

export const ApproveExportManifestCommandSchema = z.object({
  type: z.literal('ApproveExportManifest'),
  payload: z.object({
    exportJobId: ExportJobId,
    actorId: ActorId,
    approvalToken: z.string(),
  }),
});

export const UpdateExportJobCommandSchema = z.object({
  type: z.literal('UpdateExportJob'),
  payload: z.object({
    exportJobId: ExportJobId,
    changes: z.record(z.unknown()),
  }),
});

// Version Commands
export const CreateSnapshotCommandSchema = z.object({
  type: z.literal('CreateSnapshot'),
  payload: z.object({}),
});

export const UndoCommandSchema = z.object({
  type: z.literal('Undo'),
  payload: z.object({
    steps: z.number().int().positive().default(1),
  }),
});

// Privacy Commands
export const CreatePrivacyReceiptCommandSchema = z.object({
  type: z.literal('CreatePrivacyReceipt'),
  payload: z.object({
    processingType: z.enum(['local', 'remote']),
    assetIds: z.array(AssetId).optional(),
    regionDescription: z.string().optional(),
    consentGiven: z.boolean(),
    retentionStatus: z.enum(['retained', 'deleted', 'pending']),
  }),
});

// ============================================================================
// Union Type
// ============================================================================

export const CommandSchema = z.discriminatedUnion('type', [
  CreateProjectCommandSchema,
  UpdateProjectCommandSchema,
  DeleteProjectCommandSchema,
  EncryptProjectCommandSchema,
  ImportProjectCommandSchema,
  CreatePageCommandSchema,
  UpdatePageCommandSchema,
  DeletePageCommandSchema,
  ReorderPagesCommandSchema,
  ChangePageStatusCommandSchema,
  CreateObjectCommandSchema,
  UpdateObjectCommandSchema,
  DeleteObjectCommandSchema,
  MoveObjectCommandSchema,
  SetObjectConstraintsCommandSchema,
  ReorderObjectReadingOrderCommandSchema,
  ChangeObjectApprovalCommandSchema,
  UploadAssetCommandSchema,
  UpdateAssetCommandSchema,
  DeleteAssetCommandSchema,
  RegisterAssetCropCommandSchema,
  RecordAssetAnalysisCommandSchema,
  CreateDatasetCommandSchema,
  UpdateDatasetCommandSchema,
  DeleteDatasetCommandSchema,
  ConfirmDatasetSchemaCommandSchema,
  CreateDiagramCommandSchema,
  UpdateDiagramCommandSchema,
  DeleteDiagramCommandSchema,
  AddDiagramNodeCommandSchema,
  UpdateDiagramNodeCommandSchema,
  RemoveDiagramNodeCommandSchema,
  AddDiagramEdgeCommandSchema,
  UpdateDiagramEdgeCommandSchema,
  RemoveDiagramEdgeCommandSchema,
  ApplyDiagramLayoutCommandSchema,
  CreateChartCommandSchema,
  UpdateChartCommandSchema,
  DeleteChartCommandSchema,
  BumpChartSpecVersionCommandSchema,
  CreateDecisionCommandSchema,
  UpdateDecisionCommandSchema,
  ApproveDecisionCommandSchema,
  RejectDecisionCommandSchema,
  RequestDecisionAlternativesCommandSchema,
  CreateFindingCommandSchema,
  ResolveFindingCommandSchema,
  AcceptFindingCommandSchema,
  DismissFindingCommandSchema,
  RequestReviewCommandSchema,
  ConfirmReadinessCommandSchema,
  LockDocumentCommandSchema,
  UnlockDocumentCommandSchema,
  FinalizeExportCommandSchema,
  CreateExportJobCommandSchema,
  ApproveExportManifestCommandSchema,
  UpdateExportJobCommandSchema,
  CreateSnapshotCommandSchema,
  UndoCommandSchema,
  CreatePrivacyReceiptCommandSchema,
]);

export type Command = z.infer<typeof CommandSchema>;

// ============================================================================
// Command Factory Functions
// ============================================================================

const createCommand = <T extends Command['type']>(
  type: T,
  projectId: ProjectId,
  expectedVersion: number,
  actorId: ActorId,
  payload: z.infer<typeof CommandSchema> extends { type: T; payload: infer P } ? P : never
): Command => ({
  id: `cmd_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`,
  type,
  projectId,
  expectedVersion,
  actorId,
  payload,
  timestamp: new Date().toISOString(),
});

export const createCreateProjectCommand = (
  projectId: ProjectId,
  actorId: ActorId,
  title: string,
  language: string,
  documentType: DocumentType,
  intentContract: IntentContract,
  theme: Theme
) => createCommand('CreateProject', projectId, 0, actorId, { title, language, documentType, intentContract, theme, actorId });

export const createCreatePageCommand = (
  projectId: ProjectId,
  expectedVersion: number,
  actorId: ActorId,
  template: PageTemplate,
  insertAfter?: PageId
) => createCommand('CreatePage', projectId, expectedVersion, actorId, { template, insertAfter });

export const createCreateObjectCommand = (
  projectId: ProjectId,
  expectedVersion: number,
  actorId: ActorId,
  object: DocumentObject
) => createCommand('CreateObject', projectId, expectedVersion, actorId, { object });

export const createUpdateObjectCommand = (
  projectId: ProjectId,
  expectedVersion: number,
  actorId: ActorId,
  objectId: ObjectId,
  changes: Record<string, unknown>
) => createCommand('UpdateObject', projectId, expectedVersion, actorId, { objectId, changes });

export const createDeleteObjectCommand = (
  projectId: ProjectId,
  expectedVersion: number,
  actorId: ActorId,
  objectId: ObjectId
) => createCommand('DeleteObject', projectId, expectedVersion, actorId, { objectId });

export const createUploadAssetCommand = (
  projectId: ProjectId,
  expectedVersion: number,
  actorId: ActorId,
  fileName: string,
  mimeType: string,
  data: Uint8Array,
  sourceType: AssetSourceType,
  sourceReference?: string,
  license?: string
) => createCommand('UploadAsset', projectId, expectedVersion, actorId, { fileName, mimeType, data, sourceType, sourceReference, license });

export const createCreateDecisionCommand = (
  projectId: ProjectId,
  expectedVersion: number,
  actorId: ActorId,
  category: DecisionCategory,
  targetObjectIds: ObjectId[],
  targetPageIds: PageId[],
  suggestedBy: ActorId,
  options: DecisionOption[]
) => createCommand('CreateDecision', projectId, expectedVersion, actorId, { category, targetObjectIds, targetPageIds, suggestedBy, options });

export const createApproveDecisionCommand = (
  projectId: ProjectId,
  expectedVersion: number,
  actorId: ActorId,
  decisionId: DecisionId,
  selectedOptionId: OptionId,
  reason?: string
) => createCommand('ApproveDecision', projectId, expectedVersion, actorId, { decisionId, selectedOptionId, reason, actorId });

export const createLockDocumentCommand = (
  projectId: ProjectId,
  expectedVersion: number,
  actorId: ActorId,
  manifestHash: Hash
) => createCommand('LockDocument', projectId, expectedVersion, actorId, { manifestHash });

export const createFinalizeExportCommand = (
  projectId: ProjectId,
  expectedVersion: number,
  actorId: ActorId,
  exportJobId: ExportJobId,
  approvalToken: string
) => createCommand('FinalizeExport', projectId, expectedVersion, actorId, { exportJobId, approvalToken });

export const createUndoCommand = (
  projectId: ProjectId,
  expectedVersion: number,
  actorId: ActorId,
  steps = 1
) => createCommand('Undo', projectId, expectedVersion, actorId, { steps });