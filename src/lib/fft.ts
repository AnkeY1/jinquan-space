/** Original iterative radix-2 FFT, negative-exponent convention; no normalization. */
export interface ComplexSpectrum {
  real: Float64Array;
  imaginary: Float64Array;
}

export function fft(input: ArrayLike<number>): ComplexSpectrum {
  const n = input.length;
  if (!Number.isInteger(n) || n < 2 || n > 8192 || (n & (n - 1)) !== 0) {
    throw new RangeError('FFT 长度必须是 2 的幂，且在 2 到 8192 之间。');
  }
  const real = Float64Array.from(input);
  const imaginary = new Float64Array(n);
  if (!real.every(Number.isFinite)) throw new RangeError('FFT 输入必须全部为有限数值。');

  // Bit reversal places each butterfly pair next to its partner.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    while ((j & bit) !== 0) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) [real[i], real[j]] = [real[j]!, real[i]!];
  }
  for (let size = 2; size <= n; size *= 2) {
    const half = size / 2;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const angle = (-2 * Math.PI * k) / size;
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const left = start + k;
        const right = left + half;
        const tr = cosine * real[right]! - sine * imaginary[right]!;
        const ti = sine * real[right]! + cosine * imaginary[right]!;
        real[right] = real[left]! - tr;
        imaginary[right] = imaginary[left]! - ti;
        real[left] = real[left]! + tr;
        imaginary[left] = imaginary[left]! + ti;
      }
    }
  }
  return { real, imaginary };
}

export function windowCoefficients(n: number, type: 'rectangular' | 'hann-periodic'): Float64Array {
  if (!Number.isInteger(n) || n < 2 || n > 8192) throw new RangeError('窗长度无效。');
  if (type !== 'rectangular' && type !== 'hann-periodic') throw new RangeError('不支持的窗函数。');
  return Float64Array.from({ length: n }, (_, index) =>
    type === 'rectangular' ? 1 : 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / n),
  );
}

export function amplitudeSpectrum(
  samples: ArrayLike<number>,
  fs: number,
  window: 'rectangular' | 'hann-periodic',
): { frequencies: Float64Array; amplitudes: Float64Array; windowSum: number } {
  if (!Number.isFinite(fs) || fs <= 0) throw new RangeError('采样率必须为正的有限数值。');
  const n = samples.length;
  const coefficients = windowCoefficients(n, window);
  let windowSum = 0;
  const weighted = Float64Array.from(samples, (sample, i) => {
    windowSum += coefficients[i]!;
    return sample * coefficients[i]!;
  });
  const spectrum = fft(weighted);
  const frequencies = new Float64Array(n / 2 + 1);
  const amplitudes = new Float64Array(n / 2 + 1);
  for (let k = 0; k <= n / 2; k++) {
    frequencies[k] = (k * fs) / n;
    // DC and Nyquist have no distinct negative-frequency partner.
    const scale = k === 0 || k === n / 2 ? 1 : 2;
    amplitudes[k] = (scale * Math.hypot(spectrum.real[k]!, spectrum.imaginary[k]!)) / windowSum;
  }
  return { frequencies, amplitudes, windowSum };
}
