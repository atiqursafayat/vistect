// ============================================================================
// Decision Queue (Alt+U)
// ============================================================================

import type { DecisionId, DecisionOption, OptionId } from '@vistect/domain/schema';
import { useMemo, useState } from 'react';


import { useAnnouncements } from '../../app/Providers';
import { useProject, useProjectDecisions, useUnapprovedDecisionCount } from '../../state';

const CATEGORY_LABELS: Record<string, string> = {
  page_structure: 'Page Structure',
  image_selection: 'Image Selection',
  image_crop: 'Image Crop',
  image_placement: 'Image Placement',
  icon_metaphor: 'Icon Metaphor',
  icon_family: 'Icon Family',
  chart_type: 'Chart Type',
  chart_styling: 'Chart Styling',
  diagram_structure: 'Diagram Structure',
  diagram_layout: 'Diagram Layout',
  template_selection: 'Template Selection',
  visual_priority: 'Visual Priority',
  reading_order: 'Reading Order',
  alt_text: 'Alt Text',
  long_description: 'Long Description',
  export_format: 'Export Format',
};

const CATEGORY_ICONS: Record<string, string> = {
  page_structure: '📄',
  image_selection: '🖼️',
  image_crop: '✂️',
  image_placement: '📍',
  icon_metaphor: '⭐',
  icon_family: '🎨',
  chart_type: '📊',
  chart_styling: '🎨',
  diagram_structure: '🔗',
  diagram_layout: '📐',
  template_selection: '📄',
  visual_priority: '🔝',
  reading_order: '📖',
  alt_text: '📝',
  long_description: '📖',
  export_format: '📦',
};

export interface DecisionQueueProps {
  id: string;
  /** Dispatches ApproveDecision. Absent until the command bus is wired in. */
  onApprove?: (decisionId: DecisionId, optionId: OptionId, reason?: string) => void;
  /** Dispatches RejectDecision. */
  onReject?: (decisionId: DecisionId, reason: string) => void;
  /** Dispatches RequestDecisionAlternatives. */
  onRequestAlternatives?: (decisionId: DecisionId) => void;
}

