/**
 * The command log — spec §8.1, §23.2, §27; architecture decision 2 in the plan.
 *
 * Every state change is a `Command`: fully-resolved data, no ids or timestamps
 * generated in here. That single rule is what makes undo work by replay (§8.1) instead
 * of by hand-written inverse operations, and it is why two replays of the same log
 * produce byte-identical state.
 *
 * The reducer is also where §27 lives: when a command touches an object that a human
 * has already approved, the approval — and any decision that governs that object —
 * flips to `stale`. Nothing silently keeps a sign-off it no longer earns.
 */
import type { Bounds, ApprovalState, Provenance } from './model/primitives.js';
import type { DocumentObject } from './model/objects.js';
import { objectText } from './model/objects.js';
import type {
  DocumentProject,
  IntentContract,
  Page,
  PageStatus,
  Theme,
} from './model/project.js';
import type { VisualDecision } from './model/findings.js';

export type Command =
  /** The only command that may run against an absent project. */
  | { kind: 'create-document'; project: DocumentProject }
  | { kind: 'update-intent-contract'; patch: Partial<IntentContract> }
  | { kind: 'set-theme'; theme: Theme }
  | { kind: 'add-page'; page: Page; index?: number }
  | { kind: 'add-object'; pageId: string; object: DocumentObject; readingOrderIndex?: number }
  | { kind: 'update-text-content'; objectId: string; content?: string; items?: string[] }
  /** Written by `measure_page` once the browser has measured the real render (§10.4). */
  | { kind: 'set-object-bounds'; objectId: string; bounds: Bounds }
  | { kind: 'set-object-approval'; objectId: string; approval: ApprovalState }
  | { kind: 'set-page-status'; pageId: string; status: PageStatus }
  | { kind: 'set-reading-order'; pageId: string; readingOrder: string[] }
  | { kind: 'record-decision'; decision: VisualDecision };

export type CommandKind = Command['kind'];

/** Context the reducer is given instead of reaching for a clock or an id generator. */
export type CommandContext = {
  /** Version the resulting state carries. */
  version: number;
  /** ISO timestamp recorded in the envelope, so replay reproduces it exactly. */
  at: string;
  /** Who asked for this command; copied into the version log. */
  by: Provenance;
};

export type CommandEnvelope = {
  seq: number;
  /**
   * All commands from one tool call share a batch id. Undo removes a whole batch,
   * because "undo" to a person means the tool call they just heard about, not a
   * fragment of it.
   */
  batchId: string;
  command: Command;
  at: string;
  /** Who asked for it. §23.2's audit trail is this field across the whole log. */
  by: Provenance;
  /** One readable sentence — the announcer, activity stream and version log share it. */
  summary: string;
  resultingVersion: number;
};

/**
 * Objects a command changes. Drives §27 invalidation, so a command that is missing an
 * id here would silently keep a stale approval — the one bug this file must not have.
 */
export function touchedObjectIds(command: Command): string[] {
  switch (command.kind) {
    case 'update-text-content':
    case 'set-object-bounds':
    case 'set-object-approval':
      return [command.objectId];
    case 'set-reading-order':
      return command.readingOrder;
    case 'add-object':
      return [command.object.id];
    case 'create-document':
    case 'update-intent-contract':
    case 'set-theme':
    case 'add-page':
    case 'set-page-status':
    case 'record-decision':
      return [];
  }
}

/**
 * Commands that must not invalidate a human's sign-off.
 *
 * `set-object-bounds` is the interesting one: it carries *measured* geometry for a
 * layout that already existed, so invalidating on it would flip every approval on the
 * page every time `measure_page` ran, and §27 would become noise nobody reads.
 * A material geometry change surfaces as a validation finding instead.
 */
const PRESERVES_APPROVAL: ReadonlySet<CommandKind> = new Set<CommandKind>([
  'set-object-approval',
  'set-object-bounds',
  'add-object',
  'record-decision',
]);

const pageLabel = (project: DocumentProject, pageId: string): string => {
  const page = project.pages.find((p) => p.id === pageId);
  if (!page) return 'an unknown page';
  return page.title ? `page ${page.pageNumber} (${page.title})` : `page ${page.pageNumber}`;
};

/** Short enough to stay comfortable when a screen reader reads it mid-sentence. */
const excerpt = (text: string, max = 48): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
};

/**
 * Names an object the way a person would: by what it says, not by its id. Every summary
 * that mentions an object goes through here, so the activity stream, the announcer, the
 * version log and a stale-write error all describe it identically.
 */
const objectLabel = (project: DocumentProject, objectId: string): string => {
  for (const page of project.pages) {
    const object = page.objects.find((o) => o.id === objectId);
    if (!object) continue;
    const where = `on ${pageLabel(project, page.id)}`;
    const text = objectText(object);
    return text && text.trim().length > 0
      ? `the ${object.role} "${excerpt(text)}" ${where}`
      : `the ${object.role} ${where}`;
  }
  return 'an unknown object';
};

/**
 * One plain sentence per command. This is the string a screen reader hears after an
 * agent acts (§20.2), so it names what changed and where — never "operation succeeded".
 */
