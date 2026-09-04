// ============================================================================
// IndexedDB Event Store
// ============================================================================

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { nanoid } from 'nanoid';
import type {
  DocumentProject,
  DomainEvent,
  EventEnvelope,
  ProjectId,
  VersionId,
  Hash,
  ActorId,
} from '@vistect/domain';
import { computeHmac } from './hmac';

// ============================================================================
// Database Schema
// ============================================================================

interface VistectDBSchema extends DBSchema {
  'vistect-events': {
    key: string; // eventId
    value: EventEnvelope & { projectId: ProjectId; sequence: number };
    indexes: { 'by-project': ProjectId; 'by-project-sequence': [ProjectId, number] };
  };
  'vistect-snapshots': {
    key: string; // snapshotId
    value: {
      id: VersionId;
      projectId: ProjectId;
      version: number;
      snapshotHash: Hash;
      eventCount: number;
      projectState: DocumentProject;
      prevSnapshotHash: Hash | null;
      createdAt: string;
    };
    indexes: { 'by-project': ProjectId; 'by-project-version': [ProjectId, number] };
  };
  'vistect-assets': {
    key: string; // assetId
    value: {
      id: string;
      projectId: ProjectId;
      blob: Blob;
      mimeType: string;
      contentHash: Hash;
      createdAt: string;
    };
    indexes: { 'by-project': ProjectId; 'by-hash': Hash };
  };
  'vistect-meta': {
    key: string;
    value: {
      id: string;
      projectId: ProjectId;
      actorId: ActorId;
      sessionSecret: string; // HMAC secret for this session
      log: Array<{ timestamp: string; level: string; message: string; meta?: unknown }>;
      storageEstimate: { usage: number; quota: number } | null;
      createdAt: string;
      updatedAt: string;
    };
    indexes: { 'by-project': ProjectId };
  }
}

const DB_NAME = 'vistect-db';
const DB_VERSION = 1;

// ============================================================================
// Event Store Class
// ============================================================================

