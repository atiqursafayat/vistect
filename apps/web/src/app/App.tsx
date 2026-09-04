// ============================================================================
// Main App Component
// ============================================================================

import { useEffect } from 'react';

import { ActivityStream } from '../features/activity/ActivityStream';
import { DecisionQueue } from '../features/decisions/DecisionQueue';
import { Editor } from '../features/editor/Editor';
import { Explorer } from '../features/explorer/Explorer';
import { IntentEditor } from '../features/intent/IntentEditor';
import { Navigator } from '../features/navigator/Navigator';
import { PrivacyCenter } from '../features/privacy/PrivacyCenter';
import { WarningQueue } from '../features/validation/WarningQueue';
import { useStore, type ViewMode } from '../state';
import { Layout } from '../ui/Layout';
import { ShortcutHelp } from '../ui/ShortcutHelp';
import { Welcome } from '../ui/Welcome';

import { useAnnouncements, useProject, useWebMCP } from './Providers';

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

/**
 * Alt-key view shortcuts (§21.2).
 *
 * Alt rather than Ctrl: Ctrl combinations collide with screen reader command
 * layers, which would make the shortcut unreachable for the primary audience.
 */
const VIEW_SHORTCUTS: Readonly<Record<string, { view: ViewMode; label: string }>> = {
  u: { view: 'decisions', label: 'Decision queue' },
  w: { view: 'warnings', label: 'Warning queue' },
  a: { view: 'activity', label: 'Activity stream' },
  n: { view: 'navigator', label: 'Navigator' },
  o: { view: 'explorer', label: 'Object explorer' },
  p: { view: 'privacy', label: 'Privacy centre' },
};

export function App() {
  const { project, isLoading } = useProject();
  const { announce } = useAnnouncements();
  const { isAvailable, registerTools, unregisterTools } = useWebMCP();
  const currentView = useStore((state) => state.currentView);
  const setCurrentView = useStore((state) => state.setCurrentView);

  // Register WebMCP tools when project changes
  useEffect(() => {
    if (project) {
      registerTools();
      announce(`Project "${project.title}" loaded`, 'polite');
    } else {
      unregisterTools();
    }
  }, [project, registerTools, unregisterTools, announce]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const ctrl = e.ctrlKey || e.metaKey;

      if (e.altKey && !ctrl) {
        const shortcut = VIEW_SHORTCUTS[e.key.toLowerCase()];
        if (shortcut !== undefined) {
          e.preventDefault();
          setCurrentView(shortcut.view);
          announce(`${shortcut.label} opened`);
        }
        return;
      }

      if (e.key === '?' && !ctrl) {
        e.preventDefault();
        setCurrentView('shortcuts');
      } else if (e.key === 'Escape') {
        setCurrentView('editor');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); };
  }, [setCurrentView, announce]);

  // Announce WebMCP status
  useEffect(() => {
    if (isAvailable) {
      announce('WebMCP agent capability detected', 'polite');
    }
  }, [isAvailable, announce]);

  if (isLoading) {
    return (
      <Layout>
        <output className="loading-screen" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <p>Loading Vistect…</p>
        </output>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Live regions */}
      <output id="live-polite" aria-live="polite" aria-atomic="true" className="sr-only" />
      <div id="live-assertive" role="alert" aria-live="assertive" aria-atomic="true" className="sr-only" />

      {/* Persistent navigator, always available for keyboard traversal */}
      <Navigator id="navigator" />

      <main id="main-content">
        {currentView === 'welcome' && <Welcome />}
        {currentView === 'navigator' && <Navigator id="navigator-main" />}
        {currentView === 'explorer' && <Explorer id="explorer" />}
        {currentView === 'intent' && <IntentEditor />}
        {currentView === 'editor' && <Editor id="editor" />}
        {currentView === 'decisions' && <DecisionQueue id="decisions" />}
        {currentView === 'warnings' && <WarningQueue id="warnings" />}
        {currentView === 'activity' && <ActivityStream id="activity" />}
        {currentView === 'privacy' && <PrivacyCenter id="privacy" />}
        <ShortcutHelp
          isOpen={currentView === 'shortcuts'}
          onClose={() => {
            setCurrentView('editor');
          }}
        />
      </main>

      <footer className="status-bar">
        <div className="status-item">
          <span className={project ? 'connected' : 'disconnected'} aria-hidden="true" />
          <span>{project ? `Project: ${project.title}` : 'No project open'}</span>
        </div>
        <div className="status-item">
          <span className={isAvailable ? 'connected' : 'disconnected'} aria-hidden="true" />
          <span>WebMCP: {isAvailable ? 'Connected' : 'Unavailable'}</span>
        </div>
        <div className="status-item">
          <kbd>Alt+U</kbd> Decisions
          <kbd>Alt+W</kbd> Warnings
          <kbd>Alt+A</kbd> Activity
          <kbd>Alt+N</kbd> Navigator
          <kbd>Alt+O</kbd> Explorer
        </div>
      </footer>
    </Layout>
  );
}