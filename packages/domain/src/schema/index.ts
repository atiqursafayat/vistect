import { nanoid } from 'nanoid';
import { z } from 'zod';

// Re-export command types
export type {
  Command,
  CommandResult,
  DomainError,
  StaleVersionError,
  LockViolationError,
  ApprovalDeniedError,
  NotFoundError,
  RateLimitedError,
  SchemaValidationError,
} from '../commands';

// ============================================================================
// ID Types (branded strings for type safety)
// ============================================================================

export const ProjectId = z.string().brand('ProjectId');
export type ProjectId = z.infer<typeof ProjectId>;

export const PageId = z.string().brand('PageId');
export type PageId = z.infer<typeof PageId>;

export const ObjectId = z.string().brand('ObjectId');
export type ObjectId = z.infer<typeof ObjectId>;

export const AssetId = z.string().brand('AssetId');
export type AssetId = z.infer<typeof AssetId>;

export const DatasetId = z.string().brand('DatasetId');
export type DatasetId = z.infer<typeof DatasetId>;

export const DiagramId = z.string().brand('DiagramId');
export type DiagramId = z.infer<typeof DiagramId>;

export const ChartId = z.string().brand('ChartId');
export type ChartId = z.infer<typeof ChartId>;

export const DecisionId = z.string().brand('DecisionId');
export type DecisionId = z.infer<typeof DecisionId>;

export const FindingId = z.string().brand('FindingId');
export type FindingId = z.infer<typeof FindingId>;

export const VersionId = z.string().brand('VersionId');
export type VersionId = z.infer<typeof VersionId>;

export const ActorId = z.string().brand('ActorId');
export type ActorId = z.infer<typeof ActorId>;

export const ExportJobId = z.string().brand('ExportJobId');
export type ExportJobId = z.infer<typeof ExportJobId>;

export const DataColumnId = z.string().brand('DataColumnId');
export type DataColumnId = z.infer<typeof DataColumnId>;

export const NodeId = z.string().brand('NodeId');
export type NodeId = z.infer<typeof NodeId>;

export const EdgeId = z.string().brand('EdgeId');
export type EdgeId = z.infer<typeof EdgeId>;

export const GroupId = z.string().brand('GroupId');
export type GroupId = z.infer<typeof GroupId>;

export const OptionId = z.string().brand('OptionId');
export type OptionId = z.infer<typeof OptionId>;

// ============================================================================
// ID Factory Functions
// ============================================================================

export const createProjectId = () => `pj_${nanoid(12)}` as ProjectId;
export const createPageId = () => `pg_${nanoid(12)}` as PageId;
export const createObjectId = () => `obj_${nanoid(12)}` as ObjectId;
export const createAssetId = () => `ast_${nanoid(12)}` as AssetId;
export const createDatasetId = () => `ds_${nanoid(12)}` as DatasetId;
export const createDiagramId = () => `dg_${nanoid(12)}` as DiagramId;
export const createChartId = () => `ch_${nanoid(12)}` as ChartId;
export const createDecisionId = () => `dec_${nanoid(12)}` as DecisionId;
export const createFindingId = () => `fnd_${nanoid(12)}` as FindingId;
export const createVersionId = () => `ver_${nanoid(12)}` as VersionId;
export const createActorId = () => `act_${nanoid(12)}` as ActorId;
export const createExportJobId = () => `exp_${nanoid(12)}` as ExportJobId;
export const createDataColumnId = () => `dc_${nanoid(12)}` as DataColumnId;
export const createNodeId = () => `nd_${nanoid(12)}` as NodeId;
export const createEdgeId = () => `eg_${nanoid(12)}` as EdgeId;
export const createGroupId = () => `gr_${nanoid(12)}` as GroupId;
export const createOptionId = () => `opt_${nanoid(12)}` as OptionId;

// ============================================================================
// Core Value Objects
// ============================================================================

export const BoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});
export type Bounds = z.infer<typeof BoundsSchema>;

export const RelativeConstraintSchema = z.object({
  anchorId: ObjectId,
  relationship: z.enum(['before', 'after', 'above', 'below', 'left_of', 'right_of', 'inside_same_region']),
  spacing: z.number().nonnegative().optional(),
});
export type RelativeConstraint = z.infer<typeof RelativeConstraintSchema>;

