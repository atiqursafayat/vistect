import { z } from 'zod';
import type {
  Command,
  CommandResult,
  DomainError,
  StaleVersionError,
  LockViolationError,
  ApprovalDeniedError,
  NotFoundError,
  RateLimitedError,
  SchemaValidationError,
  DocumentProject,
  DocumentObject,
  Actor,
  ActorKind,
  ApprovalState,
  DocumentStatus,
  PageStatus,
  FindingStatus,
  DecisionCategory,
  VisualDecision,
  ValidationFinding,
  ImageAsset,
  Diagram,
  Chart,
  Dataset,
  Hash,
  VersionId,
} from '../schema';

import type { DomainEvent, EventEnvelope } from '../events';
import { createEvent, createAgentToolExecutedEvent } from '../events';
import * as invariants from '../invariants';
import * as machines from '../machines';

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
    const startTime = performance.now();

    // Load project
    const project = await getProject(command.projectId);
    if (!project) {
      return {
        ok: false,
        error: 'Project not found',
        errorCode: 'NotFound',
      };
    }

    // Load actor
    const actor = await getActor(command.actorId);
    if (!actor) {
      return {
        ok: false,
        error: 'Actor not found',
        errorCode: 'NotFound',
      };
    }

    // Version guard (I-02)
    if (command.expectedVersion !== project.currentVersion) {
      return {
        ok: false,
        error: `Stale version: expected ${command.expectedVersion}, current is ${project.currentVersion}`,
        errorCode: 'StaleVersionError',
        version: project.currentVersion,
      };
    }

    // Lock guard (I-01)
    if (project.status === 'locked' && isWriteCommand(command.type)) {
      return {
        ok: false,
        error: 'Document is locked; no mutations allowed',
        errorCode: 'LockViolation',
      };
    }

    // Human-only approval guard (I-03)
    if (isApprovalCommand(command.type) && actor.kind !== 'human') {
      return {
        ok: false,
        error: 'Only human actors can approve decisions',
        errorCode: 'ApprovalDenied',
      };
    }

    // Get handler
    const handler = commandHandlers.get(command.type);
    if (!handler) {
      return {
        ok: false,
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
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'SchemaValidationError',
      };
    }

    // Validate invariants
    const invariantErrors = invariants.checkAll(context.project);
    if (invariantErrors.length > 0) {
      return {
        ok: false,
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

    // Persist
    await saveProject(context.project);

    // Append events with HMAC
    const eventsWithHmac = result.events.map(event => ({
      ...event,
      hmac: computeHmac(event), // placeholder - real HMAC in storage layer
    }));
    await appendEvents(eventsWithHmac);

    return {
      ok: true,
      version: context.version,
      changedIds: result.changedIds,
    };
  }

  async function dispatchFromAgent(command: Command, toolName: string): Promise<CommandResult> {
    // Additional agent-specific checks
    if (isWriteCommand(command.type)) {
      // Record agent activity
      const startTime = performance.now();
      const result = await dispatch(command);
      const durationMs = Math.round(performance.now() - startTime);

      if (result.ok) {
        const agentEvent = createAgentToolExecutedEvent(
          command.projectId,
          result.version!,
          command.actorId,
          toolName,
          command.payload,
          { success: true },
          'success',
          command.expectedVersion,
          result.version!,
          durationMs
        );
        await appendEvents([{ ...agentEvent, hmac: computeHmac(agentEvent) }]);
      }

      return result;
    }

    return dispatch(command);
  }

  return { dispatch, dispatchFromAgent };
}

// ============================================================================
// Event Application
// ============================================================================

