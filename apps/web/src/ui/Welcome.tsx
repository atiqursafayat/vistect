// ============================================================================
// Welcome view
// ============================================================================
//
// The landing view (`currentView: 'welcome'`, the store's initial value). It
// previously had no branch in `App`, so `<main>` rendered nothing but the closed
// shortcut dialog: the app opened with an empty main landmark and no `<h1>`.
//
// Two things make this the product's `<h1>` owner:
//
//   1. A document needs exactly one top-level heading, and until a project is
//      open the product itself is the subject.
//   2. Focus management (`08-accessibility-review.md` §4) sends view changes to
//      the view's `<h1>`, so every view owes the user one.
//
// No project-creation control is offered yet: the command bus is not wired to
// the UI, and an affordance that silently does nothing is worse for a
// screen reader user than an honest absence.

export function Welcome() {
  return (
    <section className="welcome-view" aria-labelledby="welcome-title">
      <h1 id="welcome-title" tabIndex={-1}>
        Vistect
      </h1>

      <p className="welcome-lede">
        An accessible visual document workspace. Understand, author, inspect, verify, and publish
        multipage visual reports without relying on sight.
      </p>

      <h2>Getting oriented</h2>
      <ul className="welcome-orientation">
        <li>
          Press <kbd>?</kbd> for the full keyboard shortcut reference.
        </li>
        <li>
          Press <kbd>Alt</kbd> + <kbd>N</kbd> for the document navigator, which lists pages in
          authored order.
        </li>
        <li>
          Press <kbd>Alt</kbd> + <kbd>O</kbd> for the object explorer, which exposes each object&apos;s
          purpose, alt text, and approval state.
        </li>
        <li>
          Press <kbd>Escape</kbd> to return to the editor from any view.
        </li>
      </ul>

      <h2>How Vistect works</h2>
      <p>
        Deterministic facts, AI-assisted interpretations, and your own decisions are labelled and
        kept separate everywhere. Your browser agent may propose operations; nothing subjective is
        applied without your approval, and every export is hash-linked to the exact version you
        inspected.
      </p>
      <p>
        Projects are stored locally in this browser. Document content does not leave your device.
      </p>
    </section>
  );
}
