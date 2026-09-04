// ============================================================================
// WebMCP Tool Schemas (Zod → JSON Schema)
// ============================================================================

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
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
  ExportJobId,
  ActorId,
  Bounds,
  RelativeConstraint,
  AccessibilityMetadata,
  ApprovalState,
  CropSpec,
  DecisionCategory,
  FindingCategory,
  FindingSeverity,
  EvidenceType,
  DocumentType,
  PageTemplate,
  PageStatus,
  DocumentStatus,
  ChartType,
  DiagramType,
  AssetSourceType,
  ObjectRole,
  ObjectKind,
} from '../schema';

// ============================================================================
// Base Input Schemas
// ============================================================================

const ProjectIdSchema = z.string().brand('ProjectId');
const PageIdSchema = z.string().brand('PageId');
const ObjectIdSchema = z.string().brand('ObjectId');
const AssetIdSchema = z.string().brand('AssetId');
const DatasetIdSchema = z.string().brand('DatasetId');
const DiagramIdSchema = z.string().brand('DiagramId');
const ChartIdSchema = z.string().brand('ChartId');
const DecisionIdSchema = z.string().brand('DecisionId');
const FindingIdSchema = z.string().brand('FindingId');
const ExportJobIdSchema = z.string().brand('ExportJobId');
const ActorIdSchema = z.string().brand('ActorId');

const BoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});

const RelativeConstraintSchema = z.object({
  anchorId: ObjectIdSchema,
  relationship: z.enum(['before', 'after', 'above', 'below', 'left_of', 'right_of', 'inside_same_region']),
  spacing: z.number().nonnegative().optional(),
});

const AccessibilityMetadataSchema = z.object({
  isDecorative: z.boolean().default(false),
  altText: z.string().optional(),
  longDescription: z.string().optional(),
  accessibleName: z.string().optional(),
  role: z.string().optional(),
  includedInReadingOrder: z.boolean().default(true),
  language: z.string().optional(),
  warnings: z.array(z.string()).default([]),
});

const ApprovalStateSchema = z.enum(['unreviewed', 'proposed', 'approved', 'rejected', 'stale']);

const CropSpecSchema = z.object({
  rect: BoundsSchema,
  aspectRatio: z.number().positive().optional(),
  intent: z.string(),
});

// ============================================================================
// Project Tools (11)
// ============================================================================

export const createProjectInputSchema = z.object({
  title: z.string().min(1).max(200).describe('Project title'),
  language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).default('en').describe('BCP-47 language code'),
  documentType: z.enum(['impact-report']).describe('Document type'),
  intentContract: z.object({
    documentType: z.enum(['impact-report']),
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
  }).describe('Intent contract defining document goals and constraints'),
  theme: z.object({
    colors: z.record(z.string()),
    fonts: z.record(z.string()),
    spacing: z.record(z.number()),
  }).describe('Visual theme'),
}).strict();

export const updateProjectInputSchema = z.object({
  projectId: ProjectIdSchema,
  changes: z.record(z.unknown()).describe('Partial project updates'),
}).strict();

export const deleteProjectInputSchema = z.object({
  projectId: ProjectIdSchema,
}).strict();

export const getProjectInputSchema = z.object({
  projectId: ProjectIdSchema,
}).strict();

export const listProjectsInputSchema = z.object({}).strict();

export const encryptProjectInputSchema = z.object({
  projectId: ProjectIdSchema,
  passphrase: z.string().min(8).max(128).describe('Encryption passphrase'),
}).strict();

export const importProjectInputSchema = z.object({
  projectId: ProjectIdSchema,
  projectData: z.string().describe('Serialized project JSON'),
  sourceHash: z.string().length(64).describe('SHA-256 of source'),
}).strict();

export const getProjectStatusInputSchema = z.object({
  projectId: ProjectIdSchema,
}).strict();

export const requestReviewInputSchema = z.object({
  projectId: ProjectIdSchema,
}).strict();

export const lockDocumentInputSchema = z.object({
  projectId: ProjectIdSchema,
  manifestHash: z.string().length(64).describe('SHA-256 of export manifest'),
}).strict();

export const unlockDocumentInputSchema = z.object({
  projectId: ProjectIdSchema,
}).strict();

