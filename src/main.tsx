/**
 * Boot. Fonts, styles, the session's store and tool runner, the saved snapshot, then React.
 *
 * The store and the runner are created here, once, and never replaced. They *are* the
 * session: `ui/services.ts` hands them to components through context, and nothing in
 * `src/core` ever learns that React exists.
 *
 * The saved snapshot is loaded before the first render, with a top-level `await`. The
 * alternative — render empty, then swap in the restored document — would announce a document
 * appearing out of nowhere a moment after the user has already started reading the page.
 *
 * Fonts are imported, not linked: they are the two faces `core/layout.ts` measures its
 * estimates against (`docs/day-0-findings.md`), they are served from this origin, and no
 * request leaves the machine to fetch them (§22.1).
 */
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/source-serif-4/400.css';
import '@fontsource/source-serif-4/600.css';
import './ui/styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createDocumentStore } from './core/store.js';
import { createToolRunner } from './core/tools/registry.js';
import { loadSnapshot } from './persist/idb.js';
import { App } from './ui/App.js';
import { newId, now } from './ui/ids.js';
import { ServicesContext } from './ui/services.js';

const deps = { now, newId };
const store = createDocumentStore(deps);
const run = createToolRunner(store, deps);

const outcome = await loadSnapshot();
let restoreSummary = outcome.summary;

if (outcome.status === 'restored') {
  try {
    store.hydrate(outcome.snapshot);
  } catch (error) {
    // The log is there but will not replay — a version of Vistect that wrote a command this
    // one cannot apply. Starting empty is the honest outcome; the saved copy is left alone so
    // an older build can still open it.
    restoreSummary = `Vistect found saved work in this browser but could not replay it, so this session starts empty. The saved copy has been left untouched. (${error instanceof Error ? error.message : String(error)})`;
  }
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('Vistect could not start: index.html has no element with id "root".');
}

createRoot(container).render(
  <StrictMode>
    <ServicesContext.Provider value={{ store, run }}>
      <App restoreSummary={restoreSummary} />
    </ServicesContext.Provider>
  </StrictMode>,
);
