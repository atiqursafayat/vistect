/**
 * The application shell — landmarks, the one live region, and the two effects that connect
 * this page to a browser agent and to the user's own disk.
 *
 * The layout is a set of landmarks rather than panes (plan §7). A screen reader user moves
 * between them with one key press, so the regions are the primary navigation of this app,
 * not a visual arrangement that happens to have labels: navigator, the page itself, the
 * object explorer, warnings, decisions, activity, and the developer console.
 *
 * Everything that speaks goes through `announce`, which owns the only live region in the
 * app. Both callers of the tool runner — a real agent through `registerVistectTools`, and
 * the developer console — end up here, so an action sounds the same however it was invoked.
 *
 * Focus is never moved in response to an agent action (§21.3). The announcement says what
 * changed and where to deal with it; the user decides when to go there.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { isUnresolved } from '../core/model/findings.js';
import { registerVistectTools } from '../webmcp/register.js';
import type { WebMcpRegistration } from '../webmcp/types.js';
import { attachAutosave } from '../persist/idb.js';
import { ActivityStream } from './ActivityStream.js';
import { Announcer } from './Announcer.js';
import type { Announcement } from './Announcer.js';
import { announcementFor } from './announce.js';
import { DevAgentConsole } from './DevAgentConsole.js';
import { Navigator } from './Navigator.js';
import { ObjectExplorer } from './ObjectExplorer.js';
import { PageCanvas } from './PageCanvas.js';
import { useProject, useServices } from './services.js';

const SKIP_TARGETS = [
  { id: 'navigator', label: 'document navigator' },
  { id: 'pages', label: 'pages' },
  { id: 'explorer', label: 'object explorer' },
  { id: 'activity', label: 'activity' },
  { id: 'console', label: 'developer agent console' },
];

/** Day 1 produces neither findings nor decisions. The landmarks exist anyway: the announcer
 * sends people to them by name, so they must be somewhere to arrive at. */
function Warnings() {
  const project = useProject();
  const findings = (project?.findings ?? []).filter((finding) => finding.status === 'open');
  if (findings.length === 0) {
    return (
      <p className="empty">
        No warnings. Geometry and contrast checks report here once a page has been measured.
      </p>
    );
  }
  return (
    <ul>
      {findings.map((finding) => (
        <li key={finding.id}>
          <strong>{finding.severity}</strong>
          {`: ${finding.summary}`}
          {finding.evidence.length > 0 ? ` ${finding.evidence.join(' ')}` : ''}
        </li>
      ))}
    </ul>
  );
}

function Decisions() {
  const project = useProject();
  const decisions = (project?.decisions ?? []).filter(isUnresolved);
  if (decisions.length === 0) {
    return (
      <p className="empty">
        Nothing waiting for you. Every visual choice an agent proposes is listed here until you
        approve or reject it.
      </p>
    );
  }
  return (
    <ul>
      {decisions.map((decision) => (
        <li key={decision.id}>
          <strong>{decision.status}</strong>
          {`: ${decision.summary}`}
        </li>
      ))}
    </ul>
  );
}

export function App({ restoreSummary }: { restoreSummary: string }) {
  const { store, run } = useServices();
  const project = useProject();
  const [announcement, setAnnouncement] = useState<Announcement | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [registration, setRegistration] = useState<WebMcpRegistration | undefined>(undefined);
  const announcementId = useRef(0);

  const announce = useCallback((text: string) => {
    announcementId.current += 1;
    setAnnouncement({ id: announcementId.current, text });
  }, []);

  /**
   * One registration for the life of the page. `signal` rather than calling `dispose()` in
   * the cleanup: registration is asynchronous, and an abort signal is the only thing that
   * reliably cancels a registration that has not resolved yet — WebMCP has no
   * `unregisterTool` (D0-1).
   */
  useEffect(() => {
    const controller = new AbortController();
    void registerVistectTools(run, {
      agentName: 'the connected browser agent',
      signal: controller.signal,
      onResult: (result) => {
        const spoken = announcementFor(result, 'agent');
        if (spoken !== undefined) announce(spoken);
      },
    }).then(
      (result) => {
        // A registration that has already been superseded must not describe itself in the
        // header: in development this effect runs twice and only the second one is live.
        if (!controller.signal.aborted) setRegistration(result);
      },
      (error: unknown) => {
        announce(
          `Vistect could not offer its tools to a browser agent: ${error instanceof Error ? error.message : String(error)}`,
        );
      },
    );
    return () => {
      controller.abort();
    };
  }, [run, announce]);

  useEffect(() => attachAutosave(store, { onError: announce }), [store, announce]);

  return (
    <>
      <ul className="skip-links">
        {SKIP_TARGETS.map((target) => (
          <li key={target.id}>
            <a href={`#${target.id}`}>{`Skip to the ${target.label}`}</a>
          </li>
        ))}
      </ul>

      <header>
        <h1>Vistect</h1>
        <p>
          Independent visual authorship.{' '}
          {project
            ? `"${project.title}" is at version ${project.activeVersion}.`
            : 'No document yet.'}
        </p>
        <p>
          Everything runs in this browser. Your document is saved in this browser only, and
          nothing is sent anywhere.
        </p>
        <p>
          <strong>Agent tools: </strong>
          {registration
            ? `${registration.summary}${registration.registered.length > 0 ? ` Registered: ${registration.registered.join(', ')}.` : ''}`
            : 'Offering the tools to this browser…'}
        </p>
        <p>
          <strong>Saved work: </strong>
          {restoreSummary}
        </p>
      </header>

      <Announcer announcement={announcement} />

      <div className="layout">
        <nav id="navigator" aria-label="Document navigator" tabIndex={-1}>
          <h2>Document navigator</h2>
          <Navigator selectedId={selectedId} onSelect={setSelectedId} />
        </nav>

        <main id="pages" tabIndex={-1}>
          <h2>Pages</h2>
          <PageCanvas />
        </main>

        <div className="side">
          <section id="explorer" aria-labelledby="explorer-heading" tabIndex={-1}>
            <h2 id="explorer-heading">Object explorer</h2>
            <ObjectExplorer selectedId={selectedId} />
          </section>

          <section aria-labelledby="warnings-heading">
            <h2 id="warnings-heading">Warnings</h2>
            <Warnings />
          </section>

          <section aria-labelledby="decisions-heading">
            <h2 id="decisions-heading">Decisions awaiting your approval</h2>
            <Decisions />
          </section>
        </div>
      </div>

      <section id="activity" aria-labelledby="activity-heading" tabIndex={-1}>
        <h2 id="activity-heading">Activity</h2>
        <ActivityStream />
      </section>

      <section id="console" aria-labelledby="console-heading" tabIndex={-1}>
        <h2 id="console-heading">Developer agent console</h2>
        <DevAgentConsole onAnnounce={announce} />
      </section>
    </>
  );
}
