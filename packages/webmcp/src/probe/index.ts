// ============================================================================
// WebMCP Capability Probe
// ============================================================================

export interface WebMCPCapability {
  available: boolean;
  version?: string;
  api: {
    registerTool: boolean;
    getTools: boolean;
    executeTool: boolean;
    ontoolchange: boolean;
  };
  declarative: {
    formAttributes: boolean;
    fieldAttributes: boolean;
  };
}

export interface CapabilityProbe {
  check(): WebMCPCapability;
  onChange(callback: (capability: WebMCPCapability) => void): () => void;
}

let currentCapability: WebMCPCapability | null = null;
const changeCallbacks = new Set<(capability: WebMCPCapability) => void>();

function detectCapability(): WebMCPCapability {
  const modelContext = (navigator as any).modelContext;

  if (!modelContext) {
    return {
      available: false,
      api: { registerTool: false, getTools: false, executeTool: false, ontoolchange: false },
      declarative: { formAttributes: false, fieldAttributes: false },
    };
  }

  return {
    available: true,
    version: modelContext.version,
    api: {
      registerTool: typeof modelContext.registerTool === 'function',
      getTools: typeof modelContext.getTools === 'function',
      executeTool: typeof modelContext.executeTool === 'function',
      ontoolchange: typeof modelContext.ontoolchange === 'object' || typeof modelContext.addEventListener === 'function',
    },
    declarative: {
      formAttributes: true, // Browser handles declarative API automatically
      fieldAttributes: true,
    },
  };
}

export function createCapabilityProbe(): CapabilityProbe {
  return {
    check() {
      currentCapability = detectCapability();
      return currentCapability;
    },

    onChange(callback) {
      changeCallbacks.add(callback);

      // Listen for browser capability changes
      const handleChange = () => {
        const newCapability = detectCapability();
        if (JSON.stringify(newCapability) !== JSON.stringify(currentCapability)) {
          currentCapability = newCapability;
          for (const cb of changeCallbacks) {
            try {
              cb(newCapability);
            } catch {
              // Ignore callback errors
            }
          }
        }
      };

      // Check periodically (browser doesn't emit capability change events)
      const interval = setInterval(handleChange, 5000);

      // Also listen for modelContext changes if available
      const modelContext = (navigator as any).modelContext;
      if (modelContext && typeof modelContext.addEventListener === 'function') {
        modelContext.addEventListener('toolchange', handleChange);
      }

      return () => {
        changeCallbacks.delete(callback);
        clearInterval(interval);
        if (modelContext && typeof modelContext.removeEventListener === 'function') {
          modelContext.removeEventListener('toolchange', handleChange);
        }
      };
    },
  };
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const capabilityProbe = createCapabilityProbe();