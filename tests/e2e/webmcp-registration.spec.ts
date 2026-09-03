/**
 * D1-6 — the registration test v1 needed and did not have.
 *
 * v1 built 2,819 lines against `navigator.modelContext`, registered zero tools, and stayed
 * green the whole time, because its tests mocked the same object that did not exist. So the
 * one rule here is absolute: **nothing in this file mocks, stubs or shims WebMCP.** Every
 * assertion below reads `document.modelContext` inside a real Chrome launched with
 * `--enable-blink-features=WebMCP` (see `playwright.config.ts`), served over loopback because
 * WebMCP needs a real secure-context origin (D0-1).
 *
 * If Chrome moves the namespace, drops an annotation, or stops accepting a tool name, this
 * file goes red. That is its whole purpose.
 *
 * `executeTool()` is not used to drive a tool: it rejects within ~1.5s and never invokes our
 * `execute` callback (D0-1), so the tool-call walk-through goes through the DevAgentConsole —
 * which the plan's Day 1 done-when explicitly allows, and which runs the *same*
 * `createToolRunner` path an agent's call runs.
 */
import { expect, test, type Page } from '@playwright/test';
import { TOOLS, TOOL_NAMES } from '../../src/core/tools/registry.js';

/**
 * The contract Vistect promises an agent, written out by hand rather than derived from the
 * registry. A test that maps over `TOOLS` to build its own expectations cannot fail when
 * `TOOLS` is wrong; this one can. The first test below is what stops it going stale as tools
 * are added.
 *
 * `readOnlyHint` is per tool. `untrustedContentHint` is true for all six: every result quotes
 * document text back to the agent, and document text is whatever a person typed or pasted.
 */
const EXPECTED: { name: string; readOnlyHint: boolean }[] = [
  { name: 'create_document', readOnlyHint: false },
  { name: 'update_intent_contract', readOnlyHint: false },
  { name: 'get_document_overview', readOnlyHint: true },
  { name: 'get_document_structure', readOnlyHint: true },
  { name: 'add_text_section', readOnlyHint: false },
  { name: 'inspect_page', readOnlyHint: true },
];

/** A `RegisteredTool` flattened to something that can cross the `evaluate` boundary. */
type PublishedTool = {
  name: string;
  title: string;
  description: string;
  readOnlyHint: boolean | undefined;
  untrustedContentHint: boolean | undefined;
  /** `typeof tool.inputSchema` as the browser hands it back — see `schemaOf` below. */
  reflectedSchemaKind: string;
  inputSchemaType: unknown;
  inputSchemaKeys: string[];
  origin: string;
};

/**
 * Reads what the browser actually holds. `RegisteredTool.window` is a `Window` and cannot be
 * serialised out of `evaluate`, so the list is flattened in the page.
 *
 * `reflectedSchemaKind` is carried out with the rest because of a divergence this test found
 * on its first run: `webmcp-types@0.1.6` declares `RegisteredTool.inputSchema?: object` and
 * documents it as "a deep copy of the schema provided at tool registration", but Chrome 152
 * reflects it back as a **JSON string**. Registration is unaffected — the object we pass to
 * `registerTool` is accepted and its content survives the round trip intact — so `schemaOf`
 * parses either shape and the tests below assert the parsed schema. The raw kind is asserted
 * separately, so the day Chrome starts honouring its own IDL, we are told rather than never
 * finding out.
 */
const publishedTools = (page: Page): Promise<PublishedTool[]> =>
  page.evaluate(async () => {
    const context = document.modelContext;
    if (!context) {
      throw new Error(
        'document.modelContext is undefined. Either Chrome was launched without --enable-blink-features=WebMCP, or this page is not a secure context.',
      );
    }
    type Schema = { type?: unknown; properties?: object };
    const schemaOf = (reflected: unknown): Schema => {
      const value: unknown = typeof reflected === 'string' ? JSON.parse(reflected) : reflected;
      return typeof value === 'object' && value !== null ? value : {};
    };

    const tools = await context.getTools();
    return tools.map((tool) => {
      const schema = schemaOf(tool.inputSchema);
      return {
        name: tool.name,
        title: tool.title,
        description: tool.description,
        readOnlyHint: tool.annotations?.readOnlyHint,
        untrustedContentHint: tool.annotations?.untrustedContentHint,
        reflectedSchemaKind: typeof tool.inputSchema,
        inputSchemaType: schema.type,
        inputSchemaKeys: Object.keys(schema.properties ?? {}),
        origin: tool.origin,
      };
    });
  });

