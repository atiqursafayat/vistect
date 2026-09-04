// ============================================================================
// Agent Activity Recorder
// ============================================================================

import type { DocumentProject, ActorId, Hash } from '@vistect/domain/schema';

// ============================================================================
// Activity Types
// ============================================================================

export interface AgentActivityEntry {
  id: string;
  timestamp: string;
  toolName: string;
  input: unknown;
  result: unknown;
  status: 'success' | 'error';
  versionBefore: number;
  versionAfter: number;
  durationMs: number;
  actorId: ActorId;
}

export interface ActivityRecorder {
  record(entry: Omit<AgentActivityEntry, 'id' | 'timestamp'>): AgentActivityEntry;
  getEntries(filter?: ActivityFilter): AgentActivityEntry[];
  clear(): void;
  subscribe(callback: (entry: AgentActivityEntry) => void): () => void;
}

export interface ActivityFilter {
  toolName?: string;
  status?: 'success' | 'error';
  actorId?: ActorId;
  since?: string; // ISO timestamp
  limit?: number;
}

// ============================================================================
// Activity Recorder Implementation
// ============================================================================

export function createActivityRecorder(): ActivityRecorder {
  const entries: AgentActivityEntry[] = [];
  const subscribers = new Set<(entry: AgentActivityEntry) => void>();
  const MAX_ENTRIES = 10000;

  return {
    record(entry) {
      const fullEntry: AgentActivityEntry = {
        ...entry,
        id: `act_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`,
        timestamp: new Date().toISOString(),
      };

      entries.push(fullEntry);

      // Trim if over limit
      if (entries.length > MAX_ENTRIES) {
        entries.splice(0, entries.length - MAX_ENTRIES);
      }

      // Notify subscribers
      for (const cb of subscribers) {
        try {
          cb(fullEntry);
        } catch {
          // Ignore callback errors
        }
      }

      return fullEntry;
    },

    getEntries(filter) {
      let filtered = entries;

      if (filter) {
        if (filter.toolName) {
          filtered = filtered.filter(e => e.toolName === filter.toolName);
        }
        if (filter.status) {
          filtered = filtered.filter(e => e.status === filter.status);
        }
        if (filter.actorId) {
          filtered = filtered.filter(e => e.actorId === filter.actorId);
        }
        if (filter.since) {
          const sinceTime = new Date(filter.since).getTime();
          filtered = filtered.filter(e => new Date(e.timestamp).getTime() >= sinceTime);
        }
        if (filter.limit) {
          filtered = filtered.slice(-filter.limit);
        }
      }

      return filtered;
    },

    clear() {
      entries.length = 0;
    },

    subscribe(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
  };
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const activityRecorder = createActivityRecorder();

// ============================================================================
// Activity Stream for WebMCP
// ============================================================================

export function createActivityStream(projectId: string, recorder: ReturnType<typeof createActivityRecorder>) {
  return {
    getRecent(limit = 100) {
      return recorder.getEntries({ limit });
    },

    getByTool(toolName: string, limit = 50) {
      return recorder.getEntries({ toolName, limit });
    },

    getErrors(limit = 50) {
      return recorder.getEntries({ status: 'error', limit });
    },

    getForActor(actorId: string, limit = 100) {
      return recorder.getEntries({ actorId, limit });
    },

    export() {
      return {
        projectId,
        entries: recorder.getEntries(),
        exportedAt: new Date().toISOString(),
      };
    },
  };
}