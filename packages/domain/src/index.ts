// ============================================================================
// Domain Package Exports
// ============================================================================

export * from './schema';
export * from './events';
export * from './commands';
export * from './bus';
export * from './machines';
export * from './invariants';
export * from './decisions';
export * from './validation';
export * from './toolSchemas';

// ============================================================================
// Re-export commonly used types
// ============================================================================

import type {
  DocumentProject,
  DocumentObject,
  Page,
  ImageAsset,
  Dataset,
  Diagram,
  Chart,
  VisualDecision,
  ValidationFinding,
  Actor,
  IntentContract,
  Theme,
} from './schema';

import type {
  DomainEvent,
  EventEnvelope,
} from './events';

import type {
  Command,
  CommandResult,
  DomainError,
} from './commands';

import type {
  CommandBus,
} from './bus';

export type {
  DocumentProject,
  DocumentObject,
  Page,
  ImageAsset,
  Dataset,
  Diagram,
  Chart,
  VisualDecision,
  ValidationFinding,
  Actor,
  IntentContract,
  Theme,
  DomainEvent,
  EventEnvelope,
  Command,
  CommandResult,
  DomainError,
  CommandBus,
};