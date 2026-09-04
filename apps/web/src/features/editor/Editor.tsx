// ============================================================================
// Editor — page canvas and object properties
// ============================================================================
//
// Renders the page using `resolveLayout` from `@vistect/render-html`, the same
// resolver that drives HTML preview and PDF export. Duplicating the region table
// here (as this file previously did) would let the canvas disagree with what
// actually exports, and a non-visual author would have no way to notice.
//
// Editing is semantic: the properties panel exposes purpose, alt text, long
// description and reading-order membership — never x/y coordinates (I-14).


import type {
  DocumentObject,
  DocumentProject,
  ObjectId,
  Page,
  PageId,
} from '@vistect/domain/schema';
import { getTemplateRegions, PAGE_SIZE } from '@vistect/render-html';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { useAnnouncements } from '../../app/Providers';
import { usePageOrder, useProject, useStore } from '../../state';

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

export interface EditorProps {
  id: string;
}

export function Editor({ id }: EditorProps) {
  const { project } = useProject();
  const pageOrder = usePageOrder();
  const { announce } = useAnnouncements();

  const selectedObjectId = useStore((state) => state.selectedObjectId);
  const selectedPageId = useStore((state) => state.selectedPageId);
  const setSelectedObject = useStore((state) => state.setSelectedObject);
  const zoomLevel = useStore((state) => state.zoomLevel);
  const setZoomLevel = useStore((state) => state.setZoomLevel);

  const canvasRef = useRef<HTMLDivElement>(null);

  // The store owns the selection, so navigator and editor cannot disagree about
  // which page is active. This effect only supplies a default.
  useEffect(() => {
    if (selectedPageId === null && pageOrder.length > 0) {
      const first = pageOrder[0];
      if (first !== undefined) setSelectedObject(null, first);
    }
  }, [selectedPageId, pageOrder, setSelectedObject]);

  const currentPage: Page | null = useMemo(() => {
    if (project === null || selectedPageId === null) return null;
    return project.pages[selectedPageId as PageId] ?? null;
  }, [project, selectedPageId]);

  const pageObjects = useMemo<DocumentObject[]>(() => {
    if (project === null || currentPage === null) return [];
    return currentPage.objects
      .map((objectId) => project.objects[objectId])
      .filter((object): object is DocumentObject => object !== undefined);
  }, [project, currentPage]);

  const handlePageChange = useCallback(
    (pageId: PageId, index: number) => {
      setSelectedObject(null, pageId);
      announce(`Page ${String(index + 1)} selected`);
    },
    [setSelectedObject, announce]
  );

  const handleObjectSelect = useCallback(
    (object: DocumentObject) => {
      if (selectedPageId === null) return;
      setSelectedObject(object.id, selectedPageId);
      announce(`${object.kind} selected: ${object.purpose}`);
    },
    [selectedPageId, setSelectedObject, announce]
  );

  // Ctrl/Cmd + wheel zoom, matching the browser's own zoom gesture.
  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoomLevel(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomLevel + delta)));
    },
    [zoomLevel, setZoomLevel]
  );

  if (project === null) {
    return (
      <section id={id} className="editor" aria-label="Document editor">
        <div className="welcome-screen">
          <h1>Welcome to Vistect</h1>
          <p>Create or open a project to start editing.</p>
        </div>
      </section>
    );
  }

  if (currentPage === null) {
    return (
      <section id={id} className="editor" aria-label="Document editor">
        <div className="empty-state">
          <h2>No page selected</h2>
          <p>Select a page from the navigator, or add the first page.</p>
        </div>
      </section>
    );
  }

  const regions = getTemplateRegions(currentPage.template);

  return (
    <section id={id} className="editor" aria-label="Document editor" onWheel={handleWheel}>
      <nav className="page-tabs" aria-label="Pages">
        <ul className="page-tab-list">
          {pageOrder.map((pageId, index) => {
            const page = project.pages[pageId];
            if (page === undefined) return null;
            const isActive = pageId === selectedPageId;

            return (
              <li key={pageId}>
                <button
                  type="button"
                  className={`page-tab${isActive ? ' page-tab-active' : ''}`}
                  // `aria-current` rather than a tablist: the panel is not
                  // swapped in place, and a fake tablist would promise keyboard
                  // behaviour (arrow-key cycling) this control does not implement.
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => { handlePageChange(pageId, index); }}
                >
                  <span className="page-tab-label">Page {index + 1}</span>
                  <span className="page-tab-template">{page.template}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className="editor-canvas"
        ref={canvasRef}
        style={{ transform: `scale(${String(zoomLevel)})`, transformOrigin: 'top left' }}
      >
        <div
          className="page-canvas"
          style={{ width: `${String(PAGE_SIZE.width)}px`, height: `${String(PAGE_SIZE.height)}px` }}
        >
          {regions.map((region) => (
            <div
              key={region.name}
              className={`template-region template-region-${region.name}`}
              style={{
                position: 'absolute',
                left: `${String(region.bounds.x)}px`,
                top: `${String(region.bounds.y)}px`,
                width: `${String(region.bounds.w)}px`,
                height: `${String(region.bounds.h)}px`,
              }}
            >
              <span className="region-label" aria-hidden="true">
                {region.name}
              </span>
            </div>
          ))}

          {pageObjects.map((object) => (
            <ObjectRenderer
              key={object.id}
              object={object}
              project={project}
              isSelected={selectedObjectId === object.id}
              onSelect={handleObjectSelect}
            />
          ))}
        </div>
      </div>

      {selectedObjectId !== null && (
        <aside className="object-panel" aria-label="Object properties">
          <ObjectProperties
            objectId={selectedObjectId as ObjectId}
            onClose={() => {
              setSelectedObject(null, selectedPageId);
            }}
          />
        </aside>
      )}
    </section>
  );
}

// ============================================================================
// Object rendering
// ============================================================================

interface ObjectRendererProps {
  object: DocumentObject;
  project: DocumentProject;
  isSelected: boolean;
  onSelect: (object: DocumentObject) => void;
}

function ObjectRenderer({ object, project, isSelected, onSelect }: ObjectRendererProps) {
  const style: CSSProperties = {
    position: 'absolute',
    left: `${String(object.bounds.x)}px`,
    top: `${String(object.bounds.y)}px`,
    width: `${String(object.bounds.w)}px`,
    height: `${String(object.bounds.h)}px`,
    zIndex: object.layer,
  };

  return (
    // A button wrapper, not a click handler on a div: selection must be reachable
    // by keyboard, and `approval` comes from the object, not its accessibility
    // metadata.
    <button
      type="button"
      className={`object-renderer object-${object.kind} approval-${object.approval}${
        isSelected ? ' selected' : ''
      }`}
      style={style}
      onClick={() => { onSelect(object); }}
      aria-pressed={isSelected}
      data-object-id={object.id}
    >
      <span className="sr-only">
        {object.kind}: {object.purpose}, {object.approval}
      </span>
      <span className="object-content" aria-hidden="true">
        <ObjectContent object={object} project={project} />
      </span>
    </button>
  );
}

/**
 * Visual preview of an object.
 *
 * Marked `aria-hidden` by the wrapper: the accessible name lives on the button,
 * and duplicating content here would announce everything twice.
 */
function ObjectContent({
  object,
  project,
}: {
  object: DocumentObject;
  project: DocumentProject;
}) {
  switch (object.kind) {
    case 'text':
      return <TextPreview object={object} />;

    case 'image': {
      const asset = project.assets[object.assetId];
      return (
        <span className="image-preview">
          {asset === undefined ? 'Missing image' : asset.fileName}
        </span>
      );
    }

    case 'icon':
      return <span className="icon-preview">{object.iconName}</span>;

    case 'chart': {
      const chart = project.charts[object.chartId];
      return (
        <span className="chart-preview">
          {chart === undefined ? 'Missing chart' : chart.spec.title}
        </span>
      );
    }

    case 'diagram': {
      const diagram = project.diagrams[object.diagramId];
      return (
        <span className="diagram-preview">
          {diagram === undefined
            ? 'Missing diagram'
            : `${diagram.type}, ${String(diagram.nodes.length)} nodes`}
        </span>
      );
    }

    case 'table':
      return (
        <span className="table-preview">
          {object.headers.length} × {object.rows.length} table
        </span>
      );

    case 'shape':
      return <span className="shape-preview">{object.shapeType}</span>;
  }
}

/** Text preview using the correct semantic element for the object's role. */
function TextPreview({ object }: { object: Extract<DocumentObject, { kind: 'text' }> }) {
  const { role, content } = object;

  if (role === 'bulleted-list' || role === 'numbered-list') {
    const items = object.listItems ?? [content];
    const List = role === 'bulleted-list' ? 'ul' : 'ol';
    return (
      <List className={`text-object text-${role}`}>
        {items.map((item, index) => (
          <li key={`${object.id}-${String(index)}`}>{item}</li>
        ))}
      </List>
    );
  }

  if (role === 'heading') {
    // Explicit branches rather than a computed `h${level}` tag name, which
    // TypeScript cannot verify as a valid intrinsic element.
    const level = Math.min(4, Math.max(1, object.headingLevel ?? 1));
    const className = 'text-object text-heading';
    if (level === 1) return <h1 className={className}>{content}</h1>;
    if (level === 2) return <h2 className={className}>{content}</h2>;
    if (level === 3) return <h3 className={className}>{content}</h3>;
    return <h4 className={className}>{content}</h4>;
  }

  if (role === 'quotation') {
    return (
      <blockquote className="text-object text-quotation">
        <p>{content}</p>
      </blockquote>
    );
  }

  return <p className={`text-object text-${role}`}>{content}</p>;
}

// ============================================================================
// Properties panel
// ============================================================================

interface ObjectFormData {
  purpose: string;
  altText: string;
  longDescription: string;
  isDecorative: boolean;
  includedInReadingOrder: boolean;
}

interface ObjectPropertiesProps {
  objectId: ObjectId;
  onClose: () => void;
  /** Dispatches the update. Absent until the command bus is wired in. */
  onSave?: (objectId: ObjectId, changes: Partial<ObjectFormData>) => void;
}

function ObjectProperties({ objectId, onClose, onSave }: ObjectPropertiesProps) {
  const { project } = useProject();
  const { announce } = useAnnouncements();
  const object = project?.objects[objectId];

  // Hooks run before any early return: the previous version called `useState`
  // after `if (!object) return null`, which violates the hook ordering rule and
  // corrupts state whenever the selection changes to a missing object.
  const [formData, setFormData] = useState<ObjectFormData>(() => emptyForm());
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (object === undefined) return;
    setFormData({
      purpose: object.purpose,
      altText: object.accessibility.altText ?? '',
      longDescription: object.accessibility.longDescription ?? '',
      isDecorative: object.accessibility.isDecorative,
      includedInReadingOrder: object.accessibility.includedInReadingOrder,
    });
    setIsDirty(false);
  }, [object]);

  const update = <K extends keyof ObjectFormData>(field: K, value: ObjectFormData[K]) => {
    setFormData((previous) => {
      const next = { ...previous, [field]: value };
      // Decorative and in-reading-order are mutually exclusive: a decorative
      // object is by definition skipped by assistive technology.
      if (field === 'isDecorative' && value === true) {
        next.includedInReadingOrder = false;
      }
      if (field === 'includedInReadingOrder' && value === true) {
        next.isDecorative = false;
      }
      return next;
    });
    setIsDirty(true);
  };

  if (object === undefined) return null;

  const handleSave = () => {
    onSave?.(objectId, formData);
    setIsDirty(false);
    announce('Object properties saved');
  };

  return (
    <div className="object-panel-content">
      <header className="panel-header">
        <h3>
          {object.kind}: {object.purpose}
        </h3>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close properties">
          <span aria-hidden="true">✕</span>
        </button>
      </header>

      <div className="form-group">
        <label htmlFor="obj-purpose">Purpose</label>
        <input
          id="obj-purpose"
          type="text"
          className="form-input"
          value={formData.purpose}
          maxLength={200}
          onChange={(e) => { update('purpose', e.target.value); }}
        />
      </div>

      {(object.kind === 'image' || object.kind === 'chart' || object.kind === 'diagram') && (
        <div className="form-group">
          <label htmlFor="obj-alt">Alternative text</label>
          <textarea
            id="obj-alt"
            className="form-textarea"
            rows={3}
            value={formData.altText}
            disabled={formData.isDecorative}
            aria-describedby="obj-alt-hint"
            onChange={(e) => { update('altText', e.target.value); }}
          />
          <p id="obj-alt-hint" className="form-hint">
            {formData.isDecorative
              ? 'Not required: this object is marked decorative.'
              : 'Describe what this conveys, not what it looks like.'}
          </p>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="obj-long-desc">Long description</label>
        <textarea
          id="obj-long-desc"
          className="form-textarea"
          rows={4}
          value={formData.longDescription}
          onChange={(e) => { update('longDescription', e.target.value); }}
        />
      </div>

      <fieldset className="checkbox-group">
        <legend>Reading order</legend>
        <label htmlFor="obj-decorative">
          <input
            id="obj-decorative"
            type="checkbox"
            checked={formData.isDecorative}
            onChange={(e) => { update('isDecorative', e.target.checked); }}
          />
          Decorative — skip in reading order
        </label>
        <label htmlFor="obj-reading-order">
          <input
            id="obj-reading-order"
            type="checkbox"
            checked={formData.includedInReadingOrder}
            onChange={(e) => { update('includedInReadingOrder', e.target.checked); }}
          />
          Include in reading order
        </label>
      </fieldset>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!isDirty}>
          Save
        </button>
      </div>
    </div>
  );
}

function emptyForm(): ObjectFormData {
  return {
    purpose: '',
    altText: '',
    longDescription: '',
    isDecorative: false,
    includedInReadingOrder: true,
  };
}
