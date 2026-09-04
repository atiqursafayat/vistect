import { describe, it, expect } from 'vitest';

import {
  escapeHtml,
  escapeHtmlAttribute,
  escapeXml,
  sanitizeUrl,
} from '../src/text';

// These tests exist because all three escaping helpers in this repo were once
// silently reduced to identity functions (`.replace(/&/g, '&')`), which removed
// every injection guard from export output while still compiling. Assertions
// below check the *encoded output*, not merely that the input changed.

describe('escapeHtml', () => {
  it('encodes all five HTML-significant characters', () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
  });

  it('is not an identity function for dangerous input', () => {
    const payload = '<script>alert(1)</script>';
    expect(escapeHtml(payload)).not.toBe(payload);
    expect(escapeHtml(payload)).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('encodes ampersand first so entities are not double-encoded', () => {
    // If '<' were replaced before '&', the output would be '&amp;lt;'.
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('neutralises attribute-breakout payloads', () => {
    expect(escapeHtml('" onload="alert(1)')).toBe('&quot; onload=&quot;alert(1)');
  });

  it('leaves safe text untouched', () => {
    expect(escapeHtml('Quarterly revenue rose 12 percent')).toBe('Quarterly revenue rose 12 percent');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('is idempotent-safe (double escaping is visible, not silent)', () => {
    expect(escapeHtml(escapeHtml('<b>'))).toBe('&amp;lt;b&amp;gt;');
  });
});

describe('escapeHtmlAttribute', () => {
  it('encodes everything escapeHtml does', () => {
    expect(escapeHtmlAttribute('<')).toBe('&lt;');
    expect(escapeHtmlAttribute('"')).toBe('&quot;');
  });

  it('additionally encodes backtick and equals', () => {
    expect(escapeHtmlAttribute('`')).toBe('&#96;');
    expect(escapeHtmlAttribute('=')).toBe('&#61;');
  });

  it('neutralises unquoted-attribute breakout', () => {
    const out = escapeHtmlAttribute('x onerror=alert(1)');
    expect(out).not.toContain('=');
    expect(out).toBe('x onerror&#61;alert(1)');
  });
});

describe('escapeXml', () => {
  it('uses the named apostrophe entity required by XML', () => {
    expect(escapeXml("'")).toBe('&apos;');
  });

  it('encodes the remaining four characters', () => {
    expect(escapeXml('&')).toBe('&amp;');
    expect(escapeXml('<')).toBe('&lt;');
    expect(escapeXml('>')).toBe('&gt;');
    expect(escapeXml('"')).toBe('&quot;');
  });

  it('neutralises script injection into SVG text nodes', () => {
    expect(escapeXml('</text><script>x</script>')).toBe(
      '&lt;/text&gt;&lt;script&gt;x&lt;/script&gt;'
    );
  });
});

describe('sanitizeUrl', () => {
  it('allows http, https and mailto', () => {
    expect(sanitizeUrl('https://example.org/report')).toBe('https://example.org/report');
    expect(sanitizeUrl('http://example.org')).toBe('http://example.org');
    expect(sanitizeUrl('mailto:a@example.org')).toBe('mailto:a@example.org');
  });

  it('rejects javascript, data, vbscript and file schemes', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('JavaScript:alert(1)')).toBeNull();
    expect(sanitizeUrl('data:text/html,<script>x</script>')).toBeNull();
    expect(sanitizeUrl('vbscript:msgbox(1)')).toBeNull();
    expect(sanitizeUrl('file:///etc/passwd')).toBeNull();
  });

  it('rejects control-character scheme smuggling', () => {
    expect(sanitizeUrl('java\tscript:alert(1)')).toBeNull();
    expect(sanitizeUrl('java\nscript:alert(1)')).toBeNull();
    expect(sanitizeUrl('\u0000javascript:alert(1)')).toBeNull();
  });

  it('allows relative and fragment URLs', () => {
    expect(sanitizeUrl('#section-2')).toBe('#section-2');
    expect(sanitizeUrl('/reports/q3')).toBe('/reports/q3');
    expect(sanitizeUrl('./local.html')).toBe('./local.html');
    expect(sanitizeUrl('../up.html')).toBe('../up.html');
  });

  it('rejects empty and whitespace-only input', () => {
    expect(sanitizeUrl('')).toBeNull();
    expect(sanitizeUrl('   ')).toBeNull();
  });

  it('rejects unparseable non-relative input', () => {
    expect(sanitizeUrl('not a url at all')).toBeNull();
  });
});
