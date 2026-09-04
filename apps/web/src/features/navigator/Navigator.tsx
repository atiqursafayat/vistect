// ============================================================================
// Document Navigator — pages tree
// ============================================================================
//
// The primary way a screen reader user moves through the document (F-1.7).
//
// Two accessibility rules shape this markup:
//
//   1. Interactive controls are never nested. The page row is a button, so its
//      reorder controls sit *beside* it, not inside — a button inside a button is
//      invalid HTML and screen readers cannot reach the inner one.
//   2. Every action announces its outcome, so a non-visual user gets confirmation
//      that a reorder took effect (§21.3).

import type { Page, PageId, PageTemplate } from '@vistect/domain/schema';
import { useMemo } from 'react';


import { useAnnouncements } from '../../app/Providers';
import { usePageOrder, useProject, useStore } from '../../state';

/** Human-readable template names, announced instead of the raw enum value. */
const TEMPLATE_LABELS: Readonly<Record<PageTemplate, string>> = {
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

interface PageTreeEntry {
  page: Page;
  index: number;
}

export interface NavigatorProps {
  id: string;
  /** Dispatches a page reorder. Absent until the command bus is wired in. */
  onReorderPages?: (pageOrder: PageId[]) => void;
}

export function Navigator({ id, onReorderPages }: NavigatorProps) {
  const { project } = useProject();
  const pageOrder = usePageOrder();
  const setSelectedObject = useStore((state) => state.setSelectedObject);
  const { announce } = useAnnouncements();

  const pageTree = useMemo<PageTreeEntry[]>(() => {
    if (project === null) return [];

    // `pageOrder` drives iteration, and entries missing from `pages` are dropped
    // via a type predicate rather than `filter(Boolean)`, which does not narrow.
    return pageOrder
      .map((pageId, index) => {
        const page = project.pages[pageId];
        return page === undefined ? null : { page, index };
      })
      .filter((entry): entry is PageTreeEntry => entry !== null);
  }, [project, pageOrder]);

  const handlePageActivate = (page: Page, index: number) => {
    setSelectedObject(null, page.id);
    announce(`Page ${String(index + 1)}, ${TEMPLATE_LABELS[page.template]}`);
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= pageOrder.length) return;

    const reordered = [...pageOrder];
    const [moved] = reordered.splice(index, 1);
    if (moved === undefined) return;
    reordered.splice(target, 0, moved);

    onReorderPages?.(reordered);
    announce(`Page moved from position ${String(index + 1)} to ${String(target + 1)}`);
  };

  if (project === null) {
    return (
      <section id={id} className="navigator" aria-label="Document navigator">
        <div className="empty-state">
          <h2>No project open</h2>
          <p>Create or open a project to navigate pages.</p>
        </div>
      </section>
    );
  }

  return (
    <section id={id} className="navigator" aria-label="Document navigator">
      <header className="navigator-header">
        <h2>Document navigator</h2>
        <p className="page-count">
          {pageOrder.length} {pageOrder.length === 1 ? 'page' : 'pages'}
        </p>
      </header>

      {pageTree.length === 0 ? (
        // Announced rather than rendered as silence, so an empty document is
        // distinguishable from a failure to load (AC F-1.7 §4).
        <output className="empty-state">This document has no pages yet.</output>
      ) : (
        <nav aria-label="Pages">
          <ol className="navigator-tree">
            {pageTree.map(({ page, index }) => (
              <li key={page.id} className="page-row">
                <button
                  type="button"
                  className={`page-node page-node-${page.status}`}
                  onClick={() => { handlePageActivate(page, index); }}
                >
                  <span className="page-template">{TEMPLATE_LABELS[page.template]}</span>
                  <span className="page-meta">
                    {page.objects.length} {page.objects.length === 1 ? 'object' : 'objects'},{' '}
                    {page.status}
                  </span>
                </button>

                <span className="page-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => { handleMove(index, -1); }}
                    disabled={index === 0}
                    aria-label={`Move ${TEMPLATE_LABELS[page.template]} up`}
                  >
                    <span aria-hidden="true">▲</span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => { handleMove(index, 1); }}
                    disabled={index === pageOrder.length - 1}
                    aria-label={`Move ${TEMPLATE_LABELS[page.template]} down`}
                  >
                    <span aria-hidden="true">▼</span>
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </section>
  );
}
