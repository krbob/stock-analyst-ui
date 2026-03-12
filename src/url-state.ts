import type { Interval, Period } from './api/types';

const VALID_PERIODS: Set<string> = new Set(['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max']);
const VALID_INTERVALS: Set<string> = new Set(['1m', '5m', '15m', '30m', '1h', '1d', '1wk', '1mo']);
const VALID_INDICATORS: Set<string> = new Set(['bb', 'ema50', 'ema200', 'macd', 'rsi', 'sma50', 'sma200']);

export interface UrlState {
  symbol: string;
  period: Period;
  interval: Interval | undefined;
  lineChart: boolean;
  logScale: boolean;
  indicators: Set<string>;
  showDividends: boolean;
  currency: string | undefined;
  compareSymbols: string[];
}

export function parseUrlParams(search: string): UrlState {
  const p = new URLSearchParams(search);
  const rawCmp = p.get('cmp');
  const seenCompare = new Set<string>();
  const compareSymbols = rawCmp
    ? rawCmp
      .split(',')
      .map(s => s.toUpperCase())
      .filter(Boolean)
      .filter((symbol) => {
        if (seenCompare.has(symbol)) return false;
        seenCompare.add(symbol);
        return true;
      })
      .slice(0, 6)
    : [];
  const symbol = p.get('s')?.toUpperCase() || (compareSymbols.length > 0 ? compareSymbols[0] : '');
  const rawPeriod = p.get('p');
  const period: Period = rawPeriod && VALID_PERIODS.has(rawPeriod) ? rawPeriod as Period : '1y';
  const rawInterval = p.get('i');
  const interval: Interval | undefined = rawInterval && VALID_INTERVALS.has(rawInterval) ? rawInterval as Interval : undefined;
  const lineChart = p.get('line') === '1';
  const logScale = p.get('log') === '1';
  const showDividends = p.get('div') === '1';
  const rawInd = p.get('ind');
  const indicators = new Set(rawInd ? rawInd.split(',').filter(k => VALID_INDICATORS.has(k)) : []);
  const currency = p.get('cur')?.toUpperCase() || undefined;
  return { symbol, period, interval, lineChart, logScale, indicators, showDividends, currency, compareSymbols };
}

export function buildUrlParams(state: UrlState): string {
  const p = new URLSearchParams();
  if (state.symbol) p.set('s', state.symbol);
  if (state.period !== '1y') p.set('p', state.period);
  if (state.interval) p.set('i', state.interval);
  if (state.lineChart) p.set('line', '1');
  if (state.logScale) p.set('log', '1');
  if (state.showDividends) p.set('div', '1');
  if (state.indicators.size > 0) p.set('ind', [...state.indicators].sort().join(','));
  if (state.currency) p.set('cur', state.currency);
  if (state.compareSymbols.length > 0) p.set('cmp', state.compareSymbols.join(','));
  return p.toString();
}
