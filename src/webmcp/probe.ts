/**
 * The capability probe — "can an agent drive this page right now?", answered in words.
 *
 * There are three separate ways WebMCP can be silently absent, and all three were found
 * the hard way (D0-1): the wrong namespace, an un-awaited registration, and an origin
 * that is not a secure context. This probe covers the two it can see from inside the
 * page; `register.ts` covers the third by awaiting.
 *
 * It is synchronous and it never throws, so the app can call it during the first render
 * and say something true either way. Degrading gracefully here is not a nicety: the
 * DevAgentConsole calls exactly the same tools through exactly the same runner, so a
 * browser without WebMCP loses the agent, not the product.
 */
import type { WebMcpSupport } from './types.js';
import { getModelContext } from './types.js';

const FLAG = '--enable-blink-features=WebMCP';

export function probeWebMcp(): WebMcpSupport {
  const hasDocument = typeof document !== 'undefined';
  const isSecureContext = typeof window !== 'undefined' && window.isSecureContext === true;
  const modelContext = getModelContext();
  const hasDocumentNamespace = modelContext !== undefined && modelContext !== null;
  const hasNavigatorNamespace = typeof navigator !== 'undefined' && 'modelContext' in navigator;
  const canRegister = typeof modelContext?.registerTool === 'function';
  const supported = hasDocumentNamespace && canRegister;

  const advice: string[] = [];
  let summary: string;

  if (!hasDocument) {
    summary = 'There is no browser document here, so WebMCP cannot be checked.';
  } else if (supported) {
    summary = 'This browser supports WebMCP, so a connected agent can drive Vistect directly.';
  } else if (!isSecureContext) {
    summary =
      'Agent tools are unavailable because this page is not a secure context, which WebMCP requires.';
    advice.push(
      'Open Vistect over https, or over http://localhost, and the agent tools appear.',
    );
  } else if (!hasDocumentNamespace) {
    summary =
      'This browser does not expose WebMCP, so no agent can connect. Everything still works from the keyboard, and the developer console can call the same tools.';
    advice.push(`Chrome needs the ${FLAG} flag until WebMCP ships unflagged.`);
    if (hasNavigatorNamespace) {
      // The exact v1 trap. If this ever fires, the namespace moved back.
      advice.push(
        'This browser does expose navigator.modelContext. Re-run npm run probe:webmcp and re-read the spec before switching namespaces.',
      );
    }
  } else {
    summary =
      'This browser exposes WebMCP but not a way to register tools, so no agent can connect.';
    advice.push('Re-run npm run probe:webmcp: the API surface has changed.');
  }

  return {
    supported,
    hasDocument,
    isSecureContext,
    hasDocumentNamespace,
    hasNavigatorNamespace,
    canRegister,
    summary,
    advice,
  };
}
