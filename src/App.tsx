import { useEffect, useRef, useState } from 'react';
import PriceChart from './components/PriceChart';
import StockDetails from './components/StockDetails';
import CompareView, { COMPARE_COLORS } from './components/CompareView';
import TickerSearch from './components/TickerSearch';
import CurrencyPicker from './components/CurrencyPicker';
import { useQuote, useStockHistory } from './api/queries';
import type { Interval, Period } from './api/types';
import { parseUrlParams, buildUrlParams } from './url-state';

const fmtPct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

const URL_INIT = parseUrlParams(window.location.search);

// ---------------------------------------------------------------------------

const PERIODS: { label: string; value: Period }[] = [
  { label: '1D', value: '1d' },
  { label: '5D', value: '5d' },
  { label: '1M', value: '1mo' },
  { label: '6M', value: '6mo' },
  { label: 'YTD', value: 'ytd' },
  { label: '1Y', value: '1y' },
  { label: '5Y', value: '5y' },
  { label: 'Max', value: 'max' },
];

const INTRADAY_INTERVALS: { label: string; value: Interval }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
];

const DAILY_INTERVALS: { label: string; value: Interval }[] = [
  { label: '1D', value: '1d' },
  { label: '1W', value: '1wk' },
  { label: '1M', value: '1mo' },
];

const DEFAULT_INTRADAY: Record<string, Interval> = {
  '1d': '5m',
  '5d': '15m',
};

const INDICATORS = [
  { label: 'SMA', keys: ['sma50', 'sma200'] },
  { label: 'EMA', keys: ['ema50', 'ema200'] },
  { label: 'BB', keys: ['bb'] },
  { label: 'RSI', keys: ['rsi'] },
  { label: 'MACD', keys: ['macd'] },
];

const ALL_INDICATOR_KEYS = ['bb', 'ema50', 'ema200', 'macd', 'rsi', 'sma50', 'sma200'];

function Spinner() {
  return (
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
  );
}

const GAIN_PERIODS = [
  { label: '1M', key: 'monthly' },
  { label: 'YTD', key: 'ytd' },
  { label: '1Y', key: 'yearly' },
  { label: '5Y', key: 'fiveYear' },
] as const;