export function describeCommand(command: Command, after: DocumentProject): string {
  switch (command.kind) {
    case 'create-document':
      return `Created "${after.title}" with ${after.pages.length} page${after.pages.length === 1 ? '' : 's'}.`;
    case 'update-intent-contract': {
      const fields = Object.keys(command.patch);
      return `Updated the intent contract: ${fields.join(', ')}.`;
    }
    case 'set-theme':
      return `Applied a theme using ${command.theme.fonts.heading} for headings and ${command.theme.fonts.body} for body text.`;
    case 'add-page':
      return `Added ${pageLabel(after, command.page.id)} using the ${command.page.templateId} template.`;
    case 'add-object':
      return `Added ${objectLabel(after, command.object.id)}.`;
    case 'update-text-content':
      return `Rewrote ${objectLabel(after, command.objectId)}.`;
    case 'set-object-bounds':
      return `Recorded measured geometry for ${objectLabel(after, command.objectId)}.`;
    case 'set-object-approval':
      return `Marked ${objectLabel(after, command.objectId)} ${command.approval.status}.`;
    case 'set-page-status':
      return `Set ${pageLabel(after, command.pageId)} to ${command.status}.`;
    case 'set-reading-order':
      return `Reordered ${command.readingOrder.length} objects on ${pageLabel(after, command.pageId)} for screen reader navigation.`;
    case 'record-decision':
      return `Recorded a ${command.decision.decisionType} decision: ${command.decision.summary}`;
  }
}

/**
 * A command that cannot be applied to this state. The message is written for the person
 * who will hear it read aloud, and always says what to do next (§19.4).
 */
export class CommandError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'CommandError';
    this.code = code;
  }
}

const requirePage = (project: DocumentProject, pageId: string): Page => {
  const page = project.pages.find((p) => p.id === pageId);
  if (!page) {
    throw new CommandError(
      'page-not-found',
      `No page with id "${pageId}". Call get_document_structure to list the current page ids.`,
    );
  }
  return page;
};

const withObject = (
  project: DocumentProject,
  objectId: string,
  update: (object: DocumentObject) => DocumentObject,
): DocumentProject => {
  let found = false;
  const pages = project.pages.map((page) => {
    if (!page.objects.some((o) => o.id === objectId)) return page;
    found = true;
    return { ...page, objects: page.objects.map((o) => (o.id === objectId ? update(o) : o)) };
  });
  if (!found) {
    throw new CommandError(
      'object-not-found',
      `No object with id "${objectId}". Call inspect_page to list the objects on a page.`,
    );
  }
  return { ...project, pages };
};

/** Page numbers are positional, never stored input, so an insert renumbers the rest. */
const renumber = (pages: Page[]): Page[] =>
  pages.map((page, index) =>
    page.pageNumber === index + 1 ? page : { ...page, pageNumber: index + 1 },
  );

const insertAt = <T>(list: T[], item: T, index: number | undefined): T[] => {
  const at = index === undefined ? list.length : Math.max(0, Math.min(index, list.length));
  return [...list.slice(0, at), item, ...list.slice(at)];
};

function reduce(
  project: DocumentProject,
  command: Command,
  ctx: CommandContext,
): DocumentProject {
  switch (command.kind) {
    case 'create-document':
      throw new CommandError(
        'document-exists',
        'A document already exists in this session. Reload to start a new one.',
      );

    case 'update-intent-contract':
      return { ...project, intentContract: { ...project.intentContract, ...command.patch } };

    case 'set-theme':
      return { ...project, theme: command.theme };

    case 'add-page':
      return {
        ...project,
        pages: renumber(insertAt(project.pages, command.page, command.index)),
      };

    case 'add-object': {
      const page = requirePage(project, command.pageId);
      if (page.objects.some((o) => o.id === command.object.id)) {
        throw new CommandError(
          'object-exists',
          `Object "${command.object.id}" is already on ${pageLabel(project, page.id)}.`,
        );
      }
      const object: DocumentObject = {
        ...command.object,
        pageId: page.id,
        versionCreated: ctx.version,
        versionModified: ctx.version,
      };
      const readingOrder = object.accessibility.includedInReadingOrder
        ? insertAt(page.readingOrder, object.id, command.readingOrderIndex)
        : page.readingOrder;
      const next: Page = { ...page, objects: [...page.objects, object], readingOrder };
      return { ...project, pages: project.pages.map((p) => (p.id === page.id ? next : p)) };
    }

    case 'update-text-content':
      return withObject(project, command.objectId, (object) => {
        if (object.type !== 'text') {
          throw new CommandError(
            'not-text',
            `${objectLabel(project, object.id)} is a ${object.type}, not text. Its content cannot be rewritten with this tool.`,
          );
        }
        return {
          ...object,
          ...(command.content === undefined ? {} : { content: command.content }),
          ...(command.items === undefined ? {} : { items: command.items }),
        };
      });

    case 'set-object-bounds':
      return withObject(project, command.objectId, (object) => ({
        ...object,
        bounds: command.bounds,
      }));

    case 'set-object-approval':
      return withObject(project, command.objectId, (object) => ({
        ...object,
        approval: command.approval,
      }));

    case 'set-page-status': {
      requirePage(project, command.pageId);
      return {
        ...project,
        pages: project.pages.map((p) =>
          p.id === command.pageId ? { ...p, status: command.status } : p,
        ),
      };
    }

    case 'set-reading-order': {
      const page = requirePage(project, command.pageId);
      const expected = page.objects
        .filter((o) => o.accessibility.includedInReadingOrder)
        .map((o) => o.id);
      const missing = expected.filter((id) => !command.readingOrder.includes(id));
      const unknown = command.readingOrder.filter((id) => !expected.includes(id));
      if (missing.length > 0 || unknown.length > 0) {
        throw new CommandError(
          'reading-order-incomplete',
          `A reading order must list every object exposed to a screen reader on ${pageLabel(project, page.id)}, exactly once. ${missing.length > 0 ? `Missing: ${missing.join(', ')}. ` : ''}${unknown.length > 0 ? `Not on this page or decorative: ${unknown.join(', ')}.` : ''}`.trim(),
        );
      }
      return {
        ...project,
        pages: project.pages.map((p) =>
          p.id === page.id ? { ...p, readingOrder: [...command.readingOrder] } : p,
        ),
      };
    }

    case 'record-decision': {
      const others = project.decisions.filter((d) => d.id !== command.decision.id);
      return { ...project, decisions: [...others, command.decision] };
    }
  }
}

