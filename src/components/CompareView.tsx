import { useEffect, useRef, useState } from 'react';
import { createChart, LineSeries, ColorType, type IChartApi, type Time } from 'lightweight-charts';
import { useStockHistory, useCompare } from '../api/queries';
import type { Analysis, HistoricalPrice, Period } from '../api/types';

export const COMPARE_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

const CHART_OPTIONS = {
  layout: {
    background: { type: ColorType.Solid as const, color: '#1a1a2e' },
    textColor: '#e0e0e0',
  },
  grid: {
    vertLines: { color: '#2a2a3e' },
    horzLines: { color: '#2a2a3e' },
  },
  timeScale: { borderColor: '#3a3a4e' },
  rightPriceScale: { borderColor: '#3a3a4e' },
} as const;

function chartTime(p: HistoricalPrice): Time {
  return p.timestamp != null ? p.timestamp as Time : p.date as Time;
}

function normalize(prices: HistoricalPrice[]): { time: Time; value: number }[] {
  if (prices.length === 0) return [];
  const first = prices[0].close;
  if (first === 0) return [];
  return prices.map((p) => ({
    time: chartTime(p),
    value: (p.close / first - 1) * 100,
  }));
}

// ---------------------------------------------------------------------------
// Table helpers
// ---------------------------------------------------------------------------

type MetricFn = (a: Analysis) => number | string | null;

interface Metric {
  label: string;
  get: MetricFn;
  fmt: (v: number | string | null) => string;
  best?: 'max' | 'min';
}

const fmtNum = (d: number) => d.toFixed(2);
const fmtPct = (d: number) => (d >= 0 ? '+' : '') + (d * 100).toFixed(2) + '%';
const fmtRate = (d: number) => (d * 100).toFixed(2) + '%';

const REC_LABELS: Record<string, string> = {
  strong_buy: 'Strong Buy', buy: 'Buy', hold: 'Hold', sell: 'Sell', strong_sell: 'Strong Sell',
};

const fmtBig = (d: number) => {
  if (d >= 1e12) return (d / 1e12).toFixed(1) + 'T';
  if (d >= 1e9) return (d / 1e9).toFixed(1) + 'B';
  if (d >= 1e6) return (d / 1e6).toFixed(1) + 'M';
  return d.toFixed(0);
};

const METRICS: Metric[] = [
  { label: 'Price', get: (a) => a.lastPrice, fmt: (v) => v != null ? fmtNum(v as number) : '—', best: 'max' },
  { label: 'Market Cap', get: (a) => a.marketCap, fmt: (v) => v != null ? fmtBig(v as number) : '—', best: 'max' },
  { label: 'P/E', get: (a) => a.peRatio, fmt: (v) => v != null ? fmtNum(v as number) : '—', best: 'min' },
  { label: 'P/B', get: (a) => a.pbRatio, fmt: (v) => v != null ? fmtNum(v as number) : '—', best: 'min' },
  { label: 'EPS', get: (a) => a.eps, fmt: (v) => v != null ? fmtNum(v as number) : '—', best: 'max' },
  { label: 'ROE', get: (a) => a.roe, fmt: (v) => v != null ? fmtRate(v as number) : '—', best: 'max' },
  { label: 'Beta', get: (a) => a.beta, fmt: (v) => v != null ? fmtNum(v as number) : '—' },
  { label: 'Div Yield', get: (a) => a.dividendYield, fmt: (v) => v != null && v !== 0 ? fmtRate(v as number) : '—', best: 'max' },
  { label: 'Div Growth', get: (a) => a.dividendGrowth, fmt: (v) => v != null && v !== 0 ? fmtRate(v as number) : '—', best: 'max' },
  { label: 'Daily', get: (a) => a.gain.daily, fmt: (v) => v != null ? fmtPct(v as number) : '—', best: 'max' },
  { label: 'Monthly', get: (a) => a.gain.monthly, fmt: (v) => v != null ? fmtPct(v as number) : '—', best: 'max' },
  { label: 'YTD', get: (a) => a.gain.ytd, fmt: (v) => v != null ? fmtPct(v as number) : '—', best: 'max' },
  { label: '1Y', get: (a) => a.gain.yearly, fmt: (v) => v != null ? fmtPct(v as number) : '—', best: 'max' },
  { label: '5Y', get: (a) => a.gain.fiveYear, fmt: (v) => v != null ? fmtPct(v as number) : '—', best: 'max' },
  { label: 'RSI (D)', get: (a) => a.rsi.daily, fmt: (v) => v != null ? (v as number).toFixed(0) : '—' },
  { label: '52W High', get: (a) => a.fiftyTwoWeekHigh, fmt: (v) => v != null ? fmtNum(v as number) : '—' },
  { label: '52W Low', get: (a) => a.fiftyTwoWeekLow, fmt: (v) => v != null ? fmtNum(v as number) : '—' },
  { label: 'Sector', get: (a) => a.sector, fmt: (v) => v != null ? String(v) : '—' },
  { label: 'Recommendation', get: (a) => a.recommendation, fmt: (v) => v != null ? (REC_LABELS[v as string] ?? String(v)) : '—' },
];

