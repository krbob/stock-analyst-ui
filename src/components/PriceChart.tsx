import { useState, useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, ColorType, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import { useStockHistory } from '../api/queries';
import type { Period } from '../api/types';

const PERIOD_PROGRESSION: Period[] = ['1mo', '3mo', '6mo', '1y', '2y', '5y', 'max'];

function getNextPeriod(current: Period): Period | null {
  const idx = PERIOD_PROGRESSION.indexOf(current);
  if (idx === -1 || idx >= PERIOD_PROGRESSION.length - 1) return null;
  return PERIOD_PROGRESSION[idx + 1];
}

interface PriceChartProps {
  symbol: string;
  period?: Period;
}

export default function PriceChart({ symbol, period = '1y' }: PriceChartProps) {
  const [effectivePeriod, setEffectivePeriod] = useState<Period>(period);
  const effectivePeriodRef = useRef<Period>(period);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const autoExpandRef = useRef(false);
  const adjustingRef = useRef(false);
  const prevBarCountRef = useRef(0);
  const { data, isFetching, error } = useStockHistory(symbol, effectivePeriod);

  // Reset on user-initiated period/symbol change
  useEffect(() => {
    autoExpandRef.current = false;
    effectivePeriodRef.current = period;
    setEffectivePeriod(period);
  }, [period, symbol]);

  // Chart creation
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#1a1a2e' },
        textColor: '#e0e0e0',
      },
      grid: {
        vertLines: { color: '#2a2a3e' },
        horzLines: { color: '#2a2a3e' },
      },
      width: containerRef.current.clientWidth,
      height: window.innerWidth < 640 ? 350 : 500,
      timeScale: {
        borderColor: '#3a3a4e',
      },
      rightPriceScale: {
        borderColor: '#3a3a4e',
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    });

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

  // Data update
  useEffect(() => {
    if (!seriesRef.current || !data) return;

    const chart = chartRef.current;
    const candlestickData = data.prices.map((p) => ({
      time: p.date,
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
    }));

    if (autoExpandRef.current) {
      // Auto-expand: shift logical range to preserve view
      const logicalRange = chart?.timeScale().getVisibleLogicalRange();
      const offset = candlestickData.length - prevBarCountRef.current;

      seriesRef.current.setData(candlestickData);
      chart?.priceScale('right').applyOptions({ autoScale: true });

      if (logicalRange && offset > 0) {
        adjustingRef.current = true;
        chart?.timeScale().setVisibleLogicalRange({
          from: logicalRange.from + offset,
          to: logicalRange.to + offset,
        });
        requestAnimationFrame(() => { adjustingRef.current = false; });
      }

      autoExpandRef.current = false;
    } else {
      // User-initiated: fit to show all data
      seriesRef.current.setData(candlestickData);
      chart?.priceScale('right').applyOptions({ autoScale: true });
      chart?.timeScale().fitContent();
    }

    prevBarCountRef.current = candlestickData.length;
  }, [data]);

  // Auto-expand: fetch larger period when user zooms past data edge
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !data || data.prices.length === 0) return;

    const handler = () => {
      if (adjustingRef.current) return;

      const logicalRange = chart.timeScale().getVisibleLogicalRange();
      if (!logicalRange) return;

      const visibleBars = logicalRange.to - logicalRange.from;
      const emptyLeft = -logicalRange.from;

      if (emptyLeft > visibleBars * 0.1) {
        const next = getNextPeriod(effectivePeriodRef.current);
        if (next) {
          effectivePeriodRef.current = next;
          autoExpandRef.current = true;
          setEffectivePeriod(next);
        }
      }
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
    return () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
  }, [data]);

  if (!symbol) return null;

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full" />
      {isFetching && !autoExpandRef.current && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#1a1a2e]/80">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
        </div>
      )}
      {error && !autoExpandRef.current && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-red-400 bg-[#1a1a2e]/80">
          {error instanceof Error ? error.message : 'Failed to load chart data'}
        </div>
      )}
    </div>
  );
}
