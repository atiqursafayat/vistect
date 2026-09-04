// ============================================================================
// Execution Gate: Rate Limiting and Human Confirmation
// ============================================================================
//
// Every agent tool call passes through this gate before reaching the command bus:
//
//   rate limit → human confirmation (consequential tools) → execute
//
// Two distinct protections. Rate limiting bounds a runaway or looping agent
// (`07-security-review.md` §3). Confirmation ensures a consequential action —
// locking, deleting, approving, exporting — is authorised by a human gesture, not
// inferred by a model (§18.12, AC F-6.x §3).

import type { Command, CommandResult } from '@vistect/domain/commands';

// ============================================================================
// Rate limiter (token bucket)
// ============================================================================

export interface RateLimitConfig {
  /** Maximum burst size. */
  capacity: number;
  /** Sustained rate, tokens per second. */
  refillRate: number;
}

/**
 * Per-prefix limits, ordered from most to least specific.
 *
 * An array rather than a record: `Object.entries` order is not part of the
 * language contract for all key shapes, and prefix matching must be
 * deterministic — `get_findings` has to match before the broader `get_`.
 */
const RATE_LIMITS: readonly (readonly [prefix: string, config: RateLimitConfig])[] = [
  // Specific read tools
  ['get_findings', { capacity: 20, refillRate: 5 }],
  ['get_validation_summary', { capacity: 20, refillRate: 5 }],
  ['get_decisions', { capacity: 20, refillRate: 5 }],
  ['get_export_jobs', { capacity: 10, refillRate: 2 }],
  ['get_document_overview', { capacity: 10, refillRate: 2 }],
  ['get_diagrams', { capacity: 20, refillRate: 5 }],
  ['get_charts', { capacity: 20, refillRate: 5 }],
  ['get_image_assets', { capacity: 20, refillRate: 5 }],
  ['get_text_objects', { capacity: 20, refillRate: 5 }],
  ['get_icon_system', { capacity: 10, refillRate: 2 }],

  // Read prefixes
  ['get_', { capacity: 50, refillRate: 10 }],
  ['list_', { capacity: 50, refillRate: 10 }],
  ['search_', { capacity: 20, refillRate: 5 }],
  ['navigate_', { capacity: 30, refillRate: 5 }],
  ['inspect_', { capacity: 30, refillRate: 5 }],
  ['describe_', { capacity: 20, refillRate: 3 }],
  ['analyze_', { capacity: 20, refillRate: 3 }],
  ['validate_', { capacity: 10, refillRate: 2 }],
  ['compare_', { capacity: 10, refillRate: 2 }],
  ['recommend_', { capacity: 10, refillRate: 2 }],
  ['preview_', { capacity: 10, refillRate: 2 }],
  ['identify_', { capacity: 20, refillRate: 3 }],

  // Write prefixes — lower, because each mutates and each costs a version bump
  ['update_', { capacity: 20, refillRate: 5 }],
  ['set_', { capacity: 20, refillRate: 5 }],
  ['create_', { capacity: 10, refillRate: 2 }],
  ['add_', { capacity: 15, refillRate: 3 }],
  ['move_', { capacity: 15, refillRate: 3 }],
  ['place_', { capacity: 15, refillRate: 3 }],
  ['reorder_', { capacity: 10, refillRate: 2 }],
  ['remove_', { capacity: 10, refillRate: 2 }],
  ['delete_', { capacity: 10, refillRate: 2 }],
  ['crop_', { capacity: 10, refillRate: 2 }],
  ['record_', { capacity: 10, refillRate: 2 }],
  ['approve_', { capacity: 10, refillRate: 2 }],
  ['reject_', { capacity: 10, refillRate: 2 }],
  ['import_', { capacity: 5, refillRate: 1 }],
  ['upload_', { capacity: 5, refillRate: 1 }],
  ['export_', { capacity: 5, refillRate: 1 }],
  ['lock_', { capacity: 5, refillRate: 1 }],
  ['unlock_', { capacity: 5, refillRate: 1 }],
  ['finalize_', { capacity: 2, refillRate: 0.5 }],
];

