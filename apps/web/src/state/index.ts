// ============================================================================
// Zustand Store - View/Projection State
// ============================================================================

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { DocumentProject, Actor } from '@vistect/domain/schema';

export type ViewMode =
  | 'welcome'
  | 'navigator'
  | 'explorer'
  | 'intent'
  | 'editor'
  | 'decisions'
  | 'warnings'
  | 'activity'
  | 'privacy'
  | 'shortcuts'
  | 'import';

interface EditorState {
  selectedObjectId: string | null;
  selectedPageId: string | null;
  editingText: boolean;
  dragState: 'idle' | 'dragging' | 'resizing' | null;
}

interface UIState {
  currentView: ViewMode;
  sidebarOpen: boolean;
  sidebarWidth: number;
  panelHeights: Record<string, number>;
  zoomLevel: number;
  reducedMotion: boolean;
  highContrast: boolean;
}

interface ProjectState {
  project: DocumentProject | null;
  actor: Actor;
  recentProjects: Array<{ id: string; title: string; updatedAt: string }>;
}

interface NotificationState {
  announcements: Array<{ id: string; message: string; politeness: 'polite' | 'assertive'; timestamp: number }>;
}

interface AppState extends EditorState, UIState, ProjectState, NotificationState {
  // Actions
  setCurrentView: (view: ViewMode) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setPanelHeight: (panel: string, height: number) => void;
  setZoomLevel: (zoom: number) => void;
  setReducedMotion: (enabled: boolean) => void;
  setHighContrast: (enabled: boolean) => void;
  openProject: (project: DocumentProject) => void;
  closeProject: () => void;
  addRecentProject: (project: { id: string; title: string; updatedAt: string }) => void;
  setSelectedObject: (objectId: string | null, pageId: string | null) => void;
  setEditingText: (editing: boolean) => void;
  setDragState: (state: 'idle' | 'dragging' | 'resizing') => void;
  announce: (message: string, politeness?: 'polite' | 'assertive') => void;
  clearAnnouncements: () => void;
}

const DEFAULT_SIDEBAR_WIDTH = 280;
const MAX_RECENT_PROJECTS = 10;

export const useStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    currentView: 'welcome',
    sidebarOpen: true,
    sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    panelHeights: {},
    zoomLevel: 1,
    reducedMotion: false,
    highContrast: false,
    project: null,
    actor: { id: 'act_user' as any, kind: 'human', label: 'You' },
    recentProjects: [],
    selectedObjectId: null,
    selectedPageId: null,
    editingText: false,
    dragState: 'idle',
    announcements: [],

    // Actions
    setCurrentView: (view) => set({ currentView: view }),
    toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarWidth: (width) => set({ sidebarWidth: Math.max(200, Math.min(500, width)) }),
    setPanelHeight: (panel, height) => set(state => ({
      panelHeights: { ...state.panelHeights, [panel]: height },
    })),
    setZoomLevel: (zoom) => set({ zoomLevel: Math.max(0.5, Math.min(3, zoom)) }),
    setReducedMotion: (enabled) => {
      document.body.classList.toggle('reduced-motion', enabled);
      set({ reducedMotion: enabled });
    },
    setHighContrast: (enabled) => {
      document.body.classList.toggle('high-contrast', enabled);
      set({ highContrast: enabled });
    },
    openProject: (project) => set({ project, currentView: 'editor' }),
    closeProject: () => set({ project: null, currentView: 'welcome', selectedObjectId: null, selectedPageId: null }),
    addRecentProject: (project) => set(state => {
      const filtered = state.recentProjects.filter(p => p.id !== project.id);
      return { recentProjects: [project, ...filtered].slice(0, MAX_RECENT_PROJECTS) };
    }),
    setSelectedObject: (objectId, pageId) => set({ selectedObjectId: objectId, selectedPageId: pageId }),
    setEditingText: (editing) => set({ editingText: editing }),
    setDragState: (dragState) => set({ dragState }),
    announce: (message, politeness = 'polite') => set(state => ({
      announcements: [
        ...state.announcements.slice(-99),
        { id: `ann_${Date.now()}`, message, politeness, timestamp: Date.now() },
      ],
    })),
    clearAnnouncements: () => set({ announcements: [] }),
  }))
);

// ============================================================================
// Selectors
// ============================================================================

export const selectCurrentView = (state: AppState) => state.currentView;
export const selectProject = (state: AppState) => state.project;
export const selectActor = (state: AppState) => state.actor;
export const selectSidebarOpen = (state: AppState) => state.sidebarOpen;
export const selectZoomLevel = (state: AppState) => state.zoomLevel;
export const selectReducedMotion = (state: AppState) => state.reducedMotion;
export const selectHighContrast = (state: AppState) => state.highContrast;
export const selectSelectedObject = (state: AppState) => state.selectedObjectId;
export const selectEditingText = (state: AppState) => state.editingText;
export const selectAnnouncements = (state: AppState) => state.announcements;

// ============================================================================
// Derived State (for projections)
// ============================================================================

export function useProjectData<T>(selector: (project: DocumentProject | null) => T): T {
  const project = useStore(selectProject);
  return selector(project);
}

export function useProjectPages() {
  return useProjectData(project => project ? Object.values(project.pages) : []);
}

export function useProjectObjects() {
  return useProjectData(project => project ? Object.values(project.objects) : []);
}

export function useProjectDecisions() {
  return useProjectData(project => project ? Object.values(project.decisions) : []);
}

export function useProjectFindings() {
  return useProjectData(project => project ? Object.values(project.findings) : []);
}

export function useProjectAssets() {
  return useProjectData(project => project ? Object.values(project.assets) : []);
}

export function usePageOrder() {
  return useProjectData(project => project ? project.pageOrder : []);
}

export function useProjectDecisionsByStatus(status: string) {
  return useProjectData(project => project
    ? Object.values(project.decisions).filter(d => d.status === status)
    : []);
}

export function useUnapprovedDecisionCount() {
  return useProjectData(project => project
    ? Object.values(project.decisions).filter(d => d.status !== 'approved' && d.status !== 'rejected').length
    : 0);
}

export function useOpenBlockingFindings() {
  return useProjectData(project => project
    ? Object.values(project.findings).filter(f => f.severity === 'blocking' && f.status === 'open')
    : []);
}