export type CommandResult = {
  project: DocumentProject;
  /** `describeCommand` for this command, computed once and reused by every surface. */
  summary: string;
  /** Approvals §27 cleared. The announcer must say these out loud, not swallow them. */
  invalidatedObjectIds: string[];
  invalidatedDecisionIds: string[];
};

/**
 * §27. An edit to an approved object cannot leave the approval standing, and it cannot
 * leave a decision that governs that object standing either. Both flip to `stale`,
 * keeping `approvedBy`/`approvedAt` so the record still shows who signed off on what.
 */
function invalidate(
  project: DocumentProject,
  command: Command,
  ctx: CommandContext,
): { project: DocumentProject; objectIds: string[]; decisionIds: string[] } {
  const touched = touchedObjectIds(command);
  if (touched.length === 0) return { project, objectIds: [], decisionIds: [] };

  const preserve = PRESERVES_APPROVAL.has(command.kind);
  const objectIds: string[] = [];

  const pages = project.pages.map((page) => {
    let changed = false;
    const objects = page.objects.map((object) => {
      if (!touched.includes(object.id)) return object;
      changed = true;
      const stale = !preserve && object.approval.status === 'approved';
      if (stale) objectIds.push(object.id);
      return {
        ...object,
        versionModified: ctx.version,
        ...(stale ? { approval: { ...object.approval, status: 'stale' as const } } : {}),
      };
    });
    return changed ? { ...page, objects } : page;
  });

  const decisionIds: string[] = [];
  const decisions = project.decisions.map((decision) => {
    if (preserve || decision.status !== 'approved') return decision;
    if (!decision.targetIds.some((id) => touched.includes(id))) return decision;
    decisionIds.push(decision.id);
    return {
      ...decision,
      status: 'stale' as const,
      staleReason: `${describeCommand(command, project)} The approved choice may no longer hold.`,
    };
  });

  return { project: { ...project, pages, decisions }, objectIds, decisionIds };
}

/**
 * The single state transition in the application. Pure: same log in, same state out,
 * which is what lets `undo` be "replay the log without its last entry".
 *
 * Throws `CommandError` when the command cannot apply. The store turns that into a
 * failed tool result; it never leaves state half-changed, because nothing is written
 * until this function returns.
 */
export function applyCommand(
  project: DocumentProject | undefined,
  command: Command,
  ctx: CommandContext,
): CommandResult {
  if (command.kind === 'create-document') {
    if (project) {
      throw new CommandError(
        'document-exists',
        'A document already exists in this session. Reload the page to start a new one.',
      );
    }
    const created: DocumentProject = {
      ...command.project,
      activeVersion: ctx.version,
      createdAt: ctx.at,
      updatedAt: ctx.at,
      versions: [],
    };
    const summary = describeCommand(command, created);
    created.versions = [{ version: ctx.version, at: ctx.at, summary, by: ctx.by }];
    return { project: created, summary, invalidatedObjectIds: [], invalidatedDecisionIds: [] };
  }

  if (!project) {
    throw new CommandError(
      'no-document',
      `Cannot apply "${command.kind}": no document exists yet. Call create_document first.`,
    );
  }

  const reduced = reduce(project, command, ctx);
  const { project: invalidated, objectIds, decisionIds } = invalidate(reduced, command, ctx);
  const summary = describeCommand(command, invalidated);
  return {
    project: {
      ...invalidated,
      activeVersion: ctx.version,
      updatedAt: ctx.at,
      versions: [
        ...invalidated.versions,
        { version: ctx.version, at: ctx.at, summary, by: ctx.by },
      ],
    },
    summary,
    invalidatedObjectIds: objectIds,
    invalidatedDecisionIds: decisionIds,
  };
}
