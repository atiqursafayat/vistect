// ============================================================================
// Command Bus
// ============================================================================
//
// The single write path. Every mutation — from the UI, from a WebMCP tool, from
// an import — passes through `dispatch`, in this order:
//
//   load project → load actor → version guard (I-02) → lock guard (I-01)
//   → human-actor guard (I-03) → handler → invariant check → apply events
//   → bump version → persist → append events
//
// Events are appended *after* the projection succeeds and the project is saved,
// so a rejected command leaves no trace and a persisted event always has a
// corresponding state change.

import type {
  Command,
  CommandResult,
} from '../commands';
import type { DomainEvent, EventEnvelope } from '../events';
import { createAgentToolExecutedEvent } from '../events';
import * as invariants from '../invariants';
import { createVersionId } from '../schema';
import type { Actor, DocumentProject } from '../schema';

// ============================================================================
// Command Bus Types
// ============================================================================

export interface CommandHandlerContext {
  project: DocumentProject;
  events: DomainEvent[];
  version: number;
  actor: Actor;
}

export type CommandHandler = (context: CommandHandlerContext, payload: unknown) => Promise<{ events: DomainEvent[]; changedIds: string[] }>;

// ============================================================================
// Command Registry
// ============================================================================

const commandHandlers = new Map<string, CommandHandler>();

export function registerCommandHandler(type: string, handler: CommandHandler): void {
  if (commandHandlers.has(type)) {
    throw new Error(`Command handler for ${type} already registered`);
  }
  commandHandlers.set(type, handler);
}

export function getCommandHandler(type: string): CommandHandler | undefined {
  return commandHandlers.get(type);
}

export function hasCommandHandler(type: string): boolean {
  return commandHandlers.has(type);
}

// ============================================================================
// Command Bus
// ============================================================================

export interface CommandBus {
  dispatch(command: Command): Promise<CommandResult>;
  dispatchFromAgent(command: Command, toolName: string): Promise<CommandResult>;
}

