// ============================================================================
// Agent Activity Stream
// ============================================================================

import React, { useMemo } from 'react';
import { useProject } from '../../state';
import { activityRecorder } from '@vistect/webmcp/activity';
import type { AgentActivityEntry } from '@vistect/webmcp/activity';
import { useAnnouncements } from '../../app/Providers';

const TOOL_ICONS: Record<string, string> = {
  create: '➕',
  update: '✏️',
  delete: '🗑️',
  move: '📦',
  place: '📍',
  upload: '📤',
  inspect: '🔍',
  analyze: '🧠',
  compare: '⚖️',
  crop: '✂️',
  approve: '✅',
  reject: '❌',
  lock: '🔒',
  unlock: '🔓',
  finalize: '📦',
  get: '📥',
  list: '📋',
  recommend: '💡',
  validate: '✓',
  resolve: '✓',
  accept: '✓',
  dismiss: '👁️',
  import: '📥',
  narrate: '📖',
  navigate: '🧭',
  identify: '🔍',
};

const STATUS_COLORS = {
  success: '#40c057',
  error: '#fa5252',
};

export function ActivityStream({ id }: { id: string }) {
  const { project } = useProject();
  const { announce } = useAnnouncements();

  // Get entries from recorder
  const entries = useMemo(() => activityRecorder.getEntries({ limit: 100 }), []);
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');

  const filteredEntries = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter(e => e.status === filter);
  }, [entries, filter]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getToolIcon = (toolName: string) => {
    const prefix = toolName.split('_')[0];
    return TOOL_ICONS[prefix] || '⚙️';
  };

  const formatTimestamp = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (!project) {
    return (
      <section id={id} className="activity-stream" aria-label="Agent activity stream">
        <div className="empty-state">
          <h2>No project open</h2>
          <p>Activity stream will appear here when a project is open</p>
        </div>
      </section>
    );
  }

  return (
    <section id={id} className="activity-stream" aria-label="Agent activity stream" role="log" aria-live="polite">
      <header className="stream-header">
        <h2>Agent Activity Stream</h2>
        <div className="stream-filters">
          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
            aria-pressed={filter === 'all'}
          >
            All ({entries.length})
          </button>
          <button
            className={filter === 'success' ? 'active' : ''}
            onClick={() => setFilter('success')}
            aria-pressed={filter === 'success'}
          >
            ✓ Success ({entries.filter(e => e.status === 'success').length})
          </button>
          <button
            className={filter === 'error' ? 'active' : ''}
            onClick={() => setFilter('error')}
            aria-pressed={filter === 'error'}
          >
            ✗ Errors ({entries.filter(e => e.status === 'error').length})
          </button>
        </div>
      </header>

      <div className="stream-entries" role="list">
        {filteredEntries.length === 0 ? (
          <div className="empty-state">
            <p>No activity entries</p>
          </div>
        ) : (
          <ul role="list" aria-label="Activity entries">
            {filteredEntries.map(entry => (
              <li key={entry.id} role="listitem" className={`stream-entry ${entry.status}`}>
                <div className="entry-header">
                  <span className="entry-time">{formatTimestamp(entry.timestamp)}</span>
                  <span className="entry-tool" style={{ color: STATUS_COLORS[entry.status] }}>
                    {getToolIcon(entry.toolName)} {entry.toolName}
                  </span>
                  <span className="entry-version">v{entry.versionBefore} → v{entry.versionAfter}</span>
                  <span className="entry-duration">{formatDuration(entry.durationMs)}</span>
                </div>

                <div className="entry-details">
                  <details>
                    <summary>Input</summary>
                    <pre className="code-block">{JSON.stringify(entry.input, null, 2)}</pre>
                  </details>
                  <details>
                    <summary>Result</summary>
                    <pre className="code-block">{JSON.stringify(entry.result, null, 2)}</pre>
                  </details>
                </div>

                {entry.status === 'error' && (
                  <div className="entry-error" role="alert">
                    <strong>Error:</strong> {JSON.stringify(entry.result)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="stream-footer">
        <span className="entry-count">{filteredEntries.length} of {entries.length} entries shown</span>
        <button className="btn btn-secondary btn-sm" onClick={() => activityRecorder.clear()}>
          Clear Stream
        </button>
      </footer>
    </section>
  );
}

function useState<T>(initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  // This would be replaced with React's useState
  // For now, using a simple implementation
  let state = initial;
  const setState = (newState: T | ((prev: T) => T)) => {
    state = typeof newState === 'function' ? (newState as (prev: T) => T)(state) : newState;
  };
  return [state, setState];
}