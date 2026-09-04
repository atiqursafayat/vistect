// ============================================================================
// Semantic Object Explorer
// ============================================================================

import type { ApprovalState, FindingSeverity, ObjectId, ObjectKind } from '@vistect/domain/schema';
import { useMemo, useState } from 'react';


import { useAnnouncements } from '../../app/Providers';
import {
  useProject,
  useProjectDecisions,
  useProjectFindings,
  useProjectObjects,
  useUnapprovedDecisionCount,
} from '../../state';

const KIND_LABELS: Record<ObjectKind, string> = {
  text: 'Text',
  image: 'Image',
  icon: 'Icon',
  chart: 'Chart',
  diagram: 'Diagram',
  table: 'Table',
  shape: 'Shape',
};

const APPROVAL_LABELS: Record<ApprovalState, string> = {
  unreviewed: 'Unreviewed',
  proposed: 'Proposed',
  approved: 'Approved',
  rejected: 'Rejected',
  stale: 'Stale',
};

const SEVERITY_COLORS: Record<FindingSeverity, string> = {
  info: '#228be6',
  warning: '#fab005',
  error: '#fa5252',
  blocking: '#c92a2a',
};

interface FilterState {
  kind: ObjectKind | 'all';
  approval: ApprovalState | 'all';
  hasWarnings: boolean;
  search: string;
}

