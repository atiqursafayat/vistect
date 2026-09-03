/**
 * The semantic object explorer — spec §21.4.
 *
 * §21.4 lists eleven things every object must expose. All eleven are here, as a definition
 * list, because that is the structure a screen reader can walk term by term and it is the
 * one place a user can answer "what exactly is this thing?" without seeing it.
 *
 * Two of the eleven are computed rather than stored, and deliberately so:
 *
 *   - **Relative position** is derived from the template's regions, not from a `regionId`
 *     field on the object. Bounds are the single source of truth for where a thing is, and a
 *     second field would be one more thing to keep in step with it.
 *   - **Dimensions in understandable terms** means inches and "the full width of the text
 *     column", not a pixel pair on its own. A pixel count is not a size a person can picture.
 *
 * Nothing here can change the document. The explorer answers questions; the tools act.
 */
import type { DocumentObject } from '../core/model/objects.js';
import { objectText, requiresAlternativeText } from '../core/model/objects.js';
import type { ApprovalState, Bounds, Provenance } from '../core/model/primitives.js';
import { PAGE_GEOMETRY, contentBox } from '../core/model/primitives.js';
import type { DocumentProject, Page } from '../core/model/project.js';
import { findObject, findPage } from '../core/model/project.js';
import { describeKind, plural } from '../core/tools/common.js';
import { getTemplate } from '../core/templates.js';
import { useProject } from './services.js';

type Field = { term: string; value: string };

const round = (value: number): number => Math.round(value * 10) / 10;

const inches = (px: number): number => round(px / 96);

/** Both units, because one of them is the one the user thinks in and it is not always px. */
const describeSize = (bounds: Bounds): string => {
  const box = contentBox(PAGE_GEOMETRY);
  const full =
    Math.abs(bounds.width - box.width) <= 2 ? ', the full width of the printable area' : '';
  return `${Math.round(bounds.width)} by ${Math.round(bounds.height)} pixels${full} — ${inches(bounds.width)} by ${inches(bounds.height)} inches when printed`;
};

const describeWhere = (page: Page, bounds: Bounds): string => {
  const centre = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const region = getTemplate(page.templateId)?.regions.find(
    (candidate) =>
      centre.x >= candidate.bounds.x &&
      centre.x <= candidate.bounds.x + candidate.bounds.width &&
      centre.y >= candidate.bounds.y &&
      centre.y <= candidate.bounds.y + candidate.bounds.height,
  );
  const place = region
    ? `In the ${region.label} region`
    : 'Outside every region of the template';
  return `${place}, ${inches(bounds.x)} inches from the left edge and ${inches(bounds.y)} inches down from the top`;
};

const when = (iso: string): string => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? iso
    : at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

/**
 * §4.4: the ledger says who, by which tool, and when. `agentName` is the agent's own claim
 * about itself, so it is quoted as a claim rather than stated as fact.
 */
const describeSource = (source: Provenance): string => {
  const who =
    source.origin === 'agent'
      ? `An agent${source.agentName ? ` calling itself "${source.agentName}"` : ''}`
      : source.origin === 'user'
        ? 'You'
        : source.origin === 'import'
          ? 'An import'
          : 'Vistect itself';
  const how = source.toolName ? `, using ${source.toolName},` : '';
  const note = source.note ? ` (${source.note})` : '';
  return `${who}${how} on ${when(source.createdAt)}${note}`;
};

const describeApproval = (approval: ApprovalState): string => {
  const who = approval.approvedBy ? ` by ${approval.approvedBy}` : '';
  const at = approval.approvedAt ? ` on ${when(approval.approvedAt)}` : '';
  const version =
    approval.approvedVersion === undefined ? '' : ` at version ${approval.approvedVersion}`;
  switch (approval.status) {
    case 'approved':
      return `Approved${who}${at}${version}`;
    case 'stale':
      return `Needs review: it was approved${who}${version}, and the document has changed since`;
    case 'proposed':
      return 'Proposed by the agent, not yet approved by you';
    case 'rejected':
      return `Rejected${who}${at}`;
    case 'unreviewed':
      return 'Not reviewed yet';
  }
};

const describeName = (object: DocumentObject): string => {
  const explicit = object.accessibility.accessibleName ?? object.accessibility.altText;
  if (explicit && explicit.trim() !== '') return explicit;
  const text = objectText(object);
  if (text && text.trim() !== '') return text;
  if (requiresAlternativeText(object)) {
    return 'None yet — this object carries meaning, so it needs alt text before export';
  }
  return object.accessibility.isDecorative
    ? 'None. Marked decorative, so a screen reader skips it'
    : 'None';
};

