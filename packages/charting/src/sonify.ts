// ============================================================================
// Chart Sonification (Stretch - Web Audio API)
// ============================================================================

import type { ChartSpec, Dataset, ChartGeometry } from '../index';

export interface SonificationOptions {
  duration?: number; // total duration in seconds
  minFreq?: number;  // minimum frequency (Hz)
  maxFreq?: number;  // maximum frequency (Hz)
  instrument?: 'sine' | 'square' | 'triangle' | 'sawtooth';
}

export interface SonificationResult {
  play: () => Promise<void>;
  stop: () => void;
  isPlaying: boolean;
}

let audioContext: AudioContext | null = null;
let currentOscillators: OscillatorNode[] = [];
let gainNode: GainNode | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);
    gainNode.gain.value = 0.3;
  }
  return audioContext;
}

export function sonifyChart(spec: ChartSpec, dataset: Dataset, geometry: ChartGeometry, options: SonificationOptions = {}): SonificationResult {
  const {
    duration = 5,
    minFreq = 220,  // A3
    maxFreq = 880,  // A5
    instrument = 'sine',
  } = options;

  const ctx = getAudioContext();

  // Find min/max values for frequency mapping
  let minVal = Infinity, maxVal = -Infinity;
  for (const series of spec.series) {
    const col = dataset.columns.find(c => c.id === series.dataColumnId);
    if (col && col.type === 'number') {
      for (const val of col.values) {
        if (typeof val === 'number') {
          minVal = Math.min(minVal, val);
          maxVal = Math.max(maxVal, val);
        }
      }
    }
  }

  const categoryCol = dataset.columns.find(c => c.type === 'string' || c.type === 'date');
  const categoryCount = categoryCol ? [...new Set(categoryCol.values)].length : 1;

  let isPlaying = false;
  let stopFlag = false;

  const play = async () => {
    if (isPlaying) return;
    isPlaying = true;
    stopFlag = false;

    // Resume audio context if suspended
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const stepDuration = duration / categoryCount;

    for (let catIdx = 0; catIdx < categoryCount && !stopFlag; catIdx++) {
      // Play each series at this category
      for (let sIdx = 0; sIdx < spec.series.length && !stopFlag; sIdx++) {
        const series = spec.series[sIdx];
        const col = dataset.columns.find(c => c.id === series.dataColumnId);
        if (!col || col.type !== 'number') continue;

        const value = col.values[catIdx] as number;
        if (typeof value !== 'number') continue;

        // Map value to frequency
        const freq = minFreq + ((value - minVal) / (maxVal - minVal)) * (maxFreq - minFreq);

        const osc = ctx.createOscillator();
        osc.type = instrument;
        osc.frequency.value = freq;
        osc.connect(gainNode!);
        osc.start();
        osc.stop(ctx.currentTime + stepDuration * 0.8);

        currentOscillators.push(osc);
      }

      // Wait for step duration
      await new Promise(resolve => setTimeout(resolve, stepDuration * 1000));
    }

    isPlaying = false;
  };

  const stop = () => {
    stopFlag = true;
    for (const osc of currentOscillators) {
      try { osc.stop(); } catch {}
    }
    currentOscillators = [];
    isPlaying = false;
  };

  return { play, stop, get isPlaying() { return isPlaying; } };
}

export function sonifyDataSeries(values: number[], options: SonificationOptions = {}): SonificationResult {
  const {
    duration = 3,
    minFreq = 220,
    maxFreq = 880,
    instrument = 'sine',
  } = options;

  const ctx = getAudioContext();
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  let isPlaying = false;
  let stopFlag = false;

  const play = async () => {
    if (isPlaying) return;
    isPlaying = true;
    stopFlag = false;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const stepDuration = duration / values.length;

    for (let i = 0; i < values.length && !stopFlag; i++) {
      const value = values[i];
      const freq = minFreq + ((value - minVal) / (maxVal - minVal)) * (maxFreq - minFreq);

      const osc = ctx.createOscillator();
      osc.type = instrument;
      osc.frequency.value = freq;
      osc.connect(gainNode!);
      osc.start();
      osc.stop(ctx.currentTime + stepDuration * 0.8);

      currentOscillators.push(osc);

      await new Promise(resolve => setTimeout(resolve, stepDuration * 1000));
    }

    isPlaying = false;
  };

  const stop = () => {
    stopFlag = true;
    for (const osc of currentOscillators) {
      try { osc.stop(); } catch {}
    }
    currentOscillators = [];
    isPlaying = false;
  };

  return { play, stop, get isPlaying() { return isPlaying; } };
}

export function stopAllSonification(): void {
  for (const osc of currentOscillators) {
    try { osc.stop(); } catch {}
  }
  currentOscillators = [];
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close().catch(() => {});
    audioContext = null;
    gainNode = null;
  }
}