export function createCommandBus(dependencies: {
  getProject: (projectId: string) => Promise<DocumentProject | null>;
  saveProject: (project: DocumentProject) => Promise<void>;
  appendEvents: (events: EventEnvelope[]) => Promise<void>;
  getActor: (actorId: string) => Promise<Actor | null>;
}): CommandBus {
  const { getProject, saveProject, appendEvents, getActor } = dependencies;

  async function dispatch(command: Command): Promise<CommandResult> {
    // Load project
    const project = await getProject(command.projectId);
    if (!project) {
      return {
        ok: false,
        changedIds: [],
        error: 'Project not found',
        errorCode: 'NotFound',
      };
    }

    // Load actor
    const actor = await getActor(command.actorId);
    if (!actor) {
      return {
        ok: false,
        changedIds: [],
        error: 'Actor not found',
        errorCode: 'NotFound',
      };
    }

    // Version guard (I-02)
    if (command.expectedVersion !== project.currentVersion) {
      return {
        ok: false,
        changedIds: [],
        error: `Stale version: expected ${command.expectedVersion}, current is ${project.currentVersion}`,
        errorCode: 'StaleVersionError',
        version: project.currentVersion,
      };
    }

    // Lock guard (I-01)
    if (project.status === 'locked' && isWriteCommand(command.type)) {
      return {
        ok: false,
        changedIds: [],
        error: 'Document is locked; no mutations allowed',
        errorCode: 'LockViolation',
      };
    }

    // Human-only approval guard (I-03)
    if (isApprovalCommand(command.type) && actor.kind !== 'human') {
      return {
        ok: false,
        changedIds: [],
        error: 'Only human actors can approve decisions',
        errorCode: 'ApprovalDenied',
      };
    }

    // Get handler
    const handler = commandHandlers.get(command.type);
    if (!handler) {
      return {
        ok: false,
        changedIds: [],
        error: `No handler for command type: ${command.type}`,
        errorCode: 'NotFound',
      };
    }

    // Execute handler
    const context: CommandHandlerContext = {
      project: { ...project },
      events: [],
      version: project.currentVersion,
      actor,
    };

    let result: { events: DomainEvent[]; changedIds: string[] };
    try {
      result = await handler(context, command.payload);
    } catch (error) {
      return {
        ok: false,
        changedIds: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'SchemaValidationError',
      };
    }

    // Validate invariants
    const invariantErrors = invariants.checkAll(context.project);
    if (invariantErrors.length > 0) {
      return {
        ok: false,
        changedIds: [],
        error: `Invariant violations: ${invariantErrors.join('; ')}`,
        errorCode: 'SchemaValidationError',
      };
    }

    // Apply events to project state
    for (const event of result.events) {
      applyEvent(context.project, event);
    }

    // Increment version for content mutations
    if (isWriteCommand(command.type)) {
      context.project.currentVersion += 1;
      context.version = context.project.currentVersion;
    }

    context.project.updatedAt = new Date().toISOString();

    // Persist state first, then append events (I-13: durable append before ack).
    await saveProject(context.project);
    await appendEvents(result.events.map(stampPendingHmac));

    return {
      ok: true,
      version: context.version,
      changedIds: result.changedIds,
    };
  }

  async function dispatchFromAgent(command: Command, toolName: string): Promise<CommandResult> {
    if (!isWriteCommand(command.type)) {
      return dispatch(command);
    }

    // Agent writes are additionally recorded in the activity stream (§21.3),
    // including the version before and after, so every agent action is auditable.
    const startTime = performance.now();
    const result = await dispatch(command);
    const durationMs = Math.round(performance.now() - startTime);

    const versionAfter = result.version ?? command.expectedVersion;
    const agentEvent = createAgentToolExecutedEvent(
      command.projectId,
      versionAfter,
      command.actorId,
      toolName,
      command.payload,
      result.ok ? { success: true } : { success: false, error: result.error ?? 'Unknown error' },
      result.ok ? 'success' : 'error',
      command.expectedVersion,
      versionAfter,
      durationMs
    );
    const eventsWithHmac = [stampPendingHmac(agentEvent)];
    await appendEvents(eventsWithHmac);

    return result;
  }

  return { dispatch, dispatchFromAgent };
}

// ============================================================================
// Event Application
// ============================================================================

/**
 * Applies one event to a project, mutating it in place.
 *
 * Exported because snapshot recovery in `@vistect/storage` must replay events
 * with **exactly** this logic; a second implementation there would drift and
 * produce a recovered project that differs from the live one.
 *
 * Mutates rather than returning a copy: replaying thousands of events during
 * recovery would otherwise allocate a full project clone per event.
 */
