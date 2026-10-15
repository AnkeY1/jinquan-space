import { describe, expect, it } from 'vitest';
import { SIGNAL_DEFAULTS, SIGNAL_PRESETS } from '../../src/data/experiments';
import {
  createUniformNoise,
  generateSignal,
  isSignalResult,
  parseSignalSearch,
  signalParametersToSearch,
  signalPlotPoints,
  validateSignalParameters,
} from '../../src/lib/signal';

describe('U-DSP-05/06: deterministic signal generation', () => {
  it('shows 900 Hz sampled at 1024 Hz as a 124 Hz peak', () => {
    const output = generateSignal({
      ...SIGNAL_DEFAULTS,
      a2: 0,
      f1: 900,
      noiseAmplitude: 0,
      window: 'rectangular',
    });
    expect(output.peakFrequency).toBe(124);
    expect(output.peakAmplitude).toBeCloseTo(1, 9);
    expect(output.warnings).toHaveLength(1);
    expect(output.deltaF).toBe(1);
    expect(output.duration).toBe(1);
    expect(output.lastSampleTime).toBe(1023 / 1024);
  });

  it('gives identical samples for identical seeds and parameters', () => {
    const first = generateSignal(SIGNAL_DEFAULTS);
    const second = generateSignal(SIGNAL_DEFAULTS);
    expect(first.samples).toEqual(second.samples);
    expect(first.amplitudes).toEqual(second.amplitudes);
    expect(isSignalResult(first)).toBe(true);
    expect(isSignalResult({ ...first, samples: new Float64Array(1) })).toBe(false);
    const changed = generateSignal({ ...SIGNAL_DEFAULTS, seed: SIGNAL_DEFAULTS.seed + 1 });
    expect(first.samples).not.toEqual(changed.samples);
  });

  it('has a fixed PRNG sequence and keeps noise stable when other parameters change', () => {
    const noise = createUniformNoise(0);
    // Fixed independent Mulberry32 uint32 outputs for seed=0.
    expect(noise()).toBe((1144304738 / 4294967296) * 2 - 1);
    expect(noise()).toBe((1416247 / 4294967296) * 2 - 1);
    const first = generateSignal({ ...SIGNAL_DEFAULTS, a1: 0, a2: 0, dc: 0, noiseAmplitude: 1 });
    const shifted = generateSignal({ ...SIGNAL_DEFAULTS, a1: 0, a2: 0, dc: 1, noiseAmplitude: 1 });
    first.samples.forEach((sample, i) => {
      expect(sample).toBeGreaterThanOrEqual(-1);
      expect(sample).toBeLessThan(1);
      expect(shifted.samples[i]! - sample).toBeCloseTo(1, 12);
    });
  });

  it('keeps exactly three explicit stable presets, all valid', () => {
    expect(SIGNAL_PRESETS.map((preset) => preset.id)).toEqual(['clean', 'noisy', 'aliasing']);
    expect(SIGNAL_PRESETS[0]!.parameters.f1).toBe(64);
    expect(SIGNAL_PRESETS[0]!.parameters.noiseAmplitude).toBe(0);
    expect(SIGNAL_PRESETS[1]!.parameters.noiseAmplitude).toBe(0.3);
    expect(SIGNAL_PRESETS[2]!.parameters.f1).toBe(900);
    SIGNAL_PRESETS.forEach((preset) =>
      expect(validateSignalParameters(preset.parameters).ok).toBe(true),
    );
  });
});

describe('signal parameter validation and share-state safety', () => {
  it('accepts exact bounds and frequencies above Nyquist', () => {
    expect(
      validateSignalParameters({ ...SIGNAL_DEFAULTS, f1: 2048, seed: 4294967295, n: 8192 }).ok,
    ).toBe(true);
    expect(validateSignalParameters({ ...SIGNAL_DEFAULTS, f1: 900 }).ok).toBe(true);
  });
  it.each([
    { n: 1000000000 },
    { n: 1023 },
    { fs: 1 },
    { fs: 512, f1: 1025 },
    { seed: -1 },
    { seed: 0.5 },
    { seed: 4294967296 },
    { window: 'evil' },
    { a1: 2.1 },
    { noiseAmplitude: -1 },
    { phase2: 181 },
    { dc: Infinity },
    { f1: '0x10' },
    { f1: '12abc' },
    { f1: 'NaN' },
    { f1: '' },
  ])('rejects invalid parameters without clamping: %j', (invalid) => {
    const candidate = { ...SIGNAL_DEFAULTS, ...invalid };
    expect(validateSignalParameters(candidate).ok).toBe(false);
    expect(() => generateSignal(candidate)).toThrow();
  });
  it('round trips only a bounded whitelist of parameters', () => {
    const parameters = { ...SIGNAL_DEFAULTS, seed: 0, f1: 900 };
    const search = signalParametersToSearch(parameters);
    expect(parseSignalSearch(search).parameters).toEqual(parameters);
    const unknown = parseSignalSearch('filename=secret.log&content=private&f1=64');
    expect(unknown.parameters.f1).toBe(64);
    expect(unknown.warnings).toHaveLength(1);
    expect(signalParametersToSearch(unknown.parameters)).not.toContain('secret');
    expect(parseSignalSearch('n=999999999').parameters).toEqual(SIGNAL_DEFAULTS);
    expect(parseSignalSearch('seed=1&seed=2').warnings).toHaveLength(1);
    expect(parseSignalSearch(`seed=${'0'.repeat(3000)}`).parameters).toEqual(SIGNAL_DEFAULTS);
    expect(parseSignalSearch('window=%3Cscript%3E').parameters).toEqual(SIGNAL_DEFAULTS);
  });
});

describe('signal plot-only reduction', () => {
  it('preserves full data, endpoints, extremes and sample order', () => {
    const x = Float64Array.from({ length: 8192 }, (_, i) => i);
    const y = new Float64Array(8192);
    y[1501] = -200;
    y[1502] = 300;
    const points = signalPlotPoints(x, y);
    expect(points.length).toBeLessThanOrEqual(4000);
    expect(points).toContainEqual([1501, -200]);
    expect(points).toContainEqual([1502, 300]);
    expect(points[0]).toEqual([0, 0]);
    expect(points.at(-1)).toEqual([8191, 0]);
    expect(points.every((point, i) => i === 0 || point[0] > points[i - 1]![0])).toBe(true);
    expect(y.length).toBe(8192);
    expect(y[1501]).toBe(-200);
  });
});