function findBestIdx(values: (number | string | null)[], dir: 'max' | 'min'): number {
  let best = -1;
  let bestVal = dir === 'max' ? -Infinity : Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (typeof v !== 'number') continue;
    if (dir === 'max' ? v > bestVal : v < bestVal) {
      bestVal = v;
      best = i;
    }
  }
  return best;
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
  const hasData = histories.slice(0, activeCount).every((h) => h.data && h.data.prices.length > 0);
  const isFetching = histories.slice(0, activeCount).some((h) => h.isFetching);

  // Single combined effect: create chart + series only when data is ready
  useEffect(() => {
    if (!containerRef.current || !hasData) return;

    const chart = createChart(containerRef.current, {
      ...CHART_OPTIONS,
      width: containerRef.current.clientWidth,
      height: window.innerWidth < 640 ? 300 : 400,
      rightPriceScale: {
        borderColor: '#3a3a4e',
        autoScale: true,
      },
    });
    chartRef.current = chart;

    const seriesMap = new Map<string, Map<string, number>>();
    const cleanups: (() => void)[] = [];

    for (let i = 0; i < activeCount; i++) {
      const data = histories[i].data!;
      const sym = symbols[i];
      const color = COMPARE_COLORS[i % COMPARE_COLORS.length];
      const normalized = normalize(data.prices);
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
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    cleanups.push(() => {
      window.removeEventListener('resize', handleResize);
    });

    return () => {
      cleanups.forEach((fn) => fn());
      try { chart.remove(); } catch { /* lightweight-charts may throw on remove */ }
      chartRef.current = null;
    };
  }, [hasData, activeCount, period, currency, ...symbols, h0.data, h1.data, h2.data, h3.data, h4.data, h5.data]);

  const chartLoading = !hasData;
  const tableLoading = !compareData;

  return (
    <div className="space-y-4">
      {/* Overlay chart */}
      <div className="relative rounded-lg border border-gray-800 bg-[#1a1a2e] overflow-hidden" style={{ minHeight: window.innerWidth < 640 ? 300 : 400 }}>
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
        <div ref={containerRef} className="w-full" />
        {(chartLoading || isFetching) && (
          <div className={`absolute inset-0 z-10 flex items-center justify-center ${chartLoading ? 'bg-[#1a1a2e]' : 'bg-[#1a1a2e]/80'}`}>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          </div>
        )}
      </div>

      {/* Comparison table */}
      {tableLoading ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-gray-800 bg-gray-900/50">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
        </div>
      ) : compareData.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="px-3 py-2 text-left text-gray-400 font-medium">Metric</th>
                {compareData.map((a, i) => (
                  <th key={a.symbol} className="px-3 py-2 text-right font-medium" style={{ color: COMPARE_COLORS[i % COMPARE_COLORS.length] }}>
                    {a.symbol.toUpperCase()}
                    {a.name && <span className="block text-xs text-gray-500 font-normal">{a.name}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => {
                const values = compareData.map((a) => m.get(a));
                const bestIdx = m.best ? findBestIdx(values, m.best) : -1;
                return (
                  <tr key={m.label} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-3 py-1.5 text-gray-400">{m.label}</td>
                    {values.map((v, i) => {
                      const formatted = m.fmt(v);
                      const isBest = i === bestIdx;
                      const isGain = typeof v === 'number' && m.label !== 'P/E' && m.label !== 'P/B' && m.label !== 'Beta';
                      const gainColor = isGain && typeof v === 'number' ? (v >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-300';
                      return (
                        <td key={i} className={`px-3 py-1.5 text-right ${isBest ? 'font-semibold text-green-400' : gainColor}`}>
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
