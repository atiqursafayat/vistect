// ============================================================================
// Context Providers
// ============================================================================
//
// Three providers, in dependency order:
//
//   ServicesProvider   — command bus, storage, actor registry
//   AnnouncementProvider — live-region announcements (§21.3)
//   WebMCPProvider     — tool registry, scoped to the open project
//
// WebMCP is strictly optional: when the capability is absent, the app is fully
// operable through the UI (FR-127, AC F-6.x §4).


import type { CommandBus } from '@vistect/domain/bus';
import type { Actor, DocumentProject } from '@vistect/domain/schema';
import { toolDefinitions } from '@vistect/domain/toolSchemas';
import {
  activityRecorder,
  capabilityProbe,
  createToolRegistry,
  type ToolRegistry,
} from '@vistect/webmcp';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  createAppServices,
  createLocalActor,
  type AppServices,
} from '../services/appServices';
import { useStore } from '../state';

// ============================================================================
// Services
// ============================================================================

interface ServicesContextValue {
  services: AppServices | null;
  commandBus: CommandBus | null;
  project: DocumentProject | null;
  actor: Actor;
  setProject: (project: DocumentProject | null) => void;
  isLoading: boolean;
  /** Non-null when service construction failed; surfaced rather than swallowed. */
  error: Error | null;
}

const ServicesContext = createContext<ServicesContextValue | null>(null);