// ============================================================================
// Page Tools (will be in layout tools)
// ============================================================================

// ============================================================================
// Text Tools (5)
// ============================================================================

export const createTextObjectInputSchema = z.object({
  projectId: ProjectIdSchema,
  pageId: PageIdSchema,
  role: z.enum(['heading', 'paragraph', 'bulleted-list', 'numbered-list', 'quotation', 'callout', 'statistic-card', 'caption', 'footnote', 'source-note', 'page-break', 'section-break', 'hyperlink']),
  content: z.string().describe('Text content'),
  headingLevel: z.number().int().min(1).max(4).optional().describe('Heading level (1-4) for headings'),
  listItems: z.array(z.string()).optional().describe('List items for lists'),
  hyperlink: z.string().url().optional().describe('URL for hyperlinks'),
  constraints: z.array(RelativeConstraintSchema).default([]).describe('Relative placement constraints'),
  accessibility: AccessibilityMetadataSchema.optional(),
}).strict();

export const updateTextObjectInputSchema = z.object({
  projectId: ProjectIdSchema,
  objectId: ObjectIdSchema,
  content: z.string().optional(),
  headingLevel: z.number().int().min(1).max(4).optional(),
  listItems: z.array(z.string()).optional(),
  hyperlink: z.string().url().optional(),
  constraints: z.array(RelativeConstraintSchema).optional(),
  accessibility: AccessibilityMetadataSchema.optional(),
}).strict();

export const deleteTextObjectInputSchema = z.object({
  projectId: ProjectIdSchema,
  objectId: ObjectIdSchema,
}).strict();

export const reorderTextObjectsInputSchema = z.object({
  projectId: ProjectIdSchema,
  pageId: PageIdSchema,
  readingOrder: z.array(ObjectIdSchema).describe('New reading order'),
}).strict();

export const getTextObjectsInputSchema = z.object({
  projectId: ProjectIdSchema,
  pageId: PageIdSchema.optional(),
}).strict();

// ============================================================================
// Image Tools (7)
// ============================================================================

