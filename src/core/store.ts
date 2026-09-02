/**
 * The document store — spec §8.1, §23.2; architecture decision 2 in the plan.
 *
 * One append-only command log plus a reducer. No zustand, no CQRS, no event bus: this
 * file has zero dependencies, which is what keeps `src/core/` compilable with `lib` set
 * to `ES2023` and no `types` at all (see `tsconfig.core.json`). React subscribes through
 * `useSyncExternalStore`; the clock and the id generator are injected so unit tests get
 * byte-identical state on every run.
 *
 * Three invariants this file exists to hold:
 *
 *  1. Every command bumps the version, and a version number is never reused — not even
 *     after undo. `activeVersion` is therefore a reliable answer to "is what I read
 *     still true?", which is what `expectedDocumentVersion` on every write tool tests.
 *  2. A dispatch is atomic. A tool emitting three commands either applies all three or
 *     changes nothing, so a rejected write can never leave a half-built page.
 *  3. Undo is "replay the log without its last batch". A batch is one tool call, because
 *     that is the unit a person means when they say undo.
 */
import type { DocumentProject } from './model/project.js';
import type { Provenance } from './model/primitives.js';
import type { Command, CommandEnvelope } from './commands.js';
import { CommandError, applyCommand } from './commands.js';

export type StoreDeps = {
  /** ISO 8601 string. Injected: core must not reach for a clock. */
  now: () => string;
  newId: (prefix: string) => string;
};

/**
 * §23.2's audit trail. Wider than the command log on purpose: a read-only tool call
 * produces no command but must still be visible in the activity stream, or the user
 * cannot tell the difference between "the agent looked" and "nothing happened".
 */
export type ActivityEntry = {
  id: string;
  at: string;
  by: Provenance;
  toolName?: string;
  outcome: 'applied' | 'read' | 'rejected';
  /** One readable sentence. Rendered verbatim in the activity stream. */
  summary: string;
  /** Supporting lines: measured numbers, invalidated approvals, error guidance. */
  detail: string[];
  /** `activeVersion` after the entry was recorded. */
  documentVersion: number;
};

export type StoreState = {
  project: DocumentProject | undefined;
  log: CommandEnvelope[];
  activity: ActivityEntry[];
  /** Next version number to issue. Monotonic; never decreases, even on undo. */
  nextVersion: number;
};

/** What `persist/idb.ts` writes. The log is the source of truth; state is replayed. */
export type PersistedSnapshot = {
  schema: 1;
  log: CommandEnvelope[];
  activity: ActivityEntry[];
  nextVersion: number;
};

export type DispatchRequest = {
  commands: Command[];
  by: Provenance;
  toolName?: string;
  /**
   * The version the caller believes it is writing against. Omitted only by
   * `create_document`, which has no prior state to be stale against.
   */
  expectedDocumentVersion?: number;
};

export type DispatchSuccess = {
  ok: true;
  project: DocumentProject;
  versionBefore: number;
  versionAfter: number;
  /** One sentence per applied command, in order. */
  summaries: string[];
  invalidatedObjectIds: string[];
  invalidatedDecisionIds: string[];
};

export type DispatchFailure = {
  ok: false;
  code: string;
  /** Written to be read aloud, and always says what to do next (§19.4). */
  message: string;
  currentVersion: number;
};

export type DispatchResult = DispatchSuccess | DispatchFailure;

export type UndoResult =
  | { ok: true; summary: string; undoneSummaries: string[]; currentVersion: number }
  | { ok: false; message: string };

export type Store = {
  getState: () => StoreState;
  subscribe: (listener: () => void) => () => void;
  dispatch: (request: DispatchRequest) => DispatchResult;
  /** Records a read-only tool call in the activity stream (§23.2). Emits no command. */
  recordRead: (entry: {
    by: Provenance;
    toolName: string;
    summary: string;
    detail?: string[];
  }) => void;
  undo: () => UndoResult;
  canUndo: () => boolean;
  snapshot: () => PersistedSnapshot;
  /** Replays a persisted log. Throws if the log cannot be replayed. */
  hydrate: (snapshot: PersistedSnapshot) => void;
};