export function ServicesProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<AppServices | null>(null);
  const [project, setProjectState] = useState<DocumentProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Created once and held in a ref: regenerating the actor id on re-render would
  // orphan every approval attributed to the previous one.
  const actorRef = useRef<Actor>(createLocalActor());

  useEffect(() => {
    let cancelled = false;

    createAppServices({ actor: actorRef.current })
      .then((created) => {
        if (cancelled) return;
        setServices(created);
        setIsLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        // Storage unavailable (private mode, quota denied) is a real state the
        // user must see, not a silent degradation to an unusable app.
        setError(cause instanceof Error ? cause : new Error('Failed to initialise storage'));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Mirror the services' project into React state so components re-render on
  // every successful command.
  useEffect(() => {
    if (services === null) return;
    return services.subscribe(setProjectState);
  }, [services]);

  const setProject = useCallback(
    (next: DocumentProject | null) => {
      if (services === null) {
        setProjectState(next);
        return;
      }
      if (next === null) {
        services.closeProject();
      } else {
        void services.openProject(next);
      }
    },
    [services]
  );

  const value = useMemo<ServicesContextValue>(
    () => ({
      services,
      commandBus: services?.commandBus ?? null,
      project,
      actor: actorRef.current,
      setProject,
      isLoading,
      error,
    }),
    [services, project, setProject, isLoading, error]
  );

  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

function useServicesContext(): ServicesContextValue {
  const context = useContext(ServicesContext);
  if (context === null) {
    throw new Error('Provider hooks must be used within <Providers>');
  }
  return context;
}

export function useProject(): ServicesContextValue {
  return useServicesContext();
}

export function useCommandBus(): CommandBus | null {
  return useServicesContext().commandBus;
}

// ============================================================================
// Announcements
// ============================================================================

interface AnnouncementContextValue {
  announce: (message: string, politeness?: 'polite' | 'assertive') => void;
}

const AnnouncementContext = createContext<AnnouncementContextValue | null>(null);

/**
 * Delay between clearing and setting live-region text.
 *
 * Screen readers ignore a re-set of identical text; clearing first forces a
 * re-announcement. 100ms is long enough for the change to be observed and short
 * enough not to feel detached from the action.
 */
const LIVE_REGION_RESET_MS = 100;

export function AnnouncementProvider({ children }: { children: ReactNode }) {
  const recordAnnouncement = useStore((state) => state.announce);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(
    () => () => {
      // Clear pending timers on unmount so no callback writes to a detached node.
      for (const timer of timers.current) clearTimeout(timer);
      timers.current.clear();
    },
    []
  );

  const announce = useCallback(
    (message: string, politeness: 'polite' | 'assertive' = 'polite') => {
      // Recorded in the store as well as the DOM, so the activity log retains
      // what was announced even if the region was not mounted.
      recordAnnouncement(message, politeness);

      const region = document.getElementById(
        politeness === 'assertive' ? 'live-assertive' : 'live-polite'
      );
      if (region === null) return;

      region.textContent = '';
      const timer = setTimeout(() => {
        region.textContent = message;
        timers.current.delete(timer);
      }, LIVE_REGION_RESET_MS);
      timers.current.add(timer);
    },
    [recordAnnouncement]
  );

  const value = useMemo(() => ({ announce }), [announce]);

  return <AnnouncementContext.Provider value={value}>{children}</AnnouncementContext.Provider>;
}

export function useAnnouncements(): AnnouncementContextValue {
  const context = useContext(AnnouncementContext);
  if (context === null) {
    throw new Error('useAnnouncements must be used within <AnnouncementProvider>');
  }
  return context;
}

// ============================================================================
// WebMCP
// ============================================================================

interface WebMCPContextValue {
  isAvailable: boolean;
  registry: ToolRegistry | null;
  registerTools: () => void;
  unregisterTools: () => void;
}

const WebMCPContext = createContext<WebMCPContextValue | null>(null);

export function WebMCPProvider({ children }: { children: ReactNode }) {
  const { project, commandBus } = useServicesContext();
  const [isAvailable, setIsAvailable] = useState(false);
  const registryRef = useRef<ToolRegistry | null>(null);

  useEffect(() => {
    // `onChange` emits current state immediately, so no separate initial check.
    return capabilityProbe.onChange((capability) => {
      setIsAvailable(capability.available);
    });
  }, []);

  // The registry is built once per command bus, not per project: rebuilding it on
  // every project change would re-run the ~70 registrations for no benefit, and
  // project scoping is handled by `setProjectContext`.
  useEffect(() => {
    if (commandBus === null || !isAvailable) return;

    const registry = createToolRegistry({
      commandBus,
      onExecution: (entry) => {
        activityRecorder.record({
          toolName: entry.toolName,
          input: entry.input,
          result: entry.result,
          status: entry.result.ok ? 'success' : 'error',
          versionBefore: entry.versionBefore,
          versionAfter: entry.versionAfter,
          durationMs: entry.durationMs,
          actorId: project?.actorId ?? ('act_unknown' as Actor['id']),
        });
      },
    });

    for (const definition of toolDefinitions) {
      registry.registerTool(definition);
    }

    registryRef.current = registry;

    return () => {
      registry.unregisterAll();
      registryRef.current = null;
    };
  }, [commandBus, isAvailable, project?.actorId]);

  // Tools are exposed only while a project is open.
  useEffect(() => {
    const registry = registryRef.current;
    if (registry === null || commandBus === null) return;

    if (project === null) {
      registry.clearProjectContext();
    } else {
      registry.setProjectContext(project, commandBus);
    }
  }, [project, commandBus]);

  const registerTools = useCallback(() => {
    if (registryRef.current !== null && project !== null && commandBus !== null) {
      registryRef.current.setProjectContext(project, commandBus);
    }
  }, [project, commandBus]);

  const unregisterTools = useCallback(() => {
    registryRef.current?.clearProjectContext();
  }, []);

  const value = useMemo<WebMCPContextValue>(
    () => ({ isAvailable, registry: registryRef.current, registerTools, unregisterTools }),
    [isAvailable, registerTools, unregisterTools]
  );

  return <WebMCPContext.Provider value={value}>{children}</WebMCPContext.Provider>;
}

export function useWebMCP(): WebMCPContextValue {
  const context = useContext(WebMCPContext);
  if (context === null) {
    throw new Error('useWebMCP must be used within <WebMCPProvider>');
  }
  return context;
}

// ============================================================================
// Composition
// ============================================================================

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ServicesProvider>
      <AnnouncementProvider>
        <WebMCPProvider>{children}</WebMCPProvider>
      </AnnouncementProvider>
    </ServicesProvider>
  );
}
