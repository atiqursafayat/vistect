#!/usr/bin/env node
/**
 * D0-1 — WebMCP ground-truth probe.
 *
 * Reproduces the table in `docs/implementation-plan.md` §2 on demand, in a real
 * flagged Chrome, and exits non-zero the moment reality stops matching it.
 *
 * This exists because v1 built 2,819 lines of WebMCP integration on the belief
 * that tools register on `navigator.modelContext`. They do not — they register on
 * `document.modelContext` — and nothing in v1's test suite could tell, because the
 * harness mocked the same object that does not exist. This script is the
 * counter-measure: it never mocks, it runs in CI, and a namespace move fails it
 * loudly instead of silently degrading.
 *
 *   npm run probe:webmcp
 */
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const CHROME_ARGS = ['--enable-blink-features=WebMCP'];
const PROBE_TOOL = 'vistect_probe_echo';
const EXECUTE_TIMEOUT_MS = 1500;

/**
 * WebMCP is gated on a secure context, and `about:blank` + `setContent()` is an
 * opaque origin that does not qualify. Loopback does, so the probe serves its own
 * page — that keeps it runnable with no dev server and no origin-trial token.
 */
function serveProbePage() {
  const html =
    '<!doctype html><html lang="en"><title>Vistect WebMCP probe</title><h1>probe</h1>';
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ url: `http://127.0.0.1:${port}/`, close: () => server.close() });
    });
  });
}

/**
 * Runs inside the page. Serialised via `toString()`, so it must be entirely
 * self-contained — no closures over module scope.
 */
async function probeInPage(toolName, executeTimeoutMs) {
  const out = {
    isSecureContext: window.isSecureContext,
    documentNamespace: typeof document.modelContext,
    navigatorNamespace: typeof navigator.modelContext,
    navigatorHasKey: 'modelContext' in navigator,
    prototypeSurface: null,
    registerToolReturnsPromise: null,
    getToolsResolves: null,
    registeredToolKeys: null,
    annotationsRoundTrip: null,
    hasExecuteTool: null,
    executeToolSettles: null,
    executeCallbackInvoked: null,
    abortUnregisters: null,
    error: null,
  };

  const mc = document.modelContext;
  if (!mc) return out;

  try {
    out.prototypeSurface = Object.getOwnPropertyNames(Object.getPrototypeOf(mc)).sort();
    out.hasExecuteTool = typeof mc.executeTool;

    let executeCallbackInvoked = false;
    const controller = new AbortController();
    const returned = mc.registerTool(
      {
        name: toolName,
        title: 'Vistect probe echo',
        description: 'Probe-only tool. Echoes its input so registration can be asserted.',
        inputSchema: {
          type: 'object',
          properties: { message: { type: 'string' } },
          required: ['message'],
          additionalProperties: false,
        },
        // `consequentialHint` is included even though webmcp-types@0.1.6 does not
        // declare it: the probe's job is to report whether it round-trips.
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: true,
          consequentialHint: true,
        },
        execute: (input) => {
          executeCallbackInvoked = true;
          return { content: [{ type: 'text', text: String(input?.message ?? '') }] };
        },
      },
      { signal: controller.signal },
    );
    out.registerToolReturnsPromise = typeof returned?.then === 'function';
    await returned;

    const tools = await mc.getTools();
    out.getToolsResolves = Array.isArray(tools);
    const mine = tools.find((t) => t.name === toolName);
    if (mine) {
      // RegisteredTool is a plain dictionary object, so own keys are the surface.
      out.registeredToolKeys = Object.keys(mine).sort();
      out.annotationsRoundTrip = {
        readOnlyHint: mine.annotations?.readOnlyHint ?? null,
        untrustedContentHint: mine.annotations?.untrustedContentHint ?? null,
        consequentialHint: mine.annotations?.consequentialHint ?? null,
      };
    }

    // Bounded, because §2 records that executeTool() never settles without an
    // attached agent. An unbounded call here would hang CI.
    if (typeof mc.executeTool === 'function') {
      out.executeToolSettles = await Promise.race([
        Promise.resolve(mc.executeTool(toolName, { message: 'ping' })).then(
          () => 'resolved',
          () => 'rejected',
        ),
        new Promise((r) => setTimeout(() => r('did-not-settle'), executeTimeoutMs)),
      ]);
      out.executeCallbackInvoked = executeCallbackInvoked;
    }

    controller.abort();
    const after = await mc.getTools();
    out.abortUnregisters = !after.some((t) => t.name === toolName);
  } catch (err) {
    out.error = String(err);
  }
  return out;
}