const objectFields = (
  project: DocumentProject,
  page: Page,
  object: DocumentObject,
): Field[] => {
  const position = page.readingOrder.indexOf(object.id);
  const findings = project.findings.filter(
    (finding) => finding.targetId === object.id && finding.status === 'open',
  );
  const warnings = [...object.accessibility.warnings, ...findings.map((f) => f.summary)];
  const anchors = object.relativeConstraints.map(
    (constraint) =>
      `${constraint.relationship.replace(/_/g, ' ')} ${constraint.anchorObjectId}${
        constraint.gapPx === undefined ? '' : ` with a ${constraint.gapPx} pixel gap`
      }`,
  );
  return [
    { term: 'Type', value: describeKind(object) },
    { term: 'Accessible name', value: describeName(object) },
    { term: 'Page', value: `Page ${page.pageNumber}${page.title ? `: ${page.title}` : ''}` },
    { term: 'Purpose', value: object.purpose ?? 'Not recorded' },
    { term: 'Position', value: describeWhere(page, object.bounds) },
    {
      term: 'Anchored to',
      value: anchors.length > 0 ? anchors.join('; ') : 'Nothing — it holds its own position',
    },
    {
      term: 'Reading order',
      value:
        position === -1
          ? 'Not in the reading order, so a screen reader will never reach it'
          : `${position + 1} of ${plural(page.readingOrder.length, 'object')} on this page`,
    },
    { term: 'Size', value: describeSize(object.bounds) },
    { term: 'Added', value: describeSource(object.source) },
    { term: 'Approval', value: describeApproval(object.approval) },
    { term: 'Warnings', value: warnings.length > 0 ? warnings.join(' ') : 'None' },
    {
      term: 'Version',
      value: `Created at version ${object.versionCreated}, last changed at version ${object.versionModified}`,
    },
  ];
};

const pageFields = (project: DocumentProject, page: Page): Field[] => {
  const template = getTemplate(page.templateId);
  const strays = page.objects.filter((object) => !page.readingOrder.includes(object.id));
  const findings = project.findings.filter(
    (finding) => finding.targetId === page.id && finding.status === 'open',
  );
  return [
    { term: 'Type', value: 'Page' },
    { term: 'Number', value: `${page.pageNumber} of ${plural(project.pages.length, 'page')}` },
    { term: 'Title', value: page.title ?? 'None yet' },
    {
      term: 'Template',
      value: template ? `${template.name} — ${template.description}` : page.templateId,
    },
    {
      term: 'Regions',
      value: template ? template.regions.map((region) => region.label).join(', ') : 'Unknown',
    },
    { term: 'Objects', value: plural(page.objects.length, 'object') },
    {
      term: 'Reading order',
      value:
        strays.length === 0
          ? `All ${plural(page.objects.length, 'object')} are in the reading order`
          : `${plural(strays.length, 'object')} on this page ${strays.length === 1 ? 'is' : 'are'} not in the reading order`,
    },
    { term: 'Status', value: page.status },
    {
      term: 'Warnings',
      value: findings.length > 0 ? findings.map((f) => f.summary).join(' ') : 'None',
    },
  ];
};

/**
 * §21.4's "available actions" for Day 1. The honest answer is a sentence rather than a row of
 * buttons: the only tool that acts on an existing object arrives on Day 2, and a disabled
 * button that never becomes enabled is worse than a plain statement of what is possible now.
 */
const actionsFor = (page: Page): string =>
  `Ask the agent, or call inspect_page with pageId "${page.id}" from the developer agent console, to re-read this page and everything on it.`;

export function ObjectExplorer({ selectedId }: { selectedId: string | undefined }) {
  const project = useProject();

  if (!project || selectedId === undefined) {
    return (
      <p className="empty">
        Nothing selected. Choose a page or an object in the document navigator and everything
        known about it appears here.
      </p>
    );
  }

  const found = findObject(project, selectedId);
  const page = found?.page ?? findPage(project, selectedId);

  if (!page) {
    return <p className="empty">That item is no longer in the document.</p>;
  }

  const fields = found ? objectFields(project, page, found.object) : pageFields(project, page);
  const heading = found
    ? `${describeKind(found.object)} on page ${page.pageNumber}`
    : `Page ${page.pageNumber}${page.title ? `: ${page.title}` : ''}`;

  return (
    <div className="explorer">
      <h3>{heading}</h3>
      <dl className="fields">
        {fields.map((field) => (
          <div key={field.term}>
            <dt>{field.term}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>
      <h4>Available actions</h4>
      <p>{actionsFor(page)}</p>
    </div>
  );
}
