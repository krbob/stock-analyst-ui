import { useEffect, useRef, useState } from 'react';
import { createChart, LineSeries, type IChartApi, type ISeriesApi, type SeriesType, type Time } from 'lightweight-charts';
import { useStockHistory, useCompare } from '../api/queries';
import type { CompareResult, HistoricalPrice, Period, Quote } from '../api/types';
import { createHistoryRequest, matchesHistoryRequest } from '../api/history-utils';
import { CHART_OPTIONS, COMPARE_COLORS } from '../lib/chart-theme';
import { formatGain, formatMarketCap, formatNumber, formatRatioPercent } from '../lib/format';
import { formatRecommendation } from '../lib/recommendation';
import { normalizeFromTime, findBestIdx } from './compare-utils';

// ---------------------------------------------------------------------------
// Table helpers
// ---------------------------------------------------------------------------

type MetricFn = (q: Quote) => number | string | null;

interface Metric {
  label: string;
  get: MetricFn;
  fmt: (v: number | string | null) => string;
  best?: 'max' | 'min';
  gain?: boolean;
}

const METRICS: Metric[] = [
  { label: 'Price', get: (q) => q.lastPrice, fmt: (v) => formatNumber(v as number | null), best: 'max' },
  { label: 'Market Cap', get: (q) => q.marketCap, fmt: (v) => formatMarketCap(v as number | null), best: 'max' },
  { label: 'P/E', get: (q) => q.peRatio, fmt: (v) => formatNumber(v as number | null), best: 'min' },
  { label: 'P/B', get: (q) => q.pbRatio, fmt: (v) => formatNumber(v as number | null), best: 'min' },
  { label: 'EPS', get: (q) => q.eps, fmt: (v) => formatNumber(v as number | null), best: 'max' },
  { label: 'ROE', get: (q) => q.roe, fmt: (v) => formatRatioPercent(v as number | null), best: 'max' },
  { label: 'Beta', get: (q) => q.beta, fmt: (v) => formatNumber(v as number | null) },
  { label: 'Div Yield', get: (q) => q.dividendYield, fmt: (v) => formatRatioPercent(v as number | null), best: 'max' },
  { label: 'Div Growth', get: (q) => q.dividendGrowth, fmt: (v) => formatRatioPercent(v as number | null), best: 'max' },
  { label: 'Daily', get: (q) => q.gain.daily, fmt: (v) => formatGain(v as number | null), best: 'max', gain: true },
  { label: 'Monthly', get: (q) => q.gain.monthly, fmt: (v) => formatGain(v as number | null), best: 'max', gain: true },
  { label: 'YTD', get: (q) => q.gain.ytd, fmt: (v) => formatGain(v as number | null), best: 'max', gain: true },
  { label: '1Y', get: (q) => q.gain.yearly, fmt: (v) => formatGain(v as number | null), best: 'max', gain: true },
  { label: '5Y', get: (q) => q.gain.fiveYear, fmt: (v) => formatGain(v as number | null), best: 'max', gain: true },
  { label: '52W High', get: (q) => q.fiftyTwoWeekHigh, fmt: (v) => formatNumber(v as number | null) },
  { label: '52W Low', get: (q) => q.fiftyTwoWeekLow, fmt: (v) => formatNumber(v as number | null) },
  { label: 'Sector', get: (q) => q.sector, fmt: (v) => v != null ? String(v) : '—' },
  { label: 'Recommendation', get: (q) => q.recommendation, fmt: (v) => formatRecommendation(v as string | null) },
];

