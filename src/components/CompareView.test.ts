import { describe, it, expect } from 'vitest';

// These functions are not exported from CompareView, so we test them via extraction.
// For now, replicate the logic here to validate correctness.
// If they grow, they should be extracted into a shared utility.

function normalize(prices: { close: number; date: string }[]): { time: string; value: number }[] {
  if (prices.length === 0) return [];
  const first = prices[0].close;
  if (first === 0) return [];
  return prices.map((p) => ({
    time: p.date,
    value: (p.close / first - 1) * 100,
  }));
}

function findBestIdx(values: (number | string | null)[], dir: 'max' | 'min'): number {
  let best = -1;
  let bestVal = dir === 'max' ? -Infinity : Infinity;
  let tied = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (typeof v !== 'number') continue;
    if (dir === 'max' ? v > bestVal : v < bestVal) {
      bestVal = v;
      best = i;
      tied = false;
    } else if (v === bestVal) {
      tied = true;
    }
  }
  return tied ? -1 : best;
}

const fmtNum = (d: number) => d.toFixed(2);
const fmtPct = (d: number) => (d >= 0 ? '+' : '') + (d * 100).toFixed(2) + '%';
const fmtRate = (d: number) => (d * 100).toFixed(2) + '%';
const fmtBig = (d: number) => {
  if (d >= 1e12) return (d / 1e12).toFixed(1) + 'T';
  if (d >= 1e9) return (d / 1e9).toFixed(1) + 'B';
  if (d >= 1e6) return (d / 1e6).toFixed(1) + 'M';
  return d.toFixed(0);
};

describe('normalize', () => {
  it('returns empty for empty array', () => {
    expect(normalize([])).toEqual([]);
  });

  it('returns empty when first close is 0', () => {
    expect(normalize([{ close: 0, date: '2025-01-01' }])).toEqual([]);
  });

  it('first point is always 0%', () => {
    const result = normalize([
      { close: 100, date: '2025-01-01' },
      { close: 110, date: '2025-01-02' },
    ]);
    expect(result[0].value).toBe(0);
  });

  it('calculates percentage change correctly', () => {
    const result = normalize([
      { close: 100, date: '2025-01-01' },
      { close: 110, date: '2025-01-02' },
      { close: 90, date: '2025-01-03' },
    ]);
    expect(result[1].value).toBeCloseTo(10);
    expect(result[2].value).toBeCloseTo(-10);
  });
});

describe('findBestIdx', () => {
  it('finds max index', () => {
    expect(findBestIdx([10, 30, 20], 'max')).toBe(1);
  });

  it('finds min index', () => {
    expect(findBestIdx([10, 30, 20], 'min')).toBe(0);
  });

  it('returns -1 for all nulls', () => {
    expect(findBestIdx([null, null], 'max')).toBe(-1);
  });

  it('skips null values', () => {
    expect(findBestIdx([null, 5, null, 10], 'max')).toBe(3);
  });

  it('skips string values', () => {
    expect(findBestIdx(['Tech', 'Finance'], 'max')).toBe(-1);
  });

  it('handles negative values for max', () => {
    expect(findBestIdx([-5, -3, -10], 'max')).toBe(1);
  });

  it('handles negative values for min', () => {
    expect(findBestIdx([-5, -3, -10], 'min')).toBe(2);
  });

  it('handles single value', () => {
    expect(findBestIdx([42], 'max')).toBe(0);
  });

  it('returns -1 when best value is tied', () => {
    expect(findBestIdx([10, 30, 30], 'max')).toBe(-1);
    expect(findBestIdx([5, 5, 10], 'min')).toBe(-1);
  });

  it('highlights best when no tie', () => {
    expect(findBestIdx([0, 0.01, 0], 'max')).toBe(1);
  });
});

describe('formatting functions', () => {
  describe('fmtNum', () => {
    it('formats to 2 decimal places', () => {
      expect(fmtNum(123.456)).toBe('123.46');
      expect(fmtNum(0)).toBe('0.00');
    });
  });

  describe('fmtPct', () => {
    it('adds + for positive', () => {
      expect(fmtPct(0.2)).toBe('+20.00%');
    });

    it('shows - for negative', () => {
      expect(fmtPct(-0.05)).toBe('-5.00%');
    });

    it('handles zero', () => {
      expect(fmtPct(0)).toBe('+0.00%');
    });
  });

  describe('fmtRate', () => {
    it('formats rate as percentage without +', () => {
      expect(fmtRate(0.15)).toBe('15.00%');
      expect(fmtRate(0.004)).toBe('0.40%');
    });
  });

  describe('fmtBig', () => {
    it('formats trillions', () => {
      expect(fmtBig(3.8e12)).toBe('3.8T');
    });

    it('formats billions', () => {
      expect(fmtBig(1.5e9)).toBe('1.5B');
    });

    it('formats millions', () => {
      expect(fmtBig(42e6)).toBe('42.0M');
    });

    it('formats small numbers', () => {
      expect(fmtBig(1234)).toBe('1234');
    });
  });
});
