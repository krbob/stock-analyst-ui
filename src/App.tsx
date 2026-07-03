import { useEffect, useRef, useState } from 'react';
import PriceChart from './components/PriceChart';
import StockDetails from './components/StockDetails';
import CompareView from './components/CompareView';
import TickerSearch from './components/TickerSearch';
import CurrencyPicker from './components/CurrencyPicker';
import SegmentedControl, { type SegmentedOption } from './components/SegmentedControl';
import ToggleButton from './components/ToggleButton';
import ThemeToggle from './components/ThemeToggle';
import IndicatorsPopover from './components/IndicatorsPopover';
import { useQuote, useStockHistory } from './api/queries';
import type { Interval, Period } from './api/types';
import { parseUrlParams, buildUrlParams } from './url-state';
import { createHistoryRequest, matchesHistoryRequest } from './api/history-utils';
import { COMPARE_COLORS } from './lib/chart-theme';
import { formatGain } from './lib/format';

const URL_INIT = parseUrlParams(window.location.search);

// ---------------------------------------------------------------------------

const PERIODS: SegmentedOption<Period>[] = [
  { label: '1D', value: '1d' },
  { label: '5D', value: '5d' },
  { label: '1M', value: '1mo' },
  { label: '6M', value: '6mo' },
  { label: 'YTD', value: 'ytd' },
  { label: '1Y', value: '1y' },
  { label: '5Y', value: '5y' },
  { label: 'Max', value: 'max' },
];

const INTRADAY_INTERVALS: SegmentedOption<Interval>[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
];

const DAILY_INTERVALS: SegmentedOption<Interval>[] = [
  { label: '1D', value: '1d' },
  { label: '1W', value: '1wk' },
  { label: '1M', value: '1mo' },
];

const DEFAULT_INTRADAY: Record<string, Interval> = {
  '1d': '5m',
  '5d': '15m',
};

const INDICATORS = [
  { label: 'SMA 50/200', keys: ['sma50', 'sma200'] },
  { label: 'EMA 50/200', keys: ['ema50', 'ema200'] },
  { label: 'Bollinger Bands', keys: ['bb'] },
  { label: 'RSI', keys: ['rsi'] },
  { label: 'MACD', keys: ['macd'] },
];

const ALL_INDICATOR_KEYS = ['bb', 'ema50', 'ema200', 'macd', 'rsi', 'sma50', 'sma200'];

function Spinner() {
  return (
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
  );
}

function CandlesIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 5v3m0 8v3M8 8H5.5v8H8m0-8h2.5v8H8M16 3v3m0 10v3m0-13h-2.5v10H16m0-10h2.5v10H16" />
    </svg>
  );
}

function LineIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l6-6 4 4 8-8" />
    </svg>
  );
}

function LogIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20c0-6 2-13 16-16M4 20h16M4 20V4" />
    </svg>
  );
}

function DividendIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10m2.5-8.2c-.5-.8-1.4-1.3-2.5-1.3-1.7 0-2.8.9-2.8 2.25S10.5 12 12 12s2.8.9 2.8 2.25-1.1 2.25-2.8 2.25c-1.1 0-2-.5-2.5-1.3" />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 15l5-5 4 3 9-8M3 21l5-5 4 3 9-8" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 2.6-6.3L3 8m0-5v5h5" />
    </svg>
  );
}

const GAIN_PERIODS = [
  { label: '1M', key: 'monthly' },
  { label: 'YTD', key: 'ytd' },
  { label: '1Y', key: 'yearly' },
  { label: '5Y', key: 'fiveYear' },
] as const;

function GainChip({ label, value }: { label: string; value: number | null }) {
  if (value == null || !Number.isFinite(value)) return null;
  return (
    <span className={`text-xs ${value >= 0 ? 'text-up' : 'text-down'}`}>
      {formatGain(value)} ({label})
    </span>
  );
}

