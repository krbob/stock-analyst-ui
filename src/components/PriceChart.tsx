import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, LineSeries, HistogramSeries, ColorType, PriceScaleMode, type IChartApi } from 'lightweight-charts';
import type { HistoricalPrice } from '../api/types';
import { useStockHistory } from '../api/queries';
import type { Interval, Period } from '../api/types';

// ---------------------------------------------------------------------------
// Chart styling
// ---------------------------------------------------------------------------

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

const CANDLESTICK_OPTIONS = {
  upColor: '#22c55e',
  downColor: '#ef4444',
  borderDownColor: '#ef4444',
  borderUpColor: '#22c55e',
  wickDownColor: '#ef4444',
  wickUpColor: '#22c55e',
} as const;

const LINE_OPTIONS = {
  color: '#3b82f6',
  lineWidth: 2 as const,
};

function fmtVol(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PriceChartProps {
  symbol: string;
  period?: Period;
  interval?: Interval;
  lineChart?: boolean;
  logScale?: boolean;
}

export default function PriceChart({ symbol, period = '1y', interval, lineChart, logScale }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const pricesRef = useRef<Map<string, HistoricalPrice>>(new Map());
  const [legend, setLegend] = useState<HistoricalPrice | null>(null);

  const { data, isFetching, error } = useStockHistory(symbol, period, interval);
  const prevDataRef = useRef(data);

  // ---- Chart creation (once) ----
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      ...CHART_OPTIONS,
      width: containerRef.current.clientWidth,
      height: window.innerWidth < 640 ? 350 : 500,
    });

    chartRef.current = chart;

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        setLegend(null);
        return;
      }
      const price = pricesRef.current.get(String(param.time));
      setLegend(price ?? null);
    });

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // ---- Series + data (recreated on type or data change) ----
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !data) return;

    const priceMap = new Map<string, HistoricalPrice>();
    for (const p of data.prices) priceMap.set(p.date, p);
    pricesRef.current = priceMap;
    setLegend(null);

    const cleanups: (() => void)[] = [];

    if (lineChart) {
      const series = chart.addSeries(LineSeries, LINE_OPTIONS);
      series.setData(data.prices.map((p) => ({ time: p.date, value: p.close })));
      cleanups.push(() => chart.removeSeries(series));
    } else {
      const series = chart.addSeries(CandlestickSeries, CANDLESTICK_OPTIONS);
      series.setData(
        data.prices.map((p) => ({
          time: p.date,
          open: p.open,
          high: p.high,
          low: p.low,
          close: p.close,
        })),
      );
      cleanups.push(() => chart.removeSeries(series));
    }

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    volumeSeries.setData(
      data.prices.map((p) => ({
        time: p.date,
        value: p.volume,
        color: p.close >= p.open ? '#22c55e40' : '#ef444440',
      })),
    );
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      borderVisible: false,
    });
    cleanups.push(() => chart.removeSeries(volumeSeries));

    chart.priceScale('right').applyOptions({ autoScale: true });

    const dataChanged = prevDataRef.current !== data;
    prevDataRef.current = data;
    if (dataChanged) {
      chart.timeScale().fitContent();
    }

    return () => cleanups.forEach((fn) => fn());
  }, [data, lineChart]);

  // ---- Log scale (independent of series) ----
  useEffect(() => {
    chartRef.current?.priceScale('right').applyOptions({
      mode: logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    });
  }, [logScale]);

  if (!symbol) return null;

  return (
    <div className="relative">
      {legend && (
        <div className="absolute left-2 top-2 z-20 flex gap-3 text-xs text-gray-300">
          <span>O <span className="text-white">{legend.open.toFixed(2)}</span></span>
          <span>H <span className="text-white">{legend.high.toFixed(2)}</span></span>
          <span>L <span className="text-white">{legend.low.toFixed(2)}</span></span>
          <span>C <span className={legend.close >= legend.open ? 'text-green-400' : 'text-red-400'}>{legend.close.toFixed(2)}</span></span>
          <span>V <span className="text-white">{fmtVol(legend.volume)}</span></span>
        </div>
      )}
      <div ref={containerRef} className="w-full" />
      {isFetching && (
        <div className={`absolute inset-0 z-10 flex items-center justify-center ${
          data?.symbol.toLowerCase() === symbol.toLowerCase() ? 'bg-[#1a1a2e]/80' : 'bg-[#1a1a2e]'
        }`}>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-red-400 bg-[#1a1a2e]/80">
          {error instanceof Error ? error.message : 'Failed to load chart data'}
        </div>
      )}
    </div>
  );
}
