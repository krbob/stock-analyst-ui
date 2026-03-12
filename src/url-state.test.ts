import { describe, it, expect } from 'vitest';
import { parseUrlParams, buildUrlParams, type UrlState } from './url-state';

const DEFAULTS: UrlState = {
  symbol: '',
  period: '1y',
  interval: undefined,
  lineChart: false,
  logScale: false,
  indicators: new Set(),
  showDividends: false,
  currency: undefined,
  compareSymbols: [],
};

describe('parseUrlParams', () => {
  it('returns defaults for empty search', () => {
    const state = parseUrlParams('');
    expect(state.symbol).toBe('');
    expect(state.period).toBe('1y');
    expect(state.interval).toBeUndefined();
    expect(state.lineChart).toBe(false);
    expect(state.logScale).toBe(false);
    expect(state.showDividends).toBe(false);
    expect(state.indicators.size).toBe(0);
    expect(state.currency).toBeUndefined();
    expect(state.compareSymbols).toEqual([]);
  });

  it('parses symbol and uppercases it', () => {
    expect(parseUrlParams('?s=aapl').symbol).toBe('AAPL');
    expect(parseUrlParams('?s=MSFT').symbol).toBe('MSFT');
  });

  it('parses valid period', () => {
    expect(parseUrlParams('?s=A&p=5y').period).toBe('5y');
    expect(parseUrlParams('?s=A&p=1d').period).toBe('1d');
    expect(parseUrlParams('?s=A&p=ytd').period).toBe('ytd');
    expect(parseUrlParams('?s=A&p=max').period).toBe('max');
  });

  it('falls back to 1y for invalid period', () => {
    expect(parseUrlParams('?s=A&p=invalid').period).toBe('1y');
    expect(parseUrlParams('?s=A&p=').period).toBe('1y');
  });

  it('parses valid interval', () => {
    expect(parseUrlParams('?s=A&i=5m').interval).toBe('5m');
    expect(parseUrlParams('?s=A&i=1wk').interval).toBe('1wk');
  });

  it('ignores invalid interval', () => {
    expect(parseUrlParams('?s=A&i=invalid').interval).toBeUndefined();
  });

  it('parses boolean flags', () => {
    const state = parseUrlParams('?s=A&line=1&log=1&div=1');
    expect(state.lineChart).toBe(true);
    expect(state.logScale).toBe(true);
    expect(state.showDividends).toBe(true);
  });

  it('treats missing flags as false', () => {
    const state = parseUrlParams('?s=A');
    expect(state.lineChart).toBe(false);
    expect(state.logScale).toBe(false);
    expect(state.showDividends).toBe(false);
  });

  it('treats non-1 flags as false', () => {
    const state = parseUrlParams('?s=A&line=0&log=true');
    expect(state.lineChart).toBe(false);
    expect(state.logScale).toBe(false);
  });

  it('parses valid indicators', () => {
    const state = parseUrlParams('?s=A&ind=sma50,rsi,macd');
    expect(state.indicators).toEqual(new Set(['sma50', 'rsi', 'macd']));
  });

  it('filters invalid indicators', () => {
    const state = parseUrlParams('?s=A&ind=sma50,invalid,rsi');
    expect(state.indicators).toEqual(new Set(['sma50', 'rsi']));
  });

  it('parses currency', () => {
    expect(parseUrlParams('?s=A&cur=EUR').currency).toBe('EUR');
  });

  it('uppercases currency', () => {
    expect(parseUrlParams('?s=A&cur=eur').currency).toBe('EUR');
  });

  it('parses compare symbols', () => {
    const state = parseUrlParams('?cmp=AAPL,MSFT,GOOG');
    expect(state.compareSymbols).toEqual(['AAPL', 'MSFT', 'GOOG']);
  });

  it('uppercases compare symbols', () => {
    const state = parseUrlParams('?cmp=aapl,msft');
    expect(state.compareSymbols).toEqual(['AAPL', 'MSFT']);
  });

  it('limits compare to 6 symbols', () => {
    const state = parseUrlParams('?cmp=A,B,C,D,E,F,G,H');
    expect(state.compareSymbols).toHaveLength(6);
  });

  it('filters empty compare symbols', () => {
    const state = parseUrlParams('?cmp=AAPL,,MSFT,');
    expect(state.compareSymbols).toEqual(['AAPL', 'MSFT']);
  });

  it('deduplicates compare symbols case-insensitively after uppercasing', () => {
    const state = parseUrlParams('?cmp=AAPL,aapl,MSFT,msft');
    expect(state.compareSymbols).toEqual(['AAPL', 'MSFT']);
  });

  it('derives symbol from first compare symbol when s is missing', () => {
    const state = parseUrlParams('?cmp=AAPL,MSFT');
    expect(state.symbol).toBe('AAPL');
  });

  it('prefers explicit s over compare first', () => {
    const state = parseUrlParams('?s=GOOG&cmp=AAPL,MSFT');
    expect(state.symbol).toBe('GOOG');
  });

  it('parses full URL with all params', () => {
    const state = parseUrlParams('?s=AAPL&p=5y&i=1wk&line=1&log=1&div=1&ind=sma50,sma200&cur=EUR&cmp=AAPL,MSFT');
    expect(state.symbol).toBe('AAPL');
    expect(state.period).toBe('5y');
    expect(state.interval).toBe('1wk');
    expect(state.lineChart).toBe(true);
    expect(state.logScale).toBe(true);
    expect(state.showDividends).toBe(true);
    expect(state.indicators).toEqual(new Set(['sma50', 'sma200']));
    expect(state.currency).toBe('EUR');
    expect(state.compareSymbols).toEqual(['AAPL', 'MSFT']);
  });
});

