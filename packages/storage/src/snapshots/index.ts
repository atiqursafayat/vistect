// ============================================================================
// Snapshot Management
// ============================================================================
//
// Snapshots bound replay cost: without them, opening a mature project would mean
// replaying its entire event log. A snapshot stores full project state at a
// version, so recovery replays only the events after it (AC F-1.2 §1).
//
// Snapshot hashes chain to the previous snapshot, so a tampered or truncated
// snapshot history is detectable the same way the event chain is.

import { applyEvent } from '@vistect/domain';
import type { DocumentProject, DomainEvent, Hash, ProjectId, VersionId } from '@vistect/domain';

import { eventStore } from '../eventStore';

/** Versions between snapshots. Bounds replay to at most this many events. */
export const SNAPSHOT_INTERVAL = 50;

/** Undo depth in commands (AC F-1.3 §1). */
export const UNDO_DEPTH = 100;

/** Snapshots retained per project before compaction thins the history. */
export const MAX_SNAPSHOTS = 20;

export interface SnapshotRecovery {
  snapshot: DocumentProject;
  events: DomainEvent[];
}

export interface SnapshotManager {
  shouldCreateSnapshot(version: number, lastSnapshotVersion: number): boolean;
  createSnapshot(
    project: DocumentProject,
    version: number,
    eventCount: number,
    prevSnapshotHash: Hash | null
  ): Promise<VersionId>;
  getSnapshotForRecovery(
    projectId: ProjectId,
    targetVersion: number
  ): Promise<SnapshotRecovery | null>;
  compactSnapshots(projectId: ProjectId): Promise<VersionId[]>;
}

export function createSnapshotManager(): SnapshotManager {
  return { shouldCreateSnapshot, createSnapshot, getSnapshotForRecovery, compactSnapshots };
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
  const hash = await computeProjectHash(project);
  return eventStore.createSnapshot(project.id, version, hash, eventCount, project, prevSnapshotHash);
}

async function getSnapshotForRecovery(
  projectId: ProjectId,
  targetVersion: number
): Promise<SnapshotRecovery | null> {
  // Prefer an exact snapshot at the target version; otherwise the newest one at
  // or before it, so replay only moves forward.
  const exact = await eventStore.getSnapshot(projectId, targetVersion);
  if (exact !== null) {
    return {
      snapshot: exact.projectState,
      events: await eventStore.getDomainEvents(projectId, exact.version, targetVersion),
    };
  }

  const latest = await eventStore.getLatestSnapshot(projectId);
  if (latest === null || latest.version > targetVersion) return null;

  return {
    snapshot: latest.projectState,
    events: await eventStore.getDomainEvents(projectId, latest.version, targetVersion),
  };
}

/**
 * Thins snapshot history to at most {@link MAX_SNAPSHOTS}, keeping the oldest,
 * the newest, and an even spread between them, then deletes the rest.
 *
 * Returns the retained ids. The previous implementation computed the set and only
 * logged it, so history grew without bound.
 */
async function compactSnapshots(projectId: ProjectId): Promise<VersionId[]> {
  const chain = await eventStore.getSnapshotChain(projectId);
  if (chain.length <= MAX_SNAPSHOTS) return chain.map((s) => s.id);

  const first = chain[0];
  const last = chain[chain.length - 1];
  if (first === undefined || last === undefined) return [];

  const keep = new Set<VersionId>([first.id, last.id]);

  // Even spread across the interior. `MAX_SNAPSHOTS - 2` accounts for the two
  // endpoints already retained.
  const interior = chain.slice(1, -1);
  const stride = Math.max(1, Math.ceil(interior.length / (MAX_SNAPSHOTS - 2)));
  for (let i = 0; i < interior.length; i += stride) {
    const entry = interior[i];
    if (entry !== undefined) keep.add(entry.id);
  }

  for (const snapshot of chain) {
    if (!keep.has(snapshot.id)) {
      await eventStore.deleteSnapshot(snapshot.id);
    }
  }

  return [...keep];
}

// ============================================================================
// Hashing
// ============================================================================

/**
 * Content hash of a project's semantic state.
 *
 * Excludes fields that change without altering content — `currentVersion`,
 * timestamps, the version list, export jobs — so two projects with identical
 * content hash identically. This is the value bound into an export manifest
 * (§28) to prove which state was exported.
 */
export async function computeProjectHash(project: DocumentProject): Promise<Hash> {
  const {
    currentVersion: _version,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    versions: _versions,
    exportJobs: _exportJobs,
    ...content
  } = project;

  const data = new TextEncoder().encode(canonicalise(content));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Deterministic serialisation with recursively sorted keys.
 *
 * `JSON.stringify(state, Object.keys(state).sort())` — the previous approach —
 * treats the array as a key allowlist and drops every nested key absent from it,
 * so the hash covered only top-level scalars and would not change when page or
 * object content changed.
 */
function canonicalise(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalise).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalise(v)}`).join(',')}}`;
}

// ============================================================================
// Project Recovery
// ============================================================================

/**
 * Rebuilds project state at `targetVersion` from the nearest snapshot plus the
 * events after it, using the command bus's own `applyEvent`.
 */
export async function recoverProject(
  projectId: ProjectId,
  targetVersion: number
): Promise<DocumentProject | null> {
  const recovery = await createSnapshotManager().getSnapshotForRecovery(projectId, targetVersion);
  if (recovery === null) return null;

  // Deep clone before replay: `applyEvent` mutates, and the snapshot object is
  // the stored record, which must not be modified.
  const project = structuredClone(recovery.snapshot);
  for (const event of recovery.events) {
    if (event.version > targetVersion) break;
    applyEvent(project, event);
  }

  return project;
}
