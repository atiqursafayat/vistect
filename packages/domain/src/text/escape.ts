// ============================================================================
// Text Escaping — single source of truth for untrusted-content encoding
// ============================================================================
//
// SECURITY CRITICAL. Every renderer (HTML preview, HTML export bundle, chart
// tables, chart narratives, diagram SVG) MUST route untrusted text through
// these functions. They live in `domain` (the universal dependency) so that
// there is exactly one implementation: duplicated copies of this logic
// previously drifted and silently became identity functions, which removed all
// injection protection from export output.
//
// Pure string functions — no DOM, no React, no I/O. See ADR-009.

/**
 * Escapes text for interpolation into HTML **element content**.
 *
 * Encodes the five characters that can terminate text context or an attribute
 * value. `&` must be replaced first, otherwise later replacements would be
 * double-encoded.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escapes text for interpolation into a **double-quoted HTML attribute value**.
 *
 * Identical coverage to {@link escapeHtml} plus backtick and equals, which
 * legacy engines can treat as attribute delimiters when a value is unquoted.
 * Always emit attributes with double quotes in addition to calling this.
 */
export function escapeHtmlAttribute(text: string): string {
  return escapeHtml(text).replace(/`/g, '&#96;').replace(/=/g, '&#61;');
}

/**
 * Escapes text for interpolation into **XML/SVG** content or attributes.
 *
 * XML defines `&apos;` (HTML 4 does not), so the apostrophe uses the named
 * entity here while {@link escapeHtml} uses the numeric form.
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * URL schemes permitted in authored hyperlinks (FR/AC F-1.6 §3).
 *
 * `javascript:`, `data:`, `vbscript:` and `file:` are excluded deliberately.
 */
export const ALLOWED_URL_SCHEMES = ['http:', 'https:', 'mailto:'] as const;

/**
 * Returns the URL when its scheme is allowlisted, otherwise `null`.
 *
 * Relative URLs (`/page`, `#anchor`, `./doc`) are permitted because they cannot
 * introduce a new scheme. Anything that parses to a non-allowlisted scheme, or
 * fails to parse at all, is rejected.
 */
export function sanitizeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed === '') return null;

  // Reject control characters used to smuggle schemes past naive parsers,
  // e.g. "java\tscript:alert(1)".
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f-\u009f]/.test(trimmed)) return null;

  if (trimmed.startsWith('#') || trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return trimmed;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    // Not absolute and not a recognised relative form — reject rather than guess.
    return null;
  }

  return (ALLOWED_URL_SCHEMES as readonly string[]).includes(parsed.protocol) ? trimmed : null;
}
