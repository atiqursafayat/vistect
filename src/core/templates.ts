/**
 * Page templates — spec §10.1.
 *
 * A template is a set of named regions with fixed bounds. Objects are placed *into a
 * region*, never at coordinates the user had to supply (§4.2). Adding the remaining
 * six §10.1 templates is data-only work; the four here are what Day 1 and the §34
 * demo script need.
 */
import type { Bounds } from './model/primitives.js';
import { PAGE_GEOMETRY, contentBox } from './model/primitives.js';

export type RegionId = 'header' | 'flow' | 'figure' | 'sidebar' | 'footer';

export const REGION_IDS: RegionId[] = ['header', 'flow', 'figure', 'sidebar', 'footer'];

export type Region = {
  id: RegionId;
  label: string;
  bounds: Bounds;
  /** Regions flow their children top-to-bottom; non-flow regions hold one object. */
  flow: boolean;
};

export type PageTemplate = {
  id: string;
  name: string;
  description: string;
  regions: Region[];
  /** Where `add_text_section` puts a section when the caller names no region. */
  defaultTextRegion: RegionId;
};

const box = contentBox(PAGE_GEOMETRY);
const half = Math.round((box.width - 24) / 2);
const footerHeight = 28;

const region = (id: RegionId, label: string, bounds: Bounds, flow = true): Region => ({
  id,
  label,
  bounds,
  flow,
});

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: 'cover',
    name: 'Cover',
    description:
      'Title, subtitle and organisation over a single full-width cover image. One dominant visual.',
    defaultTextRegion: 'flow',
    regions: [
      region(
        'figure',
        'Cover image',
        { x: 0, y: 0, width: PAGE_GEOMETRY.widthPx, height: 560 },
        false,
      ),
      region('flow', 'Title block', { x: box.x, y: 616, width: box.width, height: 320 }),
      region('footer', 'Organisation', {
        x: box.x,
        y: box.y + box.height - footerHeight,
        width: box.width,
        height: footerHeight,
      }),
    ],
  },
  {
    id: 'text-led',
    name: 'Text-led page',
    description: 'A heading and body text in a single column. No visual.',
    defaultTextRegion: 'flow',
    regions: [
      region('flow', 'Main column', {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height - footerHeight - 16,
      }),
      region('footer', 'Page footer', {
        x: box.x,
        y: box.y + box.height - footerHeight,
        width: box.width,
        height: footerHeight,
      }),
    ],
  },
  {
    id: 'text-with-side-image',
    name: 'Text with side image',
    description:
      'A heading and body text in the left column, one supporting image on the right.',
    defaultTextRegion: 'flow',
    regions: [
      region('flow', 'Text column', {
        x: box.x,
        y: box.y,
        width: half,
        height: box.height - footerHeight - 16,
      }),
      region(
        'figure',
        'Side image',
        { x: box.x + half + 24, y: box.y, width: half, height: 420 },
        false,
      ),
      region('sidebar', 'Image caption', {
        x: box.x + half + 24,
        y: box.y + 436,
        width: half,
        height: 120,
      }),
      region('footer', 'Page footer', {
        x: box.x,
        y: box.y + box.height - footerHeight,
        width: box.width,
        height: footerHeight,
      }),
    ],
  },
  {
    id: 'chart-page',
    name: 'Chart page',
    description:
      'A heading, a short lead paragraph, one full-width chart, then its caption and source note.',
    defaultTextRegion: 'flow',
    regions: [
      region('flow', 'Heading and lead', { x: box.x, y: box.y, width: box.width, height: 220 }),
      region(
        'figure',
        'Chart',
        { x: box.x, y: box.y + 236, width: box.width, height: 420 },
        false,
      ),
      region('sidebar', 'Caption and source note', {
        x: box.x,
        y: box.y + 672,
        width: box.width,
        height: 120,
      }),
      region('footer', 'Page footer', {
        x: box.x,
        y: box.y + box.height - footerHeight,
        width: box.width,
        height: footerHeight,
      }),
    ],
  },
];

export const TEMPLATE_IDS = PAGE_TEMPLATES.map((t) => t.id);

export function getTemplate(templateId: string): PageTemplate | undefined {
  return PAGE_TEMPLATES.find((t) => t.id === templateId);
}

export function getRegion(templateId: string, regionId: RegionId): Region | undefined {
  return getTemplate(templateId)?.regions.find((r) => r.id === regionId);
}