/**
 * How many commands the autosaved snapshot holds, straight out of IndexedDB — or -1 when
 * nothing has been written yet. Polled before a reload so the test waits for the save it is
 * about to depend on instead of guessing at the 250ms debounce in `persist/idb.ts`.
 */
const savedChangeCount = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('vistect');
        open.onerror = () => {
          reject(new Error('IndexedDB would not open in this browser.'));
        };
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('snapshots')) {
            db.close();
            resolve(-1);
            return;
          }
          const read: IDBRequest<unknown> = db
            .transaction('snapshots')
            .objectStore('snapshots')
            .get('current');
          read.onerror = () => {
            db.close();
            reject(new Error('The saved snapshot could not be read.'));
          };
          read.onsuccess = () => {
            const value = read.result as { log?: unknown } | undefined;
            db.close();
            resolve(Array.isArray(value?.log) ? value.log.length : -1);
          };
        };
      }),
  );

/** The header line that reports the registration, and the one that reports the restore. */
const headerLine = (page: Page, label: string) =>
  page.locator('header p').filter({ hasText: label });

test('the hand-written contract and the registry agree on which tools exist', () => {
  expect(EXPECTED.map((tool) => tool.name)).toEqual(TOOL_NAMES);
  for (const expected of EXPECTED) {
    const tool = TOOLS.find((candidate) => candidate.name === expected.name);
    expect(tool?.annotations.readOnlyHint, `${expected.name} readOnlyHint`).toBe(
      expected.readOnlyHint,
    );
  }
});

/**
 * The single fact v1 got wrong, asserted against the browser rather than a document. The
 * `navigator` half is watched, not used: if it ever becomes true, read the spec before
 * changing `webmcp/types.ts` — a namespace that exists in both places is not the same as one
 * that has moved.
 */
test('WebMCP is at document.modelContext, in a secure context, and not on navigator', async ({
  page,
}) => {
  await page.goto('/');

  const facts = await page.evaluate(() => ({
    isSecureContext: window.isSecureContext,
    hasDocumentNamespace: typeof document.modelContext === 'object',
    hasNavigatorNamespace: 'modelContext' in navigator,
  }));

  expect(facts).toEqual({
    isSecureContext: true,
    hasDocumentNamespace: true,
    hasNavigatorNamespace: false,
  });
});

test('every tool reaches the browser with the annotations it declared', async ({ page }) => {
  await page.goto('/');

  // Registration is asynchronous and the header is the app's own report of it, so waiting on
  // that sentence is also an assertion that the user is told the truth about it.
  await expect(headerLine(page, 'Agent tools:')).toContainText(
    `Vistect published ${String(TOOLS.length)} tools`,
  );

  const published = await publishedTools(page);

  /**
   * One assertion for names, annotations and count: a duplicate registration, a missing tool
   * or a tool that lost an annotation all land here with a readable diff.
   *
   * Compared by name rather than in sequence, because the first run of this test established
   * that `getTools()` returns the tools **sorted alphabetically by name**, not in the order
   * they were registered. `register.ts` still registers one at a time and in registry order —
   * that is about attributing a rejection to the tool that caused it, not about presentation —
   * but the order an agent sees is Chrome's, so asserting ours here would only have pinned a
   * belief. What must hold is that the published set is exactly the promised set.
   */
  const byName = <T extends { name: string }>(list: T[]): T[] =>
    [...list].sort((a, b) => a.name.localeCompare(b.name));

  expect(
    byName(
      published.map((tool) => ({
        name: tool.name,
        readOnlyHint: tool.readOnlyHint,
        untrustedContentHint: tool.untrustedContentHint,
      })),
    ),
  ).toEqual(
    byName(
      EXPECTED.map((tool) => ({
        name: tool.name,
        readOnlyHint: tool.readOnlyHint,
        untrustedContentHint: true,
      })),
    ),
  );

  const origin = new URL(page.url()).origin;
  for (const tool of published) {
    expect(tool.title, `${tool.name} published no title`).not.toBe('');
    // Descriptions are how a tool gets chosen (plan §6). A one-liner is a bug, not a style.
    expect(
      tool.description.length,
      `${tool.name} published a thin description`,
    ).toBeGreaterThan(80);
    expect(tool.inputSchemaType, `${tool.name} published no object input schema`).toBe(
      'object',
    );
    expect(tool.origin, `${tool.name} was registered by another origin`).toBe(origin);
    /**
     * The IDL says `object`; Chrome 152 says `string` (see `publishedTools`). Asserted rather
     * than tolerated: this is the shape an agent has to parse to fill the schema in, and a
     * change either way is something we need to read the spec about, not discover in a demo.
     */
    expect(
      tool.reflectedSchemaKind,
      `${tool.name}: Chrome no longer reflects inputSchema back as a JSON string. Re-read the WebMCP spec before changing webmcp/types.ts.`,
    ).toBe('string');
  }
});

