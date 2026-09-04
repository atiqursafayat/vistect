// ============================================================================
// Intent Contract Editor
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useProject } from '../../state';
import type { IntentContract } from '@vistect/domain/schema';
import { useAnnouncements } from '../../app/Providers';

const DOCUMENT_TYPES = ['impact-report'] as const;
const TONES = ['professional', 'accessible', 'engaging', 'authoritative', 'empathetic', 'concise'];
const IMAGE_SOURCING = ['upload', 'curated', 'ai-generated', 'mixed'] as const;
const PRIVACY_LEVELS = ['public', 'internal', 'confidential', 'restricted'] as const;

export function IntentEditor() {
  const { project, setProject } = useProject();
  const { announce } = useAnnouncements();

  const [intent, setIntent] = useState<IntentContract | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (project) {
      setIntent(project.intentContract);
      setIsDirty(false);
    }
  }, [project]);

  const validate = (data: IntentContract): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    if (!data.purpose || data.purpose.length < 10) {
      newErrors.purpose = 'Purpose must be at least 10 characters';
    }
    if (!data.audience || data.audience.length < 5) {
      newErrors.audience = 'Audience must be at least 5 characters';
    }
    if (!data.primaryMessage || data.primaryMessage.length < 10) {
      newErrors.primaryMessage = 'Primary message must be at least 10 characters';
    }
    if (data.brandColors && Object.keys(data.brandColors).length > 0) {
      for (const [key, value] of Object.entries(data.brandColors)) {
        if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
          newErrors[`brandColors.${key}`] = `Invalid hex color: ${value}`;
        }
      }
    }

    return newErrors;
  };

  const handleChange = <K extends keyof IntentContract>(field: K, value: IntentContract[K]) => {
    if (!intent) return;
    const newIntent = { ...intent, [field]: value };
    setIntent(newIntent);
    setErrors(validate(newIntent));
    setIsDirty(true);
  };

  const handleNestedChange = <T extends object>(parent: keyof IntentContract, field: string, value: any) => {
    if (!intent) return;
    const parentObj = intent[parent] as T;
    const newParent = { ...parentObj, [field]: value };
    handleChange(parent, newParent as any);
  };

  const handleSave = () => {
    if (!intent || !project) return;
    const newErrors = validate(intent);
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      announce('Validation failed. Please fix errors.', 'assertive');
      return;
    }
    // Would dispatch UpdateProject command
    setIsDirty(false);
    announce('Intent contract saved');
  };

  const handleReset = () => {
    if (project) {
      setIntent(project.intentContract);
      setErrors({});
      setIsDirty(false);
    }
  };

  if (!project || !intent) {
    return (
      <section className="intent-editor" aria-label="Intent contract editor">
        <div className="empty-state">
          <h2>No project open</h2>
          <p>Open a project to edit its intent contract</p>
        </div>
      </section>
    );
  }

  return (
    <section className="intent-editor" aria-label="Intent contract editor">
      <header className="editor-header">
        <h2>Intent Contract</h2>
        <div className="editor-actions">
          {isDirty && (
            <>
              <button className="btn btn-secondary" onClick={handleReset} disabled={!isDirty}>
                Reset
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={Object.keys(errors).length > 0}>
                Save
              </button>
            </>
          )}
        </div>
      </header>

      {Object.keys(errors).length > 0 && (
        <div className="error-banner" role="alert">
          <strong>Validation errors:</strong>
          <ul>
            {Object.entries(errors).map(([field, message]) => (
              <li key={field}><strong>{field}:</strong> {message}</li>
            ))}
          </ul>
        </div>
      )}

      <form className="intent-form" onSubmit={e => { e.preventDefault(); handleSave(); }}>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="document-type">Document Type</label>
            <select
              id="document-type"
              value={intent.documentType}
              onChange={e => handleChange('documentType', e.target.value as any)}
              disabled={true}
              className="form-input"
            >
              {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="purpose">Purpose *</label>
            <textarea
              id="purpose"
              value={intent.purpose}
              onChange={e => handleChange('purpose', e.target.value)}
              rows={3}
              className="form-textarea"
              aria-describedby={errors.purpose ? 'purpose-error' : undefined}
              aria-invalid={!!errors.purpose}
            />
            {errors.purpose && <span id="purpose-error" className="form-error">{errors.purpose}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="audience">Audience *</label>
            <textarea
              id="audience"
              value={intent.audience}
              onChange={e => handleChange('audience', e.target.value)}
              rows={2}
              className="form-textarea"
              aria-describedby={errors.audience ? 'audience-error' : undefined}
              aria-invalid={!!errors.audience}
            />
            {errors.audience && <span id="audience-error" className="form-error">{errors.audience}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="primary-message">Primary Message *</label>
            <textarea
              id="primary-message"
              value={intent.primaryMessage}
              onChange={e => handleChange('primaryMessage', e.target.value)}
              rows={3}
              className="form-textarea"
              aria-describedby={errors.primaryMessage ? 'primary-message-error' : undefined}
              aria-invalid={!!errors.primaryMessage}
            />
            {errors.primaryMessage && <span id="primary-message-error" className="form-error">{errors.primaryMessage}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="secondary-messages">Secondary Messages</label>
            <div className="list-input">
              {intent.secondaryMessages.map((msg, i) => (
                <div key={i} className="list-input-item">
                  <input
                    type="text"
                    value={msg}
                    onChange={e => {
                      const newMsgs = [...intent.secondaryMessages];
                      newMsgs[i] = e.target.value;
                      handleChange('secondaryMessages', newMsgs);
                    }}
                    className="form-input"
                    placeholder={`Secondary message ${i + 1}`}
                  />
                  <button type="button" className="icon-btn" onClick={() => {
                    const newMsgs = intent.secondaryMessages.filter((_, idx) => idx !== i);
                    handleChange('secondaryMessages', newMsgs);
                  }} aria-label={`Remove message ${i + 1}`}>✕</button>
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleChange('secondaryMessages', [...intent.secondaryMessages, ''])}>
                + Add Message
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="tone">Tone</label>
            <select
              id="tone"
              value={intent.tone}
              onChange={e => handleChange('tone', e.target.value)}
              className="form-select"
            >
              {TONES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="concepts-to-avoid">Concepts to Avoid</label>
            <div className="list-input">
              {intent.conceptsToAvoid.map((concept, i) => (
                <div key={i} className="list-input-item">
                  <input
                    type="text"
                    value={concept}
                    onChange={e => {
                      const newConcepts = [...intent.conceptsToAvoid];
                      newConcepts[i] = e.target.value;
                      handleChange('conceptsToAvoid', newConcepts);
                    }}
                    className="form-input"
                    placeholder={`Concept ${i + 1}`}
                  />
                  <button type="button" className="icon-btn" onClick={() => {
                    const newConcepts = intent.conceptsToAvoid.filter((_, idx) => idx !== i);
                    handleChange('conceptsToAvoid', newConcepts);
                  }} aria-label={`Remove concept ${i + 1}`}>✕</button>
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleChange('conceptsToAvoid', [...intent.conceptsToAvoid, ''])}>
                + Add Concept
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="visual-style">Visual Style</label>
            <textarea
              id="visual-style"
              value={intent.visualStyle}
              onChange={e => handleChange('visualStyle', e.target.value)}
              rows={2}
              className="form-textarea"
            />
          </div>

          <div className="form-group">
            <label htmlFor="required-visuals">Required Visuals</label>
            <div className="list-input">
              {intent.requiredVisuals.map((visual, i) => (
                <div key={i} className="list-input-item">
                  <input
                    type="text"
                    value={visual}
                    onChange={e => {
                      const newVisuals = [...intent.requiredVisuals];
                      newVisuals[i] = e.target.value;
                      handleChange('requiredVisuals', newVisuals);
                    }}
                    className="form-input"
                    placeholder={`Visual ${i + 1}`}
                  />
                  <button type="button" className="icon-btn" onClick={() => {
                    const newVisuals = intent.requiredVisuals.filter((_, idx) => idx !== i);
                    handleChange('requiredVisuals', newVisuals);
                  }} aria-label={`Remove visual ${i + 1}`}>✕</button>
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleChange('requiredVisuals', [...intent.requiredVisuals, ''])}>
                + Add Visual
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="accessibility-requirements">Accessibility Requirements</label>
            <div className="list-input">
              {intent.accessibilityRequirements.map((req, i) => (
                <div key={i} className="list-input-item">
                  <input
                    type="text"
                    value={req}
                    onChange={e => {
                      const newReqs = [...intent.accessibilityRequirements];
                      newReqs[i] = e.target.value;
                      handleChange('accessibilityRequirements', newReqs);
                    }}
                    className="form-input"
                    placeholder={`Requirement ${i + 1}`}
                  />
                  <button type="button" className="icon-btn" onClick={() => {
                    const newReqs = intent.accessibilityRequirements.filter((_, idx) => idx !== i);
                    handleChange('accessibilityRequirements', newReqs);
                  }} aria-label={`Remove requirement ${i + 1}`}>✕</button>
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleChange('accessibilityRequirements', [...intent.accessibilityRequirements, ''])}>
                + Add Requirement
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="image-sourcing">Image Sourcing Preference</label>
            <select
              id="image-sourcing"
              value={intent.imageSourcingPreference}
              onChange={e => handleChange('imageSourcingPreference', e.target.value as any)}
              className="form-select"
            >
              {IMAGE_SOURCING.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="privacy-sensitivity">Privacy Sensitivity</label>
            <select
              id="privacy-sensitivity"
              value={intent.privacySensitivity}
              onChange={e => handleChange('privacySensitivity', e.target.value as any)}
              className="form-select"
            >
              {PRIVACY_LEVELS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="form-group">
            <fieldset>
              <legend>Export Requirements</legend>
              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={intent.exportRequirements.pdf}
                    onChange={e => handleNestedChange('exportRequirements', 'pdf', e.target.checked)}
                  >
                  PDF
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={intent.exportRequirements.html}
                    onChange={e => handleNestedChange('exportRequirements', 'html', e.target.checked)}
                  >
                  Accessible HTML
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={intent.exportRequirements.svgDiagrams}
                    onChange={e => handleNestedChange('exportRequirements', 'svgDiagrams', e.target.checked)}
                  >
                  SVG Diagrams
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={intent.exportRequirements.chartTables}
                    onChange={e => handleNestedChange('exportRequirements', 'chartTables', e.target.checked)}
                  >
                  Chart Data Tables
                </label>
              </div>
            </fieldset>
          </div>

          <div className="form-group">
            <fieldset>
              <legend>Brand Colors</legend>
              <div className="color-inputs">
                {Object.entries(intent.brandColors).map(([key, value]) => (
                  <div key={key} className="color-input-item">
                    <label htmlFor={`color-${key}`}>{key}</label>
                    <input
                      id={`color-${key}`}
                      type="color"
                      value={value}
                      onChange={e => handleNestedChange('brandColors', key, e.target.value)}
                      className="form-input color-input"
                    />
                    <input
                      type="text"
                      value={value}
                      onChange={e => handleNestedChange('brandColors', key, e.target.value)}
                      className="form-input"
                      pattern="^#[0-9A-Fa-f]{6}$"
                    />
                    <button type="button" className="icon-btn" onClick={() => {
                      const newColors = { ...intent.brandColors };
                      delete newColors[key];
                      handleChange('brandColors', newColors);
                    }} aria-label={`Remove ${key} color`}>✕</button>
                  </div>
                ))}
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                  handleChange('brandColors', { ...intent.brandColors, [`color${Object.keys(intent.brandColors).length + 1}`]: '#1a1a2e' });
                }}>
                  + Add Color
                </button>
              </div>
            </fieldset>
          </div>

          <div className="form-group">
            <fieldset>
              <legend>Brand Fonts</legend>
              <div className="font-inputs">
                {Object.entries(intent.brandFonts).map(([key, value]) => (
                  <div key={key} className="font-input-item">
                    <label htmlFor={`font-${key}`}>{key}</label>
                    <input
                      id={`font-${key}`}
                      type="text"
                      value={value}
                      onChange={e => handleNestedChange('brandFonts', key, e.target.value)}
                      className="form-input"
                    />
                    <button type="button" className="icon-btn" onClick={() => {
                      const newFonts = { ...intent.brandFonts };
                      delete newFonts[key];
                      handleChange('brandFonts', newFonts);
                    }} aria-label={`Remove ${key} font`}>✕</button>
                  </div>
                ))}
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                  handleChange('brandFonts', { ...intent.brandFonts, [`font${Object.keys(intent.brandFonts).length + 1}`]: 'Inter' });
                }}>
                  + Add Font
                </button>
              </div>
            </fieldset>
          </div>
        </div>
      </form>
    </section>
  );
}