function StockInfo({ symbol, currency, livePrice, hideGain }: {
  symbol: string;
  currency?: string;
  livePrice?: number;
  hideGain?: boolean;
}) {
  const nativeQuote = useQuote(symbol);
  const convertedQuote = useQuote(symbol, currency);

  if (!symbol) return null;

  const data = currency ? convertedQuote.data : nativeQuote.data;
  const error = currency ? convertedQuote.error : nativeQuote.error;
  const isLoading = currency
    ? convertedQuote.isLoading && !convertedQuote.data
    : nativeQuote.isLoading && !nativeQuote.data;
  const displayCurrency = currency ?? nativeQuote.data?.currency ?? data?.currency ?? null;
  const displayPrice = livePrice ?? data?.lastPrice;
  const errorMessage = error instanceof Error
    ? error.message
    : currency ? 'Conversion failed' : 'Not found';

  return (
    <div className="min-w-0">
      <div className="flex h-8 items-baseline gap-3">
        <h2 className="text-2xl font-bold text-primary">{symbol.toUpperCase()}</h2>
        {isLoading && <Spinner />}
        {error && <span className="text-sm text-danger">{errorMessage}</span>}
        {data && (
          <span className="text-xl text-secondary">
            {displayPrice?.toFixed(2)}
            {displayCurrency && <span className="ml-1.5 text-sm text-muted">{displayCurrency}</span>}
          </span>
        )}
        {data && data.gain.daily != null && Number.isFinite(data.gain.daily) && (
          <span className={`text-lg font-medium transition-opacity duration-300 ${hideGain ? 'opacity-0' : 'opacity-100'} ${data.gain.daily >= 0 ? 'text-up' : 'text-down'}`}>
            {formatGain(data.gain.daily)}
          </span>
        )}
      </div>
      <p className="h-5 text-sm text-muted">{data?.name ?? ' '}</p>
      <div className="mt-1 flex min-h-5 flex-wrap gap-3">
        {data && GAIN_PERIODS.map((p) => (
          <GainChip key={p.key} label={p.label} value={data.gain[p.key]} />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [symbol, setSymbol] = useState(URL_INIT.symbol);
  const [period, setPeriod] = useState<Period>(URL_INIT.period);
  const [interval, setSelectedInterval] = useState<Interval | undefined>(URL_INIT.interval);
  const [lineChart, setLineChart] = useState(URL_INIT.lineChart);
  const [logScale, setLogScale] = useState(URL_INIT.logScale);
  const [indicators, setIndicators] = useState<Set<string>>(URL_INIT.indicators);
  const [showDividends, setShowDividends] = useState(URL_INIT.showDividends);
  const [currency, setCurrency] = useState<string | undefined>(URL_INIT.currency);
  const [chartZoomed, setChartZoomed] = useState(false);
  const [compareSymbols, setCompareSymbols] = useState<string[]>(URL_INIT.compareSymbols);
  const resetViewRef = useRef<(() => void) | null>(null);

  // Sync state → URL
  useEffect(() => {
    const qs = buildUrlParams({ symbol, period, interval, lineChart, logScale, indicators, showDividends, currency, compareSymbols });
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [symbol, period, interval, lineChart, logScale, indicators, showDividends, currency, compareSymbols]);

  const inCompareMode = compareSymbols.length > 0;

  // Always fetch all indicators — StockDetails derives technicals from the last data point,
  // and the chart shows only the ones toggled on via `activeIndicators`.
  const indicatorArray = ALL_INDICATOR_KEYS;

  const dividendsParam = showDividends || undefined;
  const nativeHistoryRequest = createHistoryRequest(symbol, period, interval, indicatorArray, undefined, dividendsParam);
  const convertedHistoryRequest = createHistoryRequest(symbol, period, interval, indicatorArray, currency, dividendsParam);

  // Native history for interval detection & intraday live price — not blocked by conversion errors.
  const { data: historyData } = useStockHistory(symbol, period, interval, indicatorArray, undefined, dividendsParam);
  // Currency-converted history — shares cache with PriceChart's query.
  const { data: convertedHistory } = useStockHistory(symbol, period, interval, indicatorArray, currency, dividendsParam);
  // Native quote for the header currency picker (shares its cache with StockInfo).
  const { data: headerQuote } = useQuote(inCompareMode ? '' : symbol);
  const nativeHistory = matchesHistoryRequest(historyData, nativeHistoryRequest) ? historyData : undefined;
  const currencyHistory = matchesHistoryRequest(convertedHistory, convertedHistoryRequest) ? convertedHistory : undefined;
  const activeInterval = interval ?? (
    nativeHistory?.symbol.toLowerCase() === symbol.toLowerCase()
      ? nativeHistory.interval
      : undefined
  );

  const toggleIndicatorGroup = (keys: string[]) => {
    setIndicators((prev) => {
      const next = new Set(prev);
      const allActive = keys.every((k) => next.has(k));
      for (const k of keys) {
        if (allActive) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  };

  const isIntradayPeriod = period === '1d' || period === '5d';

  const handlePeriod = (p: Period) => {
    setPeriod(p);
    if (!inCompareMode) setSelectedInterval(DEFAULT_INTRADAY[p] ?? undefined);
  };

  const handleSelect = (sym: string) => {
    if (inCompareMode) {
      const exists = compareSymbols.some(s => s.toLowerCase() === sym.toLowerCase());
      if (!exists && compareSymbols.length < 6) {
        setCompareSymbols(prev => [...prev, sym]);
      }
    } else {
      setSymbol(sym);
      setPeriod('1y');
      setSelectedInterval(undefined);
      setCurrency(undefined);
    }
  };

  const enterCompare = () => {
    setCompareSymbols([symbol]);
  };

  const exitCompare = () => {
    setCompareSymbols([]);
  };

  const removeFromCompare = (sym: string) => {
    setCompareSymbols(prev => prev.filter(s => s.toLowerCase() !== sym.toLowerCase()));
  };

  const intervalOptions = isIntradayPeriod ? INTRADAY_INTERVALS : DAILY_INTERVALS;

  return (
    <div className="min-h-screen bg-page text-primary">
      <header className="sticky top-0 z-40 border-b border-border bg-surface-raised/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">Stock Analyst</h1>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <TickerSearch onSelect={handleSelect} />
            {(symbol || inCompareMode) && (
              <CurrencyPicker
                nativeCurrency={inCompareMode ? null : headerQuote?.currency ?? null}
                value={currency}
                onChange={setCurrency}
              />
            )}
            {(symbol || inCompareMode) && (
              <button
                type="button"
                onClick={inCompareMode ? exitCompare : enterCompare}
                aria-pressed={inCompareMode}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                  inCompareMode
                    ? 'border-accent/40 bg-accent/15 text-accent'
                    : 'border-border bg-surface text-secondary hover:text-primary'
                }`}
              >
                <CompareIcon />
                Compare
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        {/* Compare mode — symbol chips + period + overlay chart + table */}
        {inCompareMode && (
          <>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {compareSymbols.map((sym, i) => (
                  <span
                    key={sym}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium"
                    style={{ backgroundColor: COMPARE_COLORS[i % COMPARE_COLORS.length] + '22', color: COMPARE_COLORS[i % COMPARE_COLORS.length] }}
                  >
                    {sym.toUpperCase()}
                    <button type="button" onClick={() => removeFromCompare(sym)} className="ml-0.5 rounded outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-accent" aria-label={`Remove ${sym.toUpperCase()} from compare`}>&times;</button>
                  </span>
                ))}
                {compareSymbols.length < 6 && (
                  <span className="text-xs text-muted">Search to add more</span>
                )}
              </div>
              <SegmentedControl options={PERIODS} value={period} onChange={handlePeriod} ariaLabel="Time period" className="max-w-full overflow-x-auto" />
            </div>
            <CompareView symbols={compareSymbols} period={period} currency={currency} />
          </>
        )}

        {/* Single-stock content (hidden but mounted in compare to avoid chart.remove() crash) */}
        {symbol ? (
          <div className={inCompareMode ? 'hidden' : ''}>
            <div className="mb-4">
              <StockInfo symbol={symbol} currency={currency} livePrice={isIntradayPeriod && !currency ? nativeHistory?.prices.at(-1)?.close : undefined} hideGain={isIntradayPeriod} />
            </div>

            {/* Toolbar */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <SegmentedControl options={PERIODS} value={period} onChange={handlePeriod} ariaLabel="Time period" className="max-w-full overflow-x-auto" />
              <SegmentedControl
                options={intervalOptions}
                value={activeInterval && intervalOptions.some((o) => o.value === activeInterval) ? activeInterval : undefined}
                onChange={(v) => { if (activeInterval !== v) setSelectedInterval(v); }}
                ariaLabel="Chart interval"
              />
              <SegmentedControl
                options={[
                  { value: 'candles', label: <span className="inline-flex items-center gap-1.5"><CandlesIcon />Candles</span>, ariaLabel: 'Candlestick chart' },
                  { value: 'line', label: <span className="inline-flex items-center gap-1.5"><LineIcon />Line</span>, ariaLabel: 'Line chart' },
                ]}
                value={lineChart ? 'line' : 'candles'}
                onChange={(v) => setLineChart(v === 'line')}
                ariaLabel="Chart type"
              />
              <ToggleButton pressed={logScale} onClick={() => setLogScale(!logScale)} icon={<LogIcon />} title="Logarithmic price scale">
                Log
              </ToggleButton>
              <ToggleButton pressed={showDividends} onClick={() => setShowDividends(!showDividends)} icon={<DividendIcon />} title="Show dividends">
                Div
              </ToggleButton>
              <IndicatorsPopover groups={INDICATORS} active={indicators} onToggleGroup={toggleIndicatorGroup} />
              <div className={`ml-auto transition-opacity duration-200 ${chartZoomed ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <button
                  type="button"
                  onClick={() => resetViewRef.current?.()}
                  tabIndex={chartZoomed ? 0 : -1}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-muted outline-none transition-colors hover:bg-surface hover:text-primary focus-visible:ring-2 focus-visible:ring-accent sm:text-sm"
                >
                  <ResetIcon />
                  Reset
                </button>
              </div>
            </div>

            {/* Chart card */}
            <div className="overflow-hidden rounded-xl border border-border bg-chart-bg shadow-sm">
              <PriceChart symbol={symbol} period={period} interval={interval} lineChart={lineChart} logScale={logScale} indicators={indicatorArray} activeIndicators={indicators} currency={currency} dividends={dividendsParam} showDividends={showDividends} onZoomChange={setChartZoomed} resetRef={resetViewRef} />
            </div>

            <StockDetails symbol={symbol} currency={currency} prices={currencyHistory?.prices ?? nativeHistory?.prices} indicators={currencyHistory?.indicators ?? nativeHistory?.indicators} showDividends={showDividends} />
          </div>
        ) : !inCompareMode && (
          <div className="flex h-[500px] items-center justify-center text-muted px-4 text-center">
            Enter a stock ticker to view the chart
          </div>
        )}
      </main>
    </div>
  );
}
