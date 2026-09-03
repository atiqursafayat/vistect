/**
 * The document navigator — the primary way the document is read without seeing it (§9.2).
 *
 * A `tree` rather than a list, because the document *is* a hierarchy: pages contain objects,
 * and the objects appear here in reading order, which is the order a screen reader will meet
 * them in the export. Reading order is stored, not derived (§10.3), so this tree is also how
 * a user checks that the order they intended is the order that exists.
 *
 * Keyboard model is the ARIA tree pattern: one tab stop for the whole tree (roving
 * tabindex), arrows to move, right and left to expand and collapse, Enter to inspect.
 *
 * Focus is moved only in response to a key press. An agent action re-renders this tree —
 * often while the user is reading somewhere else in it — and stealing focus then would lose
 * their place. That is the rule in plan §7, and `focusNextRef` below is how it is kept.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { DocumentObject } from '../core/model/objects.js';
import { objectText } from '../core/model/objects.js';
import type { Page } from '../core/model/project.js';
import { describeKind, plural } from '../core/tools/common.js';
import { useProject } from './services.js';

/**
 * The tree is flattened and each row declares its own `aria-level`, `aria-posinset` and
 * `aria-setsize`. That is a legal ARIA tree and it keeps one list to walk with the arrow
 * keys, rather than a nested structure plus a parallel index to navigate it by.
 */
type RowBase = {
  id: string;
  label: string;
  level: 1 | 2;
  posinset: number;
  setsize: number;
};

type Row =
  | (RowBase & { kind: 'page'; expanded: boolean; hasChildren: boolean })
  | (RowBase & { kind: 'object'; pageId: string });

const shorten = (text: string, max = 60): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
};

/**
 * The agent is given the raw approval status — `stale`, `proposed` — because an enum value is
 * what it can reason about. A person is given the sentence instead, and "needs review" is the
 * exact phrase the announcer tells them to look for after a change invalidates an approval
 * (§27), so it is spelled the same way here.
 */
const describeApproval = (object: DocumentObject): string => {
  switch (object.approval.status) {
    case 'stale':
      return ' — needs review';
    case 'proposed':
      return ' — proposed, not yet approved';
    case 'rejected':
      return ' — rejected';
    case 'approved':
      return ' — approved';
    case 'unreviewed':
      return '';
  }
};

/**
 * An object with no place in the reading order is a real defect (§10.3), not a rendering
 * detail, so it is listed last and says so rather than being quietly left out.
 */
const objectRowLabel = (object: DocumentObject, position: number | undefined): string => {
  const text = objectText(object);
  const lead = position === undefined ? 'Not in the reading order:' : `${position}.`;
  return `${lead} ${describeKind(object)}${text ? `: ${shorten(text)}` : ''}${describeApproval(object)}`;
};

type Child = { object: DocumentObject; position: number | undefined };

const pageChildren = (page: Page): Child[] => {
  const byId = new Map(page.objects.map((object) => [object.id, object]));
  const children: Child[] = [];
  for (const id of page.readingOrder) {
    const object = byId.get(id);
    if (object) children.push({ object, position: children.length + 1 });
  }
  for (const object of page.objects) {
    if (!page.readingOrder.includes(object.id)) children.push({ object, position: undefined });
  }
  return children;
};

const pageRowLabel = (page: Page): string =>
  `Page ${page.pageNumber}${page.title ? `: ${page.title}` : ''} — ${page.templateId} template, ${
    page.objects.length === 0 ? 'empty' : plural(page.objects.length, 'object')
  }, ${page.status}`;

export type NavigatorProps = {
  /** The page or object the object explorer is showing, so the tree can mark it selected. */
  selectedId: string | undefined;
  onSelect: (id: string) => void;
};

