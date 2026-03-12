import { describe, it, expect } from 'vitest';

// Test the formatting functions used in StockDetails.
// These are local to the module, so we replicate them here for validation.

function fmtMktCap(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  return n.toFixed(0);
}

function fmtRate(n: number): string {
  return (n * 100).toFixed(2) + '%';
}

function fmtNum(n: number | null, decimals = 2): string {
  return n != null ? n.toFixed(decimals) : '—';
}

describe('fmtMktCap', () => {
  it('formats trillions', () => {
    expect(fmtMktCap(3.8e12)).toBe('3.80T');
    expect(fmtMktCap(1e12)).toBe('1.00T');
  });

  it('formats billions', () => {
    expect(fmtMktCap(250e9)).toBe('250.00B');
    expect(fmtMktCap(1.5e9)).toBe('1.50B');
  });

  it('formats millions', () => {
    expect(fmtMktCap(42e6)).toBe('42.0M');
    expect(fmtMktCap(1e6)).toBe('1.0M');
  });

  it('formats small numbers', () => {
    expect(fmtMktCap(999999)).toBe('999999');
    expect(fmtMktCap(0)).toBe('0');
  });
});

describe('fmtRate', () => {
  it('converts decimal to percentage', () => {
    expect(fmtRate(0.15)).toBe('15.00%');
    expect(fmtRate(0.004)).toBe('0.40%');
    expect(fmtRate(1.52)).toBe('152.00%');
  });

  it('handles zero', () => {
    expect(fmtRate(0)).toBe('0.00%');
  });

  it('handles negative', () => {
    expect(fmtRate(-0.05)).toBe('-5.00%');
  });
});

describe('fmtNum', () => {
  it('formats number with default 2 decimals', () => {
    expect(fmtNum(123.456)).toBe('123.46');
  });

  it('formats with custom decimals', () => {
    expect(fmtNum(55.123, 1)).toBe('55.1');
  });

  it('returns dash for null', () => {
    expect(fmtNum(null)).toBe('—');
  });

  it('formats zero', () => {
    expect(fmtNum(0)).toBe('0.00');
  });
});

describe('dividend extraction logic', () => {
  interface Price { date: string; dividend: number }

  function extractDividends(prices: Price[]) {
    return prices
      .filter((p) => p.dividend > 0)
      .map((p) => ({ date: p.date, amount: p.dividend }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  it('filters out zero dividends', () => {
    const prices = [
      { date: '2025-01-01', dividend: 0 },
      { date: '2025-04-01', dividend: 0.25 },
      { date: '2025-07-01', dividend: 0 },
    ];
    expect(extractDividends(prices)).toEqual([
      { date: '2025-04-01', amount: 0.25 },
    ]);
  });

  it('sorts by date descending', () => {
    const prices = [
      { date: '2025-01-01', dividend: 0.20 },
      { date: '2025-07-01', dividend: 0.25 },
      { date: '2025-04-01', dividend: 0.22 },
    ];
    const result = extractDividends(prices);
    expect(result[0].date).toBe('2025-07-01');
    expect(result[1].date).toBe('2025-04-01');
    expect(result[2].date).toBe('2025-01-01');
  });

  it('returns empty for no dividends', () => {
    expect(extractDividends([])).toEqual([]);
    expect(extractDividends([{ date: '2025-01-01', dividend: 0 }])).toEqual([]);
  });
});
