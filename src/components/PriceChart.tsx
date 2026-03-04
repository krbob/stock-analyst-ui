import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, LineSeries, ColorType, PriceScaleMode, type IChartApi } from 'lightweight-charts';
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

  const { data, isFetching, error } = useStockHistory(symbol, period, interval);

  // ---- Chart creation (once) ----
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      ...CHART_OPTIONS,
      width: containerRef.current.clientWidth,
      height: window.innerWidth < 640 ? 350 : 500,
    });

    chartRef.current = chart;

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

    let cleanup: () => void;

    if (lineChart) {
      const series = chart.addSeries(LineSeries, LINE_OPTIONS);
      series.setData(data.prices.map((p) => ({ time: p.date, value: p.close })));
      cleanup = () => chart.removeSeries(series);
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
      cleanup = () => chart.removeSeries(series);
    }

    chart.priceScale('right').applyOptions({ autoScale: true });
    chart.timeScale().fitContent();

    return cleanup;
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
      <div ref={containerRef} className="w-full" />
      {isFetching && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#1a1a2e]/80">
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