/**
 * A published schema an agent cannot fill in is a tool it cannot call. Two fields carry the
 * whole Day 1 contract: `create_document` must ask for the intent it will be judged against,
 * and every other write must expose `expectedDocumentVersion` — the agent cannot satisfy an
 * optimistic-concurrency check it was never told about (§6).
 */
test('the published schemas expose the fields an agent has to fill in', async ({ page }) => {
  await page.goto('/');
  await expect(headerLine(page, 'Agent tools:')).toContainText('Vistect published');

  const published = await publishedTools(page);
  const keysOf = (name: string): string[] =>
    published.find((tool) => tool.name === name)?.inputSchemaKeys ?? [];

  expect(keysOf('create_document')).toEqual(
    expect.arrayContaining(['title', 'purpose', 'audience', 'primaryMessage', 'pageTemplates']),
  );
  expect(
    keysOf('create_document'),
    'create_document has no prior state to conflict with',
  ).not.toContain('expectedDocumentVersion');
  expect(keysOf('add_text_section')).toEqual(
    expect.arrayContaining(['expectedDocumentVersion', 'textRole', 'content']),
  );
  expect(keysOf('update_intent_contract')).toContain('expectedDocumentVersion');
  expect(keysOf('inspect_page')).toContain('pageId');
});

/**
 * Day 1's done-when, in one test: two tool calls, an announcement for each, a page that
 * appears, an audit trail listing both, and a reload that restores all of it.
 *
 * It is driven through the DevAgentConsole because `executeTool()` cannot drive a tool (D0-1),
 * and the console is not a second implementation — it calls the same `createToolRunner` the
 * WebMCP `execute` callback calls, so what passes here is what an agent gets.
 */
test('two tool calls announce, render, are audited, and survive a reload', async ({ page }) => {
  await page.goto('/');

  const announcer = page.getByRole('status');
  const entries = page.locator('#activity li.activity-entry');
  const page2 = page.getByRole('article', { name: 'Page 2' });

  // Proves the browser started clean, which is what makes the count after the reload mean
  // something.
  await expect(headerLine(page, 'Saved work:')).toContainText(
    'Starting a new document. Nothing was saved here before.',
  );
  await expect(page.getByText('There is no document to show yet.')).toBeVisible();

  await page.getByRole('button', { name: '1. Create the demo document' }).click();

  await expect(announcer).toContainText('Tool call completed.');
  await expect(announcer).toContainText('Created "Independence in Practice" with 2 pages');
  await expect(page.getByRole('article', { name: 'Page 1' })).toBeVisible();
  await expect(page2).toBeVisible();

  await page.getByRole('button', { name: '3. Add a heading to the last page' }).click();

  await expect(announcer).toContainText('Added a level 2 heading to page 2');
  await expect(announcer).toContainText('The document is now at version 2.');

  // The page, and the navigator's account of the page. A blind user reads the second one, so
  // both are part of "the page appears".
  await expect(
    page2.getByRole('heading', { level: 2, name: 'Employment outcomes' }),
  ).toBeVisible();
  await expect(
    page.getByRole('treeitem', { name: '1. Heading level 2: Employment outcomes' }),
  ).toBeVisible();

  // Newest first, and attributed: a console call is recorded as the user's, never as an
  // agent's (§4.4).
  await expect(entries).toHaveCount(2);
  await expect(entries.first()).toContainText('Applied by you — add_text_section');
  await expect(entries.last()).toContainText('Applied by you — create_document');

  await expect.poll(() => savedChangeCount(page)).toBe(2);
  await page.reload();

  await expect(headerLine(page, 'Saved work:')).toContainText(
    'Restored your document from this browser: 2 recorded changes.',
  );
  await expect(
    page2.getByRole('heading', { level: 2, name: 'Employment outcomes' }),
  ).toBeVisible();
  // The ledger is restored too, not just the document: what the agent did, and when.
  await expect(entries).toHaveCount(2);
  await expect(entries.first()).toContainText('add_text_section');

  // Nothing is announced on load. A restored document is not a change, and saying otherwise
  // would have a screen reader report work the user did not just do (§21.3).
  await expect(announcer).toBeEmpty();
});
