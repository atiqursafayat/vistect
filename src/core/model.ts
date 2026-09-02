/**
 * The semantic document model — spec §8.
 *
 * Single import point for every consumer:
 *
 *   import type { DocumentProject, Page, TextObject } from '../core/model.js';
 */
export * from './model/primitives.js';
export * from './model/objects.js';
export * from './model/findings.js';
export * from './model/project.js';
