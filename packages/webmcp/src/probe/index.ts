// ============================================================================
// WebMCP Capability Probe
// ============================================================================
//
// WebMCP is a Chrome origin-trial API, so it is absent for most users. The probe
// reports what is available so the UI can degrade gracefully: agent affordances
// hide, and manual controls provide full parity (FR-127, AC F-6.x §4).
//
// It is a *probe*, not a gate: nothing in the app may require WebMCP to function.

import { getModelContext, type ModelContext } from '../types';

export interface WebMCPCapability {
  available: boolean;
  version?: string | undefined;
  api: {
    registerTool: boolean;
    getTools: boolean;
    executeTool: boolean;
    toolChangeEvents: boolean;
  };
  /**
   * Declarative form/field annotation support.
   *
   * Reported as unknown-but-assumed when the imperative API exists: the
   * declarative half has no feature test, and the browser ignores unknown
   * attributes harmlessly.
   */
  declarative: {
    assumedSupported: boolean;
  };
}

export interface CapabilityProbe {
  check(): WebMCPCapability;
  /** Subscribes to capability changes. Fires immediately with current state. */
  onChange(callback: (capability: WebMCPCapability) => void): () => void;
}

const UNAVAILABLE: WebMCPCapability = {
  available: false,
  api: {
    registerTool: false,
    getTools: false,
    executeTool: false,
    toolChangeEvents: false,
  },
  declarative: { assumedSupported: false },
};

/** Poll interval. The API emits no capability-change event, so polling is required. */
const POLL_INTERVAL_MS = 5_000;

function detect(modelContext: ModelContext | undefined): WebMCPCapability {
  if (modelContext === undefined) return UNAVAILABLE;

  // `registerTool` is the load-bearing method: without it the API is present but
  // useless, so `available` tracks it rather than mere object existence.
  const canRegister = typeof modelContext.registerTool === 'function';

  return {
    available: canRegister,
    version: modelContext.version,
    api: {
      registerTool: canRegister,
      getTools: typeof modelContext.getTools === 'function',
      executeTool: typeof modelContext.executeTool === 'function',
      toolChangeEvents: typeof modelContext.addEventListener === 'function',
    },
    declarative: { assumedSupported: canRegister },
  };
}

/**
 * Creates a probe.
 *
 * State is per-instance, not module-level: a module-level cache shared between
 * instances meant one probe's `check()` could suppress another's change
 * notification.
 */
export function createCapabilityProbe(): CapabilityProbe {
  let current: WebMCPCapability = detect(getModelContext());
  const subscribers = new Set<(capability: WebMCPCapability) => void>();
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let listeningTo: ModelContext | null = null;

  const notify = (capability: WebMCPCapability): void => {
    for (const callback of subscribers) {
      try {
        callback(capability);
      } catch {
        // One subscriber's failure must not stop the others.
      }
    }
  };

  const poll = (): void => {
    const next = detect(getModelContext());
    // Structural comparison: the object is recreated on each detect, so identity
    // comparison would report a change every tick.
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      current = next;
      notify(next);
    }
  };

  const startWatching = (): void => {
    if (pollTimer !== null) return;

    pollTimer = setInterval(poll, POLL_INTERVAL_MS);

    const modelContext = getModelContext();
    if (modelContext?.addEventListener !== undefined) {
      modelContext.addEventListener('toolchange', poll);
      listeningTo = modelContext;
    }
  };

  const stopWatching = (): void => {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    // Removal targets the object the listener was added to; re-reading
    // `navigator.modelContext` could return a different object and leak.
    listeningTo?.removeEventListener?.('toolchange', poll);
    listeningTo = null;
  };

  return {
    check() {
      current = detect(getModelContext());
      return current;
    },

    onChange(callback) {
      subscribers.add(callback);
      startWatching();

      // Immediate emission: a subscriber that waits a full poll interval for its
      // first value cannot render correct initial state.
      callback(current);

      return () => {
        subscribers.delete(callback);
        if (subscribers.size === 0) stopWatching();
      };
    },
  };
}

/** Shared probe. One per tab is sufficient. */
export const capabilityProbe = createCapabilityProbe();