export function DecisionQueue({
  id,
  onApprove,
  onReject,
  onRequestAlternatives,
}: DecisionQueueProps) {
  const { project } = useProject();
  const decisions = useProjectDecisions();
  const unapprovedCount = useUnapprovedDecisionCount();
  const { announce } = useAnnouncements();

  const [selectedDecision, setSelectedDecision] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'proposed' | 'stale' | 'open'>('all');

  const filteredDecisions = useMemo(() => {
    let filtered = decisions.filter(d => d.status !== 'approved' && d.status !== 'rejected');
    if (filter !== 'all') {
      filtered = filtered.filter(d => d.status === filter);
    }
    return filtered;
  }, [decisions, filter]);

  // Approval is a human-only command (I-03), so these handlers are the sole
  // entry point for it; the dispatchers are injected by the parent once the
  // command bus is wired in.
  const handleApprove = (decisionId: DecisionId, optionId: OptionId, reason?: string) => {
    onApprove?.(decisionId, optionId, reason);
    announce('Decision approved');
  };

  const handleReject = (decisionId: DecisionId, reason: string) => {
    onReject?.(decisionId, reason);
    announce('Decision rejected');
  };

  const handleRequestAlternatives = (decisionId: DecisionId) => {
    onRequestAlternatives?.(decisionId);
    announce('Alternatives requested');
  };

  if (!project) {
    return (
      <section id={id} className="decision-queue" aria-label="Decision queue">
        <div className="empty-state">
          <h2>No project open</h2>
        </div>
      </section>
    );
  }

  return (
    <section id={id} className="decision-queue" aria-label="Decision queue" aria-live="polite">
      <header className="queue-header">
        <h2>Decisions Requiring Review</h2>
        <span className="queue-count" aria-label={`${unapprovedCount} unapproved decisions`}>
          {unapprovedCount}
        </span>
      </header>

      <div className="queue-filters">
        <button
          className={filter === 'all' ? 'active' : ''}
          onClick={() => { setFilter('all'); }}
          aria-pressed={filter === 'all'}
        >
          All ({filteredDecisions.length})
        </button>
        <button
          className={filter === 'proposed' ? 'active' : ''}
          onClick={() => { setFilter('proposed'); }}
          aria-pressed={filter === 'proposed'}
        >
          Proposed ({decisions.filter(d => d.status === 'proposed').length})
        </button>
        <button
          className={filter === 'stale' ? 'active' : ''}
          onClick={() => { setFilter('stale'); }}
          aria-pressed={filter === 'stale'}
        >
          Stale ({decisions.filter(d => d.status === 'stale').length})
        </button>
        <button
          className={filter === 'open' ? 'active' : ''}
          onClick={() => { setFilter('open'); }}
          aria-pressed={filter === 'open'}
        >
          Open ({decisions.filter(d => d.status === 'open').length})
        </button>
      </div>

      <div className="queue-list">
        {filteredDecisions.length === 0 ? (
          <div className="empty-state">
            <h3>No pending decisions</h3>
            <p>All decisions have been reviewed</p>
          </div>
        ) : (
          <ul aria-label="Pending decisions">
            {filteredDecisions.map((decision) => (
              <li key={decision.id} className={`decision-card ${decision.status}`}>
                <div className="decision-header">
                  <span className="decision-category-icon" aria-hidden="true">
                    {CATEGORY_ICONS[decision.category] ?? '📋'}
                  </span>
                  <span className="decision-category">{CATEGORY_LABELS[decision.category] ?? decision.category}</span>
                  <span className={`decision-status ${decision.status}`}>
                    {decision.status.charAt(0).toUpperCase() + decision.status.slice(1)}
                  </span>
                </div>

                <div className="decision-context">
                  <strong>Target:</strong>{' '}
                  {decision.targetObjectIds.length > 0 && (
                    <>
                      {decision.targetObjectIds.length} object(s)
                    </>
                  )}
                  {decision.targetPageIds.length > 0 && (
                    <>
                      {decision.targetPageIds.length} page(s)
                    </>
                  )}
                </div>

                <div className="decision-options">
                  {decision.options.map((option: DecisionOption) => (
                    <div key={option.id} className={`decision-option ${option.isSelected ? 'selected' : ''}`}>
                      <label>
                        <input
                          type="radio"
                          name={`decision-${decision.id}`}
                          checked={option.isSelected}
                          onChange={() => { /* Select option */ }}
                        />
                        <span className="option-description">{option.description}</span>
                        {option.evidence.length > 0 && (
                          <details>
                            <summary>Evidence</summary>
                            <ul>{option.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
                          </details>
                        )}
                        {option.rejectionReason && (
                          <span className="rejection-reason">Rejected: {option.rejectionReason}</span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>

                <div className="decision-actions">
                  {decision.status === 'proposed' && (
                    <>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          const selected = decision.options.find(o => o.isSelected);
                          if (selected) handleApprove(decision.id, selected.id);
                        }}
                        disabled={!decision.options.some(o => o.isSelected)}
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          const reason = prompt('Rejection reason:');
                          if (reason) handleReject(decision.id, reason);
                        }}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {decision.status === 'rejected' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => { handleRequestAlternatives(decision.id); }}
                    >
                      Request Alternatives
                    </button>
                  )}
                  {decision.status === 'stale' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => { /* Re-review */ }}
                    >
                      Re-review
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setSelectedDecision(selectedDecision === decision.id ? null : decision.id); }}
                  >
                    {selectedDecision === decision.id ? 'Hide' : 'Details'}
                  </button>
                </div>

                {selectedDecision === decision.id && (
                  <details className="decision-details" open>
                    <summary>Details</summary>
                    <div className="detail-grid">
                      <div>
                        <strong>Suggested by:</strong> {decision.suggestedBy}
                      </div>
                      <div>
                        <strong>Created:</strong> {new Date(decision.createdAt).toLocaleString()}
                      </div>
                      {decision.approvedAt && (
                        <div>
                          <strong>Approved:</strong> {new Date(decision.approvedAt).toLocaleString()} by {decision.approvedBy}
                        </div>
                      )}
                      {decision.approvedVersion && (
                        <div>
                          <strong>Approved version:</strong> v{decision.approvedVersion}
                        </div>
                      )}
                      <div>
                        <strong>Selection reason:</strong> {decision.selectionReason ?? '(none)'}
                      </div>
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="queue-footer">
        <span className="shortcut-hint" aria-hidden="true">Alt+U to open</span>
      </footer>
    </section>
  );
}