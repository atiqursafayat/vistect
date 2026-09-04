// ============================================================================
// Document Navigator - Pages/Headings Tree
// ============================================================================

import React, { useMemo } from 'react';
import { useProject, useProjectPages, usePageOrder } from '../../state';
import type { Page, PageTemplate } from '@vistect/domain/schema';
import { useAnnouncements } from '../../app/Providers';

const TEMPLATE_LABELS: Record<PageTemplate, string> = {
  cover: 'Cover page',
  'text-led': 'Text-led page',
  'text-side-image': 'Text with side image',
  'full-width-image-caption': 'Full-width image with caption',
  statistics: 'Statistics page',
  chart: 'Chart page',
  diagram: 'Diagram page',
  'participant-story': 'Participant story',
  recommendations: 'Recommendations',
  'conclusion-contact': 'Conclusion and contact',
};

const TEMPLATE_ICONS: Record<PageTemplate, string> = {
  cover: '📄',
  'text-led': '📝',
  'text-side-image': '📷',
  'full-width-image-caption': '🖼️',
  statistics: '📊',
  chart: '📈',
  diagram: '🔗',
  'participant-story': '👤',
  recommendations: '✅',
  'conclusion-contact': '📞',
};

export function Navigator({ id }: { id: string }) {
  const { project } = useProject();
  const pages = useProjectPages();
  const pageOrder = usePageOrder();
  const { announce } = useAnnouncements();

  const pageTree = useMemo(() => {
    if (!project) return [];
    return pageOrder.map((pageId, index) => {
      const page = project.pages[pageId];
      if (!page) return null;
      return { page, index };
    }).filter(Boolean);
  }, [project, pageOrder]);

  const handlePageActivate = (pageId: string) => {
    // Navigate to page in editor
    announce(`Navigated to page ${pageId}`);
  };

  const handlePageReorder = (fromIndex: number, toIndex: number) => {
    // Would dispatch ReorderPages command
  };

  if (!project) {
    return (
      <section id={id} className="navigator" aria-label="Document navigator">
        <div className="empty-state">
          <h2>No project open</h2>
          <p>Create or open a project to navigate pages</p>
        </div>
      </section>
    );
  }

  return (
    <section id={id} className="navigator" aria-label="Document navigator">
      <header className="navigator-header">
        <h2>Document Navigator</h2>
        <span className="page-count">{pageOrder.length} pages</span>
      </header>

      <nav className="navigator-tree" role="tree" aria-label="Pages">
        <ul role="group" aria-label="Pages">
          {pageTree.map(({ page, index }) => (
            <li key={page.id} role="treeitem" aria-level={1} aria-setsize={pageOrder.length} aria-posinset={index + 1}>
              <button
                className={`page-node ${page.status}`}
                onClick={() => handlePageActivate(page.id)}
                aria-label={`${TEMPLATE_LABELS[page.template]}, ${page.status}, ${page.objects.length} objects`}
              >
                <span className="page-icon" aria-hidden="true">{TEMPLATE_ICONS[page.template]}</span>
                <span className="page-info">
                  <span className="page-template">{TEMPLATE_LABELS[page.template]}</span>
                  <span className="page-meta">{page.objects.length} objects • {page.status}</span>
                </span>
                <span className="page-actions" aria-hidden="true">
                  <button
                    className="icon-btn"
                    onClick={(e) => { e.stopPropagation(); /* Move up */ }}
                    aria-label="Move page up"
                    disabled={index === 0}
                  >▲</button>
                  <button
                    className="icon-btn"
                    onClick={(e) => { e.stopPropagation(); /* Move down */ }}
                    aria-label="Move page down"
                    disabled={index === pageOrder.length - 1}
                  >▼</button>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <footer className="navigator-footer">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => { /* Create page */ }}
          aria-label="Create new page"
        >
          <span aria-hidden="true">+</span> Add Page
        </button>
        <span className="shortcut-hint" aria-hidden="true">Alt+N to focus</span>
      </footer>
    </section>
  );
}