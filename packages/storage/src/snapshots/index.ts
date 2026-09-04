// ============================================================================
// Snapshot Management
// ============================================================================

import { eventStore } from '../eventStore';
import type {
  DocumentProject,
  ProjectId,
  VersionId,
  Hash,
  DocumentVersion,
} from '@vistect/domain';
import { nanoid } from 'nanoid';

// ============================================================================
// Snapshot Configuration
// ============================================================================

export const SNAPSHOT_INTERVAL = 50; // Create snapshot every 50 versions
export const UNDO_DEPTH = 100; // Keep 100 commands for undo
export const MAX_SNAPSHOTS = 20; // Max snapshots to keep per project

// ============================================================================
// Snapshot Manager
// ============================================================================

export interface SnapshotManager {
  shouldCreateSnapshot(version: number, lastSnapshotVersion: number): boolean;
  createSnapshot(project: DocumentProject, version: number, eventCount: number, prevSnapshotHash: Hash | null): Promise<VersionId>;
  getSnapshotForRecovery(projectId: ProjectId, targetVersion: number): Promise<{ snapshot: DocumentProject; events: any[] } | null>;
  compactSnapshots(projectId: ProjectId): Promise<void>;
}

export function createSnapshotManager(): SnapshotManager {
  return {
    shouldCreateSnapshot,
    createSnapshot,
    getSnapshotForRecovery,
    compactSnapshots,
  };
}

function shouldCreateSnapshot(version: number, lastSnapshotVersion: number): boolean {
  return version - lastSnapshotVersion >= SNAPSHOT_INTERVAL;
}

async function createSnapshot(
  project: DocumentProject,
  version: number,
  eventCount: number,
  prevSnapshotHash: Hash | null
): Promise<VersionId> {
  // Serialize project state for hashing
  const serialized = serializeForHash(project);
  const hash = await hashState(serialized);

  const snapshotId = await eventStore.createSnapshot(
    project.id,
    version,
    hash,
    eventCount,
    project,
    prevSnapshotHash
  );

  return snapshotId;
}

async function getSnapshotForRecovery(
  projectId: ProjectId,
  targetVersion: number
): Promise<{ snapshot: DocumentProject; events: any[] } | null> {
  // Find the latest snapshot at or before targetVersion
  const snapshot = await eventStore.getSnapshot(projectId, targetVersion);
  if (!snapshot) {
    // Fall back to latest snapshot before target
    const latestSnapshot = await eventStore.getLatestSnapshot(projectId);
    if (!latestSnapshot || latestSnapshot.version > targetVersion) return null;

    const events = await eventStore.getEvents(projectId, latestSnapshot.version, targetVersion);
    return { snapshot: latestSnapshot.projectState, events };
  }

  const events = await eventStore.getEvents(projectId, snapshot.version, targetVersion);
  return { snapshot: snapshot.projectState, events };
}

async function compactSnapshots(projectId: ProjectId): Promise<void> {
  // Get all snapshots
  const chain = await eventStore.getSnapshotChain(projectId);
  if (chain.length <= MAX_SNAPSHOTS) return;

  // Keep the first, last, and evenly distributed snapshots
  const toKeep = new Set<VersionId>();
  toKeep.add(chain[0].id);
  toKeep.add(chain[chain.length - 1].id);

  // Keep snapshots at intervals
  const interval = Math.max(1, Math.floor((chain.length - 2) / (MAX_SNAPSHOTS - 2)));
  for (let i = 1; i < chain.length - 1; i += interval) {
    toKeep.add(chain[i].id);
  }

  // Delete the rest (in a real implementation, we'd have a delete method)
  // For now, we just log the compaction
  console.log(`Snapshot compaction for ${projectId}: keeping ${toKeep.size} of ${chain.length} snapshots`);
}

// ============================================================================
// Serialization for Hashing
// ============================================================================

function serializeForHash(project: DocumentProject): string {
  // Create a deterministic serialization of project state
  // Exclude fields that change without semantic meaning
  const { currentVersion, createdAt, updatedAt, versions, exportJobs, ...state } = project;

  // Sort keys for deterministic output
  return JSON.stringify(state, Object.keys(state).sort());
}

async function hashState(data: string): Promise<Hash> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================================
// Project Recovery
// ============================================================================

export async function recoverProject(
  projectId: ProjectId,
  targetVersion: number
): Promise<DocumentProject | null> {
  const manager = createSnapshotManager();
  const recovery = await manager.getSnapshotForRecovery(projectId, targetVersion);
  if (!recovery) return null;

  // Replay events onto snapshot
  let project = recovery.snapshot;
  for (const event of recovery.events) {
    // Apply event to project state
    // This would use the same applyEvent logic from the command bus
    project = applyEventToProject(project, event);
  }

  return project;
}

function applyEventToProject(project: DocumentProject, event: any): DocumentProject {
  // Simplified - real implementation would use the command bus applyEvent
  return project;
}