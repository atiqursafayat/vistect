/**
 * The developer agent console — plan §8 D1-7, and the demo's fallback path.
 *
 * It exists for two reasons. First, WebMCP needs a flagged browser and a live agent, and a
 * demo cannot depend on both: this console calls the same tools through the same runner, so
 * "the agent did it" and "we did it here" produce byte-identical state, activity entries and
 * announcements. Second, it is the fastest way to reproduce a bug report — the failing tool
 * call is a paste into a text box.
 *
 * It never pretends to be the agent. Every call it makes is recorded with `origin: 'user'`
 * and a note saying where it came from, because a ledger that can be faked is not a ledger
 * (§4.4). The one thing this console has that an agent does not is the *starter call*: an
 * agent reads the JSON Schema, a human would rather start from a filled-in example.
 */
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { TOOLS, getTool, toolInputSchema } from '../core/tools/registry.js';
import type { ToolRunResult } from '../core/tools/registry.js';
import { announcementFor } from './announce.js';
import { now } from './ids.js';
import { useServices, useStoreState } from './services.js';

type Starter = (version: number) => Record<string, unknown>;

/**
 * Hand-written rather than generated from the schema: a generated example fills required
 * fields with placeholder junk, and the point of a starter is that it runs as it stands.
 */
const STARTERS: Record<string, Starter> = {
  create_document: () => ({
    title: 'Independence in Practice',
    purpose: 'Show funders the measurable outcomes of the independence programme.',
    audience: ['funders'],
    primaryMessage: 'Independence is measurable, and it is happening.',
    tone: ['plain', 'confident'],
    pageTemplates: ['cover', 'text-led'],
  }),
  update_intent_contract: (version) => ({
    expectedDocumentVersion: version,
    avoid: ['charity framing', 'medical imagery', 'pity'],
    visualStyle: 'documentary photography, no stock',
  }),
  get_document_overview: () => ({}),
  get_document_structure: () => ({ includeObjects: true }),
  add_text_section: (version) => ({
    expectedDocumentVersion: version,
    textRole: 'heading',
    headingLevel: 2,
    content: 'Employment outcomes',
    purpose: 'Open the section that carries the primary message.',
  }),
  inspect_page: () => ({ pageId: 'page-2' }),
};

const starterFor = (toolName: string, version: number): string =>
  `${JSON.stringify(STARTERS[toolName]?.(version) ?? {}, null, 2)}\n`;

/** §34's first beat, as four buttons. Each one runs the starter for its tool immediately. */
const PRESETS: { label: string; toolName: string }[] = [
  { label: '1. Create the demo document', toolName: 'create_document' },
  { label: '2. Record the brief', toolName: 'update_intent_contract' },
  { label: '3. Add a heading to the last page', toolName: 'add_text_section' },
  { label: '4. Read that page back', toolName: 'inspect_page' },
];

export function DevAgentConsole({ onAnnounce }: { onAnnounce: (text: string) => void }) {
  const { run } = useServices();
  const { project } = useStoreState();
  const version = project?.activeVersion ?? 0;
  const [toolName, setToolName] = useState<string>(TOOLS[0]?.name ?? '');
  const [args, setArgs] = useState<string>(() => starterFor(TOOLS[0]?.name ?? '', 0));
  const [outcome, setOutcome] = useState<string>('');
  /** The last starter written into the box, so an edited box is never overwritten. */
  const starterRef = useRef<string>(args);

  const call = (name: string, input: unknown): ToolRunResult => {
    const result = run(name, input, {
      origin: 'user',
      createdAt: now(),
      note: 'via the developer agent console',
    });
    setOutcome(
      `${result.ok ? 'Completed' : `Refused, ${result.code ?? 'no code given'}`}: ${result.lead}`,
    );
    const spoken = announcementFor(result, 'user');
    if (spoken !== undefined) onAnnounce(spoken);
    return result;
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    let input: unknown;
    try {
      input = args.trim() === '' ? {} : JSON.parse(args);
    } catch (error) {
      // A parse error never reaches the runner, so it is not in the activity stream. It is
      // said out loud and left on screen instead of being dropped.
      const message = `Nothing was called: the arguments are not valid JSON. ${error instanceof Error ? error.message : String(error)}`;
      setOutcome(message);
      onAnnounce(message);
      return;
    }
    call(toolName, input);
  };

  const selectTool = (name: string): void => {
    setToolName(name);
    if (args.trim() !== '' && args !== starterRef.current) return;
    const next = starterFor(name, version);
    starterRef.current = next;
    setArgs(next);
  };

  const insertStarter = (): void => {
    const next = starterFor(toolName, version);
    starterRef.current = next;
    setArgs(next);
  };

  const runPreset = (name: string): void => {
    setToolName(name);
    const next = starterFor(name, version);
    starterRef.current = next;
    setArgs(next);
    call(name, STARTERS[name]?.(version) ?? {});
  };

  const tool = getTool(toolName);

  return (
    <form className="console" onSubmit={submit}>
      <p>
        These calls go through the same runner an agent's calls go through, so they behave
        identically. They are recorded as coming from you, not from an agent.
      </p>

      <h3>Demo sequence</h3>
      <div className="buttons">
        {PRESETS.map((preset) => (
          <button key={preset.label} type="button" onClick={() => runPreset(preset.toolName)}>
            {preset.label}
          </button>
        ))}
      </div>

      <h3>Any call</h3>
      <div className="field">
        <label htmlFor="console-tool">Tool</label>
        <select
          id="console-tool"
          value={toolName}
          onChange={(event) => selectTool(event.target.value)}
        >
          {TOOLS.map((candidate) => (
            <option key={candidate.name} value={candidate.name}>
              {candidate.name} — {candidate.title}
            </option>
          ))}
        </select>
      </div>

      {tool ? (
        <>
          <p>{tool.description}</p>
          <details>
            <summary>The input schema {tool.name} publishes to the agent</summary>
            <pre>{JSON.stringify(toolInputSchema(tool), null, 2)}</pre>
          </details>
        </>
      ) : null}

      <div className="field">
        <label htmlFor="console-args">Arguments, as JSON</label>
        <textarea
          id="console-args"
          rows={12}
          spellCheck={false}
          value={args}
          aria-describedby="console-args-help"
          onChange={(event) => setArgs(event.target.value)}
        />
        <p id="console-args-help">
          {project
            ? `The document is at version ${version}. A write is refused unless its expectedDocumentVersion is ${version}.`
            : 'There is no document yet, so start with create_document.'}
        </p>
      </div>

      <div className="buttons">
        <button type="submit">Run {toolName}</button>
        <button type="button" onClick={insertStarter}>
          Replace the arguments with a starter call
        </button>
      </div>

      {/* Not a live region: the announcer already said this. Here it just stays readable. */}
      <p className="outcome">
        {outcome === '' ? 'Nothing has been called from this console yet.' : outcome}
      </p>
    </form>
  );
}
