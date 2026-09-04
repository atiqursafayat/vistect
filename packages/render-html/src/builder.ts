// ============================================================================
// HTML Builder
// ============================================================================
//
// A small string builder with **escaping by default**. `text()` and attribute
// values are always escaped; injecting pre-built markup requires the explicitly
// named `unsafeRaw()`, which exists only for markup this codebase generated
// (sanitised SVG, nested builder output).
//
// The previous builder had a single `raw()` used for both trusted markup and
// untrusted document content, so authored text reached the output unescaped.

import { escapeHtml, escapeHtmlAttribute, sanitizeUrl } from '@vistect/domain/text';

export type AttributeValue = string | number | boolean | undefined;
export type Attributes = Record<string, AttributeValue>;

/** Elements that must not be given a closing tag. */
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

/** Attributes whose value is a URL and must pass scheme allowlisting. */
const URL_ATTRIBUTES = new Set(['href', 'src', 'action', 'formaction', 'poster', 'cite']);

export class HTMLBuilder {
  private readonly parts: string[] = [];
  private readonly openTags: string[] = [];

  /** Opens an element. Void elements are rejected; use {@link voidTag}. */
  open(tag: string, attrs: Attributes = {}): this {
    if (VOID_ELEMENTS.has(tag)) {
      throw new Error(`<${tag}> is a void element and cannot be opened; use voidTag()`);
    }
    this.parts.push(`<${tag}${formatAttributes(attrs)}>`);
    this.openTags.push(tag);
    return this;
  }

  /**
   * Closes the most recently opened element.
   *
   * The tag name is verified against the open stack, so a mismatched close is a
   * loud error rather than silently malformed HTML that breaks assistive
   * technology in ways a sighted spot-check would not reveal.
   */
  close(tag: string): this {
    const expected = this.openTags.pop();
    if (expected !== tag) {
      throw new Error(`Mismatched close: expected </${expected ?? 'nothing'}>, got </${tag}>`);
    }
    this.parts.push(`</${tag}>`);
    return this;
  }

  /** Self-contained element with escaped text content. */
  tag(tag: string, attrs: Attributes, content: string): this {
    if (VOID_ELEMENTS.has(tag)) {
      return this.voidTag(tag, attrs);
    }
    this.parts.push(`<${tag}${formatAttributes(attrs)}>${escapeHtml(content)}</${tag}>`);
    return this;
  }

  /** Void element such as `<meta>` or `<img>`. */
  voidTag(tag: string, attrs: Attributes = {}): this {
    this.parts.push(`<${tag}${formatAttributes(attrs)}>`);
    return this;
  }

  /** Escaped text content. */
  text(content: string): this {
    this.parts.push(escapeHtml(content));
    return this;
  }

  /**
   * Inserts markup **without escaping**.
   *
   * Only for markup produced by this codebase: sanitised SVG, another builder's
   * output, or generated CSS. Never for document content, asset metadata, or
   * anything an agent supplied.
   */
  unsafeRaw(html: string): this {
    this.parts.push(html);
    return this;
  }

  /** Renders and asserts every element was closed. */
  toString(): string {
    if (this.openTags.length > 0) {
      throw new Error(`Unclosed elements: ${this.openTags.join(', ')}`);
    }
    return this.parts.join('');
  }
}

function formatAttributes(attrs: Attributes): string {
  return Object.entries(attrs)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([name, value]) => {
      // Boolean attributes are rendered bare (`<input required>`).
      if (value === true) return ` ${name}`;

      const raw = String(value);

      // A URL attribute whose scheme is not allowlisted is dropped entirely
      // rather than emitted escaped: `href="javascript:…"` is still dangerous
      // once a browser decodes the entities.
      if (URL_ATTRIBUTES.has(name)) {
        const safe = sanitizeUrl(raw);
        return safe === null ? '' : ` ${name}="${escapeHtmlAttribute(safe)}"`;
      }

      return ` ${name}="${escapeHtmlAttribute(raw)}"`;
    })
    .join('');
}
