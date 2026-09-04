// ============================================================================
// Warning/Validation Queue (Alt+W)
// ============================================================================

import React, { useMemo } from 'react';
import { useProject, useProjectFindings } from '../../state';
import type { ValidationFinding, FindingSeverity, FindingStatus } from '@vistect/domain/schema';
import { useAnnouncements } from '../../app/Providers';

const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  info: 'Info',
  warning: 'Warning',
  error: 'Error',
  blocking: 'Blocking',
};

const SEVERITY_ICONS: Record<FindingSeverity, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '❌',
  blocking: '🚫',
};

const SEVERITY_COLORS: Record<FindingSeverity, string> = {
  info: '#228be6',
  warning: '#fab005',
  error: '#fa5252',
  blocking: '#c92a2a',
};

const STATUS_LABELS: Record<FindingStatus, string> = {
  open: 'Open',
  accepted: 'Accepted',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

export function WarningQueue({ id }: { id: string }) {
  const { project } = useProject();
  const findings = useProjectFindings();
  const { announce } = useAnnouncements();

  const [filter, setFilter] = useState<'all' | FindingSeverity | FindingStatus>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filteredFindings = useMemo(() => {
    let filtered = findings;
    if (filter !== 'all') {
      if (['info', 'warning', 'error', 'blocking'].includes(filter)) {
        filtered = filtered.filter(f => f.severity === filter);
      } else {
        filtered = filtered.filter(f => f.status === filter);
      }
    }
    // Sort by severity (blocking first), then by timestamp
    return [...filtered].sort((a, b) => {
      const severityOrder = { blocking: 0, error: 1, warning: 2, info: 3 };
      const aOrder = severityOrder[a.severity];
      const bOrder = severityOrder[b.severity];
      if (aOrder !== bOrder) return aOrder - bOrder;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [findings, filter]);

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleResolve = (findingId: string) => {
    // Would dispatch ResolveFinding command
    announce(`Finding resolved: ${findingId}`);
  };

  const handleAccept = (findingId: string) => {
    const reason = prompt('Reason for accepting this risk:');
    if (reason) {
      // Would dispatch AcceptFinding command
      announce(`Finding accepted: ${findingId}`);
    }
  };

  const handleDismiss = (findingId: string) => {
    // Would dispatch DismissFinding command
    announce(`Finding dismissed: ${findingId}`);
  };

  if (!project) {
    return (
      <section id={id} className="warning-queue" aria-label="Warning queue">
        <div className="empty-state">
          <h2>No project open</h2>
        </div>
      </section>
    );
  }

  const openFindings = findings.filter(f => f.status === 'open');
  const blockingCount = openFindings.filter(f => f.severity === 'blocking').length;
  const errorCount = openFindings.filter(f => f.severity === 'error').length;
  const warningCount = openFindings.filter(f => f.severity === 'warning').length;

  return (
    <section id={id} className="warning-queue" aria-label="Warning queue" role="region" aria-live="polite">
      <header className="queue-header">
        <h2>Validation Findings</h2>
        <div className="queue-summary">
          {blockingCount > 0 && (
            <span className="severity-badge blocking" aria-label={`${blockingCount} blocking findings`}>
              {blockingCount} Blocking
            </span>
          )}
          {errorCount > 0 && (
            <span className="severity-badge error" aria-label={`${errorCount} errors`}>
              {errorCount} Errors
            </span>
          )}
          {warningCount > 0 && (
            <span className="severity-badge warning" aria-label={`${warningCount} warnings`}>
              {warningCount} Warnings
            </span>
          )}
        </div>
      </header>

      <div className="queue-filters">
        <button
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
          aria-pressed={filter === 'all'}
        >
          All ({filteredFindings.length})
        </button>
        <button
          className={filter === 'blocking' ? 'active' : ''}
          onClick={() => setFilter('blocking')}
          aria-pressed={filter === 'blocking'}
          style={{ borderLeftColor: SEVERITY_COLORS.blocking }}
        >
          <span style={{ color: SEVERITY_COLORS.blocking }}>🚫</span> Blocking ({findings.filter(f => f.severity === 'blocking').length})
        </button>
        <button
          className={filter === 'error' ? 'active' : ''}
          onClick={() => setFilter('error')}
          aria-pressed={filter === 'error'}
          style={{ borderLeftColor: SEVERITY_COLORS.error }}
        >
          <span style={{ color: SEVERITY_COLORS.error }}>❌</span> Errors ({findings.filter(f => f.severity === 'error').length})
        </button>
        <button
          className={filter === 'warning' ? 'active' : ''}
          onClick={() => setFilter('warning')}
          aria-pressed={filter === 'warning'}
          style={{ borderLeftColor: SEVERITY_COLORS.warning }}
        >
          <span style={{ color: SEVERITY_COLORS.warning }}>⚠️</span> Warnings ({findings.filter(f => f.severity === 'warning').length})
        </button>
        <button
          className={filter === 'info' ? 'active' : ''}
          onClick={() => setFilter('info')}
          aria-pressed={filter === 'info'}
          style={{ borderLeftColor: SEVERITY_COLORS.info }}
        >
          <span style={{ color: SEVERITY_COLORS.info }}>ℹ️</span> Info ({findings.filter(f => f.severity === 'info').length})
        </button>
        <button
          className={filter === 'open' ? 'active' : ''}
          onClick={() => setFilter('open')}
          aria-pressed={filter === 'open'}
        >
          Open ({openFindings.length})
        </button>
        <button
          className={filter === 'resolved' ? 'active' : ''}
          onClick={() => setFilter('resolved')}
          aria-pressed={filter === 'resolved'}
        >
          Resolved ({findings.filter(f => f.status === 'resolved').length})
        </button>
        <button
          className={filter === 'accepted' ? 'active' : ''}
          onClick={() => setFilter('accepted')}
          aria-pressed={filter === 'accepted'}
        >
          Accepted ({findings.filter(f => f.status === 'accepted').length})
        </button>
        <button
          className={filter === 'dismissed' ? 'active' : ''}
          onClick={() => setFilter('dismissed')}
          aria-pressed={filter === 'dismissed'}
        >
          Dismissed ({findings.filter(f => f.status === 'dismissed').length})
        </button>
      </div>

      <div className="queue-list" role="list" aria-label="Validation findings">
        {filteredFindings.length === 0 ? (
          <div className="empty-state">
            <h3>No findings</h3>
            <p>All validations passing</p>
          </div>
        ) : (
          <ul role="list">
            {filteredFindings.map(finding => {
              const isExpanded = expandedIds.has(finding.id);
              const targetObj = project.objects[finding.targetId as string];
              const targetPage = project.pages[finding.targetId as string];

              return (
                <li key={finding.id} className={`finding-card ${finding.severity} ${finding.status}`} role="listitem" style={{ borderLeftColor: SEVERITY_COLORS[finding.severity] }}>
                  <div className="finding-header">
                    <span className="finding-severity-icon" aria-hidden="true">{SEVERITY_ICONS[finding.severity]}</span>
                    <span className="finding-category">{finding.category}</span>
                    <span className={`finding-severity ${finding.severity}`}>{SEVERITY_LABELS[finding.severity]}</span>
                    <span className={`finding-status ${finding.status}`}>{STATUS_LABELS[finding.status]}</span>
                  </div>

                  <div className="finding-summary">{finding.summary}</div>

                  <div className="finding-meta">
                    <span>Target: {targetObj ? `${targetObj.kind} (${targetObj.id})` : targetPage ? `Page ${targetPage.id}` : finding.targetId}</span>
                    <span>Type: {finding.evidenceType}</span>
                    {finding.confidence !== undefined && <span>Confidence: {(finding.confidence * 100).toFixed(0)}%</span>}
                    <span>Created: {new Date(finding.createdAt).toLocaleString()}</span>
                  </div>

                  {finding.evidence.length > 0 && (
                    <details className="finding-evidence">
                      <summary>Evidence ({finding.evidence.length})</summary>
                      <ul>
                        {finding.evidence.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </details>
                  )}

                  {finding.suggestedActions.length > 0 && (
                    <details className="finding-actions">
                      <summary>Suggested Actions ({finding.suggestedActions.length})</summary>
                      <ul>
                        {finding.suggestedActions.map((a, i) => (
                          <li key={i}>
                            <strong>{a.type.toUpperCase()}:</strong> {a.description}
                            {a.toolName && <button className="btn btn-ghost btn-sm" onClick={() => { /* Execute tool */ }}>Run {a.toolName}</button>}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  <div className="finding-actions-bar">
                    {finding.status === 'open' && finding.severity !== 'blocking' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => handleAccept(finding.id)}>
                        Accept Risk
                      </button>
                    )}
                    {finding.status === 'open' && finding.severity !== 'blocking' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDismiss(finding.id)}>
                        Dismiss
                      </button>
                    )}
                    {finding.status === 'open' && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleResolve(finding.id)}>
                        Resolve
                      </button>
                    )}
                    {finding.status === 'accepted' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => { /* Reopen */ }}>
                        Reopen
                      </button>
                    )}
                    {finding.status === 'resolved' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => { /* Reopen */ }}>
                        Reopen
                      </button>
                    )}
                    {finding.status === 'dismissed' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => { /* Reopen */ }}>
                        Restore
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => toggleExpanded(finding.id)}
                    >
                      {isExpanded ? 'Hide' : 'Details'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="finding-details">
                      <div className="detail-row">
                        <strong>ID:</strong> {finding.id}
                      </div>
                      <div className="detail-row">
                        <strong>Scope:</strong> {finding.scope}
                      </div>
                      <div className="detail-row">
                        <strong>Evidence Type:</strong> {finding.evidenceType}
                      </div>
                      {finding.acceptedReason && (
                        <div className="detail-row">
                          <strong>Accepted Reason:</strong> {finding.acceptedReason}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="queue-footer">
        <span className="shortcut-hint" aria-hidden="true">Alt+W to open</span>
      </footer>
    </section>
  );
}

function useState<T>(initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  let state = initial;
  const setState = (newState: T | ((prev: T) => T)) => {
    state = typeof newState === 'function' ? (newState as (prev: T) => T)(state) : newState;
  };
  return [state, setState];
}