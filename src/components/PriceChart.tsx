import { useState, useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, ColorType, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import { useStockHistory } from '../api/queries';
import type { Period } from '../api/types';

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

/** Ordered list of periods that support auto-zoom (expand / shrink). */
const PERIOD_PROGRESSION: Period[] = ['1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'max'];

/** Approximate candle interval in calendar days — must match backend `intervalFor()`. */
const CANDLE_INTERVAL_DAYS: Partial<Record<Period, number>> = {
  '5y': 7, '10y': 7, 'max': 30,
  // all others → 1 (daily); handled via fallback below
};

function candleInterval(period: Period): number {
  return CANDLE_INTERVAL_DAYS[period] ?? 1;
}

function getNextPeriod(current: Period): Period | null {
  const idx = PERIOD_PROGRESSION.indexOf(current);
  if (idx === -1 || idx >= PERIOD_PROGRESSION.length - 1) return null;
  return PERIOD_PROGRESSION[idx + 1];
}

/**
 * Return the smallest period whose data range covers the given number of days.
 *
 * Thresholds sit at ~95 % of each period's calendar range — tight enough to
 * trigger promptly on zoom-in, but with enough margin so the fetched data
 * comfortably covers the visible window.
 */
function targetPeriodForDays(days: number): Period {
  if (days <= 28) return '1mo';
  if (days <= 85) return '3mo';
  if (days <= 170) return '6mo';
  if (days <= 350) return '1y';
  if (days <= 700) return '2y';
  if (days <= 1735) return '5y';
  if (days <= 3470) return '10y';
  return 'max';
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/** Convert a lightweight-charts time value (UTCTimestamp in seconds or date string) to ms. */
function timeToMs(t: unknown): number {
  return typeof t === 'number' ? t * 1000 : new Date(t as string).getTime();
}

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
  onPeriodChange?: (period: Period) => void;
}

export default function PriceChart({ symbol, period = '1y', onPeriodChange }: PriceChartProps) {
  const [effectivePeriod, setEffectivePeriod] = useState<Period>(period);
  const effectivePeriodRef = useRef<Period>(period);
  const prevSymbolRef = useRef(symbol);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  /** Indicates the type of ongoing automatic transition, suppressing the range-change handler. */
  const autoTransitionRef = useRef<'expand' | 'shrink' | null>(null);
  /** Period to report to the parent once the new data has loaded. */
  const pendingPeriodRef = useRef<Period | null>(null);
  /** True while the chart view is being programmatically adjusted (blocks the range-change handler). */
  const adjustingRef = useRef(false);
  const shrinkTimerRef = useRef(0);

  const { data, isFetching, error } = useStockHistory(symbol, effectivePeriod);

  // ---- Reset on user-initiated period / symbol change ----
  useEffect(() => {
    const symbolChanged = symbol !== prevSymbolRef.current;
    prevSymbolRef.current = symbol;

    // When the incoming period already matches the effective one it was us who
    // changed it (via onPeriodChange) — skip the reset to avoid a loop.
    if (!symbolChanged && period === effectivePeriodRef.current) return;

    autoTransitionRef.current = null;
    effectivePeriodRef.current = period;
    setEffectivePeriod(period);
  }, [period, symbol]);

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

  // ---- Push new data into the chart & adjust view ----
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

    // Capture range *before* setting data so we can preserve the view on shrink.
    const prevRange = chart?.timeScale().getVisibleRange();

    seriesRef.current.setData(candlestickData);
    chart?.priceScale('right').applyOptions({ autoScale: true });

    const transition = autoTransitionRef.current;
    adjustingRef.current = true;

    if (transition === 'shrink' && prevRange) {
      // Keep the same time window — the user now gets finer candles for the same span.
      chart?.timeScale().setVisibleRange(prevRange);
    } else {
      // Expand or user-initiated: show all data.
      chart?.timeScale().fitContent();
    }

    autoTransitionRef.current = null;

    if (pendingPeriodRef.current) {
      onPeriodChange?.(pendingPeriodRef.current);
      pendingPeriodRef.current = null;
    }

    // Un-guard after the view has settled so the range-change handler can fire again.
    clearTimeout(shrinkTimerRef.current);
    requestAnimationFrame(() => {
      adjustingRef.current = false;
    });
  }, [data, onPeriodChange]);

  // ---- Auto-expand / auto-shrink on user zoom ----
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !data || data.prices.length === 0) return;

    const handler = () => {
      if (adjustingRef.current || autoTransitionRef.current) return;

      const logicalRange = chart.timeScale().getVisibleLogicalRange();
      if (!logicalRange) return;

      const visibleBars = logicalRange.to - logicalRange.from;
      const emptyLeft = -logicalRange.from;

      // --- Expand: user scrolled / zoomed past the left edge of the data ---
      if (emptyLeft > visibleBars * 0.1) {
        const next = getNextPeriod(effectivePeriodRef.current);
        if (next) {
          clearTimeout(shrinkTimerRef.current);
          effectivePeriodRef.current = next;
          pendingPeriodRef.current = next;
          autoTransitionRef.current = 'expand';
          setEffectivePeriod(next);
          return;
        }
        // Already at the largest period — fall through so shrink can still run.
      }

      // --- Shrink: user zoomed in enough that a finer period would suffice ---
      // Debounced to avoid rapid-fire fetches during a zoom gesture.
      clearTimeout(shrinkTimerRef.current);
      shrinkTimerRef.current = window.setTimeout(() => {
        if (autoTransitionRef.current || adjustingRef.current) return;

        const visibleRange = chart.timeScale().getVisibleRange();
        if (!visibleRange) return;

        const fromMs = timeToMs(visibleRange.from);
        const toMs = timeToMs(visibleRange.to);
        const spanDays = (toMs - fromMs) / 86_400_000;
        const ageDays = (Date.now() - fromMs) / 86_400_000;

        // The target period must cover both the age of the oldest visible bar
        // (so the API returns data that far back) and the visible span itself.
        const target = targetPeriodForDays(Math.max(ageDays, spanDays));
        const targetIdx = PERIOD_PROGRESSION.indexOf(target);
        const currentIdx = PERIOD_PROGRESSION.indexOf(effectivePeriodRef.current);

        // Only shrink when the target period actually provides finer candles
        // (e.g. monthly → weekly, or weekly → daily).  Shrinking between two
        // periods with the same interval (e.g. 10y → 5y, both weekly) would
        // fetch new data without improving the chart resolution.
        if (
          targetIdx >= 0 &&
          targetIdx < currentIdx &&
          candleInterval(target) < candleInterval(effectivePeriodRef.current)
        ) {
          effectivePeriodRef.current = target;
          pendingPeriodRef.current = target;
          autoTransitionRef.current = 'shrink';
          setEffectivePeriod(target);
        }
      }, 300);
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
      clearTimeout(shrinkTimerRef.current);
    };
  }, [data]);

  if (!symbol) return null;

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full" />
      {isFetching && !autoTransitionRef.current && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#1a1a2e]/80">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
        </div>
      )}
      {error && !autoTransitionRef.current && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-red-400 bg-[#1a1a2e]/80">
          {error instanceof Error ? error.message : 'Failed to load chart data'}
        </div>
      )}
    </div>
  );
}
