/**
 * The page canvas — the visual rendering, and the thing D3-5 measures.
 *
 * Three decisions worth knowing before changing anything here:
 *
 *   1. **It is real semantic HTML, in reading order, and it is not `aria-hidden`.** It would
 *      be easy to hide it and treat the navigator as the only readable path, but the same
 *      structure is what the accessible HTML export emits (§13.5). Building it once means the
 *      export cannot drift from what the user was told is on the page.
 *   2. **DOM order is `page.readingOrder`, not visual order.** §10.3 allows the two to differ
 *      deliberately. Objects are absolutely positioned, so DOM order is free to be the
 *      *semantic* order — which is the order that gets exported.
 *   3. **No `transform: scale()` anywhere on this subtree.** Geometry validation reads
 *      `getBoundingClientRect()` (D0-2), and a scaled ancestor silently multiplies every
 *      number it returns. A page wider than the pane scrolls; it is never scaled.
 *
 * `data-object-id` is the contract with the measurement code: it is on the semantic element
 * itself, so a text box's declared height and its natural height can be compared directly.
 */
import { createElement } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { DocumentObject, TextObject } from '../core/model/objects.js';
import { textMetrics } from '../core/layout.js';
import type { Bounds } from '../core/model/primitives.js';
import type { Page, Theme } from '../core/model/project.js';
import { describeKind } from '../core/tools/common.js';
import { useProject } from './services.js';

const box = (bounds: Bounds): CSSProperties => ({
  left: `${String(bounds.x)}px`,
  top: `${String(bounds.y)}px`,
  width: `${String(bounds.width)}px`,
  minHeight: `${String(bounds.height)}px`,
});

/**
 * Type is set from `textMetrics` — the same function `core/layout.ts` estimates heights
 * with — rather than from a stylesheet that happens to use similar numbers. If the two ever
 * disagree, every overflow warning becomes noise: the estimate would be measuring one
 * typography and the browser rendering another.
 */
const typeStyle = (object: TextObject, theme: Theme): CSSProperties => {
  const metrics = textMetrics(theme, object.textRole, object.headingLevel);
  const heading = object.textRole === 'heading';
  const quiet =
    object.textRole === 'caption' ||
    object.textRole === 'source-note' ||
    object.textRole === 'footnote';
  return {
    fontFamily: heading
      ? `"${theme.fonts.heading}", ui-sans-serif, system-ui, sans-serif`
      : `"${theme.fonts.body}", Georgia, serif`,
    fontSize: `${String(metrics.fontSizePx)}px`,
    lineHeight: `${String(metrics.lineHeightPx)}px`,
    fontWeight: heading || object.textRole === 'statistic' ? 600 : 400,
    color: quiet ? theme.colors.muted : heading ? theme.colors.primary : theme.colors.text,
  };
};

/**
 * The element each text role becomes. Every role is listed and there is no `default`, so a new
 * text role is a lint error here rather than a silent `<p>` — and this is the function that
 * decides what the accessible HTML export emits, so an unconsidered role would ship as one.
 */
const tagFor = (object: TextObject): string => {
  switch (object.textRole) {
    case 'heading':
      return `h${String(object.headingLevel ?? 2)}`;
    case 'list':
      return object.ordered === true ? 'ol' : 'ul';
    case 'quote':
      return 'blockquote';
    case 'callout':
      return 'aside';
    // A statistic is a sentence a screen reader should read as prose, not a heading: it is
    // large because it matters visually, and `<p>` is what it actually is.
    case 'paragraph':
    case 'statistic':
    case 'caption':
    case 'source-note':
    case 'footnote':
      return 'p';
  }
};

const childrenFor = (object: TextObject): ReactNode => {
  if (object.textRole === 'list') {
    return (object.items ?? []).map((item, index) => (
      <li key={`${object.id}-${String(index)}`}>{item}</li>
    ));
  }
  if (object.textRole === 'quote') return <p>{object.content}</p>;
  return object.content;
};

const renderObject = (
  object: DocumentObject,
  theme: Theme,
  inReadingOrder: boolean,
): ReactNode => {
  const shared = {
    key: object.id,
    'data-object-id': object.id,
    'data-in-reading-order': inReadingOrder ? 'true' : 'false',
  };

  if (object.type === 'text') {
    return createElement(
      tagFor(object),
      {
        ...shared,
        className: `object text-${object.textRole}`,
        style: { ...box(object.bounds), ...typeStyle(object, theme) },
      },
      childrenFor(object),
    );
  }

  /**
   * Nothing but text is constructible on Day 1, so this is the shape of the placeholder the
   * later object kinds will replace, not a rendering of them. It says what it is out loud:
   * an unlabelled empty box on a page is exactly the thing this product exists to prevent.
   */
  const name =
    object.accessibility.accessibleName ?? object.accessibility.altText ?? describeKind(object);
  return (
    <div
      {...shared}
      className={`object placeholder placeholder-${object.type}`}
      style={box(object.bounds)}
      {...(object.accessibility.isDecorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': name })}
    >
      {describeKind(object)}
    </div>
  );
};

const PageArticle = ({
  page,
  theme,
  width,
  height,
}: {
  page: Page;
  theme: Theme;
  width: number;
  height: number;
}) => {
  const ordered = page.readingOrder
    .map((id) => page.objects.find((object) => object.id === id))
    .filter((object): object is DocumentObject => object !== undefined);
  // Rendered last, and never hidden: the user who has to fix a stray object is the user who
  // cannot see it, and hiding it would leave them with nothing to act on.
  const strays = page.objects.filter((object) => !page.readingOrder.includes(object.id));

  return (
    <article
      className="page"
      aria-label={`Page ${String(page.pageNumber)}${page.title ? `: ${page.title}` : ''}`}
      data-page-id={page.id}
      style={{
        width: `${String(width)}px`,
        height: `${String(height)}px`,
        background: theme.colors.background,
      }}
    >
      {ordered.map((object) => renderObject(object, theme, true))}
      {strays.map((object) => renderObject(object, theme, false))}
    </article>
  );
};

export function PageCanvas() {
  const project = useProject();

  if (!project) {
    return <p className="empty">There is no document to show yet.</p>;
  }

  return (
    <div className="canvas">
      {project.pages.map((page) => (
        <PageArticle
          key={page.id}
          page={page}
          theme={project.theme}
          width={project.geometry.widthPx}
          height={project.geometry.heightPx}
        />
      ))}
    </div>
  );
}
