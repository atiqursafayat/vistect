/**
 * The one live region for the whole application (plan §7).
 *
 * One region, app-wide, is a deliberate constraint: several competing live regions is the
 * fastest way to make a screen reader unusable, because the later announcement cuts off the
 * earlier one and the user hears fragments of both. Everything that needs to be said aloud
 * comes through here, in the order it happened.
 *
 * It is visible as well as announced. A sighted collaborator — or a demo audience — should
 * be able to see the same sentence the screen reader just read, and status is never carried
 * by colour alone (§21.2).
 *
 * The paragraph is keyed by announcement id so the DOM node is replaced rather than mutated.
 * Two identical announcements in a row are then still two changes, and the second one is
 * not swallowed.
 */

export type Announcement = {
  id: number;
  text: string;
};

export function Announcer({ announcement }: { announcement: Announcement | undefined }) {
  return (
    <div className="announcer" role="status" aria-live="polite" aria-atomic="true">
      {announcement ? <p key={announcement.id}>{announcement.text}</p> : null}
    </div>
  );
}
