// ============================================================================
// Privacy Center
// ============================================================================


import { dictEntries } from '@vistect/domain/collections';
import type { AssetId } from '@vistect/domain/schema';
import { useState } from 'react';

import { useAnnouncements } from '../../app/Providers';
import { useProject } from '../../state';

interface PrivacyReceipt {
  id: string;
  timestamp: string;
  processingType: 'local' | 'remote';
  assetIds?: string[];
  regionDescription?: string;
  consentGiven: boolean;
  retentionStatus: 'retained' | 'deleted' | 'pending';
}

interface ConsentRequest {
  id: string;
  timestamp: string;
  assetIds: string[];
  regionDescription: string;
  detectedText: string;
  detectedFaces: number;
  status: 'pending' | 'approved' | 'rejected' | 'redacted';
}

export interface PrivacyCenterProps {
  id: string;
  /** Records a consent decision for non-local processing (§22). */
  onConsent?: (requestId: string, approved: boolean) => void;
  /** Redacts detected faces or text from an asset. */
  onRedact?: (assetId: AssetId) => void;
  /** Permanently deletes an asset and its receipts. */
  onDelete?: (assetId: AssetId) => void;
}

export function PrivacyCenter({ id, onConsent, onRedact, onDelete }: PrivacyCenterProps) {
  const { project } = useProject();
  const { announce } = useAnnouncements();

  // Receipts and consent requests are persisted in the meta store; the handlers
  // below are injected so this component stays a pure view.
  const [receipts] = useState<PrivacyReceipt[]>([]);
  const [consentRequests] = useState<ConsentRequest[]>([]);
  const [redactionMode, setRedactionMode] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState<AssetId | null>(null);

  const handleConsent = (requestId: string, approved: boolean) => {
    onConsent?.(requestId, approved);
    announce(approved ? 'Consent granted for remote processing' : 'Consent denied');
  };

  const handleRedact = (assetId: AssetId) => {
    onRedact?.(assetId);
    announce('Asset redacted');
  };

  // Two-step deletion rather than `confirm()`: a native dialog cannot be styled,
  // announced, or focus-managed, and deletion is irreversible.
  const requestDeletion = (assetId: AssetId) => {
    setPendingDeletion(assetId);
    announce('Confirm deletion to permanently remove this asset', 'assertive');
  };

  const confirmDeletion = () => {
    if (pendingDeletion === null) return;
    onDelete?.(pendingDeletion);
    setPendingDeletion(null);
    announce('Asset deleted');
  };

  const exportReceipts = () => {
    const data = JSON.stringify(receipts, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vistect-privacy-receipts-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    announce('Privacy receipts exported');
  };

  if (!project) {
    return (
      <section id={id} className="privacy-center" aria-label="Privacy center">
        <div className="empty-state">
          <h2>No project open</h2>
        </div>
      </section>
    );
  }

  const localProcessingCount = receipts.filter(r => r.processingType === 'local').length;
  const remoteProcessingCount = receipts.filter(r => r.processingType === 'remote').length;
  const pendingConsents = consentRequests.filter(r => r.status === 'pending').length;

  return (
    <section id={id} className="privacy-center" aria-label="Privacy center">
      <header className="center-header">
        <h2>Privacy Center</h2>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={exportReceipts}>
            Export Receipts
          </button>
        </div>
      </header>

      <div className="privacy-summary">
        <div className="summary-card">
          <h3>Processing Overview</h3>
          <dl>
            <dt>Local Processing</dt>
            <dd>{localProcessingCount}</dd>
            <dt>Remote Processing</dt>
            <dd>{remoteProcessingCount}</dd>
            <dt>Pending Consents</dt>
            <dd>{pendingConsents}</dd>
            <dt>Data Retained</dt>
            <dd>{receipts.filter(r => r.retentionStatus === 'retained').length}</dd>
          </dl>
        </div>

        <div className="summary-card">
          <h3>Project Data</h3>
          <dl>
            <dt>Images</dt>
            <dd>{project ? Object.keys(project.assets).length : 0}</dd>
            <dt>Pages</dt>
            <dd>{project ? Object.keys(project.pages).length : 0}</dd>
            <dt>Objects</dt>
            <dd>{project ? Object.keys(project.objects).length : 0}</dd>
          </dl>
        </div>
      </div>

      <div className="privacy-tabs">
        {/* Section links rather than a tablist: all four panels are rendered
            below, so `aria-current` describes position without promising the
            arrow-key behaviour a real tablist requires. */}
        <nav className="tabs" aria-label="Privacy sections">
          <button type="button" aria-current="true" className="active">
            Receipts
          </button>
          <button type="button">Consent requests</button>
          <button type="button">Redaction</button>
          <button type="button">Deletion</button>
        </nav>
      </div>

      <div className="tab-panels">
        {/* Receipts Panel */}
        <section role="tabpanel" className="tab-panel active" aria-label="Privacy receipts">
          {receipts.length === 0 ? (
            <div className="empty-state">
              <p>No privacy receipts recorded</p>
            </div>
          ) : (
            <ul className="receipts-list">
              {receipts.map(receipt => (
                <li key={receipt.id} className="receipt-card">
                  <div className="receipt-header">
                    <span className={`receipt-type ${receipt.processingType}`}>
                      {receipt.processingType === 'local' ? '🔒' : '☁️'} {receipt.processingType.charAt(0).toUpperCase() + receipt.processingType.slice(1)}
                    </span>
                    <span className="receipt-time">{new Date(receipt.timestamp).toLocaleString()}</span>
                    <span className={`retention-status ${receipt.retentionStatus}`}>{receipt.retentionStatus}</span>
                  </div>
                  <div className="receipt-details">
                    {receipt.assetIds && receipt.assetIds.length > 0 && (
                      <div>Assets: {receipt.assetIds.join(', ')}</div>
                    )}
                    {receipt.regionDescription && (
                      <div>Region: {receipt.regionDescription}</div>
                    )}
                    <div>Consent: {receipt.consentGiven ? 'Granted' : 'Denied'}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Consent Requests Panel */}
        <section role="tabpanel" className="tab-panel" aria-label="Consent requests">
          {consentRequests.length === 0 ? (
            <div className="empty-state">
              <p>No pending consent requests</p>
            </div>
          ) : (
            <ul className="consent-list">
              {consentRequests.map(request => (
                <li key={request.id} className="consent-card">
                  <div className="consent-header">
                    <span className="consent-time">{new Date(request.timestamp).toLocaleString()}</span>
                    <span className={`consent-status ${request.status}`}>{request.status}</span>
                  </div>
                  <div className="consent-details">
                    <div>Assets: {request.assetIds.join(', ')}</div>
                    <div>Region: {request.regionDescription}</div>
                    <div>Detected Text: {request.detectedText || '(none)'}</div>
                    <div>Detected Faces: {request.detectedFaces}</div>
                  </div>
                  {request.status === 'pending' && (
                    <div className="consent-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => { handleConsent(request.id, true); }}>
                        Approve
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => { handleConsent(request.id, false); }}>
                        Deny
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => {
                        // Redact
                      }}>
                        Redact First
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Redaction Panel */}
        <section role="tabpanel" className="tab-panel" aria-label="Redaction">
          <h3>Redact Sensitive Content</h3>
          <p>Select assets to redact sensitive information before processing</p>
          <div className="redaction-tools">
            <label>
              <input type="checkbox" checked={redactionMode} onChange={e => { setRedactionMode(e.target.checked); }} />
              Enable Redaction Mode
            </label>
            {redactionMode && (
              <div className="redaction-options">
                <label>
                  <input type="checkbox" /> Redact detected faces
                </label>
                <label>
                  <input type="checkbox" /> Redact detected text
                </label>
                <label>
                  <input type="checkbox" /> Redact license plates
                </label>
                <label>
                  <input type="checkbox" /> Redact personal identifiers
                </label>
              </div>
            )}
          </div>
          <ul className="asset-list">
            {project !== null &&
              dictEntries(project.assets).map(([assetId, asset]) => (
                <li key={assetId} className="asset-item">
                  <span>{asset.fileName}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => { handleRedact(assetId); }}
                  >
                    Redact
                  </button>
                </li>
              ))}
          </ul>
        </section>

        {/* Deletion Panel */}
        <section role="tabpanel" className="tab-panel" aria-label="Deletion">
          <h3>Delete Project Data</h3>
          <div className="deletion-options">
            <div className="deletion-card">
              <h4>Delete Individual Assets</h4>
              <p>Select assets to permanently remove</p>
              <ul className="asset-list">
                {project !== null &&
                  dictEntries(project.assets).map(([assetId, asset]) => (
                    <li key={assetId} className="asset-item">
                      <span>
                        {asset.fileName} ({asset.mimeType})
                      </span>
                      {pendingDeletion === assetId ? (
                        <span className="deletion-confirm">
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={confirmDeletion}
                          >
                            Confirm delete
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => { setPendingDeletion(null); }}
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => { requestDeletion(assetId); }}
                        >
                          Delete
                        </button>
                      )}
                    </li>
                  ))}
              </ul>
            </div>

            <div className="deletion-card warning">
              <h4>Delete Entire Project</h4>
              <p>This will permanently delete all project data including assets, decisions, and history.</p>
              <button className="btn btn-danger" onClick={() => {
                if (confirm('Are you sure you want to delete the entire project? This cannot be undone.')) {
                  // Delete project
                }
              }}>
                Delete Project
              </button>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}