export const uploadImageInputSchema = z.object({
  projectId: ProjectIdSchema,
  fileName: z.string().describe('Original file name'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']).describe('MIME type'),
  data: z.instanceof(Uint8Array).describe('Image binary data'),
  sourceType: z.enum(['upload', 'organization_library', 'curated_provider', 'ai_generated', 'imported']).describe('Source type'),
  sourceReference: z.string().optional().describe('Source URL or reference'),
  license: z.string().optional().describe('License information'),
}).strict();

export const inspectImageInputSchema = z.object({
  projectId: ProjectIdSchema,
  assetId: AssetIdSchema,
}).strict();

export const recordImageAnalysisInputSchema = z.object({
  projectId: ProjectIdSchema,
  assetId: AssetIdSchema,
  observations: z.array(z.object({
    claim: z.string(),
    confidence: z.number().min(0).max(1),
    basis: z.string(),
  })).describe('High-confidence observations'),
  interpretations: z.array(z.object({
    claim: z.string(),
    confidence: z.number().min(0).max(1),
    model: z.string(),
    evidence: z.array(z.string()).default([]),
  })).describe('Model interpretations'),
  uncertainties: z.array(z.object({
    claim: z.string(),
    analyses: z.array(z.string()).default([]),
    recommendation: z.string(),
  })).describe('Uncertainties and disagreements'),
}).strict();

export const compareImagesInputSchema = z.object({
  projectId: ProjectIdSchema,
  assetIds: z.array(AssetIdSchema).min(2).max(5).describe('Asset IDs to compare'),
  criteria: z.array(z.enum([
    'intent_alignment', 'subject_relevance', 'composition', 'emotional_tone',
    'professional_quality', 'representation', 'stereotype_framing', 'crop_flexibility',
    'title_safe_area', 'distracting_details', 'visual_complexity', 'source_license',
    'resolution', 'model_confidence'
  ])).default([]).describe('Comparison criteria'),
}).strict();

export const cropImageInputSchema = z.object({
  projectId: ProjectIdSchema,
  assetId: AssetIdSchema,
  crop: CropSpecSchema.describe('Crop specification'),
}).strict();

export const approveAltTextInputSchema = z.object({
  projectId: ProjectIdSchema,
  objectId: ObjectIdSchema,
  altText: z.string().describe('Approved alt text'),
}).strict();

export const getImageAssetsInputSchema = z.object({
  projectId: ProjectIdSchema,
}).strict();

// ============================================================================
// Diagram Tools (10)
// ============================================================================

export const createDiagramInputSchema = z.object({
  projectId: ProjectIdSchema,
  pageId: PageIdSchema,
  type: z.enum(['process_flow', 'decision_tree', 'journey_map', 'system_architecture', 'org_structure']).describe('Diagram type'),
  layout: z.enum(['layered', 'force', 'hierarchical']).default('layered').describe('Layout algorithm'),
  layoutSeed: z.number().int().default(42).describe('Deterministic layout seed'),
  constraints: z.array(RelativeConstraintSchema).default([]),
  accessibility: AccessibilityMetadataSchema.optional(),
}).strict();

export const updateDiagramInputSchema = z.object({
  projectId: ProjectIdSchema,
  diagramId: DiagramIdSchema,
  changes: z.record(z.unknown()).describe('Diagram updates'),
}).strict();

export const deleteDiagramInputSchema = z.object({
  projectId: ProjectIdSchema,
  diagramId: DiagramIdSchema,
}).strict();

export const addDiagramNodeInputSchema = z.object({
  projectId: ProjectIdSchema,
  diagramId: DiagramIdSchema,
  node: z.object({
    id: z.string().brand('NodeId'),
    type: z.enum(['start', 'end', 'process', 'decision', 'input_output', 'group']),
    label: z.string(),
    bounds: BoundsSchema,
    groupId: z.string().brand('GroupId').optional(),
    accessibility: AccessibilityMetadataSchema,
  }),
}).strict();

export const addDiagramEdgeInputSchema = z.object({
  projectId: ProjectIdSchema,
  diagramId: DiagramIdSchema,
  edge: z.object({
    id: z.string().brand('EdgeId'),
    from: z.string().brand('NodeId'),
    to: z.string().brand('NodeId'),
    label: z.string().optional(),
    style: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
    isDecisionOutcome: z.boolean().default(false),
    outcomeLabel: z.enum(['yes', 'no', 'true', 'false', 'other']).optional(),
  }),
}).strict();

export const applyDiagramLayoutInputSchema = z.object({
  projectId: ProjectIdSchema,
  diagramId: DiagramIdSchema,
  layout: z.enum(['layered', 'force', 'hierarchical']),
  seed: z.number().int(),
}).strict();

export const validateDiagramInputSchema = z.object({
  projectId: ProjectIdSchema,
  diagramId: DiagramIdSchema,
}).strict();

export const describeDiagramInputSchema = z.object({
  projectId: ProjectIdSchema,
  diagramId: DiagramIdSchema,
  format: z.enum(['short', 'long', 'route_trace']).default('long').describe('Description format'),
}).strict();

export const exportDiagramInputSchema = z.object({
  projectId: ProjectIdSchema,
  diagramId: DiagramIdSchema,
  format: z.enum(['svg', 'png', 'html', 'tactile']).default('svg'),
}).strict();

export const getDiagramsInputSchema = z.object({
  projectId: ProjectIdSchema,
}).strict();

// ============================================================================
// Chart Tools (7)
// ============================================================================

export const importDatasetInputSchema = z.object({
  projectId: ProjectIdSchema,
  name: z.string().describe('Dataset name'),
  source: z.enum(['csv_upload', 'manual_entry', 'pasted_table', 'extracted_table']).describe('Data source'),
  data: z.string().describe('CSV text or JSON data'),
  sourceReference: z.string().optional().describe('Source reference'),
}).strict();

export const recommendChartTypesInputSchema = z.object({
  projectId: ProjectIdSchema,
  datasetId: DatasetIdSchema,
  goal: z.enum(['comparison', 'trend', 'composition', 'distribution', 'relationship']).describe('Chart goal'),
}).strict();

export const createChartInputSchema = z.object({
  projectId: ProjectIdSchema,
  pageId: PageIdSchema,
  spec: z.object({
    type: z.enum(['horizontal_bar', 'vertical_bar', 'line']).describe('Chart type'),
    datasetId: DatasetIdSchema,
    xAxis: z.object({
      title: z.string(),
      type: z.enum(['category', 'value', 'time']),
      min: z.number().optional(),
      max: z.number().optional(),
      baselineZero: z.boolean().default(true),
    }),
    yAxis: z.object({
      title: z.string(),
      type: z.enum(['category', 'value', 'time']),
      min: z.number().optional(),
      max: z.number().optional(),
      baselineZero: z.boolean().default(true),
    }),
    series: z.array(z.object({
      name: z.string(),
      dataColumnId: z.string().brand('DataColumnId'),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      pattern: z.string().optional(),
      dashArray: z.string().optional(),
    })).min(1),
    title: z.string(),
    subtitle: z.string().optional(),
    sourceNote: z.string().optional(),
    legendPosition: z.enum(['top', 'bottom', 'left', 'right', 'none']).default('bottom'),
  }),
  constraints: z.array(RelativeConstraintSchema).default([]),
  accessibility: AccessibilityMetadataSchema.optional(),
}).strict();

export const updateChartInputSchema = z.object({
  projectId: ProjectIdSchema,
  chartId: ChartIdSchema,
  changes: z.record(z.unknown()).describe('Chart updates'),
}).strict();

export const deleteChartInputSchema = z.object({
  projectId: ProjectIdSchema,
  chartId: ChartIdSchema,
}).strict();

export const validateChartInputSchema = z.object({
  projectId: ProjectIdSchema,
  chartId: ChartIdSchema,
}).strict();

export const getChartsInputSchema = z.object({
  projectId: ProjectIdSchema,
}).strict();

// ============================================================================
// Icon Tools (6)
// ============================================================================

export const searchIconsInputSchema = z.object({
  projectId: ProjectIdSchema,
  query: z.string().describe('Search query for icon meaning'),
  family: z.string().optional().describe('Icon family filter'),
}).strict();

export const assignIconInputSchema = z.object({
  projectId: ProjectIdSchema,
  pageId: PageIdSchema,
  iconName: z.string().describe('Icon name from library'),
  iconFamily: z.string().describe('Icon family'),
  strokeWeight: z.number().positive().describe('Stroke weight'),
  cornerStyle: z.string().describe('Corner style'),
  fillStyle: z.string().describe('Fill style'),
  sizeClass: z.string().describe('Size class'),
  semanticAssignment: z.string().optional().describe('Semantic meaning'),
  constraints: z.array(RelativeConstraintSchema).default([]),
  accessibility: AccessibilityMetadataSchema.optional(),
}).strict();

export const updateIconInputSchema = z.object({
  projectId: ProjectIdSchema,
  objectId: ObjectIdSchema,
  changes: z.record(z.unknown()).describe('Icon updates'),
}).strict();

export const deleteIconInputSchema = z.object({
  projectId: ProjectIdSchema,
  objectId: ObjectIdSchema,
}).strict();

export const validateIconsInputSchema = z.object({
  projectId: ProjectIdSchema,
}).strict();

export const getIconSystemInputSchema = z.object({
  projectId: ProjectIdSchema,
}).strict();

// ============================================================================
// Layout Tools (5)
// ============================================================================

export const createPageInputSchema = z.object({
  projectId: ProjectIdSchema,
  template: z.enum([
    'cover', 'text-led', 'text-side-image', 'full-width-image-caption',
    'statistics', 'chart', 'diagram', 'participant-story',
    'recommendations', 'conclusion-contact'
  ]).describe('Page template'),
  insertAfter: PageIdSchema.optional().describe('Page ID to insert after'),
}).strict();

export const deletePageInputSchema = z.object({
  projectId: ProjectIdSchema,
  pageId: PageIdSchema,
}).strict();

export const reorderPagesInputSchema = z.object({
  projectId: ProjectIdSchema,
  pageOrder: z.array(PageIdSchema).describe('New page order'),
}).strict();

export const moveObjectInputSchema = z.object({
  projectId: ProjectIdSchema,
  objectId: ObjectIdSchema,
  toPageId: PageIdSchema,
  insertAfter: ObjectIdSchema.optional(),
}).strict();

export const setObjectConstraintsInputSchema = z.object({
  projectId: ProjectIdSchema,
  objectId: ObjectIdSchema,
  constraints: z.array(RelativeConstraintSchema).describe('Relative constraints'),
}).strict();

// ============================================================================
// Verification Tools (8)
// ============================================================================

export const runValidationInputSchema = z.object({
  projectId: ProjectIdSchema,
  scope: z.enum(['object', 'page', 'document']).optional(),
  targetId: z.string().optional(),
}).strict();

export const getFindingsInputSchema = z.object({
  projectId: ProjectIdSchema,
  scope: z.enum(['object', 'page', 'document']).optional(),
  targetId: z.string().optional(),
  severity: z.enum(['info', 'warning', 'error', 'blocking']).optional(),
  status: z.enum(['open', 'accepted', 'resolved', 'dismissed']).optional(),
}).strict();

export const resolveFindingInputSchema = z.object({
  projectId: ProjectIdSchema,
  findingId: FindingIdSchema,
}).strict();

export const acceptFindingInputSchema = z.object({
  projectId: ProjectIdSchema,
  findingId: FindingIdSchema,
  reason: z.string().describe('Reason for accepting risk'),
}).strict();

export const dismissFindingInputSchema = z.object({
  projectId: ProjectIdSchema,
  findingId: FindingIdSchema,
}).strict();

export const getValidationSummaryInputSchema = z.object({
  projectId: ProjectIdSchema,
}).strict();

export const previewExportManifestInputSchema = z.object({
  projectId: ProjectIdSchema,
}).strict();

export const approveExportManifestInputSchema = z.object({
  projectId: ProjectIdSchema,
  exportJobId: ExportJobIdSchema,
  approvalToken: z.string().describe('Approval token from user gesture'),
}).strict();

// ============================================================================
// Approval/Export Tools (7)
// ============================================================================

export const createDecisionInputSchema = z.object({
  projectId: ProjectIdSchema,
  category: z.enum([
    'page_structure', 'image_selection', 'image_crop', 'image_placement',
    'icon_metaphor', 'icon_family', 'chart_type', 'chart_styling',
    'diagram_structure', 'diagram_layout', 'template_selection',
    'visual_priority', 'reading_order', 'alt_text', 'long_description',
    'export_format'
  ]),
  targetObjectIds: z.array(ObjectIdSchema).default([]),
  targetPageIds: z.array(PageIdSchema).default([]),
  suggestedBy: ActorIdSchema,
  options: z.array(z.object({
    description: z.string(),
    evidence: z.array(z.string()).default([]),
  })).min(1),
}).strict();

export const approveDecisionInputSchema = z.object({
  projectId: ProjectIdSchema,
  decisionId: DecisionIdSchema,
  selectedOptionId: z.string().brand('OptionId'),
  reason: z.string().optional(),
}).strict();

export const rejectDecisionInputSchema = z.object({
  projectId: ProjectIdSchema,
  decisionId: DecisionIdSchema,
  reason: z.string().describe('Rejection reason'),
}).strict();

export const requestDecisionAlternativesInputSchema = z.object({
  projectId: ProjectIdSchema,
  decisionId: DecisionIdSchema,
}).strict();

export const finalizeExportInputSchema = z.object({
  projectId: ProjectIdSchema,
  exportJobId: ExportJobIdSchema,
  approvalToken: z.string().describe('Approval token from user gesture'),
}).strict();

export const getDecisionsInputSchema = z.object({
  projectId: ProjectIdSchema,
  status: z.enum(['open', 'proposed', 'approved', 'rejected', 'stale']).optional(),
  category: z.enum([
    'page_structure', 'image_selection', 'image_crop', 'image_placement',
    'icon_metaphor', 'icon_family', 'chart_type', 'chart_styling',
    'diagram_structure', 'diagram_layout', 'template_selection',
    'visual_priority', 'reading_order', 'alt_text', 'long_description',
    'export_format'
  ]).optional(),
}).strict();

export const getExportJobsInputSchema = z.object({
  projectId: ProjectIdSchema,
}).strict();

// ============================================================================
// Reader Tools (for Understand Mode)
// ============================================================================

export const importDigitalPdfInputSchema = z.object({
  projectId: ProjectIdSchema,
  pdfData: z.instanceof(Uint8Array).describe('PDF binary data'),
}).strict();

export const narratePageInputSchema = z.object({
  projectId: ProjectIdSchema,
  pageId: PageIdSchema,
}).strict();

export const getDocumentOverviewInputSchema = z.object({
  projectId: ProjectIdSchema,
}).strict();

export const navigateSemanticInputSchema = z.object({
  projectId: ProjectIdSchema,
  by: z.enum(['page', 'heading', 'paragraph', 'image', 'chart', 'diagram', 'table', 'icon', 'caption', 'footnote', 'warning', 'unapproved', 'agent-created']),
  value: z.string().optional(),
}).strict();

export const compareVisualElementsInputSchema = z.object({
  projectId: ProjectIdSchema,
  elementIds: z.array(ObjectIdSchema).min(2).max(5),
}).strict();

export const identifyAccessibilityDefectsInputSchema = z.object({
  projectId: ProjectIdSchema,
}).strict();

// ============================================================================
// Tool Definitions with Annotations
// ============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    untrustedContentHint: boolean;
  };
}

