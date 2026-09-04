// ============================================================================
// Main App Component
// ============================================================================

import React, { useEffect, useCallback } from 'react';
import { useProject } from './Providers';
import { useAnnouncements } from './Providers';
import { useWebMCP } from './Providers';
import { Navigator } from '../features/navigator/Navigator';
import { Explorer } from '../features/explorer/Explorer';
import { IntentEditor } from '../features/intent/IntentEditor';
import { Editor } from '../features/editor/Editor';
import { ActivityStream } from '../features/activity/ActivityStream';
import { DecisionQueue } from '../features/decisions/DecisionQueue';
import { WarningQueue } from '../features/validation/WarningQueue';
import { PrivacyCenter } from '../features/privacy/PrivacyCenter';
import { ShortcutHelp } from '../ui/ShortcutHelp';
import { Layout } from '../ui/Layout';
import { useStore } from '../state';
import { createHumanActor } from '@vistect/domain/schema';

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

const SHORTCUTS = {
  'Alt+U': 'Open decision queue',
  'Alt+W': 'Open warning queue',
  'Alt+A': 'Open activity stream',
  'Alt+N': 'Open navigator',
  'Alt+O': 'Open object explorer',
  'Alt+P': 'Open privacy center',
  'Escape': 'Close dialog / cancel',
  '?': 'Show shortcut help',
} as const;

export function App() {
  const { project, setProject, isLoading } = useProject();
  const { announce } = useAnnouncements();
  const { isAvailable, registerTools, unregisterTools } = useWebMCP();
  const { currentView, setCurrentView, openProject } = useStore();

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

      const key = e.key;
      const alt = e.altKey;
      const ctrl = e.ctrlKey || e.metaKey;

      if (alt && key === 'u') {
        e.preventDefault();
        setCurrentView('decisions');
        announce('Decision queue opened');
      } else if (alt && key === 'w') {
        e.preventDefault();
        setCurrentView('warnings');
        announce('Warning queue opened');
      } else if (alt && key === 'a') {
        e.preventDefault();
        setCurrentView('activity');
        announce('Activity stream opened');
      } else if (alt && key === 'n') {
        e.preventDefault();
        setCurrentView('navigator');
        announce('Navigator opened');
      } else if (alt && key === 'o') {
        e.preventDefault();
        setCurrentView('explorer');
        announce('Object explorer opened');
      } else if (alt && key === 'p') {
        e.preventDefault();
        setCurrentView('privacy');
        announce('Privacy center opened');
      } else if (key === '?' && !alt && !ctrl) {
        e.preventDefault();
        setCurrentView('shortcuts');
      } else if (key === 'Escape') {
        setCurrentView('editor');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
        <div className="loading-screen" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <p>Loading Vistect...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Skip links */}
      <nav className="skip-links" aria-label="Skip links">
        <a href="#navigator" className="skip-link">Skip to navigator</a>
        <a href="#explorer" className="skip-link">Skip to object explorer</a>
        <a href="#editor" className="skip-link">Skip to editor</a>
        <a href="#decisions" className="skip-link">Skip to decisions</a>
        <a href="#warnings" className="skip-link">Skip to warnings</a>
      </nav>

      {/* Live regions */}
      <div id="live-polite" role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
      <div id="live-assertive" role="alert" aria-live="assertive" aria-atomic="true" className="sr-only" />

      {/* Main navigation */}
      <Navigator id="navigator" />

      {/* Main content area */}
      <main id="main-content" role="main">
        {currentView === 'navigator' && <Navigator />}
        {currentView === 'explorer' && <Explorer id="explorer" />}
        {currentView === 'intent' && <IntentEditor />}
        {currentView === 'editor' && <Editor id="editor" />}
        {currentView === 'decisions' && <DecisionQueue id="decisions" />}
        {currentView === 'warnings' && <WarningQueue id="warnings" />}
        {currentView === 'activity' && <ActivityStream id="activity" />}
        {currentView === 'privacy' && <PrivacyCenter id="privacy" />}
        {currentView === 'shortcuts' && <ShortcutHelp />}
      </main>

      {/* Status bar */}
      <footer className="status-bar" role="contentinfo">
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