export class EventStore {
  private db: IDBPDatabase<VistectDBSchema> | null = null;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initialize();
    await this.initPromise;
  }

  private async _initialize(): Promise<void> {
    this.db = await openDB<VistectDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Events store
        if (!db.objectStoreNames.contains('vistect-events')) {
          const eventsStore = db.createObjectStore('vistect-events', { keyPath: 'id' });
          eventsStore.createIndex('by-project', 'projectId');
          eventsStore.createIndex('by-project-sequence', ['projectId', 'sequence']);
        }

        // Snapshots store
        if (!db.objectStoreNames.contains('vistect-snapshots')) {
          const snapshotsStore = db.createObjectStore('vistect-snapshots', { keyPath: 'id' });
          snapshotsStore.createIndex('by-project', 'projectId');
          snapshotsStore.createIndex('by-project-version', ['projectId', 'version']);
        }

        // Assets store
        if (!db.objectStoreNames.contains('vistect-assets')) {
          const assetsStore = db.createObjectStore('vistect-assets', { keyPath: 'id' });
          assetsStore.createIndex('by-project', 'projectId');
          assetsStore.createIndex('by-hash', 'contentHash', { unique: false });
        }

        // Meta store
        if (!db.objectStoreNames.contains('vistect-meta')) {
          const metaStore = db.createObjectStore('vistect-meta', { keyPath: 'id' });
          metaStore.createIndex('by-project', 'projectId');
        }
      },
    });
  }

  // ============================================================================
  // Event Operations
  // ============================================================================

  async appendEvents(projectId: ProjectId, events: DomainEvent[], sessionSecret: string): Promise<void> {
    if (!this.db) await this.initialize();

    const tx = this.db!.transaction('vistect-events', 'readwrite');
    const store = tx.objectStore('vistect-events');

    // Get current sequence number for this project
    const lastEvent = await store.index('by-project').getAll(projectId);
    let sequence = lastEvent.length > 0 ? Math.max(...lastEvent.map(e => e.sequence)) + 1 : 0;

    for (const event of events) {
      const envelope: EventEnvelope & { projectId: ProjectId; sequence: number } = {
        ...event,
        projectId,
        sequence: sequence++,
        hmac: computeHmac(event, sessionSecret),
      };
      await store.put(envelope);
    }

    await tx.done;
  }

  async getEvents(projectId: ProjectId, fromSequence?: number, toSequence?: number): Promise<EventEnvelope[]> {
    if (!this.db) await this.initialize();

    const store = this.db!.transaction('vistect-events', 'readonly').objectStore('vistect-events');
    const index = store.index('by-project');

    let events: EventEnvelope[];
    if (fromSequence !== undefined && toSequence !== undefined) {
      events = await index.getAll(IDBKeyRange.bound([projectId, fromSequence], [projectId, toSequence]));
    } else if (fromSequence !== undefined) {
      events = await index.getAll(IDBKeyRange.lowerBound([projectId, fromSequence]));
    } else {
      events = await index.getAll(projectId);
    }

    return events.sort((a, b) => a.sequence - b.sequence);
  }

  async getLatestEvent(projectId: ProjectId): Promise<EventEnvelope | null> {
    if (!this.db) await this.initialize();

    const store = this.db!.transaction('vistect-events', 'readonly').objectStore('vistect-events');
    const index = store.index('by-project');
    const events = await index.getAll(projectId);
    if (events.length === 0) return null;
    return events.reduce((latest, e) => e.sequence > latest.sequence ? e : latest);
  }

  async getEventCount(projectId: ProjectId): Promise<number> {
    if (!this.db) await this.initialize();
    const store = this.db!.transaction('vistect-events', 'readonly').objectStore('vistect-events');
    return store.index('by-project').count(projectId);
  }

  // ============================================================================
  // Snapshot Operations
  // ============================================================================

  async createSnapshot(
    projectId: ProjectId,
    version: number,
    snapshotHash: Hash,
    eventCount: number,
    projectState: DocumentProject,
    prevSnapshotHash: Hash | null
  ): Promise<VersionId> {
    if (!this.db) await this.initialize();

    const snapshotId = `ver_${nanoid(12)}` as VersionId;
    const tx = this.db!.transaction('vistect-snapshots', 'readwrite');
    const store = tx.objectStore('vistect-snapshots');

    await store.put({
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

  async getSnapshot(projectId: ProjectId, version: number): Promise<{
    id: VersionId;
    projectId: ProjectId;
    version: number;
    snapshotHash: Hash;
    eventCount: number;
    projectState: DocumentProject;
    prevSnapshotHash: Hash | null;
    createdAt: string;
  } | null> {
    if (!this.db) await this.initialize();

    const store = this.db!.transaction('vistect-snapshots', 'readonly').objectStore('vistect-snapshots');
    const index = store.index('by-project-version');
    return index.get([projectId, version]);
  }

  async getLatestSnapshot(projectId: ProjectId): Promise<{
    id: VersionId;
    projectId: ProjectId;
    version: number;
    snapshotHash: Hash;
    eventCount: number;
    projectState: DocumentProject;
    prevSnapshotHash: Hash | null;
    createdAt: string;
  } | null> {
    if (!this.db) await this.initialize();

    const store = this.db!.transaction('vistect-snapshots', 'readonly').objectStore('vistect-snapshots');
    const index = store.index('by-project');
    const snapshots = await index.getAll(projectId);
    if (snapshots.length === 0) return null;
    return snapshots.reduce((latest, s) => s.version > latest.version ? s : latest);
  }

  async getSnapshotChain(projectId: ProjectId): Promise<Array<{
    id: VersionId;
    version: number;
    snapshotHash: Hash;
    prevSnapshotHash: Hash | null;
  }>> {
    if (!this.db) await this.initialize();

    const store = this.db!.transaction('vistect-snapshots', 'readonly').objectStore('vistect-snapshots');
    const index = store.index('by-project');
    const snapshots = await index.getAll(projectId);
    return snapshots
      .sort((a, b) => a.version - b.version)
      .map(s => ({
        id: s.id,
        version: s.version,
        snapshotHash: s.snapshotHash,
        prevSnapshotHash: s.prevSnapshotHash,
      }));
  }

  // ============================================================================
  // Asset Operations
  // ============================================================================

  async storeAsset(
    projectId: ProjectId,
    assetId: string,
    blob: Blob,
    mimeType: string,
    contentHash: Hash
  ): Promise<void> {
    if (!this.db) await this.initialize();

    const tx = this.db!.transaction('vistect-assets', 'readwrite');
    const store = tx.objectStore('vistect-assets');

    await store.put({
      id: assetId,
      projectId,
      blob,
      mimeType,
      contentHash,
      createdAt: new Date().toISOString(),
    });

    await tx.done;
  }

  async getAsset(assetId: string): Promise<{
    id: string;
    projectId: ProjectId;
    blob: Blob;
    mimeType: string;
    contentHash: Hash;
    createdAt: string;
  } | null> {
    if (!this.db) await this.initialize();

    const store = this.db!.transaction('vistect-assets', 'readonly').objectStore('vistect-assets');
    return store.get(assetId);
  }

  async getAssetsByProject(projectId: ProjectId): Promise<Array<{
    id: string;
    projectId: ProjectId;
    blob: Blob;
    mimeType: string;
    contentHash: Hash;
    createdAt: string;
  }>> {
    if (!this.db) await this.initialize();

    const store = this.db!.transaction('vistect-assets', 'readonly').objectStore('vistect-assets');
    return store.index('by-project').getAll(projectId);
  }

  async getAssetByHash(contentHash: Hash): Promise<{
    id: string;
    projectId: ProjectId;
    blob: Blob;
    mimeType: string;
    contentHash: Hash;
    createdAt: string;
  } | null> {
    if (!this.db) await this.initialize();

    const store = this.db!.transaction('vistect-assets', 'readonly').objectStore('vistect-assets');
    const assets = await store.index('by-hash').getAll(contentHash);
    return assets[0] || null;
  }

  async deleteAsset(assetId: string): Promise<void> {
    if (!this.db) await this.initialize();
    const tx = this.db!.transaction('vistect-assets', 'readwrite');
    await tx.objectStore('vistect-assets').delete(assetId);
    await tx.done;
  }

  // ============================================================================
  // Meta Operations
  // ============================================================================

  async createProjectMeta(
    projectId: ProjectId,
    actorId: ActorId,
    sessionSecret: string
  ): Promise<void> {
    if (!this.db) await this.initialize();

    const tx = this.db!.transaction('vistect-meta', 'readwrite');
    const store = tx.objectStore('vistect-meta');

    await store.put({
      id: `meta_${projectId}`,
      projectId,
      actorId,
      sessionSecret,
      log: [],
      storageEstimate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await tx.done;
  }

  async getProjectMeta(projectId: ProjectId): Promise<{
    id: string;
    projectId: ProjectId;
    actorId: ActorId;
    sessionSecret: string;
    log: Array<{ timestamp: string; level: string; message: string; meta?: unknown }>;
    storageEstimate: { usage: number; quota: number } | null;
    createdAt: string;
    updatedAt: string;
  } | null> {
    if (!this.db) await this.initialize();

    const store = this.db!.transaction('vistect-meta', 'readonly').objectStore('vistect-meta');
    return store.get(`meta_${projectId}`);
  }

  async updateProjectMeta(projectId: ProjectId, updates: Partial<{
    actorId: ActorId;
    sessionSecret: string;
    log: Array<{ timestamp: string; level: string; message: string; meta?: unknown }>;
    storageEstimate: { usage: number; quota: number } | null;
  }>): Promise<void> {
    if (!this.db) await this.initialize();

    const tx = this.db!.transaction('vistect-meta', 'readwrite');
    const store = tx.objectStore('vistect-meta');

    const existing = await store.get(`meta_${projectId}`);
    if (existing) {
      await store.put({
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    }

    await tx.done;
  }

  async addLogEntry(projectId: ProjectId, entry: { timestamp: string; level: string; message: string; meta?: unknown }): Promise<void> {
    if (!this.db) await this.initialize();

    const tx = this.db!.transaction('vistect-meta', 'readwrite');
    const store = tx.objectStore('vistect-meta');

    const existing = await store.get(`meta_${projectId}`);
    if (existing) {
      const log = [...existing.log, entry].slice(-1000); // Ring buffer of 1000 entries
      await store.put({ ...existing, log, updatedAt: new Date().toISOString() });
    }

    await tx.done;
  }

  // ============================================================================
  // Project Operations
  // ============================================================================

  async saveProject(project: DocumentProject): Promise<void> {
    // Project is saved via event store + snapshots
    // This is a no-op here - the command bus handles project persistence
  }

  async loadProject(projectId: ProjectId): Promise<DocumentProject | null> {
    // Load from latest snapshot + replay events
    const snapshot = await this.getLatestSnapshot(projectId);
    if (!snapshot) return null;

    const events = await this.getEvents(projectId, snapshot.version);
    // In a real implementation, we'd replay events onto the snapshot
    // For now, return the snapshot state
    return snapshot.projectState;
  }

  async deleteProject(projectId: ProjectId): Promise<void> {
    if (!this.db) await this.initialize();

    const tx = this.db!.transaction(['vistect-events', 'vistect-snapshots', 'vistect-assets', 'vistect-meta'], 'readwrite');

    // Delete events
    const eventsStore = tx.objectStore('vistect-events');
    const eventsIndex = eventsStore.index('by-project');
    const events = await eventsIndex.getAllKeys(projectId);
    for (const key of events) {
      await eventsStore.delete(key);
    }

    // Delete snapshots
    const snapshotsStore = tx.objectStore('vistect-snapshots');
    const snapshotsIndex = snapshotsStore.index('by-project');
    const snapshots = await snapshotsIndex.getAllKeys(projectId);
    for (const key of snapshots) {
      await snapshotsStore.delete(key);
    }

    // Delete assets
    const assetsStore = tx.objectStore('vistect-assets');
    const assetsIndex = assetsStore.index('by-project');
    const assets = await assetsIndex.getAllKeys(projectId);
    for (const key of assets) {
      await assetsStore.delete(key);
    }

    // Delete meta
    const metaStore = tx.objectStore('vistect-meta');
    await metaStore.delete(`meta_${projectId}`);

    await tx.done;
  }

  // ============================================================================
  // Utility
  // ============================================================================

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  isInitialized(): boolean {
    return this.db !== null;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const eventStore = new EventStore();