function applyEvent(project: DocumentProject, event: DomainEvent): void {
  switch (event.type) {
    case 'ProjectCreated':
      // Handled by initial project creation
      break;
    case 'ProjectUpdated':
      Object.assign(project, event.payload.changes);
      break;
    case 'PageCreated': {
      const { pageId, template } = event.payload;
      const page: Page = {
        id: pageId,
        template,
        status: 'draft',
        objects: [],
        readingOrder: [],
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
        versionCreated: project.currentVersion,
        versionModified: project.currentVersion,
      };
      project.pages[pageId] = page;
      project.pageOrder.push(pageId);
      break;
    }
    case 'PageUpdated': {
      const { pageId, changes } = event.payload;
      if (project.pages[pageId]) {
        Object.assign(project.pages[pageId], changes);
        project.pages[pageId].updatedAt = event.timestamp;
        project.pages[pageId].versionModified = project.currentVersion;
      }
      break;
    }
    case 'PageDeleted': {
      const { pageId } = event.payload;
      delete project.pages[pageId];
      project.pageOrder = project.pageOrder.filter(id => id !== pageId);
      // Also delete objects on this page
      for (const [objId, obj] of Object.entries(project.objects)) {
        if (project.pageOrder.includes(objId)) continue; // object belongs to remaining pages
        // Actually, we need to check which page the object is on
      }
      break;
    }
    case 'PageReordered': {
      project.pageOrder = event.payload.pageOrder;
      break;
    }
    case 'PageStatusChanged': {
      const { pageId, newStatus } = event.payload;
      if (project.pages[pageId]) {
        project.pages[pageId].status = newStatus as PageStatus;
        project.pages[pageId].updatedAt = event.timestamp;
        project.pages[pageId].versionModified = project.currentVersion;
      }
      break;
    }
    case 'ObjectCreated': {
      const { object } = event.payload;
      project.objects[object.id] = object;
      // Add to page's objects and reading order
      // Note: pageId is not in the object, we'd need to track it
      break;
    }
    case 'ObjectUpdated': {
      const { objectId, changes } = event.payload;
      if (project.objects[objectId]) {
        Object.assign(project.objects[objectId], changes);
        project.objects[objectId].versionModified = project.currentVersion;
      }
      break;
    }
    case 'ObjectDeleted': {
      const { objectId } = event.payload;
      delete project.objects[objectId];
      // Remove from page's objects and reading order
      for (const page of Object.values(project.pages)) {
        page.objects = page.objects.filter(id => id !== objectId);
        page.readingOrder = page.readingOrder.filter(id => id !== objectId);
      }
      break;
    }
    case 'ObjectMoved': {
      const { objectId, fromPageId, toPageId, insertAfter } = event.payload;
      // Remove from old page
      const fromPage = project.pages[fromPageId];
      if (fromPage) {
        fromPage.objects = fromPage.objects.filter(id => id !== objectId);
        fromPage.readingOrder = fromPage.readingOrder.filter(id => id !== objectId);
      }
      // Add to new page
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
      const { pageId, readingOrder } = event.payload;
      if (project.pages[pageId]) {
        project.pages[pageId].readingOrder = readingOrder;
      }
      break;
    }
    case 'ObjectApprovalChanged': {
      const { objectId, newStatus, actorId, decisionId } = event.payload;
      if (project.objects[objectId]) {
        project.objects[objectId].approval = newStatus as ApprovalState;
        if (newStatus === 'approved') {
          project.objects[objectId].approvedBy = actorId;
          project.objects[objectId].approvedAt = event.timestamp;
          project.objects[objectId].approvedVersion = project.currentVersion;
        }
        if (decisionId) {
          project.objects[objectId].decisionId = decisionId;
        }
      }
      break;
    }
    case 'AssetUploaded': {
      const { asset } = event.payload;
      project.assets[asset.id] = asset;
      break;
    }
    case 'AssetUpdated': {
      const { assetId, changes } = event.payload;
      if (project.assets[assetId]) {
        Object.assign(project.assets[assetId], changes);
      }
      break;
    }
    case 'AssetDeleted': {
      const { assetId } = event.payload;
      delete project.assets[assetId];
      break;
    }
    case 'AssetCropRegistered': {
      const { assetId, crop } = event.payload;
      if (project.assets[assetId]) {
        project.assets[assetId] = { ...project.assets[assetId] } as ImageAsset;
      }
      break;
    }
    case 'AssetAnalysisRecorded': {
      const { assetId, observations, interpretations, uncertainties } = event.payload;
      if (project.assets[assetId]) {
        project.assets[assetId].observations = observations as Observation[];
        project.assets[assetId].interpretations = interpretations as Interpretation[];
        project.assets[assetId].uncertainties = uncertainties as Uncertainty[];
      }
      break;
    }
    case 'DatasetCreated': {
      const { dataset } = event.payload;
      project.datasets[dataset.id] = dataset;
      break;
    }
    case 'DatasetUpdated': {
      const { datasetId, changes } = event.payload;
      if (project.datasets[datasetId]) {
        Object.assign(project.datasets[datasetId], changes);
      }
      break;
    }
    case 'DatasetDeleted': {
      const { datasetId } = event.payload;
      delete project.datasets[datasetId];
      break;
    }
    case 'DatasetSchemaConfirmed': {
      const { datasetId } = event.payload;
      if (project.datasets[datasetId]) {
        project.datasets[datasetId].userConfirmed = true;
      }
      break;
    }
    case 'DiagramCreated': {
      const { diagram } = event.payload;
      project.diagrams[diagram.id] = diagram;
      break;
    }
    case 'DiagramUpdated': {
      const { diagramId, changes } = event.payload;
      if (project.diagrams[diagramId]) {
        Object.assign(project.diagrams[diagramId], changes);
        project.diagrams[diagramId].updatedAt = event.timestamp;
        project.diagrams[diagramId].specVersion += 1;
      }
      break;
    }
    case 'DiagramDeleted': {
      const { diagramId } = event.payload;
      delete project.diagrams[diagramId];
      break;
    }
    case 'DiagramNodeAdded': {
      const { diagramId, node } = event.payload;
      if (project.diagrams[diagramId]) {
        project.diagrams[diagramId].nodes.push(node as DiagramNode);
      }
      break;
    }
    case 'DiagramNodeUpdated': {
      const { diagramId, nodeId, changes } = event.payload;
      const diagram = project.diagrams[diagramId];
      if (diagram) {
        const idx = diagram.nodes.findIndex(n => n.id === nodeId);
        if (idx >= 0) {
          Object.assign(diagram.nodes[idx], changes);
        }
      }
      break;
    }
    case 'DiagramNodeRemoved': {
      const { diagramId, nodeId } = event.payload;
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
      const { diagramId, edge } = event.payload;
      if (project.diagrams[diagramId]) {
        project.diagrams[diagramId].edges.push(edge as DiagramEdge);
      }
      break;
    }
    case 'DiagramEdgeUpdated': {
      const { diagramId, edgeId, changes } = event.payload;
      const diagram = project.diagrams[diagramId];
      if (diagram) {
        const idx = diagram.edges.findIndex(e => e.id === edgeId);
        if (idx >= 0) {
          Object.assign(diagram.edges[idx], changes);
        }
      }
      break;
    }
    case 'DiagramEdgeRemoved': {
      const { diagramId, edgeId } = event.payload;
      const diagram = project.diagrams[diagramId];
      if (diagram) {
        diagram.edges = diagram.edges.filter(e => e.id !== edgeId);
      }
      break;
    }
    case 'DiagramLayoutApplied': {
      const { diagramId, layout, seed } = event.payload;
      if (project.diagrams[diagramId]) {
        project.diagrams[diagramId].layout = layout;
        project.diagrams[diagramId].layoutSeed = seed;
        project.diagrams[diagramId].specVersion += 1;
      }
      break;
    }
    case 'ChartCreated': {
      const { chart } = event.payload;
      project.charts[chart.id] = chart;
      break;
    }
    case 'ChartUpdated': {
      const { chartId, changes } = event.payload;
      if (project.charts[chartId]) {
        Object.assign(project.charts[chartId], changes);
        project.charts[chartId].updatedAt = event.timestamp;
        project.charts[chartId].specVersion += 1;
      }
      break;
    }
    case 'ChartDeleted': {
      const { chartId } = event.payload;
      delete project.charts[chartId];
      break;
    }
    case 'ChartSpecVersionBumped': {
      const { chartId, newVersion } = event.payload;
      if (project.charts[chartId]) {
        project.charts[chartId].specVersion = newVersion;
      }
      break;
    }
    case 'DecisionCreated': {
      const { decision } = event.payload;
      project.decisions[decision.id] = decision;
      break;
    }
    case 'DecisionUpdated': {
      const { decisionId, changes } = event.payload;
      if (project.decisions[decisionId]) {
        Object.assign(project.decisions[decisionId], changes);
        project.decisions[decisionId].updatedAt = event.timestamp;
      }
      break;
    }
    case 'DecisionApproved': {
      const { decisionId, selectedOptionId, reason, actorId } = event.payload;
      if (project.decisions[decisionId]) {
        project.decisions[decisionId].status = 'approved';
        project.decisions[decisionId].selectedOptionId = selectedOptionId;
        project.decisions[decisionId].selectionReason = reason;
        project.decisions[decisionId].approvedBy = actorId;
        project.decisions[decisionId].approvedAt = event.timestamp;
        project.decisions[decisionId].approvedVersion = project.currentVersion;
        // Update affected objects
        for (const objId of project.decisions[decisionId].targetObjectIds) {
          if (project.objects[objId]) {
            project.objects[objId].approval = 'approved';
            project.objects[objId].approvedBy = actorId;
            project.objects[objId].approvedAt = event.timestamp;
            project.objects[objId].approvedVersion = project.currentVersion;
          }
        }
      }
      break;
    }
    case 'DecisionRejected': {
      const { decisionId, reason, actorId } = event.payload;
      if (project.decisions[decisionId]) {
        project.decisions[decisionId].status = 'rejected';
        // Revert or keep based on decision type
      }
      break;
    }
    case 'DecisionStaled': {
      const { decisionId, reason } = event.payload;
      if (project.decisions[decisionId]) {
        project.decisions[decisionId].status = 'stale';
        // Mark affected objects as stale
        for (const objId of project.decisions[decisionId].targetObjectIds) {
          if (project.objects[objId] && project.objects[objId].approval === 'approved') {
            project.objects[objId].approval = 'stale';
          }
        }
      }
      break;
    }
    case 'FindingCreated': {
      const { finding } = event.payload;
      project.findings[finding.id] = finding;
      break;
    }
    case 'FindingResolved': {
      const { findingId } = event.payload;
      if (project.findings[findingId]) {
        project.findings[findingId].status = 'resolved';
      }
      break;
    }
    case 'FindingAccepted': {
      const { findingId, reason } = event.payload;
      if (project.findings[findingId]) {
        project.findings[findingId].status = 'accepted';
        project.findings[findingId].acceptedReason = reason;
      }
      break;
    }
    case 'FindingDismissed': {
      const { findingId } = event.payload;
      if (project.findings[findingId]) {
        project.findings[findingId].status = 'dismissed';
      }
      break;
    }
    case 'FindingReopened': {
      const { findingId, reason } = event.payload;
      if (project.findings[findingId]) {
        project.findings[findingId].status = 'open';
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
      // Lock all pages
      for (const page of Object.values(project.pages)) {
        page.status = 'locked';
      }
      break;
    }
    case 'DocumentUnlocked': {
      project.status = 'review';
      for (const page of Object.values(project.pages)) {
        page.status = 'review';
      }
      break;
    }
    case 'ExportFinalized': {
      project.status = 'exported';
      break;
    }
    case 'ExportJobCreated': {
      const { exportJob } = event.payload;
      project.exportJobs[exportJob.id] = exportJob;
      break;
    }
    case 'ExportJobUpdated': {
      const { exportJobId, changes } = event.payload;
      if (project.exportJobs[exportJobId]) {
        Object.assign(project.exportJobs[exportJobId], changes);
      }
      break;
    }
    case 'ExportManifestApproved': {
      const { exportJobId, actorId, approvalToken } = event.payload;
      if (project.exportJobs[exportJobId]) {
        project.exportJobs[exportJobId].status = 'approved';
        project.exportJobs[exportJobId].approvalToken = approvalToken;
        project.exportJobs[exportJobId].approvedVersion = project.currentVersion;
      }
      break;
    }
    case 'SnapshotCreated': {
      const { version, snapshotHash, eventCount } = event.payload;
      project.versions.push({
        id: `ver_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}` as VersionId,
        version,
        snapshotHash,
        eventCount,
        createdAt: event.timestamp,
        isSnapshot: true,
      });
      break;
    }
    case 'UndoPerformed': {
      const { newVersion } = event.payload;
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
  return isWriteTool(type);
}

function isApprovalCommand(type: string): boolean {
  return type === 'ApproveDecision' || type === 'ApproveExportManifest' || type === 'ConfirmReadiness' || type === 'LockDocument';
}

function computeHmac(event: DomainEvent): string {
  // Placeholder - real implementation in storage layer with session secret
  return '0'.repeat(64);
}

// Import types for factory functions
import type { Page } from '../schema';
import type { Observation, Interpretation, Uncertainty } from '../schema';

// ============================================================================
// Exports
// ============================================================================

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
  CommandBus,
  CommandHandler,
  CommandHandlerContext,
};