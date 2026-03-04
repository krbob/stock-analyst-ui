import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, ColorType, type IChartApi, type ISeriesApi } from 'lightweight-charts';
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

const SERIES_OPTIONS = {
  upColor: '#22c55e',
  downColor: '#ef4444',
  borderDownColor: '#ef4444',
  borderUpColor: '#22c55e',
  wickDownColor: '#ef4444',
  wickUpColor: '#22c55e',
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PriceChartProps {
  symbol: string;
  period?: Period;
  interval?: Interval;
}

export default function PriceChart({ symbol, period = '1y', interval }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const { data, isFetching, error } = useStockHistory(symbol, period, interval);

  // ---- Chart creation (once) ----
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      ...CHART_OPTIONS,
      width: containerRef.current.clientWidth,
      height: window.innerWidth < 640 ? 350 : 500,
    });

    const series = chart.addSeries(CandlestickSeries, SERIES_OPTIONS);

    chartRef.current = chart;
    seriesRef.current = series;

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
      seriesRef.current = null;
    };
  }, []);

  // ---- Push new data into the chart ----
  useEffect(() => {
    if (!seriesRef.current || !data) return;

    seriesRef.current.setData(
      data.prices.map((p) => ({
        time: p.date,
        open: p.open,
        high: p.high,
        low: p.low,
        close: p.close,
      })),
    );
    // Reset Y-axis auto-scale (user may have manually zoomed the price axis).
    chartRef.current?.priceScale('right').applyOptions({ autoScale: true });
    chartRef.current?.timeScale().fitContent();
  }, [data]);

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
