// ============================================================================
// IndexedDB Event Store
// ============================================================================
//
// Durable, append-only event log plus snapshots, assets and per-project metadata
// (ADR-006). Four object stores share one database so that a delete spanning all
// of them is a single transaction.
//
// Two ordering concepts, deliberately distinct:
//   `version`  — domain version, assigned by the command bus
//   `sequence` — monotonic per-project storage order, assigned here
//
// Replay uses `sequence`, because two events can share a version (a command that
// emits several events) while storage order must remain total.

import type {
  ActorId,
  DocumentProject,
  DomainEvent,
  Hash,
  ProjectId,
  VersionId,
} from '@vistect/domain';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { nanoid } from 'nanoid';


import { CHAIN_ROOT, computeHmac, verifyChain, type ChainVerification } from './hmac';

/** A `DomainEvent` as persisted: storage keys plus a chain HMAC. */
export interface StoredEvent {
  event: DomainEvent;
  id: string;
  projectId: ProjectId;
  sequence: number;
  hmac: string;
}

export interface StoredSnapshot {
  id: VersionId;
  projectId: ProjectId;
  version: number;
  snapshotHash: Hash;
  eventCount: number;
  projectState: DocumentProject;
  prevSnapshotHash: Hash | null;
  createdAt: string;
}

export interface StoredAsset {
  id: string;
  projectId: ProjectId;
  blob: Blob;
  mimeType: string;
  contentHash: Hash;
  createdAt: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  meta?: unknown;
}

export interface ProjectMeta {
  id: string;
  projectId: ProjectId;
  actorId: ActorId;
  /** HMAC secret for this session. Never leaves the device. */
  sessionSecret: string;
  log: LogEntry[];
  storageEstimate: { usage: number; quota: number } | null;
  createdAt: string;
  updatedAt: string;
}

interface VistectDBSchema extends DBSchema {
  'vistect-events': {
    key: string;
    value: StoredEvent;
    indexes: { 'by-project': ProjectId; 'by-project-sequence': [ProjectId, number] };
  };
  'vistect-snapshots': {
    key: string;
    value: StoredSnapshot;
    indexes: { 'by-project': ProjectId; 'by-project-version': [ProjectId, number] };
  };
  'vistect-assets': {
    key: string;
    value: StoredAsset;
    indexes: { 'by-project': ProjectId; 'by-hash': Hash };
  };
  'vistect-meta': {
    key: string;
    value: ProjectMeta;
    indexes: { 'by-project': ProjectId };
  };
}

const DB_NAME = 'vistect-db';
const DB_VERSION = 1;

/** Log ring-buffer size per project. */
const MAX_LOG_ENTRIES = 1_000;

export class EventStore {
  private db: IDBPDatabase<VistectDBSchema> | null = null;
  private initPromise: Promise<IDBPDatabase<VistectDBSchema>> | null = null;

  /**
   * Opens the database, returning the handle.
   *
   * Concurrent callers share one in-flight promise, so a burst of operations at
   * startup cannot trigger several parallel `openDB` calls.
   */
  async initialize(): Promise<IDBPDatabase<VistectDBSchema>> {
    if (this.db !== null) return this.db;
    this.initPromise ??= this.open();
    this.db = await this.initPromise;
    return this.db;
  }

