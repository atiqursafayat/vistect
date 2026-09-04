// ============================================================================
// Charting Package - Dataset Import, Chart Recommendation, Rendering, Integrity
// ============================================================================
//
// PURE package: no React, no DOM globals, no app imports (see
// `docs/planning/13-repository-structure.md`).
//
// Domain shapes (`Dataset`, `DataColumn`, `ChartSpec`, `ChartGeometry`) are
// re-exported from `@vistect/domain/schema` rather than redeclared. Local copies
// previously drifted — unbranded ids, `createdBy: string`, non-optional axis
// fields — so every value crossing the boundary needed a cast.

export * from './import';
export * from './infer';
export * from './recommend';
export * from './render';
export * from './integrity';
export * from './table';
export * from './narrative';
export * from './sonify';

export type {
  Chart,
  ChartAxis,
  ChartGeometry,
  ChartSeries,
  ChartSpec,
  ChartType,
  DataColumn,
  DataColumnType,
  Dataset,
} from '@vistect/domain/schema';