export function Navigator({ selectedId, onSelect }: NavigatorProps) {
  const project = useProject();
  const [collapsedPages, setCollapsedPages] = useState<readonly string[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const treeRef = useRef<HTMLUListElement>(null);
  const focusNextRef = useRef(false);

  const rows = useMemo<Row[]>(() => {
    if (!project) return [];
    const out: Row[] = [];
    project.pages.forEach((page, pageIndex) => {
      const expanded = !collapsedPages.includes(page.id);
      out.push({
        kind: 'page',
        id: page.id,
        label: pageRowLabel(page),
        level: 1,
        posinset: pageIndex + 1,
        setsize: project.pages.length,
        expanded,
        hasChildren: page.objects.length > 0,
      });
      if (!expanded) return;
      const children = pageChildren(page);
      children.forEach(({ object, position }, index) => {
        out.push({
          kind: 'object',
          id: object.id,
          label: objectRowLabel(object, position),
          level: 2,
          posinset: index + 1,
          setsize: children.length,
          pageId: page.id,
        });
      });
    });
    return out;
  }, [project, collapsedPages]);
  /**
   * `findIndex` returns -1 when the row that was active has gone — its page was collapsed, or
   * an agent removed the object while the user was reading. Falling back to the first row
   * keeps exactly one tab stop in the tree, which is what makes it one stop in the page.
   */
  const activeIndex = Math.max(
    0,
    rows.findIndex((row) => row.id === activeId),
  );
  const activeRowId = rows[activeIndex]?.id;

  /**
   * No dependency array on purpose. One key press can both expand a page and move the active
   * row, and those land in the same commit; the ref, not the dependencies, decides whether
   * focus moves. Every other render — including every agent action — leaves focus alone.
   */
  useEffect(() => {
    if (!focusNextRef.current) return;
    focusNextRef.current = false;
    treeRef.current?.querySelector<HTMLElement>('[data-row][tabindex="0"]')?.focus();
  });

  const focusRow = (id: string | undefined): void => {
    if (id === undefined) return;
    focusNextRef.current = true;
    setActiveId(id);
  };

  const setExpanded = (pageId: string, expanded: boolean): void => {
    focusNextRef.current = true;
    setCollapsedPages((current) =>
      expanded
        ? current.filter((id) => id !== pageId)
        : current.includes(pageId)
          ? current
          : [...current, pageId],
    );
  };
  /**
   * `default: return` before the shared `preventDefault()` is the point: the tree owns the
   * arrow keys, Home, End, Enter and Space, and hands every other key back — Tab still
   * leaves the tree, and a screen reader's own shortcuts still reach it.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
    const row = rows[activeIndex];
    if (!row) return;
    switch (event.key) {
      case 'ArrowDown':
        focusRow(rows[activeIndex + 1]?.id);
        break;
      case 'ArrowUp':
        focusRow(rows[activeIndex - 1]?.id);
        break;
      case 'Home':
        focusRow(rows[0]?.id);
        break;
      case 'End':
        focusRow(rows[rows.length - 1]?.id);
        break;
      case 'ArrowRight':
        if (row.kind !== 'page' || !row.hasChildren) return;
        if (row.expanded) focusRow(rows[activeIndex + 1]?.id);
        else setExpanded(row.id, true);
        break;
      case 'ArrowLeft':
        if (row.kind === 'object') focusRow(row.pageId);
        else if (row.expanded && row.hasChildren) setExpanded(row.id, false);
        else return;
        break;
      case 'Enter':
      case ' ':
        onSelect(row.id);
        break;
      default:
        return;
    }
    event.preventDefault();
  };
  if (!project) {
    return (
      <p className="empty">
        No document yet. Ask the agent to make one, or call <code>create_document</code>{' '}
        yourself from the developer agent console.
      </p>
    );
  }

  return (
    <ul
      className="tree"
      role="tree"
      aria-label="Pages, and their objects in reading order"
      ref={treeRef}
      onKeyDown={handleKeyDown}
    >
      {rows.map((row) => (
        /*
         * The keyboard interface for a tree belongs to the tree, not to each row: the
         * `onKeyDown` above is on the `<ul>`, which is the whole point of a roving tabindex —
         * exactly one row is focusable and the container routes the arrow keys to it. Adding a
         * handler to every `<li>` as well would double-handle every key press, because the
         * event bubbles. `click-events-have-key-events` reads one element at a time and cannot
         * see the container, so it is switched off for this element only.
         */
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events
        <li
          key={row.id}
          role="treeitem"
          data-row=""
          className={`row row-${row.kind}`}
          tabIndex={row.id === activeRowId ? 0 : -1}
          aria-level={row.level}
          aria-posinset={row.posinset}
          aria-setsize={row.setsize}
          aria-selected={row.id === selectedId}
          {...(row.kind === 'page' && row.hasChildren ? { 'aria-expanded': row.expanded } : {})}
          onClick={() => {
            focusRow(row.id);
            onSelect(row.id);
          }}
        >
          {row.label}
        </li>
      ))}
    </ul>
  );
}