export function applyEvent(project: DocumentProject, event: DomainEvent): void {
  const { type, payload, timestamp } = event;

  // Type-safe event application using a switch on the discriminated union
  switch (type) {
    // Project lifecycle events that carry no projection: creation is materialised
    // by the create handler, and delete/encrypt/import are handled at the storage
    // layer, not by mutating in-memory state.
    case 'ProjectCreated':
    case 'ProjectDeleted':
    case 'ProjectEncrypted':
    case 'ProjectImported': {
      break;
    }
    case 'ProjectUpdated': {
      const { changes } = payload;
      Object.assign(project, changes);
      break;
    }
    case 'PageCreated': {
      const { pageId, template, insertAfter } = payload;
      const typedPageId = pageId;
      project.pages[typedPageId] = {
        id: typedPageId,
        template: template,
        status: 'draft',
        objects: [],
        readingOrder: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        versionCreated: project.currentVersion,
        versionModified: project.currentVersion,
      };
      if (insertAfter) {
        const insertAfterId = insertAfter;
        const idx = project.pageOrder.indexOf(insertAfterId);
        project.pageOrder.splice(idx + 1, 0, typedPageId);
      } else {
        project.pageOrder.push(typedPageId);
      }
      break;
    }
    case 'PageUpdated': {
      const { pageId, changes } = payload;
      const page = project.pages[pageId];
      if (page) {
        Object.assign(page, changes);
        page.updatedAt = timestamp;
        page.versionModified = project.currentVersion;
      }
      break;
    }
    case 'PageDeleted': {
      const { pageId } = payload;
      const typedPageId = pageId;
      delete project.pages[typedPageId];
      project.pageOrder = project.pageOrder.filter(id => id !== typedPageId);
      break;
    }
    case 'PageReordered': {
      project.pageOrder = payload.pageOrder;
      break;
    }
    case 'PageStatusChanged': {
      const { pageId, newStatus } = payload;
      const page = project.pages[pageId];
      if (page) {
        page.status = newStatus;
        page.updatedAt = timestamp;
        page.versionModified = project.currentVersion;
      }
      break;
    }
    case 'ObjectCreated': {
      const { object } = payload;
      project.objects[object.id] = object;
      break;
    }
    case 'ObjectUpdated': {
      const { objectId, changes } = payload;
      const obj = project.objects[objectId];
      if (obj) {
        Object.assign(obj, changes);
        obj.versionModified = project.currentVersion;
      }
      break;
    }
    case 'ObjectDeleted': {
      const { objectId } = payload;
      const typedObjectId = objectId;
      delete project.objects[typedObjectId];
      for (const page of Object.values(project.pages)) {
        if (!page) continue;
        page.objects = page.objects.filter(id => id !== typedObjectId);
        page.readingOrder = page.readingOrder.filter(id => id !== typedObjectId);
      }
      break;
    }
    case 'ObjectMoved': {
      const { objectId, fromPageId, toPageId, insertAfter } = payload;
      const fromPage = project.pages[fromPageId];
      if (fromPage) {
        fromPage.objects = fromPage.objects.filter(id => id !== objectId);
        fromPage.readingOrder = fromPage.readingOrder.filter(id => id !== objectId);
      }
      const toPage = project.pages[toPageId];
      if (toPage) {
        toPage.objects.push(objectId);
        if (insertAfter) {
          const idx = toPage.readingOrder.indexOf(insertAfter);
          toPage.readingOrder.splice(idx + 1, 0, objectId);
        } else {
          toPage.readingOrder.push(objectId);
        }
      }
      break;
    }
    case 'ObjectReadingOrderChanged': {
      const { pageId, readingOrder } = payload;
      const page = project.pages[pageId];
      if (page) {
        page.readingOrder = readingOrder;
      }
      break;
    }
    case 'ObjectApprovalChanged': {
      const { objectId, newStatus, actorId, decisionId } = payload;
      const obj = project.objects[objectId];
      if (obj) {
        obj.approval = newStatus;
        if (newStatus === 'approved') {
          obj.approvedBy = actorId;
          obj.approvedAt = timestamp;
          obj.approvedVersion = project.currentVersion;
        }
        if (decisionId) {
          obj.decisionId = decisionId;
        }
      }
      break;
    }
    case 'AssetUploaded': {
      const { asset } = payload;
      project.assets[asset.id] = asset;
      break;
    }
    case 'AssetUpdated': {
      const { assetId, changes } = payload;
      if (project.assets[assetId]) {
        Object.assign(project.assets[assetId], changes);
      }
      break;
    }
    case 'AssetDeleted': {
      const { assetId } = payload;
      delete project.assets[assetId];
      break;
    }
    case 'AssetCropRegistered': {
      // Crop handled in asset object
      break;
    }
    case 'AssetAnalysisRecorded': {
      const { assetId, observations, interpretations, uncertainties } = payload;
      if (project.assets[assetId]) {
        project.assets[assetId].observations = observations;
        project.assets[assetId].interpretations = interpretations;
        project.assets[assetId].uncertainties = uncertainties;
      }
      break;
    }
    case 'DatasetCreated': {
      const { dataset } = payload;
      project.datasets[dataset.id] = dataset;
      break;
    }
    case 'DatasetUpdated': {
      const { datasetId, changes } = payload;
      if (project.datasets[datasetId]) {
        Object.assign(project.datasets[datasetId], changes);
      }
      break;
    }
    case 'DatasetDeleted': {
      const { datasetId } = payload;
      delete project.datasets[datasetId];
      break;
    }
    case 'DatasetSchemaConfirmed': {
      const { datasetId } = payload;
      if (project.datasets[datasetId]) {
        project.datasets[datasetId].userConfirmed = true;
      }
      break;
    }
    case 'DiagramCreated': {
      const { diagram } = payload;
      project.diagrams[diagram.id] = diagram;
      break;
    }
    case 'DiagramUpdated': {
      const { diagramId, changes } = payload;
      if (project.diagrams[diagramId]) {
        Object.assign(project.diagrams[diagramId], changes);
        project.diagrams[diagramId].updatedAt = timestamp;
        project.diagrams[diagramId].specVersion += 1;
      }
      break;
    }
    case 'DiagramDeleted': {
      const { diagramId } = payload;
      delete project.diagrams[diagramId];
      break;
    }
    case 'DiagramNodeAdded': {
      const { diagramId, node } = payload;
      if (project.diagrams[diagramId]) {
        project.diagrams[diagramId].nodes.push(node);
      }
      break;
    }
    case 'DiagramNodeUpdated': {
      const { diagramId, nodeId, changes } = payload;
      const diagram = project.diagrams[diagramId];
      if (diagram) {
        const idx = diagram.nodes.findIndex(n => n.id === nodeId);
        const node = idx >= 0 ? diagram.nodes[idx] : undefined;
        if (node) {
          Object.assign(node, changes);
        }
      }
      break;
    }
    case 'DiagramNodeRemoved': {
      const { diagramId, nodeId } = payload;
      const diagram = project.diagrams[diagramId];
      if (diagram) {
        diagram.nodes = diagram.nodes.filter(n => n.id !== nodeId);
        diagram.edges = diagram.edges.filter(e => e.from !== nodeId && e.to !== nodeId);
        diagram.groups.forEach(g => {
          g.children = g.children.filter(id => id !== nodeId);
        });
      }
      break;
    }
    case 'DiagramEdgeAdded': {
      const { diagramId, edge } = payload;
      if (project.diagrams[diagramId]) {
        project.diagrams[diagramId].edges.push(edge);
      }
      break;
    }
    case 'DiagramEdgeUpdated': {
      const { diagramId, edgeId, changes } = payload;
      const diagram = project.diagrams[diagramId];
      if (diagram) {
        const idx = diagram.edges.findIndex(e => e.id === edgeId);
        const edge = idx >= 0 ? diagram.edges[idx] : undefined;
        if (edge) {
          Object.assign(edge, changes);
        }
      }
      break;
    }
    case 'DiagramEdgeRemoved': {
      const { diagramId, edgeId } = payload;
      const diagram = project.diagrams[diagramId];
      if (diagram) {
        diagram.edges = diagram.edges.filter(e => e.id !== edgeId);
      }
      break;
    }
    case 'DiagramLayoutApplied': {
      const { diagramId, layout, seed } = payload;
      if (project.diagrams[diagramId]) {
        project.diagrams[diagramId].layout = layout;
        project.diagrams[diagramId].layoutSeed = seed;
        project.diagrams[diagramId].specVersion += 1;
      }
      break;
    }
    case 'ChartCreated': {
      const { chart } = payload;
      project.charts[chart.id] = chart;
      break;
    }
    case 'ChartUpdated': {
      const { chartId, changes } = payload;
      if (project.charts[chartId]) {
        Object.assign(project.charts[chartId], changes);
        project.charts[chartId].updatedAt = timestamp;
        project.charts[chartId].specVersion += 1;
      }
      break;
    }
    case 'ChartDeleted': {
      const { chartId } = payload;
      delete project.charts[chartId];
      break;
    }
    case 'ChartSpecVersionBumped': {
      const { chartId, newVersion } = payload;
      if (project.charts[chartId]) {
        project.charts[chartId].specVersion = newVersion;
      }
      break;
    }
    case 'DecisionCreated': {
      const { decision } = payload;
      project.decisions[decision.id] = decision;
      break;
    }
    case 'DecisionUpdated': {
      const { decisionId, changes } = payload;
      if (project.decisions[decisionId]) {
        Object.assign(project.decisions[decisionId], changes);
        project.decisions[decisionId].updatedAt = timestamp;
      }
      break;
    }
    case 'DecisionApproved': {
      const { decisionId, selectedOptionId, reason, actorId } = payload;
      if (project.decisions[decisionId]) {
        project.decisions[decisionId].status = 'approved';
        project.decisions[decisionId].selectedOptionId = selectedOptionId;
        project.decisions[decisionId].selectionReason = reason;
        project.decisions[decisionId].approvedBy = actorId;
        project.decisions[decisionId].approvedAt = timestamp;
        project.decisions[decisionId].approvedVersion = project.currentVersion;
        for (const objId of project.decisions[decisionId].targetObjectIds) {
          if (project.objects[objId]) {
            project.objects[objId].approval = 'approved';
            project.objects[objId].approvedBy = actorId;
            project.objects[objId].approvedAt = timestamp;
            project.objects[objId].approvedVersion = project.currentVersion;
          }
        }
      }
      break;
    }
    case 'DecisionRejected': {
      const { decisionId } = payload;
      if (project.decisions[decisionId]) {
        project.decisions[decisionId].status = 'rejected';
      }
      break;
    }
    case 'DecisionStaled': {
      const { decisionId } = payload;
      const staledDecision = project.decisions[decisionId];
      if (staledDecision) {
        staledDecision.status = 'stale';
        for (const objId of staledDecision.targetObjectIds) {
          const obj = project.objects[objId];
          if (obj?.approval === 'approved') {
            obj.approval = 'stale';
          }
        }
      }
      break;
    }
    case 'FindingCreated': {
      const { finding } = payload;
      project.findings[finding.id] = finding;
      break;
    }
    case 'FindingResolved': {
      const { findingId } = payload;
      if (project.findings[findingId]) {
        project.findings[findingId].status = 'resolved';
      }
      break;
    }
    case 'FindingAccepted': {
      const { findingId, reason } = payload;
      if (project.findings[findingId]) {
        project.findings[findingId].status = 'accepted';
        project.findings[findingId].acceptedReason = reason;
      }
      break;
    }
    case 'FindingDismissed': {
      const { findingId } = payload;
      if (project.findings[findingId]) {
        project.findings[findingId].status = 'dismissed';
      }
      break;
    }
    case 'FindingReopened': {
      const { findingId } = payload;
      const finding = project.findings[findingId];
      if (finding) {
        finding.status = 'open';
      }
      break;
    }
    case 'ReviewRequested': {
      project.status = 'review';
      break;
    }
    case 'AllPagesApproved': {
      project.status = 'page_approved';
      break;
    }
    case 'ReadinessConfirmed': {
      project.status = 'document_ready';
      break;
    }
    case 'DocumentLocked': {
      project.status = 'locked';
      for (const page of Object.values(project.pages)) {
        if (!page) continue;
        page.status = 'locked';
      }
      break;
    }
    case 'DocumentUnlocked': {
      project.status = 'review';
      for (const page of Object.values(project.pages)) {
        if (!page) continue;
        page.status = 'review';
      }
      break;
    }
    case 'ExportFinalized': {
      project.status = 'exported';
      break;
    }
    case 'ExportJobCreated': {
      const { exportJob } = payload;
      project.exportJobs[exportJob.id] = exportJob;
      break;
    }
    case 'ExportJobUpdated': {
      const { exportJobId, changes } = payload;
      if (project.exportJobs[exportJobId]) {
        Object.assign(project.exportJobs[exportJobId], changes);
      }
      break;
    }
    case 'ExportManifestApproved': {
      const { exportJobId, approvalToken } = payload;
      const exportJob = project.exportJobs[exportJobId];
      if (exportJob) {
        exportJob.status = 'approved';
        exportJob.approvalToken = approvalToken;
        exportJob.approvedVersion = project.currentVersion;
      }
      break;
    }
    case 'SnapshotCreated': {
      const { version, snapshotHash, eventCount } = payload;
      project.versions.push({
        id: createVersionId(),
        version,
        snapshotHash,
        eventCount,
        createdAt: timestamp,
        isSnapshot: true,
      });
      break;
    }
    case 'UndoPerformed': {
      const { newVersion } = payload;
      project.currentVersion = newVersion;
      break;
    }
    case 'PrivacyReceiptCreated': {
      // Stored in meta store, not in project
      break;
    }
    case 'AgentToolExecuted': {
      // Logged in activity stream
      break;
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function isWriteCommand(type: string): boolean {
  const writePrefixes = [
    'CreateProject', 'UpdateProject', 'DeleteProject', 'EncryptProject', 'ImportProject',
    'CreatePage', 'UpdatePage', 'DeletePage', 'ReorderPages', 'ChangePageStatus',
    'CreateObject', 'UpdateObject', 'DeleteObject', 'MoveObject', 'SetObjectConstraints',
    'ReorderObjectReadingOrder', 'ChangeObjectApproval',
    'UploadAsset', 'UpdateAsset', 'DeleteAsset', 'RegisterAssetCrop', 'RecordAssetAnalysis',
    'CreateDataset', 'UpdateDataset', 'DeleteDataset', 'ConfirmDatasetSchema',
    'CreateDiagram', 'UpdateDiagram', 'DeleteDiagram',
    'AddDiagramNode', 'UpdateDiagramNode', 'RemoveDiagramNode',
    'AddDiagramEdge', 'UpdateDiagramEdge', 'RemoveDiagramEdge', 'ApplyDiagramLayout',
    'CreateChart', 'UpdateChart', 'DeleteChart', 'BumpChartSpecVersion',
    'CreateDecision', 'UpdateDecision', 'ApproveDecision', 'RejectDecision', 'RequestDecisionAlternatives',
    'CreateFinding', 'ResolveFinding', 'AcceptFinding', 'DismissFinding',
    'RequestReview', 'ConfirmReadiness', 'LockDocument', 'UnlockDocument', 'FinalizeExport',
    'CreateExportJob', 'ApproveExportManifest', 'UpdateExportJob',
    'CreateSnapshot', 'Undo', 'CreatePrivacyReceipt',
  ];
  return writePrefixes.includes(type);
}

function isApprovalCommand(type: string): boolean {
  return (
    type === 'ApproveDecision' ||
    type === 'ApproveExportManifest' ||
    type === 'ConfirmReadiness' ||
    type === 'LockDocument'
  );
}

/**
 * Placeholder HMAC.
 *
 * The real chain is computed in `@vistect/storage` using the per-session secret
 * derived via Web Crypto (`deriveSessionSecret`), because this package is pure
 * and must not hold key material. The storage layer overwrites this value on
 * append; it is a fixed sentinel so an unstamped event is visibly wrong rather
 * than plausibly valid.
 */
const UNSTAMPED_HMAC = '0'.repeat(64);

function stampPendingHmac(event: DomainEvent): EventEnvelope {
  return { ...event, hmac: UNSTAMPED_HMAC };
}

// ============================================================================
// Re-exports
// ============================================================================
//
// Command and error types live in `../commands`; re-exported here so consumers
// can import the whole write path from one module.

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
