import {
  SIGNAL_DEFAULTS,
  SIGNAL_MAX_QUERY_LENGTH,
  SIGNAL_SAMPLE_COUNTS,
  SIGNAL_SAMPLE_RATES,
  type SignalParameters,
} from '../data/experiments';
import { amplitudeSpectrum } from './fft';

export type SignalValidation =
  | { ok: true; value: SignalParameters; errors: Record<string, never> }
  | { ok: false; errors: Record<string, string> };

const numericKeys = [
  'fs',
  'n',
  'a1',
  'a2',
  'f1',
  'f2',
  'phase1',
  'phase2',
  'dc',
  'noiseAmplitude',
  'seed',
] as const;
const allowedKeys = [...numericKeys, 'window'] as const;
const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

export function validateSignalParameters(input: unknown): SignalValidation {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: { parameters: '参数必须为有效对象。' } };
  }
  const source = input as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const values: Partial<Record<(typeof numericKeys)[number], number>> = {};
  for (const key of numericKeys) {
    const raw = source[key];
    const value =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string' && decimal.test(raw.trim())
          ? Number(raw)
          : NaN;
    if (!Number.isFinite(value)) errors[key] = '请输入有限的十进制数值。';
    else values[key] = value;
  }
  const within = (key: (typeof numericKeys)[number], min: number, max: number) => {
    const value = values[key];
    if (value !== undefined && (value < min || value > max))
      errors[key] = `支持范围为 ${min} 到 ${max}。`;
  };
  if (values.fs !== undefined && !SIGNAL_SAMPLE_RATES.some((fs) => fs === values.fs)) {
    errors.fs = '请选择支持的采样率。';
  }
  if (values.n !== undefined && !SIGNAL_SAMPLE_COUNTS.some((n) => n === values.n)) {
    errors.n = '请选择支持的采样点数（最大 8192）。';
  }
  within('a1', 0, 2);
  within('a2', 0, 2);
  within('f1', 0, (values.fs ?? SIGNAL_DEFAULTS.fs) * 2);
  within('f2', 0, (values.fs ?? SIGNAL_DEFAULTS.fs) * 2);
  within('phase1', -180, 180);
  within('phase2', -180, 180);
  within('dc', -2, 2);
  within('noiseAmplitude', 0, 1);
  within('seed', 0, 4294967295);
  if (values.seed !== undefined && !Number.isInteger(values.seed))
    errors.seed = '种子必须是 0 到 4294967295 的整数。';
  if (source.window !== 'rectangular' && source.window !== 'hann-periodic') {
    errors.window = '请选择矩形窗或周期 Hann 窗。';
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { ...values, window: source.window } as SignalParameters, errors: {} };
}