const DEFAULT_RATE_LIMIT: RateLimitConfig = { capacity: 10, refillRate: 2 };

export interface RateLimitResult {
  allowed: boolean;
  /** Present when denied: milliseconds until one token is available. */
  retryAfterMs?: number;
}

export interface RateLimiter {
  checkLimit(toolName: string): RateLimitResult;
  reset(): void;
}

export function getRateLimitConfig(toolName: string): RateLimitConfig {
  for (const [prefix, config] of RATE_LIMITS) {
    if (toolName.startsWith(prefix)) return config;
  }
  return DEFAULT_RATE_LIMIT;
}

/**
 * Token-bucket limiter.
 *
 * `now` is injectable so tests can advance time without sleeping; production
 * callers use the default.
 */
export function createRateLimiter(now: () => number = Date.now): RateLimiter {
  const buckets = new Map<string, { tokens: number; lastRefill: number }>();

  return {
    checkLimit(toolName: string): RateLimitResult {
      const config = getRateLimitConfig(toolName);
      const timestamp = now();

      let bucket = buckets.get(toolName);
      if (bucket === undefined) {
        bucket = { tokens: config.capacity, lastRefill: timestamp };
        buckets.set(toolName, bucket);
      }

      const elapsedSeconds = Math.max(0, (timestamp - bucket.lastRefill) / 1000);
      bucket.tokens = Math.min(config.capacity, bucket.tokens + elapsedSeconds * config.refillRate);
      bucket.lastRefill = timestamp;

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return { allowed: true };
      }

      return {
        allowed: false,
        retryAfterMs: Math.ceil(((1 - bucket.tokens) / config.refillRate) * 1000),
      };
    },

    reset() {
      buckets.clear();
    },
  };
}

// ============================================================================
// Consequential actions
// ============================================================================

/**
 * Tools that require a human gesture before executing.
 *
 * Membership criterion: the action is hard to reverse, or it constitutes approval
 * that only a human may give (I-03).
 */
export const CONSEQUENTIAL_TOOLS: ReadonlySet<string> = new Set([
  'lock_document',
  'unlock_document',
  'finalize_export',
  'approve_decision',
  'reject_decision',
  'approve_export_manifest',
  'confirm_readiness',
  'delete_project',
  'delete_page',
  'delete_object',
  'delete_asset',
  'delete_diagram',
  'delete_chart',
  'delete_dataset',
]);

export function defaultRequireUserInteraction(toolName: string): boolean {
  return CONSEQUENTIAL_TOOLS.has(toolName);
}

/** Asks the user to confirm a consequential action. */
export type ConfirmationHandler = (toolName: string, input: unknown) => Promise<boolean>;

/** Milliseconds to wait for a confirmation response before treating it as declined. */
export const CONFIRMATION_TIMEOUT_MS = 120_000;

export interface ConfirmationRequestDetail {
  toolName: string;
  input: unknown;
  requestId: string;
}

export interface ConfirmationResponseDetail {
  requestId: string;
  confirmed: boolean;
}

/**
 * Browser confirmation handler.
 *
 * Dispatches `webmcp:confirmation` for the UI to render an accessible dialog, and
 * resolves when a matching `webmcp:confirmation-response` arrives.
 *
 * Three defects in the previous version are fixed here: requests were correlated
 * by tool name (so two concurrent calls to the same tool cross-resolved), there
 * was no timeout (so a dismissed dialog left the promise pending forever), and
 * the listener was never removed on the timeout path.
 */
