import { useEffect, useId, useRef, useState } from 'react';
import { createChart, LineSeries, type IChartApi } from 'lightweight-charts';
import { useStockHistory, useCompare } from '../api/queries';
import type { CompareResult, Period, Quote } from '../api/types';
import { createHistoryRequest, matchesHistoryRequest } from '../api/history-utils';
import { buildChartOptions } from '../lib/chart-theme';
import { useChartTheme } from '../hooks/useChartTheme';
import { formatGain, formatMarketCap, formatNumber, formatRatioPercent } from '../lib/format';
import { formatRecommendation } from '../lib/recommendation';
import { normalizeFromTime, findBestIdx } from './compare-utils';
import { describeComparisonChart } from './chart-accessibility';
import DataProvenanceBar from './DataProvenanceBar';
import { historyProvenance, quoteProvenance } from '../lib/data-provenance';

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
  { label: 'As of', get: (q) => q.date, fmt: (v) => v != null ? String(v) : '—' },
  { label: 'Price', get: (q) => q.lastPrice, fmt: (v) => formatNumber(v as number | null), best: 'max' },
  { label: 'Market Cap', get: (q) => q.marketCap, fmt: (v) => formatMarketCap(v as number | null), best: 'max' },
  { label: 'Forward P/E', get: (q) => q.peRatio, fmt: (v) => formatNumber(v as number | null), best: 'min' },
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
  return window.matchMedia('(max-width: 639px)').matches ? 260 : 400;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface CompareViewProps {
  symbols: string[];
  period: Period;
  currency?: string;
}

