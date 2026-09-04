// ============================================================================
// Layout Component
// ============================================================================

import React from 'react';
import { useStore, selectSidebarOpen, selectSidebarWidth, selectCurrentView } from '../../state';

export function Layout({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useStore(selectSidebarOpen);
  const sidebarWidth = useStore(selectSidebarWidth);
  const currentView = useStore(selectCurrentView);

  return (
    <div className="app-layout" data-view={currentView}>
      <aside
        className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}
        style={{ width: sidebarOpen ? sidebarWidth : 0 }}
        role="complementary"
        aria-label="Sidebar"
      >
        <div className="sidebar-header">
          <h2>Vistect</h2>
          <button
            className="sidebar-toggle"
            onClick={() => useStore.getState().toggleSidebar()}
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <ul>
            <li>
              <button
                className={currentView === 'navigator' ? 'active' : ''}
                onClick={() => useStore.getState().setCurrentView('navigator')}
              >
                <span aria-hidden="true">📋</span> Navigator
                <kbd>Alt+N</kbd>
              </button>
            </li>
            <li>
              <button
                className={currentView === 'explorer' ? 'active' : ''}
                onClick={() => useStore.getState().setCurrentView('explorer')}
              >
                <span aria-hidden="true">🔍</span> Explorer
                <kbd>Alt+O</kbd>
              </button>
            </li>
            <li>
              <button
                className={currentView === 'intent' ? 'active' : ''}
                onClick={() => useStore.getState().setCurrentView('intent')}
              >
                <span aria-hidden="true">📝</span> Intent Contract
              </button>
            </li>
            <li>
              <button
                className={currentView === 'decisions' ? 'active' : ''}
                onClick={() => useStore.getState().setCurrentView('decisions')}
              >
                <span aria-hidden="true">✅</span> Decisions
                <kbd>Alt+U</kbd>
              </button>
            </li>
            <li>
              <button
                className={currentView === 'warnings' ? 'active' : ''}
                onClick={() => useStore.getState().setCurrentView('warnings')}
              >
                <span aria-hidden="true">⚠️</span> Warnings
                <kbd>Alt+W</kbd>
              </button>
            </li>
            <li>
              <button
                className={currentView === 'activity' ? 'active' : ''}
                onClick={() => useStore.getState().setCurrentView('activity')}
              >
                <span aria-hidden="true">📊</span> Activity
                <kbd>Alt+A</kbd>
              </button>
            </li>
            <li>
              <button
                className={currentView === 'privacy' ? 'active' : ''}
                onClick={() => useStore.getState().setCurrentView('privacy')}
              >
                <span aria-hidden="true">🔒</span> Privacy
                <kbd>Alt+P</kbd>
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      <div className="main-content" role="main">
        {children}
      </div>
    </div>
  );
}