async function run() {
  const site = await serveProbePage();
  const browser = await chromium.launch({ channel: 'chrome', args: CHROME_ARGS });
  try {
    const page = await browser.newPage();
    await page.goto(site.url, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(
      `(${probeInPage.toString()})(${JSON.stringify(PROBE_TOOL)}, ${EXECUTE_TIMEOUT_MS})`,
    );
    return { chromeVersion: browser.version(), origin: site.url, ...result };
  } finally {
    await browser.close();
    site.close();
  }
}

const rows = [];
const critical = [];

function check({ fact, value, ok = true, isCritical = false, note }) {
  rows.push({ fact, value: String(value), verdict: ok ? '✅' : isCritical ? '❌' : '⚠️ ' });
  if (!ok && isCritical) critical.push(`${fact} = ${value}${note ? ` — ${note}` : ''}`);
}

function render() {
  const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - String(s).length));
  const wF = Math.max(4, ...rows.map((r) => r.fact.length));
  const wV = Math.max(5, ...rows.map((r) => r.value.length));
  return [
    `| ${pad('Fact', wF)} | ${pad('Value', wV)} |    |`,
    `|-${'-'.repeat(wF)}-|-${'-'.repeat(wV)}-|----|`,
    ...rows.map((r) => `| ${pad(r.fact, wF)} | ${pad(r.value, wV)} | ${r.verdict} |`),
  ].join('\n');
}

const p = await run();

check({ fact: 'Chrome version', value: p.chromeVersion });
check({ fact: 'Launch flag', value: CHROME_ARGS.join(' ') });
check({ fact: 'Probe origin', value: p.origin });
check({
  fact: 'document.modelContext',
  value: p.documentNamespace,
  ok: p.documentNamespace === 'object',
  isCritical: true,
  note: 'the WebMCP namespace moved — fix src/webmcp/types.ts before anything else',
});
check({
  fact: 'navigator.modelContext',
  value: `${p.navigatorNamespace} ('modelContext' in navigator: ${p.navigatorHasKey})`,
  ok: p.navigatorNamespace === 'undefined',
  note: 'navigator now carries it too — re-read the spec before switching',
});
check({
  fact: 'Secure context',
  value: p.isSecureContext,
  ok: p.isSecureContext === true,
  isCritical: true,
  note: 'WebMCP requires a secure context',
});
check({
  fact: 'Prototype surface',
  value: (p.prototypeSurface ?? []).join(', ') || '—',
  ok: (p.prototypeSurface ?? []).includes('registerTool'),
  isCritical: true,
});
check({
  fact: 'registerTool() returns a Promise',
  value: p.registerToolReturnsPromise,
  ok: p.registerToolReturnsPromise === true,
  isCritical: true,
  note: 'registration must be awaited or tools are silently lost',
});
check({
  fact: 'getTools() lists our tool',
  value: p.registeredToolKeys ? p.registeredToolKeys.join(', ') : 'NOT LISTED',
  ok: Array.isArray(p.registeredToolKeys),
  isCritical: true,
  note: 'registration resolved but the tool is not exposed to agents',
});
check({
  fact: 'annotations.readOnlyHint round-trips',
  value: p.annotationsRoundTrip?.readOnlyHint,
  ok: p.annotationsRoundTrip?.readOnlyHint === true,
});
check({
  fact: 'annotations.untrustedContentHint round-trips',
  value: p.annotationsRoundTrip?.untrustedContentHint,
  ok: p.annotationsRoundTrip?.untrustedContentHint === true,
});
check({
  fact: 'annotations.consequentialHint round-trips',
  value: p.annotationsRoundTrip?.consequentialHint,
  // Expected to be dropped. If it ever survives that is good news, not a failure.
  ok: p.annotationsRoundTrip?.consequentialHint == null,
  note: 'now supported — the app still owns its own approval gate',
});
check({ fact: 'executeTool() present', value: p.hasExecuteTool });
check({
  fact: `executeTool() settles within ${EXECUTE_TIMEOUT_MS}ms`,
  value: `${p.executeToolSettles ?? 'n/a'} (execute callback invoked: ${p.executeCallbackInvoked})`,
});
check({
  fact: 'AbortController unregisters',
  value: p.abortUnregisters,
  ok: p.abortUnregisters === true,
  note: 'there is no unregisterTool(); abort is the only removal path',
});

console.log('\nWebMCP ground truth — docs/implementation-plan.md §2\n');
console.log(render());
if (p.error) console.log(`\nIn-page error: ${p.error}`);

if (critical.length > 0) {
  console.error('\n❌ WebMCP ground truth changed:\n');
  for (const c of critical) console.error(`   - ${c}`);
  console.error('\nUpdate src/webmcp/types.ts and §2 of the plan before continuing.\n');
  process.exit(1);
}
console.log('\n✅ Ground truth matches §2.\n');
