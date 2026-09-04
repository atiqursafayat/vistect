// ============================================================================
// Shortcut Help Dialog
// ============================================================================

import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

const SHORTCUTS = {
  global: [
    { keys: ['Alt', 'U'], description: 'Open decision queue' },
    { keys: ['Alt', 'W'], description: 'Open warning queue' },
    { keys: ['Alt', 'A'], description: 'Open activity stream' },
    { keys: ['Alt', 'N'], description: 'Open navigator' },
    { keys: ['Alt', 'O'], description: 'Open object explorer' },
    { keys: ['Alt', 'P'], description: 'Open privacy center' },
    { keys: ['Escape'], description: 'Close dialog / cancel' },
    { keys: ['?'], description: 'Show this help' },
  ],
  navigator: [
    { keys: ['Enter'], description: 'Activate page' },
    { keys: ['↑', '↓'], description: 'Navigate pages' },
    { keys: ['←', '→'], description: 'Collapse/expand (future)' },
  ],
  explorer: [
    { keys: ['Enter'], description: 'Select object' },
    { keys: ['Space'], description: 'Toggle expand' },
    { keys: ['↑', '↓'], description: 'Navigate objects' },
    { keys: ['t'], description: 'Jump by type' },
    { keys: ['w'], description: 'Jump to warnings' },
    { keys: ['u'], description: 'Jump to unapproved' },
  ],
  editor: [
    { keys: ['Ctrl', 'Mousewheel'], description: 'Zoom canvas' },
    { keys: ['Ctrl', '+', '-'], description: 'Zoom in/out' },
    { keys: ['Ctrl', '0'], description: 'Reset zoom' },
  ],
  forms: [
    { keys: ['Tab'], description: 'Next field' },
    { keys: ['Shift', 'Tab'], description: 'Previous field' },
    { keys: ['Enter'], description: 'Submit form' },
    { keys: ['Escape'], description: 'Cancel/close' },
  ],
} as const;

type ShortcutCategory = keyof typeof SHORTCUTS;

export function ShortcutHelp({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeCategory, setActiveCategory] = useState<ShortcutCategory>('global');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = useMemo(() => Object.keys(SHORTCUTS) as ShortcutCategory[], []);

  return createPortal(
    <div className="shortcut-help-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="shortcut-help-title">
      <div className="shortcut-help-dialog" onClick={e => e.stopPropagation()}>
        <header className="dialog-header">
          <h2 id="shortcut-help-title">Keyboard Shortcuts</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close shortcut help">✕</button>
        </header>

        <div className="dialog-body">
          <nav className="category-tabs" role="tablist" aria-label="Shortcut categories">
            {categories.map(cat => (
              <button
                key={cat}
                role="tab"
                aria-selected={activeCategory === cat}
                aria-controls={`panel-${cat}`}
                id={`tab-${cat}`}
                className={activeCategory === cat ? 'active' : ''}
                onClick={() => setActiveCategory(cat)}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </nav>

          <div className="tab-panels">
            {categories.map(cat => (
              <section
                key={cat}
                role="tabpanel"
                id={`panel-${cat}`}
                aria-labelledby={`tab-${cat}`}
                className={activeCategory === cat ? 'active' : ''}
              >
                <table className="shortcut-table">
                  <thead>
                    <tr>
                      <th scope="col">Keys</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SHORTCUTS[cat].map((item, i) => (
                      <tr key={i}>
                        <td>
                          <kbd className="key-combo">
                            {item.keys.map((k, ki) => (
                              <span key={ki}>
                                {k}
                                {ki < item.keys.length - 1 && <span className="key-sep">+</span>}
                              </span>
                            ))}
                          </kbd>
                        </td>
                        <td>{item.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        </div>

        <footer className="dialog-footer">
          <p className="hint">Press <kbd>?</kbd> anytime to reopen this dialog</p>
        </footer>
      </div>
    </div>,
    document.body
  );
}

function useState<T>(initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  let state = initial;
  const setState = (newState: T | ((prev: T) => T)) => {
    state = typeof newState === 'function' ? (newState as (prev: T) => T)(state) : newState;
  };
  return [state, setState];
}