// ============================================================================
// Execution Gate: Rate Limiting, Approval Staging, requestUserInteraction
// ============================================================================

import type { CommandBus, Command, CommandResult, DomainError } from '@vistect/domain/bus';
import type { DocumentProject } from '@vistect/domain/schema';

// ============================================================================
// Rate Limiter (Token Bucket)
// ============================================================================

export interface RateLimitConfig {
  capacity: number; // max tokens
  refillRate: number; // tokens per second
}

export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Read tools - higher limits
  'get_': { capacity: 50, refillRate: 10 },
  'list_': { capacity: 50, refillRate: 10 },
  'inspect_': { capacity: 30, refillRate: 5 },
  'analyze_': { capacity: 20, refillRate: 3 },
  'compare_': { capacity: 10, refillRate: 2 },
  'recommend_': { capacity: 10, refillRate: 2 },
  'preview_': { capacity: 10, refillRate: 2 },
  'export_': { capacity: 5, refillRate: 1 },
  'describe_': { capacity: 20, refillRate: 3 },
  'validate_': { capacity: 10, refillRate: 2 },
  'get_findings': { capacity: 20, refillRate: 5 },
  'get_validation_summary': { capacity: 20, refillRate: 5 },
  'get_decisions': { capacity: 20, refillRate: 5 },
  'get_export_jobs': { capacity: 10, refillRate: 2 },
  'get_document_overview': { capacity: 10, refillRate: 2 },
  'navigate_semantic': { capacity: 30, refillRate: 5 },
  'get_diagrams': { capacity: 20, refillRate: 5 },
  'get_charts': { capacity: 20, refillRate: 5 },
  'get_image_assets': { capacity: 20, refillRate: 5 },
  'get_text_objects': { capacity: 20, refillRate: 5 },
  'get_icon_system': { capacity: 10, refillRate: 2 },
  'search_icons': { capacity: 20, refillRate: 5 },

  // Write tools - lower limits
  'create_': { capacity: 10, refillRate: 2 },
  'update_': { capacity: 20, refillRate: 5 },
  'delete_': { capacity: 10, refillRate: 2 },
  'move_': { capacity: 15, refillRate: 3 },
  'place_': { capacity: 15, refillRate: 3 },
  'set_': { capacity: 20, refillRate: 5 },
  'add_': { capacity: 15, refillRate: 3 },
  'remove_': { capacity: 10, refillRate: 2 },
  'reorder_': { capacity: 10, refillRate: 2 },
  'crop_': { capacity: 10, refillRate: 2 },
  'approve_': { capacity: 10, refillRate: 2 },
  'reject_': { capacity: 10, refillRate: 2 },
  'lock_': { capacity: 5, refillRate: 1 },
  'unlock_': { capacity: 5, refillRate: 1 },
  'finalize_': { capacity: 2, refillRate: 0.5 },
  'upload_': { capacity: 5, refillRate: 1 },
  'record_': { capacity: 10, refillRate: 2 },
  'import_': { capacity: 5, refillRate: 1 },
};

export interface RateLimiter {
  checkLimit(toolName: string): { allowed: boolean; retryAfterMs?: number };
  reset(): void;
}

function getRateLimitConfig(toolName: string): RateLimitConfig {
  for (const [prefix, config] of Object.entries(DEFAULT_RATE_LIMITS)) {
    if (toolName.startsWith(prefix)) {
      return config;
    }
  }
  return { capacity: 10, refillRate: 2 }; // Default
}

export function createRateLimiter(): RateLimiter {
  const buckets = new Map<string, { tokens: number; lastRefill: number }>();

  return {
    checkLimit(toolName: string) {
      const config = getRateLimitConfig(toolName);
      const now = Date.now();

      let bucket = buckets.get(toolName);
      if (!bucket) {
        bucket = { tokens: config.capacity, lastRefill: now };
        buckets.set(toolName, bucket);
      }

      // Refill tokens
      const elapsed = (now - bucket.lastRefill) / 1000;
      bucket.tokens = Math.min(config.capacity, bucket.tokens + elapsed * config.refillRate);
      bucket.lastRefill = now;

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return { allowed: true };
      }

      const retryAfterMs = Math.ceil((1 - bucket.tokens) / config.refillRate * 1000);
      return { allowed: false, retryAfterMs };
    },

    reset() {
      buckets.clear();
    },
  };
}

// ============================================================================
// Execution Gate
// ============================================================================

export interface ExecutionGate {
  execute<T>(
    toolName: string,
    project: DocumentProject,
    commandBus: CommandBus,
    command: Command,
    executeFn: () => Promise<T>
  ): Promise<CommandResult>;
}