function GainChip({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  const pct = value * 100;
  return (
    <span className={`text-xs ${pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
      {fmtPct(pct)} ({label})
    </span>
  );
}

function StockInfo({ symbol, currency, onCurrencyChange, livePrice, hideGain }: {
  symbol: string;
  currency?: string;
  onCurrencyChange: (c: string | undefined) => void;
  livePrice?: number;
  hideGain?: boolean;
}) {
  const { data, isLoading, error } = useQuote(symbol, currency);
  const [nativeCurrency, setNativeCurrency] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setNativeCurrency(null); }, [symbol]);

  // Capture native currency from the first (unconverted) response
  useEffect(() => {
    if (data?.currency && !currency) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNativeCurrency(data.currency);
    }
  }, [data?.currency, currency]);

  if (!symbol) return null;

  const displayPrice = livePrice ?? data?.lastPrice;

  return (
    <div className="min-w-0">
      <div className="flex h-8 items-baseline gap-3">
        <h2 className="text-2xl font-bold text-white">{symbol.toUpperCase()}</h2>
        {isLoading && <Spinner />}
        {error && <span className="text-sm text-red-400">{currency ? 'Conversion failed' : 'Not found'}</span>}
        {data && (
          <span className="text-xl text-gray-300">{displayPrice?.toFixed(2)}</span>
        )}
        {nativeCurrency && (
          <CurrencyPicker nativeCurrency={nativeCurrency} value={currency} onChange={onCurrencyChange} />
        )}
        {data && data.gain.daily != null && (
          <span className={`text-lg font-medium transition-opacity duration-300 ${hideGain ? 'opacity-0' : 'opacity-100'} ${data.gain.daily >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {fmtPct(data.gain.daily)}
          </span>
        )}
      </div>
      <p className="h-5 text-sm text-gray-500">{data?.name ?? '\u00A0'}</p>
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
  const [interval, setInterval] = useState<Interval | undefined>(URL_INIT.interval);
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

  // Native history for interval detection & intraday live price — not blocked by conversion errors.
  const { data: historyData } = useStockHistory(symbol, period, interval, indicatorArray, undefined, dividendsParam);
  // Currency-converted history — shares cache with PriceChart's query.
  const { data: convertedHistory } = useStockHistory(symbol, period, interval, indicatorArray, currency, dividendsParam);
  const activeInterval = interval ?? (
    historyData?.symbol.toLowerCase() === symbol.toLowerCase()
      ? historyData?.interval
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
    if (!inCompareMode) setInterval(DEFAULT_INTRADAY[p] ?? undefined);
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
      setInterval(undefined);
      setCurrency(undefined);
    }
  };

  const enterCompare = () => {
    setCompareSymbols([symbol]);
  };

  const exitCompare = () => {
    setCompareSymbols([]);
    // PriceChart may have mounted in a hidden container (e.g. opened from compare URL)
    // — trigger resize so it recalculates dimensions.
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  };

  const removeFromCompare = (sym: string) => {
    setCompareSymbols(prev => prev.filter(s => s.toLowerCase() !== sym.toLowerCase()));
  };

  const btnClass = (active: boolean) =>
    `rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
      active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
    }`;

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <header className="border-b border-gray-800 px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">Stock Analyst</h1>
          <TickerSearch onSelect={handleSelect} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        {/* Toolbar — one bar, buttons animate */}
        {symbol && (
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            {/* Left: StockInfo or compare chips */}
            {inCompareMode ? (
              <div className="flex flex-wrap items-center gap-2">
                {compareSymbols.map((sym, i) => (
                  <span
                    key={sym}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium"
                    style={{ backgroundColor: COMPARE_COLORS[i % COMPARE_COLORS.length] + '22', color: COMPARE_COLORS[i % COMPARE_COLORS.length] }}
                  >
                    {sym.toUpperCase()}
                    <button onClick={() => removeFromCompare(sym)} className="ml-0.5 hover:text-white">&times;</button>
                  </span>
                ))}
                <CurrencyPicker nativeCurrency={null} value={currency} onChange={setCurrency} />
                {compareSymbols.length < 6 && (
                  <span className="text-xs text-gray-500">Search to add more</span>
                )}
              </div>
            ) : (
              <StockInfo symbol={symbol} currency={currency} onCurrencyChange={setCurrency} livePrice={isIntradayPeriod && !currency ? historyData?.prices.at(-1)?.close : undefined} hideGain={isIntradayPeriod} />
            )}

            {/* Right: periods + animated button groups */}
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => handlePeriod(p.value)}
                  className={btnClass(period === p.value)}
                >
                  {p.label}
                </button>
              ))}
              {/* Line/Log/Div — collapses in compare mode */}
              <div className={`flex items-center gap-1 overflow-hidden transition-all duration-300 ease-in-out ${inCompareMode ? 'max-w-0 opacity-0' : 'max-w-64 opacity-100'}`}>
                <div className="mx-1 h-5 w-px shrink-0 bg-gray-700" />
                <button onClick={() => setLineChart(!lineChart)} className={btnClass(lineChart)}>
                  Line
                </button>
                <button onClick={() => setLogScale(!logScale)} className={btnClass(logScale)}>
                  Log
                </button>
                <button onClick={() => setShowDividends(!showDividends)} className={btnClass(showDividends)}>
                  Div
                </button>
              </div>
              <div className="mx-1 h-5 w-px shrink-0 bg-gray-700" />
              <button
                onClick={inCompareMode ? exitCompare : enterCompare}
                className={`w-[8rem] shrink-0 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${inCompareMode ? 'border-transparent text-red-400 hover:text-white hover:bg-red-900/50' : 'border-blue-800/50 text-blue-400 hover:text-white hover:bg-blue-900/40'}`}
              >
                {inCompareMode ? 'Exit Compare' : 'Compare'}
              </button>
            </div>
          </div>
        )}

        {/* Compare chart + table */}
        {inCompareMode && (
          <CompareView symbols={compareSymbols} period={period} currency={currency} />
        )}

        {/* Single-stock content (hidden but mounted in compare to avoid chart.remove() crash) */}
        {symbol ? (
          <div className={inCompareMode ? 'hidden' : ''}>
            <div className="mb-2 flex flex-wrap items-center gap-1">
              {INDICATORS.map((ind) => {
                const active = ind.keys.every((k) => indicators.has(k));
                return (
                  <button
                    key={ind.label}
                    onClick={() => toggleIndicatorGroup(ind.keys)}
                    className={btnClass(active)}
                  >
                    {ind.label}
                  </button>
                );
              })}
              <div className="mx-1 h-5 w-px bg-gray-700" />
              <div className="relative flex gap-1">
                <div className={`flex gap-1 transition-all duration-300 ${isIntradayPeriod ? 'opacity-0 pointer-events-none absolute' : 'opacity-100'}`}>
                  {DAILY_INTERVALS.map((i) => (
                    <button
                      key={i.value}
                      onClick={() => { if (activeInterval !== i.value) setInterval(i.value); }}
                      className={btnClass(activeInterval === i.value)}
                    >
                      {i.label}
                    </button>
                  ))}
                </div>
                <div className={`flex gap-1 transition-all duration-300 ${isIntradayPeriod ? 'opacity-100' : 'opacity-0 pointer-events-none absolute'}`}>
                  {INTRADAY_INTERVALS.map((i) => (
                    <button
                      key={i.value}
                      onClick={() => { if (activeInterval !== i.value) setInterval(i.value); }}
                      className={btnClass(activeInterval === i.value)}
                    >
                      {i.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={`ml-auto transition-opacity duration-200 ${chartZoomed ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <button onClick={() => resetViewRef.current?.()} className={btnClass(false)}>
                  Reset
                </button>
              </div>
            </div>
            <PriceChart symbol={symbol} period={period} interval={interval} lineChart={lineChart} logScale={logScale} indicators={indicatorArray} activeIndicators={indicators} currency={currency} dividends={dividendsParam} showDividends={showDividends} onZoomChange={setChartZoomed} resetRef={resetViewRef} />
            <StockDetails symbol={symbol} currency={currency} prices={convertedHistory?.prices ?? historyData?.prices} indicators={convertedHistory?.indicators ?? historyData?.indicators} showDividends={showDividends} />
          </div>
        ) : !inCompareMode && (
          <div className="flex h-[500px] items-center justify-center text-gray-500 px-4 text-center">
            Enter a stock ticker to view the chart
          </div>
        )}
      </main>
    </div>
  );
}
