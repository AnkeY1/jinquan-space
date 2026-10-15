import { describe, expect, it } from 'vitest';
import { amplitudeSpectrum, fft, windowCoefficients } from '../../src/lib/fft';

// Direct O(N²) DFT is an independent reference, never a call to the FFT under test.
function directDft(input: number[]) {
  return input.map((_, k) =>
    input.reduce(
      (sum, value, n) => {
        const angle = (-2 * Math.PI * k * n) / input.length;
        return {
          real: sum.real + value * Math.cos(angle),
          imaginary: sum.imaginary + value * Math.sin(angle),
        };
      },
      { real: 0, imaginary: 0 },
    ),
  );
}

describe('U-DSP-01: negative-exponent, unnormalized radix-2 FFT', () => {
  it('matches the fixed 8-point sine vector including imaginary signs', () => {
    const output = fft([0, 1, 0, -1, 0, 1, 0, -1]);
    for (let k = 0; k < 8; k++) {
      expect(output.real[k]).toBeCloseTo(0, 10);
      expect(output.imaginary[k]).toBeCloseTo(k === 2 ? -4 : k === 6 ? 4 : 0, 10);
    }
    const spectrum = amplitudeSpectrum([0, 1, 0, -1, 0, 1, 0, -1], 8, 'rectangular');
    expect(spectrum.amplitudes[2]).toBeCloseTo(1, 10);
  });

  it('keeps every impulse bin at 1+0j with no internal normalization', () => {
    const output = fft([1, 0, 0, 0, 0, 0, 0, 0]);
    expect([...output.real]).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    expect([...output.imaginary]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it.each([2, 4, 8, 16, 32])('agrees with direct DFT at N=%i', (n) => {
    const input = Array.from({ length: n }, (_, i) => Math.sin(i * 1.13) + i / 17 - 0.2);
    const expected = directDft(input);
    const actual = fft(input);
    // Small vectors have double-precision rounding error well below 1e-9.
    expected.forEach((value, k) => {
      expect(Math.abs(actual.real[k]! - value.real)).toBeLessThan(1e-9);
      expect(Math.abs(actual.imaginary[k]! - value.imaginary)).toBeLessThan(1e-9);
    });
  });

  it('does not mutate the source and rejects unsafe lengths/nonfinite samples', () => {
    const input = [1, 2, 3, 4];
    fft(input);
    expect(input).toEqual([1, 2, 3, 4]);
    expect(() => fft([1, 2, 3])).toThrow();
    expect(() => fft([NaN, 0])).toThrow();
    expect(() => fft(new Float64Array(16384))).toThrow();
  });
});

describe('U-DSP-02/03/04: one-sided amplitude and coherent window gain', () => {
  const fs = 1024;
  const n = 1024;
  it('recovers a unit bin-centered sine without spurious peaks', () => {
    const input = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 64 * i) / fs));
    const output = amplitudeSpectrum(input, fs, 'rectangular');
    expect(output.frequencies[64]).toBe(64);
    expect(output.amplitudes[64]).toBeCloseTo(1, 10);
    output.amplitudes.forEach((amplitude, k) => {
      if (k !== 64) expect(amplitude).toBeLessThan(1e-9);
    });
  });

  it('does not double DC or Nyquist', () => {
    const dc = amplitudeSpectrum(Array(n).fill(2) as number[], fs, 'rectangular');
    expect(dc.amplitudes[0]).toBeCloseTo(2, 10);
    const nyquist = amplitudeSpectrum(
      Array.from({ length: n }, (_, i) => (i % 2 ? -1 : 1)),
      fs,
      'rectangular',
    );
    expect(nyquist.amplitudes[n / 2]).toBeCloseTo(1, 10);
  });

  it('uses periodic Hann and actual window sum, preserving its expected main lobe', () => {
    const window = windowCoefficients(8, 'hann-periodic');
    expect(window[0]).toBe(0);
    expect(window[4]).toBe(1);
    expect(window[7]).toBeCloseTo(0.5 - Math.SQRT1_2 / 2, 12);
    expect([...window].reduce((sum, value) => sum + value, 0)).toBeCloseTo(4, 12);
    const output = amplitudeSpectrum(
      Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 64 * i) / fs)),
      fs,
      'hann-periodic',
    );
    expect(output.windowSum).toBeCloseTo(512, 9);
    expect(output.amplitudes[64]).toBeCloseTo(1, 9);
    expect(output.amplitudes[63]).toBeCloseTo(0.5, 9);
    expect(output.amplitudes[65]).toBeCloseTo(0.5, 9);
  });
});
