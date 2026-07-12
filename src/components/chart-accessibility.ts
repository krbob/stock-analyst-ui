import type { HistoricalPrice, Interval, Period } from '../api/types';

function finitePrices(prices: HistoricalPrice[]): HistoricalPrice[] {
  return prices.filter((price) => (
    Number.isFinite(price.close) && Number.isFinite(price.high) && Number.isFinite(price.low)
  ));
}

export function describePriceChart(
  symbol: string,
  prices: HistoricalPrice[],
  interval: Interval | undefined,
  currency: string | undefined,
): string {
  const valid = finitePrices(prices);
  const intervalLabel = interval ?? '1d';
  if (valid.length === 0) {
    return `${symbol.toUpperCase()} price chart. No price data is available.`;
  }

  const first = valid[0];
  const last = valid.at(-1)!;
  const low = valid.reduce((minimum, price) => Math.min(minimum, price.low), valid[0].low);
  const high = valid.reduce((maximum, price) => Math.max(maximum, price.high), valid[0].high);
  const change = first.close === 0 ? null : (last.close / first.close - 1) * 100;
  const changeText = change == null
    ? ''
    : `, ${change >= 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(2)} percent from the first close`;
  const currencyText = currency ? ` ${currency}` : '';

  return `${symbol.toUpperCase()} price chart with ${valid.length} ${intervalLabel} candles from ${first.date} to ${last.date}. ` +
    `Latest close ${last.close.toFixed(2)}${currencyText}${changeText}. ` +
    `Observed low ${low.toFixed(2)} and high ${high.toFixed(2)}${currencyText}.`;
}

export function describeComparisonChart(
  symbols: string[],
  loadedSeries: number,
  period: Period,
): string {
  const names = symbols.map((symbol) => symbol.toUpperCase()).join(', ');
  return `Percentage comparison chart for ${names} over ${period}. ` +
    `${loadedSeries} of ${symbols.length} series loaded. ` +
    'Each series uses its first available point in the selected period as the zero-percent baseline.';
}
