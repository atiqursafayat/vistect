/**
 * The activity stream — spec §23.2's audit trail, made readable.
 *
 * Newest first, because the question this answers is almost always "what just happened?".
 *
 * It has no live-region semantics on purpose. `Announcer` is the only live region in the app
 * (plan §7); a `role="log"` here would mean every agent action is spoken twice, in two
 * different wordings, and the second one would cut the first one off.
 *
 * Refused calls are listed alongside applied ones. A user who cannot see the screen has no
 * other way to tell "the agent tried and was refused" from "the agent never tried".
 */
import type { ActivityEntry } from '../core/store.js';
import { useStoreState } from './services.js';

/** Never colour alone (§21.2): the outcome is a word before it is a border colour. */
const OUTCOME: Record<ActivityEntry['outcome'], string> = {
  applied: 'Applied',
  read: 'Read',
  rejected: 'Refused',
};

const WHO: Record<ActivityEntry['by']['origin'], string> = {
  agent: 'agent',
  user: 'you',
  import: 'an import',
  system: 'Vistect',
};

const clock = (iso: string): string => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? iso
    : at.toLocaleTimeString(undefined, { timeStyle: 'medium' });
};

export function ActivityStream() {
  const { activity } = useStoreState();

  if (activity.length === 0) {
    return (
      <p className="empty">
        Nothing has happened yet. Every tool call — by the agent or by you — is listed here,
        including the ones that are refused.
      </p>
    );
  }

  return (
    <ol className="activity" aria-label={`${activity.length} entries, newest first`}>
      {[...activity].reverse().map((entry) => (
        <li key={entry.id} className={`activity-entry activity-${entry.outcome}`}>
          <p className="activity-head">
            <span className="activity-outcome">{OUTCOME[entry.outcome]}</span>
            {` by ${WHO[entry.by.origin]}${entry.toolName ? ` — ${entry.toolName}` : ''}, `}
            <time dateTime={entry.at}>{clock(entry.at)}</time>
            {`, at version ${entry.documentVersion}.`}
          </p>
          <p>{entry.summary}</p>
          {entry.detail.length > 0 ? (
            <ul className="activity-detail">
              {entry.detail.map((line, index) => (
                <li key={`${entry.id}-${String(index)}`}>{line}</li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