  private async open(): Promise<IDBPDatabase<VistectDBSchema>> {
    return openDB<VistectDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('vistect-events')) {
          const events = db.createObjectStore('vistect-events', { keyPath: 'id' });
          events.createIndex('by-project', 'projectId');
          events.createIndex('by-project-sequence', ['projectId', 'sequence']);
        }
        if (!db.objectStoreNames.contains('vistect-snapshots')) {
          const snapshots = db.createObjectStore('vistect-snapshots', { keyPath: 'id' });
          snapshots.createIndex('by-project', 'projectId');
          snapshots.createIndex('by-project-version', ['projectId', 'version']);
        }
        if (!db.objectStoreNames.contains('vistect-assets')) {
          const assets = db.createObjectStore('vistect-assets', { keyPath: 'id' });
          assets.createIndex('by-project', 'projectId');
          assets.createIndex('by-hash', 'contentHash');
        }
        if (!db.objectStoreNames.contains('vistect-meta')) {
          const meta = db.createObjectStore('vistect-meta', { keyPath: 'id' });
          meta.createIndex('by-project', 'projectId');
        }
      },
    });
  }

  // ==========================================================================
  // Events
  // ==========================================================================

  /**
   * Appends events atomically, extending the HMAC chain.
   *
   * HMACs are computed **before** the transaction opens: `crypto.subtle` is async
   * and awaiting inside an IndexedDB transaction lets it auto-commit, which would
   * silently drop the remaining events (I-13).
   */
  async appendEvents(
    projectId: ProjectId,
    events: DomainEvent[],
    sessionSecret: string
  ): Promise<void> {
    if (events.length === 0) return;
    const db = await this.initialize();

    const last = await this.getLatestEvent(projectId);
    let sequence = last === null ? 0 : last.sequence + 1;
    let previousHmac = last?.hmac ?? CHAIN_ROOT;

    const records: StoredEvent[] = [];
    for (const event of events) {
      const hmac = await computeHmac(event, sessionSecret, previousHmac);
      records.push({ event, id: event.id, projectId, sequence, hmac });
      previousHmac = hmac;
      sequence++;
    }

    const tx = db.transaction('vistect-events', 'readwrite');
    const store = tx.objectStore('vistect-events');
    await Promise.all(records.map((record) => store.put(record)));
    await tx.done;
  }

  /** Stored events in sequence order, optionally bounded by sequence. */
  async getEvents(
    projectId: ProjectId,
    fromSequence?: number,
    toSequence?: number
  ): Promise<StoredEvent[]> {
    const db = await this.initialize();
    const index = db
      .transaction('vistect-events', 'readonly')
      .objectStore('vistect-events')
      .index('by-project-sequence');

    // The compound index is queried with compound bounds; the previous code
    // passed compound ranges to the single-key `by-project` index, which matches
    // nothing.
    const lower = fromSequence ?? 0;
    const upper = toSequence ?? Number.MAX_SAFE_INTEGER;
    const range = IDBKeyRange.bound([projectId, lower], [projectId, upper]);

    // Index order is already (projectId, sequence), so results arrive sorted.
    return index.getAll(range);
  }

  /** Domain events in replay order. */
  async getDomainEvents(
    projectId: ProjectId,
    fromSequence?: number,
    toSequence?: number
  ): Promise<DomainEvent[]> {
    const stored = await this.getEvents(projectId, fromSequence, toSequence);
    return stored.map((record) => record.event);
  }

  async getLatestEvent(projectId: ProjectId): Promise<StoredEvent | null> {
    const db = await this.initialize();
    const index = db
      .transaction('vistect-events', 'readonly')
      .objectStore('vistect-events')
      .index('by-project-sequence');

    // Reverse cursor reads one record instead of loading the whole log.
    const cursor = await index.openCursor(
      IDBKeyRange.bound([projectId, 0], [projectId, Number.MAX_SAFE_INTEGER]),
      'prev'
    );
    return cursor?.value ?? null;
  }

  async getEventCount(projectId: ProjectId): Promise<number> {
    const db = await this.initialize();
    return db
      .transaction('vistect-events', 'readonly')
      .objectStore('vistect-events')
      .index('by-project')
      .count(projectId);
  }

  /** Verifies the whole HMAC chain, reporting the first broken link. */
  async verifyEventChain(
    projectId: ProjectId,
    sessionSecret: string
  ): Promise<ChainVerification> {
    const stored = await this.getEvents(projectId);
    return verifyChain(
      stored.map((record) => ({ event: record.event, hmac: record.hmac })),
      sessionSecret
    );
  }

  // ==========================================================================
  // Snapshots
  // ==========================================================================

  async createSnapshot(
    projectId: ProjectId,
    version: number,
    snapshotHash: Hash,
    eventCount: number,
    projectState: DocumentProject,
    prevSnapshotHash: Hash | null
  ): Promise<VersionId> {
    const db = await this.initialize();
    const snapshotId = `ver_${nanoid(12)}` as VersionId;

    const tx = db.transaction('vistect-snapshots', 'readwrite');
    await tx.objectStore('vistect-snapshots').put({
      id: snapshotId,
      projectId,
      version,
      snapshotHash,
      eventCount,
      projectState,
      prevSnapshotHash,
      createdAt: new Date().toISOString(),
    });
    await tx.done;

    return snapshotId;
  }

  async getSnapshot(projectId: ProjectId, version: number): Promise<StoredSnapshot | null> {
    const db = await this.initialize();
    const found = await db
      .transaction('vistect-snapshots', 'readonly')
      .objectStore('vistect-snapshots')
      .index('by-project-version')
      .get([projectId, version]);
    return found ?? null;
  }

  async getLatestSnapshot(projectId: ProjectId): Promise<StoredSnapshot | null> {
    const db = await this.initialize();
    const cursor = await db
      .transaction('vistect-snapshots', 'readonly')
      .objectStore('vistect-snapshots')
      .index('by-project-version')
      .openCursor(IDBKeyRange.bound([projectId, 0], [projectId, Number.MAX_SAFE_INTEGER]), 'prev');
    return cursor?.value ?? null;
  }

  async getSnapshotChain(projectId: ProjectId): Promise<
    { id: VersionId; version: number; snapshotHash: Hash; prevSnapshotHash: Hash | null }[]
  > {
    const db = await this.initialize();
    const snapshots = await db
      .transaction('vistect-snapshots', 'readonly')
      .objectStore('vistect-snapshots')
      .index('by-project-version')
      .getAll(IDBKeyRange.bound([projectId, 0], [projectId, Number.MAX_SAFE_INTEGER]));

    return snapshots.map((s) => ({
      id: s.id,
      version: s.version,
      snapshotHash: s.snapshotHash,
      prevSnapshotHash: s.prevSnapshotHash,
    }));
  }

  async deleteSnapshot(snapshotId: VersionId): Promise<void> {
    const db = await this.initialize();
    const tx = db.transaction('vistect-snapshots', 'readwrite');
    await tx.objectStore('vistect-snapshots').delete(snapshotId);
    await tx.done;
  }

  // ==========================================================================
  // Assets
  // ==========================================================================

  async storeAsset(
    projectId: ProjectId,
    assetId: string,
    blob: Blob,
    mimeType: string,
    contentHash: Hash
  ): Promise<void> {
    const db = await this.initialize();
    const tx = db.transaction('vistect-assets', 'readwrite');
    await tx.objectStore('vistect-assets').put({
      id: assetId,
      projectId,
      blob,
      mimeType,
      contentHash,
      createdAt: new Date().toISOString(),
    });
    await tx.done;
  }

  async getAsset(assetId: string): Promise<StoredAsset | null> {
    const db = await this.initialize();
    const found = await db
      .transaction('vistect-assets', 'readonly')
      .objectStore('vistect-assets')
      .get(assetId);
    return found ?? null;
  }

  async getAssetsByProject(projectId: ProjectId): Promise<StoredAsset[]> {
    const db = await this.initialize();
    return db
      .transaction('vistect-assets', 'readonly')
      .objectStore('vistect-assets')
      .index('by-project')
      .getAll(projectId);
  }

  /** Finds an asset by content hash. Enables upload deduplication (F-2.1). */
  async getAssetByHash(contentHash: Hash): Promise<StoredAsset | null> {
    const db = await this.initialize();
    const found = await db
      .transaction('vistect-assets', 'readonly')
      .objectStore('vistect-assets')
      .index('by-hash')
      .get(contentHash);
    return found ?? null;
  }

  async deleteAsset(assetId: string): Promise<void> {
    const db = await this.initialize();
    const tx = db.transaction('vistect-assets', 'readwrite');
    await tx.objectStore('vistect-assets').delete(assetId);
    await tx.done;
  }

  // ==========================================================================
  // Metadata
  // ==========================================================================

  private static metaKey(projectId: ProjectId): string {
    return `meta_${projectId}`;
  }

  async createProjectMeta(
    projectId: ProjectId,
    actorId: ActorId,
    sessionSecret: string
  ): Promise<void> {
    const db = await this.initialize();
    const now = new Date().toISOString();

    const tx = db.transaction('vistect-meta', 'readwrite');
    await tx.objectStore('vistect-meta').put({
      id: EventStore.metaKey(projectId),
      projectId,
      actorId,
      sessionSecret,
      log: [],
      storageEstimate: null,
      createdAt: now,
      updatedAt: now,
    });
    await tx.done;
  }

  async getProjectMeta(projectId: ProjectId): Promise<ProjectMeta | null> {
    const db = await this.initialize();
    const found = await db
      .transaction('vistect-meta', 'readonly')
      .objectStore('vistect-meta')
      .get(EventStore.metaKey(projectId));
    return found ?? null;
  }

  async updateProjectMeta(
    projectId: ProjectId,
    updates: Partial<Pick<ProjectMeta, 'actorId' | 'sessionSecret' | 'log' | 'storageEstimate'>>
  ): Promise<void> {
    const db = await this.initialize();
    const tx = db.transaction('vistect-meta', 'readwrite');
    const store = tx.objectStore('vistect-meta');

    const existing = await store.get(EventStore.metaKey(projectId));
    if (existing === undefined) {
      await tx.done;
      throw new Error(`No metadata for project ${projectId}`);
    }

    await store.put({ ...existing, ...updates, updatedAt: new Date().toISOString() });
    await tx.done;
  }

  async addLogEntry(projectId: ProjectId, entry: LogEntry): Promise<void> {
    const db = await this.initialize();
    const tx = db.transaction('vistect-meta', 'readwrite');
    const store = tx.objectStore('vistect-meta');

    const existing = await store.get(EventStore.metaKey(projectId));
    // Logging is best-effort: a missing meta record must not fail the operation
    // that produced the log line.
    if (existing === undefined) {
      await tx.done;
      return;
    }

    await store.put({
      ...existing,
      log: [...existing.log, entry].slice(-MAX_LOG_ENTRIES),
      updatedAt: new Date().toISOString(),
    });
    await tx.done;
  }

  // ==========================================================================
  // Project lifecycle
  // ==========================================================================

  /**
   * Deletes every trace of a project across all four stores in one transaction,
   * so a partial delete cannot leave orphaned events or assets (§22).
   */
  async deleteProject(projectId: ProjectId): Promise<void> {
    const db = await this.initialize();
    const tx = db.transaction(
      ['vistect-events', 'vistect-snapshots', 'vistect-assets', 'vistect-meta'],
      'readwrite'
    );

    const events = tx.objectStore('vistect-events');
    for (const key of await events.index('by-project').getAllKeys(projectId)) {
      await events.delete(key);
    }

    const snapshots = tx.objectStore('vistect-snapshots');
    for (const key of await snapshots.index('by-project').getAllKeys(projectId)) {
      await snapshots.delete(key);
    }

    const assets = tx.objectStore('vistect-assets');
    for (const key of await assets.index('by-project').getAllKeys(projectId)) {
      await assets.delete(key);
    }

    await tx.objectStore('vistect-meta').delete(EventStore.metaKey(projectId));
    await tx.done;
  }

  /** Project ids that have at least one snapshot. */
  async listProjectIds(): Promise<ProjectId[]> {
    const db = await this.initialize();
    const snapshots = await db
      .transaction('vistect-snapshots', 'readonly')
      .objectStore('vistect-snapshots')
      .getAll();
    return [...new Set(snapshots.map((s) => s.projectId))];
  }

  /** Closes the connection. Synchronous: `IDBDatabase.close` returns immediately. */
  close(): void {
    this.db?.close();
    this.db = null;
    this.initPromise = null;
  }

  isInitialized(): boolean {
    return this.db !== null;
  }
}

/** Shared instance. One IndexedDB connection per tab is sufficient. */
export const eventStore = new EventStore();