function fallbackChartHeight(): number {
  return window.matchMedia('(max-width: 639px)').matches ? 300 : 400;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CompareViewProps {
  symbols: string[];
  period: Period;
  currency?: string;
}

export default function CompareView({ symbols, period, currency }: CompareViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [legendValues, setLegendValues] = useState<Map<string, number>>(new Map());

  // 6 fixed hook slots — hooks cannot be called conditionally
  const h0 = useStockHistory(symbols[0] ?? '', period, undefined, undefined, currency);
  const h1 = useStockHistory(symbols[1] ?? '', period, undefined, undefined, currency);
  const h2 = useStockHistory(symbols[2] ?? '', period, undefined, undefined, currency);
  const h3 = useStockHistory(symbols[3] ?? '', period, undefined, undefined, currency);
  const h4 = useStockHistory(symbols[4] ?? '', period, undefined, undefined, currency);
  const h5 = useStockHistory(symbols[5] ?? '', period, undefined, undefined, currency);
  const histories = [h0, h1, h2, h3, h4, h5];

  const { data: compareData } = useCompare(symbols, currency);

  const activeCount = symbols.length;
  const historySources = symbols.map((sym, index) => {
    const request = createHistoryRequest(sym, period, undefined, undefined, currency);
    const data = matchesHistoryRequest(histories[index]?.data, request) ? histories[index].data : undefined;
    return {
      symbol: sym,
      colorIndex: index,
      data,
      error: histories[index]?.error,
      isFetching: histories[index]?.isFetching ?? false,
    };
  });
  const chartSeries = historySources.filter((source) => source.data && source.data.prices.length > 0);
  const hasData = chartSeries.length > 0;
  const isFetching = histories.slice(0, activeCount).some((h) => h.isFetching);

  // Extract successful quotes from compare results
  const quotes = compareData?.filter((r): r is CompareResult & { data: Quote } => r.data != null).map((r) => r.data) ?? [];
  const statusMessages = new Map<string, string>();
  for (const result of compareData?.filter((r) => r.error != null) ?? []) {
    statusMessages.set(result.symbol.toUpperCase(), result.error ?? 'Failed to load quote');
  }
  for (const source of historySources) {
    if (source.data || source.isFetching) continue;
    const message = source.error instanceof Error
      ? source.error.message
      : source.error
        ? String(source.error)
        : 'No chart data available';
    const symbol = source.symbol.toUpperCase();
    if (!statusMessages.has(symbol)) {
      statusMessages.set(symbol, message);
    }
  }
  const errors = [...statusMessages.entries()].map(([symbol, error]) => ({ symbol, error }));

  // Single combined effect: create chart + series only when data is ready
  useEffect(() => {
    if (!containerRef.current || !hasData) return;

    const initialWidth = containerRef.current.clientWidth;
    const initialHeight = containerRef.current.clientHeight;
    const chart = createChart(containerRef.current, {
      ...CHART_OPTIONS,
      width: Math.max(initialWidth, 1),
      height: Math.max(initialHeight, fallbackChartHeight()),
      rightPriceScale: {
        borderColor: '#3a3a4e',
        autoScale: true,
      },
    });
    chartRef.current = chart;

    const seriesMap = new Map<string, Map<string, number>>();
    const stored: { symbol: string; prices: HistoricalPrice[]; series: ISeriesApi<SeriesType> }[] = [];
    const cleanups: (() => void)[] = [];
    let prevSize = { width: initialWidth, height: initialHeight };

    for (const source of chartSeries) {
      const data = source.data!;
      const sym = source.symbol;
      const color = COMPARE_COLORS[source.colorIndex % COMPARE_COLORS.length];
      const normalized = normalizeFromTime(data.prices, null);
      if (normalized.length === 0) continue;

      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) + '%' },
      });
      series.setData(normalized);
      stored.push({ symbol: sym, prices: data.prices, series });
      cleanups.push(() => chart.removeSeries(series));

      // Build lookup for crosshair
      const lookup = new Map<string, number>();
      for (const pt of normalized) lookup.set(String(pt.time), pt.value);
      seriesMap.set(sym, lookup);
    }

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        setLegendValues(new Map());
        return;
      }
      const key = String(param.time);
      const vals = new Map<string, number>();
      for (const [sym, lookup] of seriesMap) {
        const v = lookup.get(key);
        if (v != null) vals.set(sym, v);
      }
      setLegendValues(vals);
    });

    // Re-normalize percentages based on the first visible data point when panning/zooming
    let renormGuard = false;
    let lastBaseTime: Time | null = null;
    chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
      if (!range || renormGuard) return;
      const baseTime = range.from;
      if (baseTime === lastBaseTime) return;
      lastBaseTime = baseTime;

      renormGuard = true;
      for (const { symbol, prices, series } of stored) {
        const newData = normalizeFromTime(prices, baseTime);
        if (newData.length === 0) continue;
        series.setData(newData);

        const lookup = new Map<string, number>();
        for (const pt of newData) lookup.set(String(pt.time), pt.value);
        seriesMap.set(symbol, lookup);
      }
      renormGuard = false;
    });

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) {
        const rawWidth = containerRef.current.clientWidth;
        const rawHeight = containerRef.current.clientHeight;
        chart.applyOptions({
          width: Math.max(rawWidth, 1),
          height: Math.max(rawHeight, fallbackChartHeight()),
        });
        if ((prevSize.width === 0 || prevSize.height === 0) && rawWidth > 0 && rawHeight > 0) {
          chart.timeScale().fitContent();
        }
        prevSize = { width: rawWidth, height: rawHeight };
      }
    };
    const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(containerRef.current);
    window.addEventListener('resize', handleResize);

    cleanups.push(() => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
    });

    return () => {
      cleanups.forEach((fn) => fn());
      setLegendValues(new Map());
      try { chart.remove(); } catch { /* lightweight-charts may throw on remove */ }
      chartRef.current = null;
    };
  // symbols/histories are derived from fixed hook slots — spread deps track actual data changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData, activeCount, period, currency, ...symbols, h0.data, h1.data, h2.data, h3.data, h4.data, h5.data]);

  const chartLoading = !hasData && isFetching;
  const tableLoading = !compareData;

  return (
    <div className="space-y-4">
      {/* Overlay chart */}
      <div className="relative overflow-hidden rounded-lg border border-gray-800 bg-[#1a1a2e]">
        {/* Legend */}
        <div className="absolute left-2 top-2 z-20 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          {symbols.map((sym, i) => {
            const color = COMPARE_COLORS[i % COMPARE_COLORS.length];
            const val = legendValues.get(sym);
            return (
              <span key={sym} style={{ color }}>
                {sym.toUpperCase()}
                {val != null && <span className="ml-1 text-white">{val >= 0 ? '+' : ''}{val.toFixed(2)}%</span>}
              </span>
            );
          })}
        </div>
        <div ref={containerRef} className="h-[300px] w-full sm:h-[400px]" />
        {(chartLoading || isFetching) && (
          <div className={`absolute inset-0 z-10 flex items-center justify-center ${chartLoading ? 'bg-[#1a1a2e]' : 'bg-[#1a1a2e]/80'}`}>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          </div>
        )}
        {!chartLoading && !hasData && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#1a1a2e] px-4 text-center text-sm text-gray-400">
            No chart data available for the selected symbols
          </div>
        )}
      </div>

      {/* Error badges for failed symbols */}
      {errors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {errors.map((r) => (
            <span key={r.symbol} className="rounded-full bg-red-900/30 px-3 py-1 text-xs text-red-400">
              {r.symbol}: {r.error}
            </span>
          ))}
        </div>
      )}

      {/* Comparison table */}
      {tableLoading ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-gray-800 bg-gray-900/50">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
        </div>
      ) : quotes.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="px-3 py-2 text-left text-gray-400 font-medium">Metric</th>
                {quotes.map((q) => {
                  const idx = Math.max(0, symbols.findIndex((s) => s.toLowerCase() === q.symbol.toLowerCase()));
                  return (
                    <th key={q.symbol} className="px-3 py-2 text-right font-medium" style={{ color: COMPARE_COLORS[idx % COMPARE_COLORS.length] }}>
                      {q.symbol.toUpperCase()}
                      {q.name && <span className="block text-xs text-gray-500 font-normal">{q.name}</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => {
                const values = quotes.map((q) => m.get(q));
                const bestIdx = m.best ? findBestIdx(values, m.best) : -1;
                return (
                  <tr key={m.label} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-3 py-1.5 text-gray-400">{m.label}</td>
                    {values.map((v, i) => {
                      const formatted = m.fmt(v);
                      const isBest = i === bestIdx;
                      const gainColor = m.gain && typeof v === 'number' && Number.isFinite(v) ? (v >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-300';
                      return (
                        <td key={i} className={`px-3 py-1.5 text-right ${isBest ? 'bg-amber-500/10 font-semibold text-amber-300' : gainColor}`}>
                          {formatted}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
