export const experiments = [
  {
    id: 'signal-studio',
    title: '信号实验室',
    summary: '合成两路正弦、直流与均匀噪声，在真实采样波形和单边幅度谱之间观察采样、窗与混叠。',
    path: '/lab/signal-studio/',
    tags: ['信号处理', 'FFT', '交互实验'],
    visibility: 'public' as const,
    kind: 'demo' as const,
  },
];

export const SIGNAL_SAMPLE_RATES = [128, 256, 512, 1024, 2048, 4096] as const;
export const SIGNAL_SAMPLE_COUNTS = [256, 512, 1024, 2048, 4096, 8192] as const;
export const SIGNAL_MAX_QUERY_LENGTH = 2048;

export interface SignalParameters {
  fs: number;
  n: number;
  a1: number;
  a2: number;
  f1: number;
  f2: number;
  phase1: number;
  phase2: number;
  dc: number;
  noiseAmplitude: number;
  seed: number;
  window: 'rectangular' | 'hann-periodic';
}

export const SIGNAL_DEFAULTS: Readonly<SignalParameters> = Object.freeze({
  fs: 1024,
  n: 1024,
  a1: 1,
  a2: 0.4,
  f1: 50,
  f2: 120,
  phase1: 0,
  phase2: 0,
  dc: 0,
  noiseAmplitude: 0.03,
  seed: 20261015,
  window: 'hann-periodic',
});

export const SIGNAL_PRESETS: ReadonlyArray<{
  id: string;
  title: string;
  description: string;
  parameters: Readonly<SignalParameters>;
}> = [
  {
    id: 'clean',
    title: '干净双音',
    description: '64 Hz 与 128 Hz 整频点双音，观察周期 Hann 的主瓣。',
    parameters: { ...SIGNAL_DEFAULTS, f1: 64, f2: 128, noiseAmplitude: 0 },
  },
  {
    id: 'noisy',
    title: '有噪声的双音',
    description: '固定种子的均匀噪声；重复计算得到相同样本。',
    parameters: { ...SIGNAL_DEFAULTS, noiseAmplitude: 0.3 },
  },
  {
    id: 'aliasing',
    title: '混叠示例',
    description: '以 1024 Hz 采样 900 Hz 正弦，幅度峰出现在 124 Hz。',
    parameters: {
      ...SIGNAL_DEFAULTS,
      f1: 900,
      a2: 0,
      noiseAmplitude: 0,
      window: 'rectangular',
    },
  },
];
