// ============================================================================
// Charting Package - Dataset Import, Chart Recommendation, Rendering, Integrity
// ============================================================================

export * from './import';
export * from './infer';
export * from './recommend';
export * from './render';
export * from './integrity';
export * from './table';
export * from './narrative';
export * from './sonify';

// ============================================================================
// Types
// ============================================================================

export interface DataColumn {
  id: string;
  name: string;
  type: 'number' | 'string' | 'date' | 'boolean';
  values: Array<string | number | boolean | Date>;
  inferred: boolean;
}

export interface Dataset {
  id: string;
  name: string;
  columns: DataColumn[];
  rowCount: number;
  source: 'csv_upload' | 'manual_entry' | 'pasted_table' | 'extracted_table';
  sourceReference?: string;
  inferredSchema: boolean;
  userConfirmed: boolean;
  createdAt: string;
  createdBy: string;
}

export interface ChartSpec {
  type: 'horizontal_bar' | 'vertical_bar' | 'line';
  datasetId: string;
  xAxis: {
    title: string;
    type: 'category' | 'value' | 'time';
    min?: number;
    max?: number;
    baselineZero: boolean;
  };
  yAxis: {
    title: string;
    type: 'category' | 'value' | 'time';
    min?: number;
    max?: number;
    baselineZero: boolean;
  };
  series: Array<{
    name: string;
    dataColumnId: string;
    color: string;
    pattern?: string;
    dashArray?: string;
  }>;
  title: string;
  subtitle?: string;
  sourceNote?: string;
  legendPosition: 'top' | 'bottom' | 'left' | 'right' | 'none';
}

export interface ChartGeometry {
  bars: Array<{
    seriesIndex: number;
    categoryIndex: number;
    value: number;
    x: number;
    y: number;
    w: number;
    h: number;
  }>;
  lines: Array<{
    seriesIndex: number;
    points: Array<{ x: number; y: number; value: number }>;
  }>;
  axes: {
    x: { x: number; y: number; w: number; h: number };
    y: { x: number; y: number; w: number; h: number };
  };
}

export interface ChartRecommendation {
  type: 'horizontal_bar' | 'vertical_bar' | 'line';
  reason: string;
  score: number;
  warnings: string[];
}