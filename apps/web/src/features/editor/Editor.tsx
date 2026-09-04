// ============================================================================
// Main Editor - Page Canvas + Object Editing
// ============================================================================

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useProject, useProjectPages, usePageOrder, useStore } from '../../state';
import type { DocumentObject, Page, PageTemplate, Bounds, RelativeConstraint } from '@vistect/domain/schema';
import { useAnnouncements } from '../../app/Providers';

export function Editor({ id }: { id: string }) {
  const { project } = useProject();
  const pages = useProjectPages();
  const pageOrder = usePageOrder();
  const { announce } = useAnnouncements();
  const selectedObjectId = useStore(state => state.selectedObjectId);
  const selectedPageId = useStore(state => state.selectedPageId);
  const setSelectedObject = useStore(state => state.setSelectedObject);
  const zoomLevel = useStore(state => state.zoomLevel);
  const setZoomLevel = useStore(state => state.setZoomLevel);

  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [showObjectPanel, setShowObjectPanel] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // Sync with store
  useEffect(() => {
    if (selectedPageId && currentPageId !== selectedPageId) {
      setCurrentPageId(selectedPageId);
    }
  }, [selectedPageId]);

  useEffect(() => {
    if (currentPageId) {
      useStore.getState().setSelectedObject(selectedObjectId, currentPageId);
    }
  }, [currentPageId, selectedObjectId]);

  const currentPage = useMemo(() => {
    if (!project || !currentPageId) return null;
    return project.pages[currentPageId] || null;
  }, [project, currentPageId]);

  const pageObjects = useMemo(() => {
    if (!currentPage || !project) return [];
    return currentPage.objects.map(id => project.objects[id]).filter(Boolean) as DocumentObject[];
  }, [currentPage, project]);

  const handlePageChange = (pageId: string) => {
    setCurrentPageId(pageId);
    announce(`Page ${pageId}`);
  };

  const handleObjectSelect = (objectId: string) => {
    setSelectedObject(objectId, currentPageId!);
    announce(`Selected ${objectId}`);
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel(Math.max(0.5, Math.min(2, zoomLevel + delta)));
    }
  }, [zoomLevel, setZoomLevel]);

  if (!project) {
    return (
      <section id={id} className="editor" aria-label="Document editor">
        <div className="welcome-screen">
          <h1>Welcome to Vistect</h1>
          <p>Create or open a project to start editing</p>
          <div className="welcome-actions">
            <button className="btn btn-primary btn-lg" onClick={() => { /* New project */ }}>
              New Project
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => { /* Open project */ }}>
              Open Project
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!currentPage) {
    return (
      <section id={id} className="editor" aria-label="Document editor">
        <div className="empty-state">
          <h2>No page selected</h2>
          <p>Select a page from the navigator or create a new page</p>
        </div>
      </section>
    );
  }

  return (
    <section id={id} className="editor" aria-label="Document editor" onWheel={handleWheel}>
      {/* Page selector */}
      <nav className="page-tabs" role="tablist" aria-label="Pages">
        {pageOrder.map((pageId, index) => {
          const page = project.pages[pageId];
          if (!page) return null;
          const isActive = pageId === currentPageId;
          return (
            <button
              key={pageId}
              role="tab"
              aria-selected={isActive}
              aria-controls={`page-panel-${pageId}`}
              id={`tab-${pageId}`}
              className={`page-tab ${isActive ? 'active' : ''} ${page.status}`}
              onClick={() => handlePageChange(pageId)}
            >
              <span className="page-tab-icon" aria-hidden="true">📄</span>
              <span className="page-tab-label">Page {index + 1}</span>
              <span className="page-tab-template">{page.template}</span>
              {page.objects.length > 0 && (
                <span className="page-tab-count">{page.objects.length}</span>
              )}
            </button>
          );
        })}
        <button
          role="tab"
          className="page-tab new-page-tab"
          onClick={() => { /* Create page */ }}
          aria-label="Create new page"
        >
          <span aria-hidden="true">+</span>
        </button>
      </nav>

      {/* Main canvas */}
      <div className="editor-canvas" ref={editorRef} style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}>
        <div
          role="tabpanel"
          id={`page-panel-${currentPageId}`}
          aria-labelledby={`tab-${currentPageId}`}
          className="page-canvas"
          style={{ width: '595px', height: '842px' }}
        >
          {/* Page margins */}
          <div className="page-margins" style={{ width: '595px', height: '842px' }}>
            {/* Template regions */}
            {getTemplateRegions(currentPage.template).map(region => (
              <div
                key={region.name}
                className="template-region"
                style={{
                  position: 'absolute',
                  left: `${region.bounds.x}px`,
                  top: `${region.bounds.y}px`,
                  width: `${region.bounds.w}px`,
                  height: `${region.bounds.h}px`,
                }}
                aria-label={`${region.name} region`}
              >
                <span className="region-label" aria-hidden="true">{region.name}</span>
              </div>
            ))}

            {/* Objects */}
            {pageObjects.map(obj => (
              <ObjectRenderer
                key={obj.id}
                object={obj}
                page={currentPage}
                project={project}
                isSelected={selectedObjectId === obj.id}
                onSelect={handleObjectSelect}
              />
            ))}

            {/* Drop zones for adding objects */}
            <div className="drop-zone" aria-label="Drop zone for new objects">
              <span>+ Add object</span>
            </div>
          </div>
        </div>
      </div>

      {/* Object properties panel */}
      {selectedObjectId && (
        <aside className="object-panel" role="complementary" aria-label="Object properties">
          <ObjectProperties
            objectId={selectedObjectId}
            pageId={currentPageId!}
            onClose={() => setSelectedObject(null, currentPageId!)}
          />
        </aside>
      )}
    </section>
  );
}

