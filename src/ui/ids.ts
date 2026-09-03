/**
 * Ids and the clock — the two impure things `src/core` refuses to do for itself.
 *
 * Core takes both as injected dependencies (`Ids` in `core/factory.ts`) so that replaying
 * the command log reproduces a document byte for byte instead of re-generating it. This is
 * the browser's implementation; `tests/unit/support/store-fixture.ts` is the deterministic
 * one.
 *
 * Ids are opaque handles, not prose. A screen-reader user hears objects described as
 * "the heading “Employment outcomes” on page 1" — `core/commands.ts` builds those labels —
 * so an id only has to be unique, short, and unambiguous when read out one character at a
 * time if it ever is. Sequential ids would read better but would have to survive a reload
 * to stay unique, and the snapshot deliberately persists only the command log.
 */
import { customAlphabet } from 'nanoid';

/** No look-alikes: 0/o, 1/l/i and u/v are all absent, so an id is safe to read aloud. */
const suffix = customAlphabet('23456789abcdefghjkmnpqrstwxyz', 8);

export const newId = (prefix: string): string => `${prefix}-${suffix()}`;

export const now = (): string => new Date().toISOString();