/** Mulberry32: a fixed uint32 state transition; every output is uniform in [-1, 1). */
export function createUniformNoise(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (((value ^ (value >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

export interface SignalResult {
  parameters: SignalParameters;
  time: Float64Array;
  samples: Float64Array;
  frequencies: Float64Array;
  amplitudes: Float64Array;
  windowSum: number;
  deltaF: number;
  duration: number;
  lastSampleTime: number;
  peakFrequency: number;
  peakAmplitude: number;
  warnings: string[];
}

export function generateSignal(input: unknown): SignalResult {
  const validation = validateSignalParameters(input);
  if (!validation.ok) throw new RangeError(Object.values(validation.errors).join(' '));
  const p = validation.value;
  const random = createUniformNoise(p.seed);
  const time = new Float64Array(p.n);
  const samples = new Float64Array(p.n);
  const phi1 = (p.phase1 * Math.PI) / 180;
  const phi2 = (p.phase2 * Math.PI) / 180;
  for (let i = 0; i < p.n; i++) {
    const t = i / p.fs;
    time[i] = t;
    // Always advance exactly once per sample, independent of amplitudes/frequencies.
    const noise = random();
    samples[i] =
      p.dc +
      p.a1 * Math.sin(2 * Math.PI * p.f1 * t + phi1) +
      p.a2 * Math.sin(2 * Math.PI * p.f2 * t + phi2) +
      p.noiseAmplitude * noise;
  }
  const spectrum = amplitudeSpectrum(samples, p.fs, p.window);
  let peak = 0;
  for (let k = 1; k < spectrum.amplitudes.length; k++) {
    if (spectrum.amplitudes[k]! > spectrum.amplitudes[peak]!) peak = k;
  }
  const warnings: string[] = [];
  for (const component of [1, 2] as const) {
    if (p[`a${component}`] > 0 && p[`f${component}`] > p.fs / 2) {
      warnings.push(
        `分量 ${component} 超过奈奎斯特频率 ${p.fs / 2} Hz，离散样本可能表现为较低频率。本演示不模拟抗混叠滤波器。`,
      );
    }
  }
  return {
    parameters: p,
    time,
    samples,
    ...spectrum,
    deltaF: p.fs / p.n,
    duration: p.n / p.fs,
    lastSampleTime: (p.n - 1) / p.fs,
    peakFrequency: spectrum.frequencies[peak]!,
    peakAmplitude: spectrum.amplitudes[peak]!,
    warnings,
  };
}

export function isSignalResult(input: unknown): input is SignalResult {
  if (!input || typeof input !== 'object') return false;
  const result = input as Partial<SignalResult>;
  if (!validateSignalParameters(result.parameters).ok) return false;
  const n = result.parameters!.n;
  return (
    result.time instanceof Float64Array &&
    result.time.length === n &&
    result.samples instanceof Float64Array &&
    result.samples.length === n &&
    result.frequencies instanceof Float64Array &&
    result.frequencies.length === n / 2 + 1 &&
    result.amplitudes instanceof Float64Array &&
    result.amplitudes.length === n / 2 + 1 &&
    result.time.every(Number.isFinite) &&
    result.samples.every(Number.isFinite) &&
    result.frequencies.every(Number.isFinite) &&
    result.amplitudes.every(Number.isFinite) &&
    Number.isFinite(result.windowSum) &&
    Number.isFinite(result.deltaF) &&
    Number.isFinite(result.duration) &&
    Number.isFinite(result.lastSampleTime) &&
    Number.isFinite(result.peakFrequency) &&
    Number.isFinite(result.peakAmplitude) &&
    Array.isArray(result.warnings) &&
    result.warnings.every((warning) => typeof warning === 'string')
  );
}

export function signalParametersToSearch(parameters: SignalParameters): string {
  const result = validateSignalParameters(parameters);
  if (!result.ok) throw new RangeError('只能分享合法参数。');
  const search = new URLSearchParams();
  for (const key of allowedKeys) search.set(key, String(result.value[key]));
  return search.toString();
}

export function parseSignalSearch(search: string): {
  parameters: SignalParameters;
  warnings: string[];
} {
  const defaults = { ...SIGNAL_DEFAULTS };
  if (search.length > SIGNAL_MAX_QUERY_LENGTH) {
    return { parameters: defaults, warnings: ['参数链接过长，已恢复默认参数。'] };
  }
  const query = new URLSearchParams(search);
  const candidate: Record<string, unknown> = { ...defaults };
  const warnings: string[] = [];
  for (const [key, value] of query) {
    if (!allowedKeys.some((allowed) => allowed === key)) {
      if (!warnings.length) warnings.push('已忽略参数链接中的未知字段。');
      continue;
    }
    if (query.getAll(key).length !== 1) {
      return { parameters: defaults, warnings: ['参数链接包含重复字段，已恢复默认参数。'] };
    }
    candidate[key] = value;
  }
  const validation = validateSignalParameters(candidate);
  if (!validation.ok)
    return { parameters: defaults, warnings: ['参数链接包含无效数值或窗类型，已恢复默认参数。'] };
  return { parameters: validation.value, warnings };
}

/** Plot-only buckets retain first/min/max/last in original index order. */
export function signalPlotPoints(
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  target = 4000,
): [number, number][] {
  if (x.length !== y.length || target < 4) throw new RangeError('绘图数据或展示上限无效。');
  const result: [number, number][] = [];
  if (x.length <= target)
    return Array.from({ length: x.length }, (_, i) => [x[i]!, y[i]!] as [number, number]);
  const bucketSize = Math.ceil(x.length / Math.floor(target / 4));
  for (let first = 0; first < x.length; first += bucketSize) {
    const last = Math.min(x.length - 1, first + bucketSize - 1);
    let min = first;
    let max = first;
    for (let i = first + 1; i <= last; i++) {
      if (y[i]! < y[min]!) min = i;
      if (y[i]! > y[max]!) max = i;
    }
    const indexes = [...new Set([first, min, max, last])].sort((a, b) => a - b);
    for (const i of indexes) result.push([x[i]!, y[i]!]);
  }
  return result;
}