/**
 * Rebuild state from the log. Each envelope replays with the version and timestamp it
 * was originally issued with, so replay is reproduction, not re-execution.
 */
function replay(log: CommandEnvelope[]): DocumentProject | undefined {
  let project: DocumentProject | undefined;
  for (const envelope of log) {
    project = applyCommand(project, envelope.command, {
      version: envelope.resultingVersion,
      at: envelope.at,
      by: envelope.by,
    }).project;
  }
  return project;
}

const failure = (code: string, message: string, currentVersion: number): DispatchFailure => ({
  ok: false,
  code,
  message,
  currentVersion,
});

const asFailure = (error: unknown, currentVersion: number): DispatchFailure =>
  error instanceof CommandError
    ? failure(error.code, error.message, currentVersion)
    : failure(
        'internal-error',
        `The change could not be applied: ${error instanceof Error ? error.message : String(error)}`,
        currentVersion,
      );

export function createDocumentStore(deps: StoreDeps): Store {
  let state: StoreState = { project: undefined, log: [], activity: [], nextVersion: 1 };
  const listeners = new Set<() => void>();

  const commit = (next: StoreState): void => {
    state = next;
    for (const listener of listeners) listener();
  };

  const entry = (
    partial: Omit<ActivityEntry, 'id' | 'at' | 'documentVersion'>,
    at: string,
    documentVersion: number,
  ): ActivityEntry => ({ id: deps.newId('act'), at, documentVersion, ...partial });

  /** Rejections are recorded, not swallowed: §23.2's trail includes refused writes. */
  const reject = (request: DispatchRequest, result: DispatchFailure): DispatchFailure => {
    commit({
      ...state,
      activity: [
        ...state.activity,
        entry(
          {
            by: request.by,
            ...(request.toolName === undefined ? {} : { toolName: request.toolName }),
            outcome: 'rejected',
            summary: result.message,
            detail: [
              `Nothing changed. The document is still at version ${result.currentVersion}.`,
            ],
          },
          deps.now(),
          result.currentVersion,
        ),
      ],
    });
    return result;
  };

  /** Why a stale write is stale, in the message itself — not just "version mismatch". */
  const lastChange = (): string => {
    const last = state.log.at(-1);
    return last ? `The last change was: ${last.summary}` : 'No change is recorded.';
  };

  const dispatch = (request: DispatchRequest): DispatchResult => {
    const currentVersion = state.project?.activeVersion ?? 0;

    if (request.commands.length === 0) {
      return reject(
        request,
        failure(
          'no-commands',
          'That call asked for no change, so nothing was applied.',
          currentVersion,
        ),
      );
    }

    const creates = request.commands.some((c) => c.kind === 'create-document');

    if (request.expectedDocumentVersion === undefined) {
      if (state.project && !creates) {
        return reject(
          request,
          failure(
            'missing-expected-version',
            `Every write must say which version it was written against. The document is at version ${currentVersion}; send expectedDocumentVersion: ${currentVersion}.`,
            currentVersion,
          ),
        );
      }
    } else if (request.expectedDocumentVersion !== currentVersion) {
      return reject(
        request,
        failure(
          'stale-write',
          `Refused: this change was written against version ${request.expectedDocumentVersion}, but the document is now at version ${currentVersion}. ${lastChange()} Call get_document_overview to re-read the document, then send the change again with expectedDocumentVersion: ${currentVersion}.`,
          currentVersion,
        ),
      );
    }

    // Applied against a draft, so a command that throws half-way leaves state untouched.
    const at = deps.now();
    const batchId = deps.newId('batch');
    const envelopes: CommandEnvelope[] = [];
    const summaries: string[] = [];
    const invalidatedObjects = new Set<string>();
    const invalidatedDecisions = new Set<string>();
    let draft = state.project;
    let version = state.nextVersion;

    try {
      for (const command of request.commands) {
        const result = applyCommand(draft, command, { version, at, by: request.by });
        draft = result.project;
        envelopes.push({
          seq: state.log.length + envelopes.length + 1,
          batchId,
          command,
          at,
          by: request.by,
          summary: result.summary,
          resultingVersion: version,
        });
        summaries.push(result.summary);
        for (const id of result.invalidatedObjectIds) invalidatedObjects.add(id);
        for (const id of result.invalidatedDecisionIds) invalidatedDecisions.add(id);
        version += 1;
      }
    } catch (error) {
      return reject(request, asFailure(error, currentVersion));
    }

    if (!draft) {
      return reject(
        request,
        failure(
          'no-document',
          'No document exists yet. Call create_document first.',
          currentVersion,
        ),
      );
    }

    const detail: string[] = [];
    if (invalidatedObjects.size > 0) {
      detail.push(
        `${invalidatedObjects.size} approved item${invalidatedObjects.size === 1 ? '' : 's'} went back to needing review because the change affected ${invalidatedObjects.size === 1 ? 'it' : 'them'}.`,
      );
    }
    if (invalidatedDecisions.size > 0) {
      detail.push(
        `${invalidatedDecisions.size} approved decision${invalidatedDecisions.size === 1 ? '' : 's'} ${invalidatedDecisions.size === 1 ? 'is' : 'are'} now marked stale and need re-approval.`,
      );
    }

    commit({
      project: draft,
      log: [...state.log, ...envelopes],
      activity: [
        ...state.activity,
        entry(
          {
            by: request.by,
            ...(request.toolName === undefined ? {} : { toolName: request.toolName }),
            outcome: 'applied',
            summary: summaries.join(' '),
            detail,
          },
          at,
          draft.activeVersion,
        ),
      ],
      nextVersion: version,
    });

    return {
      ok: true,
      project: draft,
      versionBefore: currentVersion,
      versionAfter: draft.activeVersion,
      summaries,
      invalidatedObjectIds: [...invalidatedObjects],
      invalidatedDecisionIds: [...invalidatedDecisions],
    };
  };

  const undo = (): UndoResult => {
    const last = state.log.at(-1);
    if (!last) return { ok: false, message: 'There is nothing to undo yet.' };

    const removed = state.log.filter((e) => e.batchId === last.batchId);
    const kept = state.log.filter((e) => e.batchId !== last.batchId);

    let project: DocumentProject | undefined;
    try {
      project = replay(kept);
    } catch (error) {
      return {
        ok: false,
        message: `Undo could not be completed, so nothing was changed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    const currentVersion = project?.activeVersion ?? 0;
    const undoneSummaries = removed.map((e) => e.summary);
    const summary =
      removed.length === 1
        ? `Undid: ${undoneSummaries[0] ?? ''}`
        : `Undid ${removed.length} changes from one action: ${undoneSummaries.join(' ')}`;
    const at = deps.now();

    commit({
      project,
      log: kept,
      activity: [
        ...state.activity,
        entry(
          {
            by: { origin: 'user', createdAt: at },
            outcome: 'applied',
            summary,
            detail: [`The document is back at version ${currentVersion}.`],
          },
          at,
          currentVersion,
        ),
      ],
      // Deliberately not rewound: a version number is never handed out twice, so a
      // finding or measurement taken at an undone version stays detectably out of date.
      nextVersion: state.nextVersion,
    });

    return { ok: true, summary, undoneSummaries, currentVersion };
  };

  const recordRead: Store['recordRead'] = (input) => {
    const at = deps.now();
    commit({
      ...state,
      activity: [
        ...state.activity,
        entry(
          {
            by: input.by,
            toolName: input.toolName,
            outcome: 'read',
            summary: input.summary,
            detail: input.detail ?? [],
          },
          at,
          state.project?.activeVersion ?? 0,
        ),
      ],
    });
  };

  const hydrate = (incoming: PersistedSnapshot): void => {
    if (incoming.schema !== 1) {
      throw new CommandError(
        'unsupported-snapshot',
        `The saved work uses save format ${String(incoming.schema)}, which this version of Vistect cannot open.`,
      );
    }
    const project = replay(incoming.log);
    commit({
      project,
      log: incoming.log,
      activity: incoming.activity,
      nextVersion: Math.max(incoming.nextVersion, (project?.activeVersion ?? 0) + 1),
    });
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch,
    recordRead,
    undo,
    canUndo: () => state.log.length > 0,
    snapshot: () => ({
      schema: 1,
      log: state.log,
      activity: state.activity,
      nextVersion: state.nextVersion,
    }),
    hydrate,
  };
}