export function createBrowserConfirmationHandler(
  timeoutMs: number = CONFIRMATION_TIMEOUT_MS
): ConfirmationHandler {
  let counter = 0;

  return async (toolName, input) => {
    if (typeof window === 'undefined') {
      // No UI to confirm with. Denying is the safe default: a consequential
      // action must never proceed unconfirmed.
      return false;
    }

    counter += 1;
    const requestId = `confirm_${String(counter)}_${String(Date.now())}`;

    return new Promise<boolean>((resolve) => {
      let settled = false;

      const finish = (confirmed: boolean): void => {
        if (settled) return;
        settled = true;
        window.removeEventListener('webmcp:confirmation-response', handler);
        clearTimeout(timer);
        resolve(confirmed);
      };

      const handler = (event: Event): void => {
        const detail = (event as CustomEvent<ConfirmationResponseDetail>).detail;
        if (detail?.requestId === requestId) {
          finish(detail.confirmed);
        }
      };

      const timer = setTimeout(() => { finish(false); }, timeoutMs);

      window.addEventListener('webmcp:confirmation-response', handler);
      window.dispatchEvent(
        new CustomEvent<ConfirmationRequestDetail>('webmcp:confirmation', {
          detail: { toolName, input, requestId },
        })
      );
    });
  };
}

/** Default handler. Named for what it is, so its behaviour is not assumed. */
export const defaultShowConfirmation: ConfirmationHandler = createBrowserConfirmationHandler();

// ============================================================================
// Execution gate
// ============================================================================

export interface ExecutionGate {
  execute(toolName: string, command: Command, run: () => Promise<CommandResult>): Promise<CommandResult>;
}

export interface ExecutionGateConfig {
  rateLimiter: RateLimiter;
  requireUserInteraction?: (toolName: string) => boolean;
  showConfirmation?: ConfirmationHandler;
}

export function createExecutionGate(config: ExecutionGateConfig): ExecutionGate {
  const {
    rateLimiter,
    requireUserInteraction = defaultRequireUserInteraction,
    showConfirmation = defaultShowConfirmation,
  } = config;

  return {
    async execute(toolName, command, run) {
      const limit = rateLimiter.checkLimit(toolName);
      if (!limit.allowed) {
        return {
          ok: false,
          changedIds: [],
          error: `Rate limited. Retry after ${String(limit.retryAfterMs ?? 0)}ms.`,
          errorCode: 'RateLimited',
        };
      }

      if (requireUserInteraction(toolName)) {
        const confirmed = await showConfirmation(toolName, command.payload);
        if (!confirmed) {
          return {
            ok: false,
            changedIds: [],
            error: 'The action was not confirmed.',
            errorCode: 'UserDeclined',
          };
        }
      }

      try {
        return await run();
      } catch (error) {
        // The command bus returns typed failures rather than throwing, so an
        // exception here is an unexpected fault, not a domain rejection.
        return {
          ok: false,
          changedIds: [],
          error: error instanceof Error ? error.message : 'Unknown execution error',
          errorCode: 'ExecutionError',
        };
      }
    },
  };
}

// ============================================================================
// Agent client
// ============================================================================

/**
 * The client object WebMCP passes to a tool's `execute`.
 *
 * `requestUserInteraction` must wrap any consequential effect, so the browser can
 * verify a user gesture initiated it (ADR-008 §2).
 */
export interface WebMCPClient {
  requestUserInteraction<T>(callback: () => Promise<T>): Promise<T>;
}

export type ToolExecuteFn = (input: unknown, client: WebMCPClient) => Promise<string>;

/**
 * Wraps a tool's `execute` so consequential tools are confirmed first.
 *
 * The returned `client.requestUserInteraction` re-confirms per invocation rather
 * than assuming the outer check still holds: a long-running tool may reach its
 * effect long after the gate ran.
 */
export function wrapToolExecute(
  executeFn: ToolExecuteFn,
  toolName: string,
  showConfirmation: ConfirmationHandler = defaultShowConfirmation,
  requireUserInteraction: (toolName: string) => boolean = defaultRequireUserInteraction
): (input: unknown) => Promise<string> {
  return async (input: unknown) => {
    const client: WebMCPClient = {
      async requestUserInteraction<T>(callback: () => Promise<T>): Promise<T> {
        if (requireUserInteraction(toolName)) {
          const confirmed = await showConfirmation(toolName, input);
          if (!confirmed) {
            throw new Error(
              JSON.stringify({ code: 'UserDeclined', message: 'The action was not confirmed.' })
            );
          }
        }
        return callback();
      },
    };

    return executeFn(input, client);
  };
}