function getTemplateRegions(template: PageTemplate) {
  const margin = 72;
  const contentWidth = 595 - 2 * margin;
  const contentHeight = 842 - 2 * margin;

  const regions: Record<PageTemplate, Array<{ name: string; bounds: Bounds }>> = {
    cover: [
      { name: 'title', bounds: { x: margin, y: margin, w: contentWidth, h: contentHeight * 0.4 } },
      { name: 'subtitle', bounds: { x: margin, y: margin + contentHeight * 0.4, w: contentWidth, h: contentHeight * 0.2 } },
      { name: 'image', bounds: { x: margin, y: margin + contentHeight * 0.6, w: contentWidth, h: contentHeight * 0.3 } },
      { name: 'footer', bounds: { x: margin, y: margin + contentHeight * 0.9, w: contentWidth, h: contentHeight * 0.1 } },
    ],
    'text-led': [
      { name: 'header', bounds: { x: margin, y: margin, w: contentWidth, h: 60 } },
      { name: 'content', bounds: { x: margin, y: margin + 60, w: contentWidth, h: contentHeight - 120 } },
      { name: 'footer', bounds: { x: margin, y: 842 - margin - 60, w: contentWidth, h: 60 } },
    ],
    'text-side-image': [
      { name: 'header', bounds: { x: margin, y: margin, w: contentWidth, h: 60 } },
      { name: 'text', bounds: { x: margin, y: margin + 60, w: contentWidth * 0.6, h: contentHeight - 120 } },
      { name: 'image', bounds: { x: margin + contentWidth * 0.65, y: margin + 60, w: contentWidth * 0.35, h: contentHeight - 120 } },
      { name: 'footer', bounds: { x: margin, y: 842 - margin - 60, w: contentWidth, h: 60 } },
    ],
    'full-width-image-caption': [
      { name: 'header', bounds: { x: margin, y: margin, w: contentWidth, h: 60 } },
      { name: 'image', bounds: { x: margin, y: margin + 60, w: contentWidth, h: contentHeight * 0.6 } },
      { name: 'caption', bounds: { x: margin, y: margin + 60 + contentHeight * 0.6, w: contentWidth, h: 80 } },
      { name: 'footer', bounds: { x: margin, y: 842 - margin - 60, w: contentWidth, h: 60 } },
    ],
    statistics: [
      { name: 'header', bounds: { x: margin, y: margin, w: contentWidth, h: 60 } },
      { name: 'stats-grid', bounds: { x: margin, y: margin + 60, w: contentWidth, h: contentHeight - 120 } },
      { name: 'footer', bounds: { x: margin, y: 842 - margin - 60, w: contentWidth, h: 60 } },
    ],
    chart: [
      { name: 'header', bounds: { x: margin, y: margin, w: contentWidth, h: 60 } },
      { name: 'chart', bounds: { x: margin, y: margin + 60, w: contentWidth, h: contentHeight - 120 } },
      { name: 'footer', bounds: { x: margin, y: 842 - margin - 60, w: contentWidth, h: 60 } },
    ],
    diagram: [
      { name: 'header', bounds: { x: margin, y: margin, w: contentWidth, h: 60 } },
      { name: 'diagram', bounds: { x: margin, y: margin + 60, w: contentWidth, h: contentHeight - 120 } },
      { name: 'footer', bounds: { x: margin, y: 842 - margin - 60, w: contentWidth, h: 60 } },
    ],
    'participant-story': [
      { name: 'header', bounds: { x: margin, y: margin, w: contentWidth, h: 60 } },
      { name: 'quote', bounds: { x: margin, y: margin + 60, w: contentWidth, h: 150 } },
      { name: 'content', bounds: { x: margin, y: margin + 210, w: contentWidth, h: contentHeight - 270 } },
      { name: 'footer', bounds: { x: margin, y: 842 - margin - 60, w: contentWidth, h: 60 } },
    ],
    recommendations: [
      { name: 'header', bounds: { x: margin, y: margin, w: contentWidth, h: 60 } },
      { name: 'list', bounds: { x: margin, y: margin + 60, w: contentWidth, h: contentHeight - 120 } },
      { name: 'footer', bounds: { x: margin, y: 842 - margin - 60, w: contentWidth, h: 60 } },
    ],
    'conclusion-contact': [
      { name: 'header', bounds: { x: margin, y: margin, w: contentWidth, h: 60 } },
      { name: 'conclusion', bounds: { x: margin, y: margin + 60, w: contentWidth, h: contentHeight * 0.5 } },
      { name: 'contact', bounds: { x: margin, y: margin + 60 + contentHeight * 0.5, w: contentWidth, h: contentHeight * 0.5 - 60 } },
      { name: 'footer', bounds: { x: margin, y: 842 - margin - 60, w: contentWidth, h: 60 } },
    ],
  };

  return regions[currentPage.template] || regions['text-led'];
}

