// ============================================================================
// Keyboard Shortcut Help Dialog
// ============================================================================
//
// Uses the native `<dialog>` element rather than a `role="dialog"` div: the
// browser then provides focus trapping, backdrop dismissal, Escape handling, and
// focus restoration — behaviour a hand-rolled overlay has to reimplement and
// usually gets wrong for screen reader and keyboard users.

import { useEffect, useRef, useState } from 'react';

const SHORTCUTS = {
  global: [
    { keys: ['Alt', 'U'], description: 'Open decision queue' },
    { keys: ['Alt', 'W'], description: 'Open warning queue' },
    { keys: ['Alt', 'A'], description: 'Open activity stream' },
    { keys: ['Alt', 'N'], description: 'Open navigator' },
    { keys: ['Alt', 'O'], description: 'Open object explorer' },
    { keys: ['Alt', 'P'], description: 'Open privacy centre' },
    { keys: ['Escape'], description: 'Close dialog or cancel' },
    { keys: ['?'], description: 'Show this help' },
  ],
  navigator: [
    { keys: ['Enter'], description: 'Activate page' },
    { keys: ['Tab'], description: 'Move between pages and controls' },
  ],
  explorer: [
    { keys: ['Enter'], description: 'Select object' },
    { keys: ['Space'], description: 'Toggle expand' },
    { keys: ['Tab'], description: 'Move between objects' },
  ],
  editor: [
    { keys: ['Ctrl', 'Mouse wheel'], description: 'Zoom canvas' },
    { keys: ['Ctrl', '+'], description: 'Zoom in' },
    { keys: ['Ctrl', '-'], description: 'Zoom out' },
  ],
  forms: [
    { keys: ['Tab'], description: 'Next field' },
    { keys: ['Shift', 'Tab'], description: 'Previous field' },
    { keys: ['Enter'], description: 'Submit form' },
    { keys: ['Escape'], description: 'Cancel' },
  ],
} as const;

type ShortcutCategory = keyof typeof SHORTCUTS;

const CATEGORIES = Object.keys(SHORTCUTS) as ShortcutCategory[];

export interface ShortcutHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutHelp({ isOpen, onClose }: ShortcutHelpProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeCategory, setActiveCategory] = useState<ShortcutCategory>('global');

  // Hooks run unconditionally; visibility is controlled by the dialog's own open
  // state. The previous version called `useMemo` after an early return, which
  // breaks the hook ordering rule.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (isOpen && !dialog.open) {
      // `showModal` traps focus and renders the backdrop; `show` does neither.
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // The dialog emits `close` for Escape and for programmatic close, so one
  // listener covers both paths.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    const handleClose = () => {
      if (isOpen) onClose();
    };
    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('close', handleClose);
    };
  }, [isOpen, onClose]);

  return (
    <dialog ref={dialogRef} className="shortcut-help-dialog" aria-labelledby="shortcut-help-title">
      <header className="dialog-header">
        <h2 id="shortcut-help-title">Keyboard shortcuts</h2>
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          aria-label="Close keyboard shortcuts"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </header>

      <div className="dialog-body">
        {/* Buttons with `aria-current`, not a tablist: a real tablist owes the
            user arrow-key cycling, and claiming the role without it misleads
            screen reader users about how to navigate. */}
        <nav className="category-tabs" aria-label="Shortcut categories">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              aria-current={activeCategory === category ? 'true' : undefined}
              className={activeCategory === category ? 'active' : ''}
              onClick={() => {
                setActiveCategory(category);
              }}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </nav>

        <section aria-label={`${activeCategory} shortcuts`}>
          <table className="shortcut-table">
            <caption className="sr-only">
              {activeCategory} keyboard shortcuts and their actions
            </caption>
            <thead>
              <tr>
                <th scope="col">Keys</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {SHORTCUTS[activeCategory].map((item) => (
                <tr key={item.description}>
                  <th scope="row">
                    <kbd className="key-combo">{item.keys.join(' + ')}</kbd>
                  </th>
                  <td>{item.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <footer className="dialog-footer">
        <p className="hint">
          Press <kbd>?</kbd> at any time to reopen this dialog.
        </p>
      </footer>
    </dialog>
  );
}
