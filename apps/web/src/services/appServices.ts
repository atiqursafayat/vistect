// ============================================================================
// Application Services
// ============================================================================
//
// Wires the pure packages into a running application:
//
//   storage (IndexedDB) ─┐
//                        ├─→ command bus ─→ WebMCP registry ─→ agent
//   React state ─────────┘
//
// The command bus is the *only* write path (ADR-004). This module constructs it
// with real dependencies — load, save, append, actor lookup — so both the UI and
// agent tools dispatch through the same object.

import { createCommandBus, type CommandBus } from '@vistect/domain/bus';
import { dictValues } from '@vistect/domain/collections';
import type { EventEnvelope } from '@vistect/domain/events';
import type { Actor, ActorId, DocumentProject, ProjectId } from '@vistect/domain/schema';
import { createActorId } from '@vistect/domain/schema';
import {
  computeProjectHash,
  createSnapshotManager,
  eventStore,
  generateSalt,
  deriveSessionSecret,
} from '@vistect/storage';

/** Actors the bus can resolve. The human is local; agent actors are added per session. */
export interface ActorRegistry {
  get(actorId: ActorId): Actor | undefined;
  register(actor: Actor): void;
}

export function createActorRegistry(localHuman: Actor): ActorRegistry {
  const actors = new Map<ActorId, Actor>([[localHuman.id, localHuman]]);
  return {
    get: (actorId) => actors.get(actorId),
    register: (actor) => {
      actors.set(actor.id, actor);
    },
  };
}

/** The local human actor. `kind: 'human'` is what authorises approvals (I-03). */
export function createLocalActor(label = 'You'): Actor {
  return { id: createActorId(), kind: 'human', label };
}

export interface AppServices {
  commandBus: CommandBus;
  actors: ActorRegistry;
  /** Current in-memory project, or `null` when none is open. */
  getProject(): DocumentProject | null;
  openProject(project: DocumentProject): Promise<void>;
  closeProject(): void;
  /** Subscribes to project changes; fires on every successful command. */
  subscribe(listener: (project: DocumentProject | null) => void): () => void;
}

export interface CreateServicesOptions {
  actor: Actor;
  /** Passphrase for the HMAC session secret. Derived per session, never stored. */
  sessionPassphrase?: string;
}

/**
 * Builds the application service graph.
 *
 * Single in-memory project: the domain is single-project-at-a-time by design, and
 * a cache keyed by id would let an agent address a project the user is not in.
 */
export async function createAppServices(options: CreateServicesOptions): Promise<AppServices> {
  const actors = createActorRegistry(options.actor);
  const snapshots = createSnapshotManager();

  // Session secret for the event HMAC chain. Random when no passphrase is given,
  // so a chain is still tamper-evident within the session.
  const passphrase = options.sessionPassphrase ?? crypto.randomUUID();
  const sessionSecret = await deriveSessionSecret(passphrase, generateSalt());

  let current: DocumentProject | null = null;
  let lastSnapshotVersion = 0;
  const listeners = new Set<(project: DocumentProject | null) => void>();

  const notify = (): void => {
    for (const listener of listeners) {
      try {
        listener(current);
      } catch {
        // One listener's failure must not block the others or the command.
      }
    }
  };

  const commandBus = createCommandBus({
    getProject: async (projectId) => {
      if (current !== null && current.id === projectId) return current;
      // Not in memory: rebuild from the newest snapshot plus subsequent events.
      const latest = await eventStore.getLatestSnapshot(projectId as ProjectId);
      return latest?.projectState ?? null;
    },

    saveProject: async (project) => {
      current = project;

      // Snapshot every SNAPSHOT_INTERVAL versions, so replay stays bounded.
      if (snapshots.shouldCreateSnapshot(project.currentVersion, lastSnapshotVersion)) {
        const previous = await eventStore.getLatestSnapshot(project.id);
        await snapshots.createSnapshot(
          project,
          project.currentVersion,
          await eventStore.getEventCount(project.id),
          previous?.snapshotHash ?? null
        );
        lastSnapshotVersion = project.currentVersion;
      }

      notify();
    },

    appendEvents: async (events: EventEnvelope[]) => {
      if (events.length === 0) return;
      const projectId = events[0]?.projectId as ProjectId | undefined;
      if (projectId === undefined) return;
      // The storage layer recomputes the real HMAC chain; the bus stamps a sentinel.
      await eventStore.appendEvents(projectId, events, sessionSecret);
    },

    // Synchronous lookup wrapped in a resolved promise: the bus contract is async
    // so a future implementation can load actors from storage.
    getActor: (actorId) => Promise.resolve(actors.get(actorId as ActorId) ?? null),
  });

  return {
    commandBus,
    actors,

    getProject: () => current,

    async openProject(project) {
      current = project;

      const existing = await eventStore.getProjectMeta(project.id);
      if (existing === null) {
        await eventStore.createProjectMeta(project.id, options.actor.id, sessionSecret);
      }

      // Baseline snapshot on open, so a fresh project has a recovery point before
      // the first mutation.
      const latest = await eventStore.getLatestSnapshot(project.id);
      if (latest === null) {
        await eventStore.createSnapshot(
          project.id,
          project.currentVersion,
          await computeProjectHash(project),
          0,
          project,
          null
        );
      }
      lastSnapshotVersion = latest?.version ?? project.currentVersion;

      notify();
    },

    closeProject() {
      current = null;
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      listener(current);
      return () => listeners.delete(listener);
    },
  };
}

/** Counts a project's objects across all pages, for quota checks. */
export function countObjects(project: DocumentProject): number {
  return dictValues(project.objects).length;
}