export const toolDefinitions: ToolDefinition[] = [
  // Project Tools (11)
  {
    name: 'create_project',
    description: 'Create a new document project with title, language, type, intent contract, and theme',
    inputSchema: zodToJsonSchema(createProjectInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'update_project',
    description: 'Update project metadata',
    inputSchema: zodToJsonSchema(updateProjectInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'delete_project',
    description: 'Delete a project',
    inputSchema: zodToJsonSchema(deleteProjectInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'get_project',
    description: 'Get project details',
    inputSchema: zodToJsonSchema(getProjectInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'list_projects',
    description: 'List all projects',
    inputSchema: zodToJsonSchema(listProjectsInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'encrypt_project',
    description: 'Encrypt project with passphrase',
    inputSchema: zodToJsonSchema(encryptProjectInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'import_project',
    description: 'Import project from serialized data',
    inputSchema: zodToJsonSchema(importProjectInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: true },
  },
  {
    name: 'get_project_status',
    description: 'Get document lifecycle status',
    inputSchema: zodToJsonSchema(getProjectStatusInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'request_review',
    description: 'Request review transition (draft → review)',
    inputSchema: zodToJsonSchema(requestReviewInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'lock_document',
    description: 'Lock document for export (requires manifest hash)',
    inputSchema: zodToJsonSchema(lockDocumentInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'unlock_document',
    description: 'Unlock document (human only)',
    inputSchema: zodToJsonSchema(unlockDocumentInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },

  // Text Tools (5)
  {
    name: 'create_text_object',
    description: 'Create a text object (heading, paragraph, list, etc.)',
    inputSchema: zodToJsonSchema(createTextObjectInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'update_text_object',
    description: 'Update a text object',
    inputSchema: zodToJsonSchema(updateTextObjectInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'delete_text_object',
    description: 'Delete a text object',
    inputSchema: zodToJsonSchema(deleteTextObjectInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'reorder_text_objects',
    description: 'Reorder text objects in reading order',
    inputSchema: zodToJsonSchema(reorderTextObjectsInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'get_text_objects',
    description: 'Get text objects',
    inputSchema: zodToJsonSchema(getTextObjectsInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },

  // Image Tools (7)
  {
    name: 'upload_image',
    description: 'Upload an image asset',
    inputSchema: zodToJsonSchema(uploadImageInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: true },
  },
  {
    name: 'inspect_image',
    description: 'Get structured analysis context for an image',
    inputSchema: zodToJsonSchema(inspectImageInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'record_image_analysis',
    description: 'Record structured image analysis (observations/interpretations/uncertainties)',
    inputSchema: zodToJsonSchema(recordImageAnalysisInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'compare_images',
    description: 'Compare multiple image candidates against criteria',
    inputSchema: zodToJsonSchema(compareImagesInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: true },
  },
  {
    name: 'crop_image',
    description: 'Register a semantic crop for an image',
    inputSchema: zodToJsonSchema(cropImageInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'approve_alt_text',
    description: 'Approve alt text for an image',
    inputSchema: zodToJsonSchema(approveAltTextInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'get_image_assets',
    description: 'Get all image assets',
    inputSchema: zodToJsonSchema(getImageAssetsInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },

  // Diagram Tools (10)
  {
    name: 'create_diagram',
    description: 'Create a diagram (process flow, decision tree, etc.)',
    inputSchema: zodToJsonSchema(createDiagramInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'update_diagram',
    description: 'Update a diagram',
    inputSchema: zodToJsonSchema(updateDiagramInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'delete_diagram',
    description: 'Delete a diagram',
    inputSchema: zodToJsonSchema(deleteDiagramInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'add_diagram_node',
    description: 'Add a node to a diagram',
    inputSchema: zodToJsonSchema(addDiagramNodeInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'add_diagram_edge',
    description: 'Add an edge to a diagram',
    inputSchema: zodToJsonSchema(addDiagramEdgeInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'apply_diagram_layout',
    description: 'Apply automatic layout to a diagram',
    inputSchema: zodToJsonSchema(applyDiagramLayoutInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'validate_diagram',
    description: 'Run structural and visual validation on a diagram',
    inputSchema: zodToJsonSchema(validateDiagramInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'describe_diagram',
    description: 'Generate semantic/spatial description of a diagram',
    inputSchema: zodToJsonSchema(describeDiagramInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'export_diagram',
    description: 'Export diagram as SVG, PNG, HTML, or tactile profile',
    inputSchema: zodToJsonSchema(exportDiagramInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'get_diagrams',
    description: 'Get all diagrams',
    inputSchema: zodToJsonSchema(getDiagramsInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },

  // Chart Tools (7)
  {
    name: 'import_dataset',
    description: 'Import a dataset from CSV, manual entry, or pasted table',
    inputSchema: zodToJsonSchema(importDatasetInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: true },
  },
  {
    name: 'recommend_chart_types',
    description: 'Get deterministic chart type recommendations for a dataset',
    inputSchema: zodToJsonSchema(recommendChartTypesInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'create_chart',
    description: 'Create a chart from a dataset and spec',
    inputSchema: zodToJsonSchema(createChartInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'update_chart',
    description: 'Update a chart',
    inputSchema: zodToJsonSchema(updateChartInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'delete_chart',
    description: 'Delete a chart',
    inputSchema: zodToJsonSchema(deleteChartInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'validate_chart',
    description: 'Run integrity checks on a chart',
    inputSchema: zodToJsonSchema(validateChartInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'get_charts',
    description: 'Get all charts',
    inputSchema: zodToJsonSchema(getChartsInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },

  // Icon Tools (6)
  {
    name: 'search_icons',
    description: 'Search icons by meaning',
    inputSchema: zodToJsonSchema(searchIconsInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'assign_icon',
    description: 'Assign an icon to a page',
    inputSchema: zodToJsonSchema(assignIconInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'update_icon',
    description: 'Update an icon',
    inputSchema: zodToJsonSchema(updateIconInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'delete_icon',
    description: 'Delete an icon',
    inputSchema: zodToJsonSchema(deleteIconInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'validate_icons',
    description: 'Run icon consistency checks',
    inputSchema: zodToJsonSchema(validateIconsInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'get_icon_system',
    description: 'Get document-wide icon system',
    inputSchema: zodToJsonSchema(getIconSystemInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },

  // Layout Tools (5)
  {
    name: 'create_page',
    description: 'Create a page from template',
    inputSchema: zodToJsonSchema(createPageInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'delete_page',
    description: 'Delete a page',
    inputSchema: zodToJsonSchema(deletePageInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'reorder_pages',
    description: 'Reorder pages',
    inputSchema: zodToJsonSchema(reorderPagesInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'move_object',
    description: 'Move an object to another page',
    inputSchema: zodToJsonSchema(moveObjectInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'set_object_constraints',
    description: 'Set relative placement constraints for an object',
    inputSchema: zodToJsonSchema(setObjectConstraintsInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },

  // Verification Tools (8)
  {
    name: 'run_validation',
    description: 'Run full validation suite',
    inputSchema: zodToJsonSchema(runValidationInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'get_findings',
    description: 'Get validation findings',
    inputSchema: zodToJsonSchema(getFindingsInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'resolve_finding',
    description: 'Mark a finding as resolved',
    inputSchema: zodToJsonSchema(resolveFindingInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'accept_finding',
    description: 'Accept a finding (risk acknowledged)',
    inputSchema: zodToJsonSchema(acceptFindingInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'dismiss_finding',
    description: 'Dismiss a subjective finding',
    inputSchema: zodToJsonSchema(dismissFindingInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'get_validation_summary',
    description: 'Get validation summary for export',
    inputSchema: zodToJsonSchema(getValidationSummaryInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'preview_export_manifest',
    description: 'Preview export manifest',
    inputSchema: zodToJsonSchema(previewExportManifestInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'approve_export_manifest',
    description: 'Approve export manifest (requires approval token)',
    inputSchema: zodToJsonSchema(approveExportManifestInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },

  // Approval/Export Tools (7)
  {
    name: 'create_decision',
    description: 'Stage a visual decision for approval',
    inputSchema: zodToJsonSchema(createDecisionInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'approve_decision',
    description: 'Approve a staged decision (human only)',
    inputSchema: zodToJsonSchema(approveDecisionInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'reject_decision',
    description: 'Reject a staged decision',
    inputSchema: zodToJsonSchema(rejectDecisionInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'request_decision_alternatives',
    description: 'Request new alternatives for a rejected decision',
    inputSchema: zodToJsonSchema(requestDecisionAlternativesInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'finalize_export',
    description: 'Finalize export (requires approval token)',
    inputSchema: zodToJsonSchema(finalizeExportInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: false },
  },
  {
    name: 'get_decisions',
    description: 'Get visual decisions',
    inputSchema: zodToJsonSchema(getDecisionsInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'get_export_jobs',
    description: 'Get export jobs',
    inputSchema: zodToJsonSchema(getExportJobsInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },

  // Reader Tools (for Understand Mode)
  {
    name: 'import_digital_pdf',
    description: 'Import a digital PDF for understanding',
    inputSchema: zodToJsonSchema(importDigitalPdfInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: false, untrustedContentHint: true },
  },
  {
    name: 'narrate_page',
    description: 'Get semantic and spatial narration of a page',
    inputSchema: zodToJsonSchema(narratePageInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'get_document_overview',
    description: 'Get document overview',
    inputSchema: zodToJsonSchema(getDocumentOverviewInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'navigate_semantic',
    description: 'Navigate document semantically',
    inputSchema: zodToJsonSchema(navigateSemanticInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'compare_visual_elements',
    description: 'Compare visual elements',
    inputSchema: zodToJsonSchema(compareVisualElementsInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
  {
    name: 'identify_accessibility_defects',
    description: 'Identify accessibility defects in imported document',
    inputSchema: zodToJsonSchema(identifyAccessibilityDefectsInputSchema, { target: 'openApi3', strict: true }) as Record<string, unknown>,
    annotations: { readOnlyHint: true, untrustedContentHint: false },
  },
];

// ============================================================================
// Schema Compilation
// ============================================================================

export function compileToolSchemas(): Map<string, Record<string, unknown>> {
  const schemas = new Map<string, Record<string, unknown>>();
  for (const tool of toolDefinitions) {
    schemas.set(tool.name, tool.inputSchema);
  }
  return schemas;
}

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return toolDefinitions.find(t => t.name === name);
}

export function getAllToolNames(): string[] {
  return toolDefinitions.map(t => t.name);
}

export function getReadOnlyTools(): string[] {
  return toolDefinitions.filter(t => t.annotations.readOnlyHint).map(t => t.name);
}

export function getWriteTools(): string[] {
  return toolDefinitions.filter(t => !t.annotations.readOnlyHint).map(t => t.name);
}

export function getUntrustedTools(): string[] {
  return toolDefinitions.filter(t => t.annotations.untrustedContentHint).map(t => t.name);
}