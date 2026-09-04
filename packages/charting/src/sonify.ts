// ============================================================================
// Chart Sonification Planning (F-4.5)
// ============================================================================
//
// This module computes a **sonification plan** — the value→pitch mapping and
// note timings — and nothing more. Playback lives in `apps/web` because this
// package is pure: `13-repository-structure.md` forbids DOM globals here, and
// Web Audio is a DOM API. Keeping the mapping pure also makes it testable
// without an audio device and keeps it deterministic.
//
// Pitch mapping is linear in value across a fixed frequency band. Linear (rather
// than logarithmic-in-value) mapping means equal value differences sound like
// equal pitch differences, which is what makes the audio a faithful analogue of
// the chart.

import type { ChartSpec, Dataset } from '@vistect/domain/schema';

export interface SonificationOptions {
  /** Total duration in seconds. */
  duration?: number;
  /** Lowest pitch in Hz, mapped to the minimum value. Default A3. */
  minFrequency?: number;
  /** Highest pitch in Hz, mapped to the maximum value. Default A5. */
  maxFrequency?: number;
  waveform?: 'sine' | 'square' | 'triangle' | 'sawtooth';
}

export interface SonificationNote {
  /** Offset from playback start, in seconds. */
  startTime: number;
  /** Sounding length in seconds; shorter than the step so notes stay distinct. */
  duration: number;
  frequency: number;
  /** Index into `ChartSpec.series`. */
  seriesIndex: number;
  /** Index into the category axis. */
  categoryIndex: number;
  /** Source value this note encodes; lets tests assert the mapping. */
  value: number;
}

export interface SonificationPlan {
  notes: SonificationNote[];
  totalDuration: number;
  waveform: NonNullable<SonificationOptions['waveform']>;
  /** Spoken introduction describing the mapping, announced before playback. */
  announcement: string;
}

const DEFAULTS = {
  duration: 5,
  minFrequency: 220,
  maxFrequency: 880,
  waveform: 'sine',
} as const satisfies Required<SonificationOptions>;

/** Fraction of each step that sounds; the remainder separates notes audibly. */
const NOTE_DUTY_CYCLE = 0.8;

/** Distinct category count, matching the renderer's category derivation. */
function categoryCount(dataset: Dataset): number {
  const column = dataset.columns.find((c) => c.type === 'string' || c.type === 'date');
  if (column === undefined) return dataset.rowCount;
  return new Set(column.values.map(String)).size;
}

function valueRange(spec: ChartSpec, dataset: Dataset): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const series of spec.series) {
    const column = dataset.columns.find((c) => c.id === series.dataColumnId);
    for (const value of column?.values ?? []) {
      if (typeof value !== 'number') continue;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  // A constant series has no range; centre it rather than dividing by zero.
  return min === max ? { min: min - 0.5, max: max + 0.5 } : { min, max };
}

export function planSonification(
  spec: ChartSpec,
  dataset: Dataset,
  options: SonificationOptions = {}
): SonificationPlan {
  const duration = options.duration ?? DEFAULTS.duration;
  const minFrequency = options.minFrequency ?? DEFAULTS.minFrequency;
  const maxFrequency = options.maxFrequency ?? DEFAULTS.maxFrequency;
  const waveform = options.waveform ?? DEFAULTS.waveform;

  const steps = Math.max(1, categoryCount(dataset));
  const stepDuration = duration / steps;
  const { min, max } = valueRange(spec, dataset);
  const span = max - min;

  const notes: SonificationNote[] = [];
  for (let categoryIndex = 0; categoryIndex < steps; categoryIndex++) {
    for (const [seriesIndex, series] of spec.series.entries()) {
      const column = dataset.columns.find((c) => c.id === series.dataColumnId);
      const raw = column?.values[categoryIndex];
      if (typeof raw !== 'number') continue;

      notes.push({
        startTime: categoryIndex * stepDuration,
        duration: stepDuration * NOTE_DUTY_CYCLE,
        frequency: minFrequency + ((raw - min) / span) * (maxFrequency - minFrequency),
        seriesIndex,
        categoryIndex,
        value: raw,
      });
    }
  }

  return {
    notes,
    totalDuration: duration,
    waveform,
    announcement:
      `Sonifying ${spec.title}. ` +
      `Pitch rises with value, from ${min} at ${minFrequency} hertz to ${max} at ${maxFrequency} hertz, ` +
      `across ${steps} ${steps === 1 ? 'category' : 'categories'} over ${duration} seconds.`,
  };
}

/** Plans a bare numeric series, for previewing a single column. */
export function planSeriesSonification(
  values: number[],
  options: SonificationOptions = {}
): SonificationPlan {
  const duration = options.duration ?? 3;
  const minFrequency = options.minFrequency ?? DEFAULTS.minFrequency;
  const maxFrequency = options.maxFrequency ?? DEFAULTS.maxFrequency;
  const waveform = options.waveform ?? DEFAULTS.waveform;

  if (values.length === 0) {
    return {
      notes: [],
      totalDuration: 0,
      waveform,
      announcement: 'No values to sonify.',
    };
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const min = rawMin === rawMax ? rawMin - 0.5 : rawMin;
  const max = rawMin === rawMax ? rawMax + 0.5 : rawMax;
  const stepDuration = duration / values.length;

  return {
    notes: values.map((value, index) => ({
      startTime: index * stepDuration,
      duration: stepDuration * NOTE_DUTY_CYCLE,
      frequency: minFrequency + ((value - min) / (max - min)) * (maxFrequency - minFrequency),
      seriesIndex: 0,
      categoryIndex: index,
      value,
    })),
    totalDuration: duration,
    waveform,
    announcement:
      `Sonifying ${values.length} ${values.length === 1 ? 'value' : 'values'}. ` +
      `Pitch rises with value, from ${rawMin} to ${rawMax}, over ${duration} seconds.`,
  };
}
