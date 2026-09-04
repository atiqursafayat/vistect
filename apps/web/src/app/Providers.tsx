// ============================================================================
// Context Providers
// ============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '../state';
import { eventStore } from '@vistect/storage/eventStore';
import { capabilityProbe } from '@vistect/webmcp/probe';
import { activityRecorder } from '@vistect/webmcp/activity';
import { createToolRegistry } from '@vistect/webmcp/registry';
import { createSchemaCompiler } from '@vistect/webmcp/compiler';
import { createRateLimiter, createExecutionGate, defaultShowConfirmation } from '@vistect/webmcp/gate';
import { toolDefinitions } from '@vistect/domain/toolSchemas';
import { CommandBus } from '@vistect/domain/bus';
import type { DocumentProject, Actor, Command } from '@vistect/domain/schema';

// ============================================================================
// Types
// ============================================================================

interface ProjectContextValue {
  project: DocumentProject | null;
  actor: Actor;
  setProject: (project: DocumentProject | null) => void;
  isLoading: boolean;
}

interface WebMCPContextValue {
  isAvailable: boolean;
  registerTools: () => void;
  unregisterTools: () => void;
}

interface AnnouncementContextValue {
  announce: (message: string, politeness?: 'polite' | 'assertive') => void;
}

// ============================================================================
// Project Provider
// ============================================================================

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [project, setProject] = useState<DocumentProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const actor: Actor = {
    id: 'act_user' as any,
    kind: 'human',
    label: 'You',
  };

  // Load last project from storage on mount
  useEffect(() => {
    const loadProject = async () => {
      try {
        // In real implementation, load from IndexedDB
        setIsLoading(false);
      } catch {
        setIsLoading(false);
      }
    };
    loadProject();
  }, []);

  const value = useMemo(() => ({ project, actor, setProject, isLoading }), [project, isLoading]);

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within ProjectProvider');
  return context;
}

// ============================================================================
// WebMCP Provider
// ============================================================================

const WebMCPContext = createContext<WebMCPContextValue | null>(null);

export function WebMCPProvider({ children }: { children: React.ReactNode }) {
  const { project, actor } = useProject();
  const [isAvailable, setIsAvailable] = useState(false);
  const [registry, setRegistry] = useState<any>(null);
  const [commandBus, setCommandBus] = useState<CommandBus | null>(null);

  // Probe WebMCP capability
  useEffect(() => {
    const checkCapability = () => {
      const capability = capabilityProbe.check();
      setIsAvailable(capability.available);
    };

    checkCapability();
    const unsubscribe = capabilityProbe.onChange(checkCapability);
    return unsubscribe;
  }, []);

  // Initialize registry when project and capability available
  useEffect(() => {
    if (!project || !isAvailable) return;

    const compiler = createSchemaCompiler();
    const rateLimiter = createRateLimiter();
    const executionGate = createExecutionGate({
      rateLimiter,
      requireUserInteraction: (name: string) => name.startsWith('lock_') || name.startsWith('finalize_') || name.startsWith('delete_') || name.startsWith('approve_'),
      showConfirmation: defaultShowConfirmation,
    });

    const newRegistry = createToolRegistry({
      commandBus: commandBus!,
      project,
    });

    // Register all tools
    for (const toolDef of toolDefinitions) {
      newRegistry.registerTool(toolDef);
    }

    setRegistry(newRegistry);
    setCommandBus(new CommandBus());

    return () => {
      newRegistry.unregisterAll();
    };
  }, [project, isAvailable, commandBus]);

  // Initialize command bus
  useEffect(() => {
    if (!project) return;
    setCommandBus(new CommandBus());
  }, [project]);

  const registerTools = useCallback(() => {
    if (registry && project) {
      registry.setProjectContext(project, commandBus!);
    }
  }, [registry, project, commandBus]);

  const unregisterTools = useCallback(() => {
    if (registry) {
      registry.clearProjectContext();
    }
  }, [registry]);

  const value = useMemo(() => ({ isAvailable, registerTools, unregisterTools }), [isAvailable, registerTools, unregisterTools]);

  return <WebMCPContext.Provider value={value}>{children}</WebMCPContext.Provider>;
}

export function useWebMCP() {
  const context = useContext(WebMCPContext);
  if (!context) throw new Error('useWebMCP must be used within WebMCPProvider');
  return context;
}

// ============================================================================
// Announcement Provider
// ============================================================================

const AnnouncementContext = createContext<AnnouncementContextValue | null>(null);

export function AnnouncementProvider({ children }: { children: React.ReactNode }) {
  const announce = useCallback((message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    const regionId = politeness === 'assertive' ? 'live-assertive' : 'live-polite';
    const region = document.getElementById(regionId);
    if (region) {
      region.textContent = '';
      // Force re-read
      setTimeout(() => {
        region.textContent = message;
      }, 50);
    }
  }, []);

  const value = useMemo(() => ({ announce }), [announce]);

  return <AnnouncementContext.Provider value={value}>{children}</AnnouncementContext.Provider>;
}

export function useAnnouncements() {
  const context = useContext(AnnouncementContext);
  if (!context) throw new Error('useAnnouncements must be used within AnnouncementProvider');
  return context;
}

// ============================================================================
// Combined Providers
// ============================================================================

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ProjectProvider>
      <AnnouncementProvider>
        <WebMCPProvider>
          {children}
        </WebMCPProvider>
      </AnnouncementProvider>
    </ProjectProvider>
  );
}