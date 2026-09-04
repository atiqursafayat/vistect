// ============================================================================
// Dictionary helpers for `z.record(BrandedId, Value)` collections
// ============================================================================
//
// `z.record(brandedKeySchema, valueSchema)` infers `Partial<Record<K, V>>`,
// because a branded string is not assignable from `string` and Zod therefore
// treats the key set as possibly-finite. That inference is *correct* for index
// lookups — `project.objects[id]` can genuinely miss — and every lookup site
// must handle `undefined`.
//
// It is misleading for iteration: `Object.values()` on such a dictionary cannot
// yield `undefined` unless a key was explicitly assigned `undefined`. The
// helpers below express that precisely, so iteration code stays readable
// without resorting to `as` casts or non-null assertions that would also
// silence real lookup bugs.

/** A dictionary keyed by a branded id, as produced by `z.record`. */
export type Dict<K extends string, V> = Partial<Record<K, V>>;

/** Values of a dictionary, with absent entries dropped. */
export function dictValues<V>(dict: Dict<string, V>): V[] {
  return Object.values(dict).filter((value): value is V => value !== undefined);
}

/** Entries of a dictionary, with absent entries dropped. */
export function dictEntries<K extends string, V>(dict: Dict<K, V>): [K, V][] {
  return Object.entries(dict).filter((entry): entry is [K, V] => entry[1] !== undefined);
}

/** Keys of a dictionary that have a present value. */
export function dictKeys<K extends string, V>(dict: Dict<K, V>): K[] {
  return dictEntries(dict).map(([key]) => key);
}

/** Number of present entries. */
export function dictSize<V>(dict: Dict<string, V>): number {
  return dictValues(dict).length;
}

/**
 * Looks up a required entry, throwing when absent.
 *
 * Use only where a missing entry indicates a broken invariant (an already
 * validated aggregate). Prefer plain indexing plus an explicit `undefined`
 * branch anywhere the caller can reasonably recover.
 */
export function dictRequire<V>(dict: Dict<string, V>, key: string, label: string): V {
  const value = dict[key];
  if (value === undefined) {
    throw new Error(`${label} not found: ${key}`);
  }
  return value;
}