export function Explorer({ id }: { id: string }) {
  const { project } = useProject();
  const objects = useProjectObjects();
  const decisions = useProjectDecisions();
  const findings = useProjectFindings();
  const unapprovedCount = useUnapprovedDecisionCount();
  const { announce } = useAnnouncements();

  const [filter, setFilter] = useState<FilterState>({
    kind: 'all',
    approval: 'all',
    hasWarnings: false,
    search: '',
  });

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredObjects = useMemo(() => {
    return objects.filter(obj => {
      if (filter.kind !== 'all' && obj.kind !== filter.kind) return false;
      if (filter.approval !== 'all' && obj.approval !== filter.approval) return false;
      if (filter.hasWarnings) {
        const objFindings = findings.filter(f => f.targetId === obj.id && f.status === 'open');
        if (objFindings.length === 0) return false;
      }
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        if (!obj.purpose.toLowerCase().includes(searchLower) &&
            !obj.id.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      return true;
    });
  }, [objects, filter, findings]);

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getObjectWarnings = (objectId: ObjectId) =>
    findings.filter((f) => f.targetId === objectId && f.status === 'open');

  const getObjectDecisions = (objectId: ObjectId) =>
    decisions.filter((d) => d.targetObjectIds.includes(objectId));

  const handleSelect = (id: string) => {
    setSelectedId(id);
    announce(`Selected ${id}`);
  };

  if (!project) {
    return (
      <section id={id} className="explorer" aria-label="Object explorer">
        <div className="empty-state">
          <h2>No project open</h2>
        </div>
      </section>
    );
  }

  return (
    <section id={id} className="explorer" aria-label="Object explorer">
      <header className="explorer-header">
        <h2>Object Explorer</h2>
        <div className="explorer-stats">
          <span>{objects.length} objects</span>
          <span className="unapproved-badge" aria-label={`${unapprovedCount} unapproved decisions`}>
            {unapprovedCount > 0 && <span className="badge">{unapprovedCount}</span>}
          </span>
        </div>
      </header>

      <div className="explorer-toolbar">
        <div className="filter-group">
          <label htmlFor="filter-kind" className="sr-only">Filter by kind</label>
          <select
            id="filter-kind"
            value={filter.kind}
            onChange={(e) => {
              setFilter((prev) => ({ ...prev, kind: e.target.value as ObjectKind | 'all' }));
            }}
            aria-label="Filter by object kind"
          >
            <option value="all">All kinds</option>
            <option value="text">Text</option>
            <option value="image">Image</option>
            <option value="icon">Icon</option>
            <option value="chart">Chart</option>
            <option value="diagram">Diagram</option>
            <option value="table">Table</option>
            <option value="shape">Shape</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="filter-approval" className="sr-only">Filter by approval</label>
          <select
            id="filter-approval"
            value={filter.approval}
            onChange={(e) => {
              setFilter((prev) => ({ ...prev, approval: e.target.value as ApprovalState | 'all' }));
            }}
            aria-label="Filter by approval status"
          >
            <option value="all">All statuses</option>
            <option value="unreviewed">Unreviewed</option>
            <option value="proposed">Proposed</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="stale">Stale</option>
          </select>
        </div>

        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={filter.hasWarnings}
            onChange={e => { setFilter(prev => ({ ...prev, hasWarnings: e.target.checked })); }}
            aria-label="Show only objects with warnings"
          />
            <span>Warnings only</span>
          </label>

        <div className="search-group">
          <label htmlFor="explorer-search" className="sr-only">Search objects</label>
          <input
            id="explorer-search"
            type="search"
            placeholder="Search objects..."
            value={filter.search}
            onChange={e => { setFilter(prev => ({ ...prev, search: e.target.value })); }}
            aria-label="Search objects by purpose or ID"
          />
        </div>
      </div>

      <div className="explorer-tree" role="tree" aria-label="Objects">
        {filteredObjects.length === 0 ? (
          <div className="empty-state">
            <p>No objects match current filters</p>
          </div>
        ) : (
          <ul aria-label="Objects">
            {filteredObjects.map(obj => {
              const warnings = getObjectWarnings(obj.id);
              const objDecisions = getObjectDecisions(obj.id);
              const isExpanded = expandedIds.has(obj.id);
              const isSelected = selectedId === obj.id;
              const hasOpenWarnings = warnings.some(w => w.status === 'open');
              const hasBlockingFindings = warnings.some(w => w.severity === 'blocking' && w.status === 'open');

              return (
                <li key={obj.id}>
                  <div
                    className={`object-row ${isSelected ? 'selected' : ''} ${hasBlockingFindings ? 'blocking' : ''} ${hasOpenWarnings ? 'has-warnings' : ''}`}
                  >
                    <button
                      type="button"
                      className="expand-toggle"
                      onClick={() => {
                        toggleExpanded(obj.id);
                      }}
                      aria-label={
                        isExpanded ? `Collapse ${obj.purpose}` : `Expand ${obj.purpose}`
                      }
                      aria-expanded={isExpanded}
                    >
                      <span aria-hidden="true">{isExpanded ? '▼' : '▶'}</span>
                    </button>

                    {/* Selection is its own button so it is reachable by keyboard;
                        the row itself is not interactive. */}
                    <button
                      type="button"
                      className="object-select"
                      onClick={() => {
                        handleSelect(obj.id);
                      }}
                      aria-pressed={isSelected}
                    >
                      <span className="object-kind">{KIND_LABELS[obj.kind]}</span>
                      <span className="object-purpose">{obj.purpose}</span>
                      <span className="object-id">{obj.id}</span>
                    </button>

                    <div className="object-status">
                      <span className={`approval-badge ${obj.approval}`}>{APPROVAL_LABELS[obj.approval]}</span>
                      {hasBlockingFindings && (
                        <span className="blocking-indicator" aria-label="Has blocking findings">●</span>
                      )}
                      {hasOpenWarnings && !hasBlockingFindings && (
                        <span className="warning-indicator" aria-label="Has warnings">⚠</span>
                      )}
                      {objDecisions.length > 0 && (
                        <span className="decision-indicator" aria-label={`${objDecisions.length} decisions`}>📋</span>
                      )}
                    </div>

                  </div>

                  {isExpanded && (
                    <div className="object-details">
                      <div className="detail-section">
                        <h4>Accessibility</h4>
                        <dl>
                          <dt>Alt text</dt>
                          <dd>{obj.accessibility.altText ?? '(none)'}</dd>
                          <dt>Long description</dt>
                          <dd>{obj.accessibility.longDescription ?? '(none)'}</dd>
                          <dt>Decorative</dt>
                          <dd>{obj.accessibility.isDecorative ? 'Yes' : 'No'}</dd>
                          <dt>In reading order</dt>
                          <dd>{obj.accessibility.includedInReadingOrder ? 'Yes' : 'No'}</dd>
                          <dt>Reading order index</dt>
                          <dd>{obj.readingOrderIndex}</dd>
                        </dl>
                      </div>

                      {objDecisions.length > 0 && (
                        <div className="detail-section">
                          <h4>Decisions ({objDecisions.length})</h4>
                          <ul>
                            {objDecisions.map(d => (
                              <li key={d.id}>
                                <strong>{d.category}</strong>: {d.status}
                                {d.selectedOptionId && ` → ${d.selectedOptionId}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {warnings.length > 0 && (
                        <div className="detail-section">
                          <h4>Findings ({warnings.length})</h4>
                          <ul>
                            {warnings.map(w => (
                              <li key={w.id} style={{ borderLeftColor: SEVERITY_COLORS[w.severity] }}>
                                <span className={`severity ${w.severity}`}>{w.severity.toUpperCase()}</span>
                                <span>{w.summary}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="detail-section">
                        <h4>Properties</h4>
                        <dl>
                          <dt>Kind</dt>
                          <dd>{obj.kind}</dd>
                          <dt>Role</dt>
                          <dd>{obj.role}</dd>
                          <dt>Layer</dt>
                          <dd>{obj.layer}</dd>
                          <dt>Bounds</dt>
                          <dd>{obj.bounds.x}, {obj.bounds.y}, {obj.bounds.w}×{obj.bounds.h}</dd>
                          <dt>Created by</dt>
                          <dd>{obj.createdBy} (v{obj.versionCreated})</dd>
                          <dt>Modified</dt>
                          <dd>{obj.versionModified}</dd>
                        </dl>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="explorer-footer">
        <span className="shortcut-hint" aria-hidden="true">Alt+O to focus • Type to filter</span>
      </footer>
    </section>
  );
}