describe('buildUrlParams', () => {
  it('returns empty string for defaults', () => {
    expect(buildUrlParams(DEFAULTS)).toBe('');
  });

  it('includes symbol', () => {
    const qs = buildUrlParams({ ...DEFAULTS, symbol: 'AAPL' });
    expect(qs).toBe('s=AAPL');
  });

  it('omits period when 1y (default)', () => {
    const qs = buildUrlParams({ ...DEFAULTS, symbol: 'A', period: '1y' });
    expect(qs).toBe('s=A');
  });

  it('includes non-default period', () => {
    const qs = buildUrlParams({ ...DEFAULTS, symbol: 'A', period: '5y' });
    expect(qs).toContain('p=5y');
  });

  it('includes interval', () => {
    const qs = buildUrlParams({ ...DEFAULTS, symbol: 'A', interval: '5m' });
    expect(qs).toContain('i=5m');
  });

  it('includes boolean flags only when true', () => {
    const qs = buildUrlParams({ ...DEFAULTS, symbol: 'A', lineChart: true, logScale: true, showDividends: true });
    expect(qs).toContain('line=1');
    expect(qs).toContain('log=1');
    expect(qs).toContain('div=1');
  });

  it('omits false boolean flags', () => {
    const qs = buildUrlParams({ ...DEFAULTS, symbol: 'A' });
    expect(qs).not.toContain('line');
    expect(qs).not.toContain('log');
    expect(qs).not.toContain('div');
  });

  it('includes sorted indicators', () => {
    const qs = buildUrlParams({ ...DEFAULTS, symbol: 'A', indicators: new Set(['rsi', 'bb', 'sma50']) });
    expect(qs).toContain('ind=bb%2Crsi%2Csma50');
  });

  it('includes currency', () => {
    const qs = buildUrlParams({ ...DEFAULTS, symbol: 'A', currency: 'EUR' });
    expect(qs).toContain('cur=EUR');
  });

  it('includes compare symbols', () => {
    const qs = buildUrlParams({ ...DEFAULTS, symbol: 'A', compareSymbols: ['AAPL', 'MSFT'] });
    expect(qs).toContain('cmp=AAPL%2CMSFT');
  });
});

describe('roundtrip: parse → build → parse', () => {
  it('preserves state through serialization cycle', () => {
    const original = parseUrlParams('?s=AAPL&p=5y&i=1wk&line=1&ind=sma50,sma200&cur=EUR&cmp=AAPL,MSFT');
    const qs = buildUrlParams(original);
    const restored = parseUrlParams(`?${qs}`);

    expect(restored.symbol).toBe(original.symbol);
    expect(restored.period).toBe(original.period);
    expect(restored.interval).toBe(original.interval);
    expect(restored.lineChart).toBe(original.lineChart);
    expect(restored.logScale).toBe(original.logScale);
    expect(restored.showDividends).toBe(original.showDividends);
    expect(restored.indicators).toEqual(original.indicators);
    expect(restored.currency).toBe(original.currency);
    expect(restored.compareSymbols).toEqual(original.compareSymbols);
  });

  it('preserves minimal state', () => {
    const original = parseUrlParams('?s=TSLA');
    const qs = buildUrlParams(original);
    const restored = parseUrlParams(`?${qs}`);
    expect(restored.symbol).toBe('TSLA');
    expect(restored.period).toBe('1y');
  });
});