interface ObjectRendererProps {
  object: DocumentObject;
  page: Page;
  project: any;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function ObjectRenderer({ object, page, project, isSelected, onSelect }: ObjectRendererProps) {
  const style = {
    position: 'absolute',
    left: `${object.bounds.x}px`,
    top: `${object.bounds.y}px`,
    width: `${object.bounds.w}px`,
    height: `${object.bounds.h}px`,
    zIndex: object.layer,
  } as React.CSSProperties;

  const accessibility = object.accessibility;

  return (
    <div
      className={`object-renderer object-${object.kind} ${isSelected ? 'selected' : ''} ${accessibility.approval}`}
      style={style}
      onClick={() => onSelect(object.id)}
      role={accessibility.role || 'region'}
      aria-label={`${object.kind}: ${object.purpose}`}
      aria-describedby={accessibility.longDescription ? `${object.id}-desc` : undefined}
      data-object-id={object.id}
    >
      {isSelected && (
        <div className="selection-handles">
          <div className="handle handle-nw" data-resize="nw" />
          <div className="handle handle-ne" data-resize="ne" />
          <div className="handle handle-sw" data-resize="sw" />
          <div className="handle handle-se" data-resize="se" />
        </div>
      )}

      <div className="object-content">
        {renderObjectContent(object, project)}
      </div>

      {accessibility.longDescription && (
        <div id={`${object.id}-desc`} className="sr-only">
          {accessibility.longDescription}
        </div>
      )}
    </div>
  );
}

function renderObjectContent(object: DocumentObject, project: any) {
  switch (object.kind) {
    case 'text':
      return renderTextContent(object);
    case 'image':
      return renderImageContent(object, project);
    case 'icon':
      return renderIconContent(object);
    case 'chart':
      return renderChartContent(object, project);
    case 'diagram':
      return renderDiagramContent(object, project);
    case 'table':
      return renderTableContent(object);
    case 'shape':
      return renderShapeContent(object);
    default:
      return <div className="placeholder">Unknown object</div>;
  }
}

function renderTextContent(obj: any) {
  const { role, content, headingLevel, listItems, hyperlink } = obj;
  const Tag = role === 'heading' ? `h${headingLevel || 1}` : role === 'paragraph' ? 'p' : 'div';

  if (role === 'bulleted-list' || role === 'numbered-list') {
    const items = listItems || [content];
    return (
      <Tag className={`text-object ${role}`} role={role === 'bulleted-list' ? 'list' : 'list'}>
        {items.map((item: string, i: number) => (
          <li key={i} className="list-item">{item}</li>
        ))}
      </Tag>
    );
  }

  if (role === 'hyperlink' && hyperlink) {
    return (
      <a href={hyperlink} target="_blank" rel="noopener noreferrer" className="text-object hyperlink">
        {content}
      </a>
    );
  }

  return <Tag className={`text-object ${role}`}>{content}</Tag>;
}

function renderImageContent(obj: any, project: any) {
  const asset = project.assets?.[obj.assetId];
  const src = asset ? URL.createObjectURL(asset.blob) : '';
  const alt = obj.altTextApproved || obj.accessibility.altText || obj.purpose;

  return (
    <figure className="image-object">
      <img src={src} alt={alt} className="image-content" loading="lazy" />
      {obj.altTextApproved && <figcaption>{obj.altTextApproved}</figcaption>}
    </figure>
  );
}

function renderIconContent(obj: any) {
  return (
    <span className={`icon-object icon-${obj.iconFamily} icon-${obj.iconName}`} role="img" aria-label={obj.accessibility.altText || obj.purpose}>
      {obj.iconName}
    </span>
  );
}

function renderChartContent(obj: any, project: any) {
  const chart = project.charts?.[obj.chartId];
  if (!chart) return <div className="chart-placeholder">Chart not found</div>;

  return (
    <figure className="chart-object">
      <figcaption>{chart.spec.title}</figcaption>
      <div className="chart-placeholder">[Chart: {chart.spec.type}]</div>
    </figure>
  );
}

function renderDiagramContent(obj: any, project: any) {
  const diagram = project.diagrams?.[obj.diagramId];
  if (!diagram) return <div className="diagram-placeholder">Diagram not found</div>;

  return (
    <figure className="diagram-object">
      <figcaption>{diagram.type}</figcaption>
      <div className="diagram-placeholder">[Diagram: {diagram.nodes.length} nodes]</div>
    </figure>
  );
}

function renderTableContent(obj: any) {
  return (
    <figure className="table-object">
      {obj.caption && <figcaption>{obj.caption}</figcaption>}
      <table className="data-table">
        <thead>
          <tr>{obj.headers.map((h: string, i: number) => <th key={i} scope="col">{h}</th>)}</tr>
        </thead>
        <tbody>
          {obj.rows.map((row: string[], ri: number) => (
            <tr key={ri}>{row.map((cell: string, ci: number) => <td key={ci}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function renderShapeContent(obj: any) {
  return (
    <div className={`shape-object shape-${obj.shapeType}`} style={obj.style}>
      {obj.shapeType}
    </div>
  );
}

// ============================================================================
// Object Properties Panel
// ============================================================================

interface ObjectPropertiesProps {
  objectId: string;
  pageId: string;
  onClose: () => void;
}

function ObjectProperties({ objectId, pageId, onClose }: ObjectPropertiesProps) {
  const { project } = useProject();
  const { announce } = useAnnouncements();

  const object = project?.objects[objectId];
  if (!object) return null;

  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    purpose: object.purpose,
    altText: object.accessibility.altText || '',
    longDescription: object.accessibility.longDescription || '',
    isDecorative: object.accessibility.isDecorative,
    includedInReadingOrder: object.accessibility.includedInReadingOrder,
  });

  const handleSave = () => {
    // Would dispatch UpdateObject command
    setEditing(false);
    announce('Object updated');
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="object-panel-content">
      <header className="panel-header">
        <h3>{object.kind}: {object.purpose}</h3>
        <button className="icon-btn" onClick={onClose} aria-label="Close panel">✕</button>
      </header>

      <div className="panel-tabs" role="tablist">
        <button role="tab" aria-selected={true} className="active">Properties</button>
        <button role="tab" aria-selected={false}>Accessibility</button>
        <button role="tab" aria-selected={false}>Constraints</button>
        <button role="tab" aria-selected={false}>Decisions</button>
      </div>

      <div className="panel-content">
        <div className="form-group">
          <label htmlFor="obj-purpose">Purpose</label>
          <input
            id="obj-purpose"
            type="text"
            value={formData.purpose}
            onChange={e => handleChange('purpose', e.target.value)}
            className="form-input"
          />
        </div>

        {object.kind === 'image' && (
          <div className="form-group">
            <label htmlFor="obj-alt">Alt Text</label>
            <textarea
              id="obj-alt"
              value={formData.altText}
              onChange={e => handleChange('altText', e.target.value)}
              rows={3}
              className="form-textarea"
            />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="obj-long-desc">Long Description</label>
          <textarea
            id="obj-long-desc"
            value={formData.longDescription}
            onChange={e => handleChange('longDescription', e.target.value)}
            rows={4}
            className="form-textarea"
          />
        </div>

        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={formData.isDecorative}
              onChange={e => handleChange('isDecorative', e.target.checked)}
            >
              Decorative (exclude from reading order)
          </label>
          <label>
            <input
              type="checkbox"
              checked={formData.includedInReadingOrder}
              onChange={e => handleChange('includedInReadingOrder', e.target.checked)}
            >
              Include in reading order
          </label>
        </div>

        <div className="form-actions">
          <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

function handleChange(field: string, value: any) {
  // This would be handled by the parent component's state
}