export interface ExecutionGateConfig {
  rateLimiter: RateLimiter;
  requireUserInteraction: (toolName: string) => boolean;
  showConfirmation: (toolName: string, input: unknown) => Promise<boolean>;
}

export function createExecutionGate(config: ExecutionGateConfig): ExecutionGate {
  const { rateLimiter, requireUserInteraction, showConfirmation } = config;

  return {
    async execute(toolName, project, commandBus, command, executeFn) {
      // Check rate limit
      const limitCheck = rateLimiter.checkLimit(toolName);
      if (!limitCheck.allowed) {
        return {
          ok: false,
          error: `Rate limited. Retry after ${limitCheck.retryAfterMs}ms`,
          errorCode: 'RateLimited',
        };
      }

      // Check if user interaction required
      if (requireUserInteraction(toolName)) {
        const confirmed = await showConfirmation(toolName, command.payload);
        if (!confirmed) {
          return {
            ok: false,
            error: 'User declined confirmation',
            errorCode: 'UserDeclined',
          };
        }
      }

      // Execute the command
      try {
        await executeFn();
        return { ok: true };
      } catch (error) {
        if (error instanceof Error) {
          // Check if it's a domain error
          try {
            const domainError = JSON.parse(error.message) as DomainError;
            return {
              ok: false,
              error: domainError.message || error.message,
              errorCode: domainError.code,
            };
          } catch {
            return {
              ok: false,
              error: error.message,
              errorCode: 'ExecutionError',
            };
          }
        }
        return {
          ok: false,
          error: 'Unknown execution error',
          errorCode: 'ExecutionError',
        };
      }
    },
  };
}

// ============================================================================
// Default Configurations
// ============================================================================

export const CONSEQUENTIAL_TOOLS = new Set([
  'lock_document',
  'unlock_document',
  'finalize_export',
  'delete_project',
  'delete_page',
  'delete_object',
  'delete_asset',
  'delete_diagram',
  'delete_chart',
  'delete_dataset',
  'approve_decision',
  'reject_decision',
  'approve_export_manifest',
]);

export function defaultRequireUserInteraction(toolName: string): boolean {
  return CONSEQUENTIAL_TOOLS.has(toolName);
}

export async function defaultShowConfirmation(toolName: string, input: unknown): Promise<boolean> {
  // In production, this would show a modal dialog
  // For testing, we'll auto-confirm non-consequential tools
  if (!CONSEQUENTIAL_TOOLS.has(toolName)) return true;

  // Dispatch a custom event for the UI to handle
  const event = new CustomEvent('webmcp:confirmation', {
    detail: { toolName, input },
  });
  window.dispatchEvent(event);

  // Wait for user response (in real implementation, this would be a promise
  // that resolves when the user clicks confirm/cancel)
  return new Promise(resolve => {
    const handler = (e: CustomEvent) => {
      if (e.detail.toolName === toolName) {
        window.removeEventListener('webmcp:confirmation-response', handler);
        resolve(e.detail.confirmed);
      }
    };
    window.addEventListener('webmcp:confirmation-response', handler);
  });
}

// ============================================================================
// Agent Client Interface (for requestUserInteraction)
// ============================================================================

export interface WebMCPClient {
  requestUserInteraction(callback: () => Promise<void>): Promise<void>;
}

export function createAgentClient(
  project: DocumentProject,
  showConfirmation: (toolName: string, input: unknown) => Promise<boolean>
): WebMCPClient {
  return {
    async requestUserInteraction(callback) {
      // This is called from within a tool's execute function
      // The tool should have already checked requireUserInteraction
      await callback();
    },
  };
}

// ============================================================================
// Tool Wrapper for execute(input, client) signature
// ============================================================================

export interface ToolExecuteFn {
  (input: unknown, client: WebMCPClient): Promise<string>;
}

export function wrapToolExecute(
  executeFn: ToolExecuteFn,
  toolName: string,
  showConfirmation: (toolName: string, input: unknown) => Promise<boolean>
): (input: unknown) => Promise<string> {
  return async (input: unknown) => {
    const client = createAgentClient({} as DocumentProject, showConfirmation);

    if (defaultRequireUserInteraction(toolName)) {
      const confirmed = await showConfirmation(toolName, input);
      if (!confirmed) {
        throw new Error(JSON.stringify({
          code: 'UserDeclined',
          message: 'User declined confirmation',
        }));
      }
    }

    return executeFn(input, client);
  };
}