export default function CompareView({ symbols, period, currency }: CompareViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [legendValues, setLegendValues] = useState<Map<string, number>>(new Map());
  const chartTheme = useChartTheme();
  const accessibleDescriptionId = useId();

  // 6 fixed hook slots — hooks cannot be called conditionally
  const h0 = useStockHistory(symbols[0] ?? '', period, undefined, undefined, currency);
  const h1 = useStockHistory(symbols[1] ?? '', period, undefined, undefined, currency);
  const h2 = useStockHistory(symbols[2] ?? '', period, undefined, undefined, currency);
  const h3 = useStockHistory(symbols[3] ?? '', period, undefined, undefined, currency);
  const h4 = useStockHistory(symbols[4] ?? '', period, undefined, undefined, currency);
  const h5 = useStockHistory(symbols[5] ?? '', period, undefined, undefined, currency);
  const histories = [h0, h1, h2, h3, h4, h5];

  const {
    data: compareData,
    error: compareError,
    isLoading: compareLoading,
    isFetching: compareFetching,
    refetch: refetchCompare,
  } = useCompare(symbols, currency);

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
  const provenanceItems = [
    ...quotes.map((quote) => quoteProvenance(quote, `${quote.symbol.toUpperCase()} quote`)),
    ...chartSeries.map((source) => historyProvenance(source.data!, `${source.symbol.toUpperCase()} history`)),
  ];
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
      ...buildChartOptions(chartTheme),
      width: Math.max(initialWidth, 1),
      height: Math.max(initialHeight, fallbackChartHeight()),
      rightPriceScale: {
        borderColor: chartTheme.scaleBorder,
        autoScale: true,
      },
    });
    chartRef.current = chart;

    const seriesMap = new Map<string, Map<string, number>>();
    const cleanups: (() => void)[] = [];
    let prevSize = { width: initialWidth, height: initialHeight };

    for (const source of chartSeries) {
      const data = source.data!;
      const sym = source.symbol;
      const color = chartTheme.compareColors[source.colorIndex % chartTheme.compareColors.length];
      const normalized = normalizeFromTime(data.prices, null);
      if (normalized.length === 0) continue;

      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) + '%' },
      });
      series.setData(normalized);
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
  }, [hasData, activeCount, period, currency, chartTheme, ...symbols, h0.data, h1.data, h2.data, h3.data, h4.data, h5.data]);

  const chartLoading = !hasData && isFetching;
  const tableLoading = compareLoading;
  const compareErrorMessage = compareError instanceof Error
    ? compareError.message
    : compareError
      ? String(compareError)
      : null;
  const accessibleChartDescription = describeComparisonChart(symbols, chartSeries.length, period);

  return (
    <div className="space-y-4">
      {/* Overlay chart */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-chart-bg shadow-sm">
        {/* Legend */}
        <div className="relative z-20 flex flex-wrap gap-x-2 gap-y-0.5 border-b border-border bg-surface-raised px-2.5 py-1.5 text-xs tabular-nums sm:absolute sm:left-2 sm:top-2 sm:gap-x-3 sm:rounded-lg sm:border sm:bg-surface-raised/85 sm:shadow-sm sm:backdrop-blur">
          {symbols.map((sym, i) => {
            const color = chartTheme.compareColors[i % chartTheme.compareColors.length];
            const val = legendValues.get(sym);
            return (
              <span key={sym} style={{ color }}>
                {sym.toUpperCase()}
                {val != null && <span className="ml-1 text-primary">{val >= 0 ? '+' : ''}{val.toFixed(2)}%</span>}
              </span>
            );
          })}
          <span className="w-full text-[11px] text-muted sm:w-auto sm:text-xs">Base: first point in selected period</span>
        </div>
        <div
          ref={containerRef}
          role="img"
          tabIndex={0}
          aria-label={`Percentage comparison chart for ${symbols.map((symbol) => symbol.toUpperCase()).join(', ')}`}
          aria-describedby={accessibleDescriptionId}
          className="h-[260px] w-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:h-[400px]"
        />
        {(chartLoading || isFetching) && (
          <div className={`absolute inset-0 z-10 flex items-center justify-center ${chartLoading ? 'bg-chart-bg' : 'bg-chart-bg/80'}`}>
            <div role="status" aria-label="Loading comparison chart data" className="h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
          </div>
        )}
        {!chartLoading && !hasData && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-chart-bg px-4 text-center text-sm text-secondary">
            No chart data available for the selected symbols
          </div>
        )}
        <p id={accessibleDescriptionId} className="sr-only">{accessibleChartDescription}</p>
      </div>

      <DataProvenanceBar
        items={provenanceItems}
        ariaLabel="Comparison market data provenance"
        coverageLabel={`${quotes.length}/${symbols.length} quotes · ${chartSeries.length}/${symbols.length} histories`}
        isRefreshing={compareFetching || isFetching}
      />

      {/* Error badges for failed symbols */}
      {errors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {errors.map((r) => (
            <span key={r.symbol} className="rounded-full border border-danger/30 bg-danger/10 px-3 py-1 text-xs text-danger">
              {r.symbol}: {r.error}
            </span>
          ))}
        </div>
      )}

      {/* Comparison table */}
      {compareErrorMessage && !compareData ? (
        <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-4 text-sm text-primary">
          <div className="font-medium">Unable to load comparison data</div>
          <div className="mt-1 break-words text-danger">{compareErrorMessage}</div>
          <button
            type="button"
            onClick={() => { void refetchCompare(); }}
            className="mt-3 rounded-lg border border-danger/40 px-3 py-1.5 font-medium text-primary outline-none transition-colors hover:bg-danger/10 focus-visible:ring-2 focus-visible:ring-accent"
          >
            Retry comparison
          </button>
        </div>
      ) : tableLoading ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-border bg-surface-raised">
          <div role="status" aria-label="Loading comparison data" className="h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
        </div>
      ) : quotes.length > 0 ? (
        <div role="region" aria-label="Scrollable stock comparison table" tabIndex={0} className="overflow-x-auto rounded-xl border border-border bg-surface-raised shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b border-border bg-surface/60">
                <th className="sticky left-0 z-10 bg-surface px-3 py-2 text-left text-muted font-medium">Metric</th>
                {quotes.map((q) => {
                  const idx = Math.max(0, symbols.findIndex((s) => s.toLowerCase() === q.symbol.toLowerCase()));
                  return (
                    <th
                      key={q.symbol}
                      aria-label={q.name ? `${q.symbol.toUpperCase()} ${q.name}` : q.symbol.toUpperCase()}
                      className="px-3 py-2 text-right font-medium"
                      style={{ color: chartTheme.compareColors[idx % chartTheme.compareColors.length] }}
                    >
                      {q.symbol.toUpperCase()}
                      {q.name && <span aria-hidden="true" className="hidden text-xs text-muted font-normal sm:block">{q.name}</span>}
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
                  <tr key={m.label} className="border-b border-border/60 hover:bg-surface/60">
                    <td className="sticky left-0 z-10 bg-surface-raised px-3 py-1.5 text-muted">{m.label}</td>
                    {values.map((v, i) => {
                      const formatted = m.fmt(v);
                      const isBest = i === bestIdx;
                      const gainColor = m.gain && typeof v === 'number' && Number.isFinite(v) ? (v >= 0 ? 'text-up' : 'text-down') : 'text-secondary';
                      return (
                        <td key={i} className={`whitespace-nowrap px-3 py-1.5 text-right ${isBest ? 'bg-highlight/10 font-semibold text-highlight' : gainColor}`}>
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
      ) : (
        <div className="rounded-xl border border-border bg-surface-raised px-4 py-6 text-center text-sm text-secondary">
          No comparison data returned for the selected symbols
        </div>
      )}
    </div>
  );
}