export const AccessibilityMetadataSchema = z.object({
  isDecorative: z.boolean().default(false),
  altText: z.string().optional(),
  longDescription: z.string().optional(),
  accessibleName: z.string().optional(),
  role: z.string().optional(),
  includedInReadingOrder: z.boolean().default(true),
  language: z.string().optional(),
  warnings: z.array(z.string()).default([]),
});
export type AccessibilityMetadata = z.infer<typeof AccessibilityMetadataSchema>;

export const ApprovalStateSchema = z.enum(['unreviewed', 'proposed', 'approved', 'rejected', 'stale']);
export type ApprovalState = z.infer<typeof ApprovalStateSchema>;

export const ProvenanceSchema = z.object({
  sourceType: z.enum(['user', 'agent', 'import', 'generated']),
  sourceReference: z.string().optional(),
  license: z.string().optional(),
  actorId: ActorId,
  at: z.string().datetime({ offset: true }),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const ObservationSchema = z.object({
  claim: z.string(),
  confidence: z.number().min(0).max(1),
  basis: z.string(),
});
export type Observation = z.infer<typeof ObservationSchema>;

export const InterpretationSchema = z.object({
  claim: z.string(),
  confidence: z.number().min(0).max(1),
  model: z.string(),
  evidence: z.array(z.string()).default([]),
});
export type Interpretation = z.infer<typeof InterpretationSchema>;

export const UncertaintySchema = z.object({
  claim: z.string(),
  analyses: z.array(z.string()).default([]),
  recommendation: z.string(),
});
export type Uncertainty = z.infer<typeof UncertaintySchema>;

export const ThemeSchema = z.object({
  colors: z.record(z.string()),
  fonts: z.record(z.string()),
  spacing: z.record(z.number()),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const CropSpecSchema = z.object({
  rect: BoundsSchema,
  aspectRatio: z.number().positive().optional(),
  intent: z.string(),
});
export type CropSpec = z.infer<typeof CropSpecSchema>;

export const FindingSeveritySchema = z.enum(['info', 'warning', 'error', 'blocking']);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const EvidenceTypeSchema = z.enum(['deterministic', 'model_assessment', 'human_review']);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

export const HashSchema = z.string().length(64);
export type Hash = z.infer<typeof HashSchema>;

// ============================================================================
// Actor System
// ============================================================================

export const ActorKindSchema = z.enum(['human', 'browser_agent']);
export type ActorKind = z.infer<typeof ActorKindSchema>;

export const ActorSchema = z.object({
  id: ActorId,
  kind: ActorKindSchema,
  label: z.string(),
  agentOrigin: z.string().optional(), // for browser agents
});
export type Actor = z.infer<typeof ActorSchema>;

export const createHumanActor = (label = 'You'): Actor => ({
  id: createActorId(),
  kind: 'human',
  label,
});

export const createAgentActor = (origin: string, label: string): Actor => ({
  id: createActorId(),
  kind: 'browser_agent',
  label,
  agentOrigin: origin,
});

// ============================================================================
// Document Project (Aggregate Root)
// ============================================================================

export const DocumentTypeSchema = z.enum(['impact-report']);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const DocumentStatusSchema = z.enum(['draft', 'review', 'page_approved', 'document_ready', 'locked', 'exported']);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const PageStatusSchema = z.enum(['draft', 'review', 'approved', 'locked']);
export type PageStatus = z.infer<typeof PageStatusSchema>;

// ============================================================================
// Intent Contract
// ============================================================================

export const IntentContractSchema = z.object({
  documentType: DocumentTypeSchema,
  purpose: z.string().min(1).max(500),
  audience: z.string().min(1).max(500),
  primaryMessage: z.string().min(1).max(500),
  secondaryMessages: z.array(z.string().max(500)).default([]),
  tone: z.string().max(100),
  conceptsToAvoid: z.array(z.string().max(100)).default([]),
  brandColors: z.record(z.string().regex(/^#[0-9A-Fa-f]{6}$/)).default({}),
  brandFonts: z.record(z.string()).default({}),
  visualStyle: z.string().max(200),
  requiredVisuals: z.array(z.string().max(200)).default([]),
  accessibilityRequirements: z.array(z.string().max(200)).default([]),
  imageSourcingPreference: z.enum(['upload', 'curated', 'ai-generated', 'mixed']).default('mixed'),
  privacySensitivity: z.enum(['public', 'internal', 'confidential', 'restricted']).default('internal'),
  exportRequirements: z.object({
    pdf: z.boolean().default(true),
    html: z.boolean().default(true),
    svgDiagrams: z.boolean().default(true),
    chartTables: z.boolean().default(true),
  }).default({}),
});
export type IntentContract = z.infer<typeof IntentContractSchema>;

// ============================================================================
// Page & Template System
// ============================================================================

export const PageTemplateSchema = z.enum([
  'cover',
  'text-led',
  'text-side-image',
  'full-width-image-caption',
  'statistics',
  'chart',
  'diagram',
  'participant-story',
  'recommendations',
  'conclusion-contact',
]);
export type PageTemplate = z.infer<typeof PageTemplateSchema>;

export const PageSchema = z.object({
  id: PageId,
  template: PageTemplateSchema,
  status: PageStatusSchema,
  objects: z.array(ObjectId).default([]),
  readingOrder: z.array(ObjectId).default([]),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  versionCreated: z.number().int().nonnegative(),
  versionModified: z.number().int().nonnegative(),
});
export type Page = z.infer<typeof PageSchema>;

// ============================================================================
// Document Objects
// ============================================================================

export const ObjectRoleSchema = z.enum([
  'heading',
  'paragraph',
  'bulleted-list',
  'numbered-list',
  'quotation',
  'callout',
  'statistic-card',
  'caption',
  'footnote',
  'source-note',
  'page-break',
  'section-break',
  'hyperlink',
  'image',
  'icon',
  'chart',
  'diagram',
  'table',
  'shape',
]);
export type ObjectRole = z.infer<typeof ObjectRoleSchema>;

export const ObjectKindSchema = z.enum([
  'text',
  'image',
  'icon',
  'chart',
  'diagram',
  'table',
  'shape',
]);
export type ObjectKind = z.infer<typeof ObjectKindSchema>;

export const BaseDocumentObjectSchema = z.object({
  id: ObjectId,
  role: ObjectRoleSchema,
  kind: ObjectKindSchema,
  purpose: z.string().max(200),
  bounds: BoundsSchema,
  constraints: z.array(RelativeConstraintSchema).default([]),
  layer: z.number().int().default(0),
  readingOrderIndex: z.number().int().nonnegative(),
  accessibility: AccessibilityMetadataSchema,
  provenance: ProvenanceSchema,
  approval: ApprovalStateSchema.default('unreviewed'),
  approvedBy: ActorId.optional(),
  approvedAt: z.string().datetime({ offset: true }).optional(),
  approvedVersion: z.number().int().nonnegative().optional(),
  decisionId: DecisionId.optional(),
  createdBy: ActorId,
  versionCreated: z.number().int().nonnegative(),
  versionModified: z.number().int().nonnegative(),
});

export const TextObjectSchema = BaseDocumentObjectSchema.extend({
  kind: z.literal('text'),
  role: z.enum(['heading', 'paragraph', 'bulleted-list', 'numbered-list', 'quotation', 'callout', 'statistic-card', 'caption', 'footnote', 'source-note', 'page-break', 'section-break', 'hyperlink']),
  content: z.string(),
  headingLevel: z.number().int().min(1).max(4).optional(),
  listItems: z.array(z.string()).optional(),
  hyperlink: z.string().url().optional(),
});
export type TextObject = z.infer<typeof TextObjectSchema>;

export const ImageObjectSchema = BaseDocumentObjectSchema.extend({
  kind: z.literal('image'),
  role: z.literal('image'),
  assetId: AssetId,
  crop: CropSpecSchema.optional(),
  altTextDraft: z.string().optional(),
  altTextApproved: z.string().optional(),
});
export type ImageObject = z.infer<typeof ImageObjectSchema>;

export const IconObjectSchema = BaseDocumentObjectSchema.extend({
  kind: z.literal('icon'),
  role: z.literal('icon'),
  iconName: z.string(),
  iconFamily: z.string(),
  strokeWeight: z.number().positive(),
  cornerStyle: z.string(),
  fillStyle: z.string(),
  sizeClass: z.string(),
  semanticAssignment: z.string().optional(),
});
export type IconObject = z.infer<typeof IconObjectSchema>;

export const ChartObjectSchema = BaseDocumentObjectSchema.extend({
  kind: z.literal('chart'),
  role: z.literal('chart'),
  chartId: ChartId,
  specVersion: z.number().int().nonnegative(),
});
export type ChartObject = z.infer<typeof ChartObjectSchema>;

export const DiagramObjectSchema = BaseDocumentObjectSchema.extend({
  kind: z.literal('diagram'),
  role: z.literal('diagram'),
  diagramId: DiagramId,
  specVersion: z.number().int().nonnegative(),
});
export type DiagramObject = z.infer<typeof DiagramObjectSchema>;

export const TableObjectSchema = BaseDocumentObjectSchema.extend({
  kind: z.literal('table'),
  role: z.literal('table'),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  caption: z.string().optional(),
});
export type TableObject = z.infer<typeof TableObjectSchema>;

export const ShapeObjectSchema = BaseDocumentObjectSchema.extend({
  kind: z.literal('shape'),
  role: z.literal('shape'),
  shapeType: z.enum(['rectangle', 'ellipse', 'line', 'arrow']),
  style: z.record(z.string()),
});
export type ShapeObject = z.infer<typeof ShapeObjectSchema>;

export const DocumentObjectSchema = z.discriminatedUnion('kind', [
  TextObjectSchema,
  ImageObjectSchema,
  IconObjectSchema,
  ChartObjectSchema,
  DiagramObjectSchema,
  TableObjectSchema,
  ShapeObjectSchema,
]);
export type DocumentObject = z.infer<typeof DocumentObjectSchema>;

// ============================================================================
// Assets
// ============================================================================

export const AssetSourceTypeSchema = z.enum(['upload', 'organization_library', 'curated_provider', 'ai_generated', 'imported']);
export type AssetSourceType = z.infer<typeof AssetSourceTypeSchema>;

export const ImageAssetSchema = z.object({
  id: AssetId,
  fileName: z.string(),
  mimeType: z.string(),
  dimensions: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
  sizeBytes: z.number().int().positive(),
  contentHash: HashSchema,
  sourceType: AssetSourceTypeSchema,
  sourceReference: z.string().optional(),
  license: z.string().optional(),
  localOnly: z.boolean().default(true),
  detectedText: z.string().optional(),
  observations: z.array(ObservationSchema).default([]),
  interpretations: z.array(InterpretationSchema).default([]),
  uncertainties: z.array(UncertaintySchema).default([]),
  qualityFindings: z.array(z.string()).default([]),
  createdAt: z.string().datetime({ offset: true }),
  createdBy: ActorId,
});
export type ImageAsset = z.infer<typeof ImageAssetSchema>;

// ============================================================================
// Datasets
// ============================================================================

export const DataColumnTypeSchema = z.enum(['number', 'string', 'date', 'boolean']);
export type DataColumnType = z.infer<typeof DataColumnTypeSchema>;

export const DataColumnSchema = z.object({
  id: DataColumnId,
  name: z.string(),
  type: DataColumnTypeSchema,
  values: z.array(z.union([z.string(), z.number(), z.boolean(), z.date()])),
  inferred: z.boolean().default(false),
});
export type DataColumn = z.infer<typeof DataColumnSchema>;

export const DatasetSchema = z.object({
  id: DatasetId,
  name: z.string(),
  columns: z.array(DataColumnSchema),
  rowCount: z.number().int().nonnegative(),
  source: z.enum(['csv_upload', 'manual_entry', 'pasted_table', 'extracted_table']),
  sourceReference: z.string().optional(),
  inferredSchema: z.boolean().default(false),
  userConfirmed: z.boolean().default(false),
  createdAt: z.string().datetime({ offset: true }),
  createdBy: ActorId,
});
export type Dataset = z.infer<typeof DatasetSchema>;

// ============================================================================
// Diagrams
// ============================================================================

export const DiagramTypeSchema = z.enum(['process_flow', 'decision_tree', 'journey_map', 'system_architecture', 'org_structure']);
export type DiagramType = z.infer<typeof DiagramTypeSchema>;

export const DiagramNodeSchema = z.object({
  id: NodeId,
  type: z.enum(['start', 'end', 'process', 'decision', 'input_output', 'group']),
  label: z.string(),
  bounds: BoundsSchema,
  groupId: GroupId.optional(),
  accessibility: AccessibilityMetadataSchema,
});
export type DiagramNode = z.infer<typeof DiagramNodeSchema>;

export const DiagramEdgeSchema = z.object({
  id: EdgeId,
  from: NodeId,
  to: NodeId,
  label: z.string().optional(),
  style: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
  isDecisionOutcome: z.boolean().default(false),
  outcomeLabel: z.enum(['yes', 'no', 'true', 'false', 'other']).optional(),
});
export type DiagramEdge = z.infer<typeof DiagramEdgeSchema>;

export const DiagramGroupSchema = z.object({
  id: GroupId,
  label: z.string(),
  bounds: BoundsSchema.optional(),
  children: z.array(NodeId).default([]),
});
export type DiagramGroup = z.infer<typeof DiagramGroupSchema>;

export const DiagramLayoutSchema = z.enum(['layered', 'force', 'hierarchical']);
export type DiagramLayout = z.infer<typeof DiagramLayoutSchema>;

export const DiagramSchema = z.object({
  id: DiagramId,
  type: DiagramTypeSchema,
  nodes: z.array(DiagramNodeSchema).default([]),
  edges: z.array(DiagramEdgeSchema).default([]),
  groups: z.array(DiagramGroupSchema).default([]),
  entryNodeId: NodeId.optional(),
  terminalNodeIds: z.array(NodeId).default([]),
  layout: DiagramLayoutSchema.default('layered'),
  layoutSeed: z.number().int().default(42),
  accessibility: AccessibilityMetadataSchema,
  specVersion: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  createdBy: ActorId,
});
export type Diagram = z.infer<typeof DiagramSchema>;

// ============================================================================
// Charts
// ============================================================================

export const ChartTypeSchema = z.enum(['horizontal_bar', 'vertical_bar', 'line']);
export type ChartType = z.infer<typeof ChartTypeSchema>;

export const ChartAxisSchema = z.object({
  title: z.string(),
  type: z.enum(['category', 'value', 'time']),
  min: z.number().optional(),
  max: z.number().optional(),
  baselineZero: z.boolean().default(true),
});
export type ChartAxis = z.infer<typeof ChartAxisSchema>;

export const ChartSeriesSchema = z.object({
  name: z.string(),
  dataColumnId: DataColumnId,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  pattern: z.string().optional(),
  dashArray: z.string().optional(),
});
export type ChartSeries = z.infer<typeof ChartSeriesSchema>;

export const ChartSpecSchema = z.object({
  type: ChartTypeSchema,
  datasetId: DatasetId,
  xAxis: ChartAxisSchema,
  yAxis: ChartAxisSchema,
  series: z.array(ChartSeriesSchema).min(1),
  title: z.string(),
  subtitle: z.string().optional(),
  sourceNote: z.string().optional(),
  legendPosition: z.enum(['top', 'bottom', 'left', 'right', 'none']).default('bottom'),
});
export type ChartSpec = z.infer<typeof ChartSpecSchema>;

export const ChartGeometrySchema = z.object({
  bars: z.array(z.object({
    seriesIndex: z.number().int(),
    categoryIndex: z.number().int(),
    value: z.number(),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  })).default([]),
  lines: z.array(z.object({
    seriesIndex: z.number().int(),
    points: z.array(z.object({ x: z.number(), y: z.number(), value: z.number() })),
  })).default([]),
  axes: z.object({
    x: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
    y: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
  }),
});
export type ChartGeometry = z.infer<typeof ChartGeometrySchema>;

export const ChartSchema = z.object({
  id: ChartId,
  spec: ChartSpecSchema,
  geometry: ChartGeometrySchema.optional(),
  integrityChecks: z.array(z.string()).default([]),
  accessibility: AccessibilityMetadataSchema,
  specVersion: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  createdBy: ActorId,
});
export type Chart = z.infer<typeof ChartSchema>;

// ============================================================================
// Visual Decisions
// ============================================================================

export const DecisionCategorySchema = z.enum([
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
]);
export type DecisionCategory = z.infer<typeof DecisionCategorySchema>;

export const DecisionOptionSchema = z.object({
  id: OptionId,
  description: z.string(),
  evidence: z.array(z.string()).default([]),
  isSelected: z.boolean().default(false),
  rejectionReason: z.string().optional(),
});
export type DecisionOption = z.infer<typeof DecisionOptionSchema>;

export const VisualDecisionSchema = z.object({
  id: DecisionId,
  category: DecisionCategorySchema,
  targetObjectIds: z.array(ObjectId).default([]),
  targetPageIds: z.array(PageId).default([]),
  status: z.enum(['open', 'proposed', 'approved', 'rejected', 'stale']),
  suggestedBy: ActorId,
  options: z.array(DecisionOptionSchema).min(1),
  selectedOptionId: OptionId.optional(),
  selectionReason: z.string().optional(),
  approvedBy: ActorId.optional(),
  approvedAt: z.string().datetime({ offset: true }).optional(),
  approvedVersion: z.number().int().nonnegative().optional(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type VisualDecision = z.infer<typeof VisualDecisionSchema>;

// ============================================================================
// Validation Findings
// ============================================================================

export const FindingCategorySchema = z.enum([
  'layout.overlap',
  'layout.out_of_bounds',
  'layout.alignment',
  'layout.spacing',
  'layout.margins',
  'layout.empty_placeholder',
  'layout.crowded_region',
  'layout.excessive_whitespace',
  'text.overflow',
  'text.truncation',
  'text.minimum_size',
  'text.heading_hierarchy',
  'text.missing_heading',
  'text.orphan_heading',
  'color.contrast_ratio',
  'color.color_only_distinction',
  'color.palette_violation',
  'image.missing_alt',
  'image.resolution',
  'image.aspect_distortion',
  'image.source_metadata',
  'image.crop_boundaries',
  'chart.data_mismatch',
  'chart.missing_labels',
  'chart.baseline_anomaly',
  'chart.missing_table',
  'chart.missing_source',
  'diagram.disconnected_nodes',
  'diagram.unreachable_nodes',
  'diagram.missing_decision_outcome',
  'diagram.invalid_cycle',
  'diagram.missing_entry_terminal',
  'diagram.duplicate_edges',
  'diagram.ambiguous_edge_labels',
  'diagram.edge_crossings',
  'diagram.connector_label_collisions',
  'diagram.node_overlaps',
  'diagram.label_overflow',
  'diagram.crowded_regions',
  'diagram.inconsistent_node_dimensions',
  'diagram.excessive_bends',
  'diagram.reading_order_mismatch',
  'diagram.insufficient_contrast',
  'diagram.color_only_meaning',
  'a11y.reading_order',
  'a11y.missing_language',
  'a11y.missing_title',
  'a11y.decorative_exposure',
  'a11y.meaningful_exclusion',
  'a11y.inaccessible_names',
  'subjective.weak_hierarchy',
  'subjective.tone_mismatch',
  'subjective.stereotype',
  'subjective.crowding',
  'subjective.ambiguous_metaphor',
  'subjective.repetition',
  'subjective.image_message_inconsistency',
]);
export type FindingCategory = z.infer<typeof FindingCategorySchema>;

export const FindingStatusSchema = z.enum(['open', 'accepted', 'resolved', 'dismissed']);
export type FindingStatus = z.infer<typeof FindingStatusSchema>;

export const SuggestedActionSchema = z.object({
  type: z.enum(['fix', 'review', 'approve', 'ignore']),
  description: z.string(),
  toolName: z.string().optional(),
  toolArgs: z.record(z.unknown()).optional(),
});
export type SuggestedAction = z.infer<typeof SuggestedActionSchema>;

export const ValidationFindingSchema = z.object({
  id: FindingId,
  scope: z.enum(['object', 'page', 'document']),
  targetId: z.union([ObjectId, PageId, ProjectId]),
  category: FindingCategorySchema,
  severity: FindingSeveritySchema,
  evidenceType: EvidenceTypeSchema,
  summary: z.string(),
  evidence: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).optional(),
  suggestedActions: z.array(SuggestedActionSchema).default([]),
  status: FindingStatusSchema.default('open'),
  acceptedReason: z.string().optional(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type ValidationFinding = z.infer<typeof ValidationFindingSchema>;

// ============================================================================
// Document Versions & Export
// ============================================================================

export const DocumentVersionSchema = z.object({
  id: VersionId,
  version: z.number().int().nonnegative(),
  snapshotHash: HashSchema,
  eventCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime({ offset: true }),
  isSnapshot: z.boolean().default(false),
});
export type DocumentVersion = z.infer<typeof DocumentVersionSchema>;

export const ExportManifestSchema = z.object({
  projectId: ProjectId,
  version: z.number().int().nonnegative(),
  lockedVersion: z.number().int().nonnegative(),
  manifestHash: HashSchema,
  accessibilityCounts: z.object({
    totalObjects: z.number().int().nonnegative(),
    withAltText: z.number().int().nonnegative(),
    withLongDescription: z.number().int().nonnegative(),
    decorativeCount: z.number().int().nonnegative(),
    readingOrderComplete: z.boolean(),
  }),
  deterministicCheckResults: z.object({
    layout: z.number().int().nonnegative(),
    text: z.number().int().nonnegative(),
    color: z.number().int().nonnegative(),
    image: z.number().int().nonnegative(),
    chart: z.number().int().nonnegative(),
    diagram: z.number().int().nonnegative(),
    a11y: z.number().int().nonnegative(),
  }),
  acceptedFindings: z.array(z.object({
    findingId: FindingId,
    reason: z.string(),
  })).default([]),
  approvalStatus: z.object({
    allDecisionsApproved: z.boolean(),
    unapprovedCount: z.number().int().nonnegative(),
  }),
  exportList: z.array(z.object({
    type: z.enum(['pdf', 'html', 'svg', 'png', 'table']),
    path: z.string(),
    hash: HashSchema,
  })),
  createdAt: z.string().datetime({ offset: true }),
  approvedBy: ActorId.optional(),
  approvedAt: z.string().datetime({ offset: true }).optional(),
});
export type ExportManifest = z.infer<typeof ExportManifestSchema>;

export const ExportJobSchema = z.object({
  id: ExportJobId,
  projectId: ProjectId,
  status: z.enum(['prepared', 'approved', 'rendering', 'completed', 'failed']),
  manifest: ExportManifestSchema.optional(),
  artifacts: z.array(z.object({
    type: z.enum(['pdf', 'html', 'svg', 'png', 'table']),
    path: z.string(),
    hash: HashSchema,
    sizeBytes: z.number().int().positive(),
  })).default([]),
  approvalToken: z.string().optional(),
  approvedVersion: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
  createdAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }).optional(),
});
export type ExportJob = z.infer<typeof ExportJobSchema>;

// ============================================================================
// Full Project Aggregate
// ============================================================================

export const DocumentProjectSchema = z.object({
  id: ProjectId,
  title: z.string().min(1).max(200),
  language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).default('en'),
  documentType: DocumentTypeSchema,
  status: DocumentStatusSchema.default('draft'),
  intentContract: IntentContractSchema,
  theme: ThemeSchema,
  pages: z.record(PageId, PageSchema).default({}),
  pageOrder: z.array(PageId).default([]),
  objects: z.record(ObjectId, DocumentObjectSchema).default({}),
  assets: z.record(AssetId, ImageAssetSchema).default({}),
  datasets: z.record(DatasetId, DatasetSchema).default({}),
  diagrams: z.record(DiagramId, DiagramSchema).default({}),
  charts: z.record(ChartId, ChartSchema).default({}),
  decisions: z.record(DecisionId, VisualDecisionSchema).default({}),
  findings: z.record(FindingId, ValidationFindingSchema).default({}),
  versions: z.array(DocumentVersionSchema).default([]),
  exportJobs: z.record(ExportJobId, ExportJobSchema).default({}),
  currentVersion: z.number().int().nonnegative().default(0),
  actorId: ActorId, // the human author
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  encrypted: z.boolean().default(false),
  encryptionKeyHash: HashSchema.optional(),
});
export type DocumentProject = z.infer<typeof DocumentProjectSchema>;

// ============================================================================
// Type Guards
// ============================================================================

export const isTextObject = (obj: DocumentObject): obj is TextObject => obj.kind === 'text';
export const isImageObject = (obj: DocumentObject): obj is ImageObject => obj.kind === 'image';
export const isIconObject = (obj: DocumentObject): obj is IconObject => obj.kind === 'icon';
export const isChartObject = (obj: DocumentObject): obj is ChartObject => obj.kind === 'chart';
export const isDiagramObject = (obj: DocumentObject): obj is DiagramObject => obj.kind === 'diagram';
export const isTableObject = (obj: DocumentObject): obj is TableObject => obj.kind === 'table';
export const isShapeObject = (obj: DocumentObject): obj is ShapeObject => obj.kind === 'shape';

export const isWriteTool = (toolName: string): boolean => {
  const writePrefixes = ['create_', 'update_', 'delete_', 'move_', 'place_', 'set_', 'add_', 'remove_', 'reorder_', 'crop_', 'approve_', 'reject_', 'lock_', 'unlock_', 'finalize_'];
  return writePrefixes.some(prefix => toolName.startsWith(prefix));
};

export const isReadTool = (toolName: string): boolean => {
  const readPrefixes = ['get_', 'list_', 'inspect_', 'analyze_', 'compare_', 'recommend_', 'preview_', 'export_'];
  return readPrefixes.some(prefix => toolName.startsWith(prefix));
};

// ============================================================================
// Schema Exports
// ============================================================================

export const allSchemas = {
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
  Bounds: BoundsSchema,
  RelativeConstraint: RelativeConstraintSchema,
  AccessibilityMetadata: AccessibilityMetadataSchema,
  ApprovalState: ApprovalStateSchema,
  Provenance: ProvenanceSchema,
  Observation: ObservationSchema,
  Interpretation: InterpretationSchema,
  Uncertainty: UncertaintySchema,
  Theme: ThemeSchema,
  CropSpec: CropSpecSchema,
  FindingSeverity: FindingSeveritySchema,
  EvidenceType: EvidenceTypeSchema,
  Hash: HashSchema,
  ActorKind: ActorKindSchema,
  Actor: ActorSchema,
  DocumentType: DocumentTypeSchema,
  DocumentStatus: DocumentStatusSchema,
  PageStatus: PageStatusSchema,
  IntentContract: IntentContractSchema,
  PageTemplate: PageTemplateSchema,
  Page: PageSchema,
  ObjectRole: ObjectRoleSchema,
  ObjectKind: ObjectKindSchema,
  TextObject: TextObjectSchema,
  ImageObject: ImageObjectSchema,
  IconObject: IconObjectSchema,
  ChartObject: ChartObjectSchema,
  DiagramObject: DiagramObjectSchema,
  TableObject: TableObjectSchema,
  ShapeObject: ShapeObjectSchema,
  DocumentObject: DocumentObjectSchema,
  AssetSourceType: AssetSourceTypeSchema,
  ImageAsset: ImageAssetSchema,
  DataColumnType: DataColumnTypeSchema,
  DataColumn: DataColumnSchema,
  Dataset: DatasetSchema,
  DiagramType: DiagramTypeSchema,
  DiagramNode: DiagramNodeSchema,
  DiagramEdge: DiagramEdgeSchema,
  DiagramGroup: DiagramGroupSchema,
  Diagram: DiagramSchema,
  ChartType: ChartTypeSchema,
  ChartAxis: ChartAxisSchema,
  ChartSeries: ChartSeriesSchema,
  ChartSpec: ChartSpecSchema,
  ChartGeometry: ChartGeometrySchema,
  Chart: ChartSchema,
  DecisionCategory: DecisionCategorySchema,
  DecisionOption: DecisionOptionSchema,
  VisualDecision: VisualDecisionSchema,
  FindingCategory: FindingCategorySchema,
  FindingStatus: FindingStatusSchema,
  SuggestedAction: SuggestedActionSchema,
  ValidationFinding: ValidationFindingSchema,
  DocumentVersion: DocumentVersionSchema,
  ExportManifest: ExportManifestSchema,
  ExportJob: ExportJobSchema,
  DocumentProject: DocumentProjectSchema,
} as const;