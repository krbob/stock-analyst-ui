import { useEffect, useId, useRef, useState } from 'react';
import { createChart, createSeriesMarkers, CandlestickSeries, LineSeries, HistogramSeries, PriceScaleMode, type IChartApi, type ISeriesApi, type SeriesType, type Time, type UTCTimestamp } from 'lightweight-charts';
import type { HistoricalPrice, Indicators } from '../api/types';
import { useStockHistory } from '../api/queries';
import type { Interval, Period } from '../api/types';
import { createHistoryRequest, matchesHistoryRequest } from '../api/history-utils';
import {
  buildCandlestickOptions,
  buildChartOptions,
  buildLineSeriesOptions,
  DIVIDEND_MARKER_COLOR,
  INDICATOR_COLORS,
  withAlpha,
} from '../lib/chart-theme';
import { useChartTheme } from '../hooks/useChartTheme';
import { getPaneStretchFactors, type IndicatorPaneKind } from './price-chart-layout';
import { describePriceChart } from './chart-accessibility';
import { runChartCleanups } from './chart-lifecycle';

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

function timeKey(item: { date: string; timestamp?: number }): string {
  return item.timestamp != null ? String(item.timestamp) : item.date;
}

function chartTime(item: { date: string; timestamp?: number }): Time {
  return item.timestamp != null ? item.timestamp as UTCTimestamp : item.date;
}

// ---------------------------------------------------------------------------
// Indicator legend lookup
// ---------------------------------------------------------------------------

interface IndicatorSnapshot {
  sma50?: number;
  sma200?: number;
  ema50?: number;
  ema200?: number;
  bb?: { upper: number; middle: number; lower: number };
  rsi?: number;
  macd?: { macd: number; signal: number; histogram: number };
}

function buildIndicatorLookup(ind: Indicators, active: Set<string>): Map<string, IndicatorSnapshot> {
  const lookup = new Map<string, IndicatorSnapshot>();
  const getSnap = (key: string) => {
    let s = lookup.get(key);
    if (!s) { s = {}; lookup.set(key, s); }
    return s;
  };

  for (const key of ['sma50', 'sma200', 'ema50', 'ema200'] as const) {
    if (!active.has(key)) continue;
    for (const v of ind[key] ?? []) getSnap(timeKey(v))[key] = v.value;
  }
  if (active.has('bb')) {
    for (const v of ind.bb ?? []) getSnap(timeKey(v)).bb = { upper: v.upper, middle: v.middle, lower: v.lower };
  }
  if (active.has('rsi')) {
    for (const v of ind.rsi ?? []) getSnap(timeKey(v)).rsi = v.value;
  }
  if (active.has('macd')) {
    for (const v of ind.macd ?? []) getSnap(timeKey(v)).macd = { macd: v.macd, signal: v.signal, histogram: v.histogram };
  }
  return lookup;
}

// ---------------------------------------------------------------------------
// Chart styling
// ---------------------------------------------------------------------------

function fmtVol(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toString();
}

function fallbackChartHeight(mobile: number, desktop: number): number {
  return window.matchMedia('(max-width: 639px)').matches ? mobile : desktop;
}

function rebalancePanes(chart: IChartApi, indicatorPanes: IndicatorPaneKind[]): void {
  const factors = getPaneStretchFactors(indicatorPanes);
  chart.panes().forEach((pane, index) => {
    pane.setStretchFactor(factors[index] ?? 1);
  });
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
  indicators?: string[];
  activeIndicators?: Set<string>;
  currency?: string;
  dividends?: boolean;
  showDividends?: boolean;
  onZoomChange?: (zoomed: boolean) => void;
  resetRef?: React.MutableRefObject<(() => void) | null>;
}

export default function PriceChart({ symbol, period = '1y', interval, lineChart, logScale, indicators, activeIndicators, currency, dividends, showDividends, onZoomChange, resetRef }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const pricesRef = useRef<Map<string, HistoricalPrice>>(new Map());
  const indRef = useRef<Map<string, IndicatorSnapshot>>(new Map());
  const baseCleanupRef = useRef<(() => void)[]>([]);
  const indicatorCleanupRef = useRef<(() => void)[]>([]);
  const [legend, setLegend] = useState<HistoricalPrice | null>(null);
  const [indLegend, setIndLegend] = useState<IndicatorSnapshot | null>(null);
  const fittingRef = useRef(false);
  const fitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chartTheme = useChartTheme();
  const accessibleDescriptionId = useId();

  const { data, isFetching, error } = useStockHistory(symbol, period, interval, indicators, currency, dividends);
  const request = createHistoryRequest(symbol, period, interval, indicators, currency, dividends);
  const currentData = matchesHistoryRequest(data, request) ? data : undefined;
  const prevDataRef = useRef(currentData);

  const scheduleFitReset = () => {
    if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    fitTimerRef.current = setTimeout(() => {
      fittingRef.current = false;
      fitTimerRef.current = null;
    }, 100);
  };

  // ---- Chart creation (once) — must not recreate on prop changes ----
  useEffect(() => {
    if (!containerRef.current) return;

    const initialWidth = containerRef.current.clientWidth;
    const initialHeight = containerRef.current.clientHeight;
    const chart = createChart(containerRef.current, {
      ...buildChartOptions(),
      width: Math.max(initialWidth, 1),
      height: Math.max(initialHeight, fallbackChartHeight(350, 500)),
    });

    chartRef.current = chart;
    let prevSize = { width: initialWidth, height: initialHeight };
    chart.panes()[0]?.setPreserveEmptyPane(true);

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        setLegend(null);
        setIndLegend(null);
        return;
      }
      const key = String(param.time);
      setLegend(pricesRef.current.get(key) ?? null);
      setIndLegend(indRef.current.get(key) ?? null);
    });

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      if (!fittingRef.current) onZoomChange?.(true);
    });

    const handleResize = () => {
      if (containerRef.current) {
        const rawWidth = containerRef.current.clientWidth;
        const rawHeight = containerRef.current.clientHeight;
        // Resizing shifts the visible logical range; suppress the zoom-change
        // callback so the Reset affordance only appears for user zoom/pan.
        fittingRef.current = true;
        chart.applyOptions({
          width: Math.max(rawWidth, 1),
          height: Math.max(rawHeight, fallbackChartHeight(350, 500)),
        });
        if ((prevSize.width === 0 || prevSize.height === 0) && rawWidth > 0 && rawHeight > 0) {
          chart.timeScale().fitContent();
        }
        scheduleFitReset();
        prevSize = { width: rawWidth, height: rawHeight };
      }
    };

    const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(containerRef.current);
    window.addEventListener('resize', handleResize);
    return () => {
      if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
      runChartCleanups(baseCleanupRef.current);
      baseCleanupRef.current = [];
      runChartCleanups(indicatorCleanupRef.current);
      indicatorCleanupRef.current = [];
      try { chart.remove(); } catch { /* lightweight-charts may throw on remove */ }
      chartRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Theme (background, grid, scales) — re-applied when tokens change ----
  useEffect(() => {
    chartRef.current?.applyOptions(buildChartOptions(chartTheme));
  }, [chartTheme]);

  // ---- Base series + data (price, volume, dividend markers) ----
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !currentData) {
      pricesRef.current = new Map();
      setLegend(null);
      if (resetRef) resetRef.current = null;
      return;
    }

    const priceMap = new Map<string, HistoricalPrice>();
    for (const p of currentData.prices) priceMap.set(timeKey(p), p);
    pricesRef.current = priceMap;
    setLegend(null);

    const isIntraday = currentData.prices.some((p) => p.timestamp != null);
    chart.applyOptions({
      timeScale: {
        timeVisible: isIntraday,
        secondsVisible: false,
      },
    });

    const cleanups: (() => void)[] = [];

    // --- Price series (pane 0) ---
    let priceSeries: ISeriesApi<SeriesType>;
    if (lineChart) {
      const series = chart.addSeries(LineSeries, buildLineSeriesOptions(chartTheme));
      series.setData(currentData.prices.map((p) => ({ time: chartTime(p), value: p.close })));
      priceSeries = series;
      cleanups.push(() => chart.removeSeries(series));
    } else {
      const series = chart.addSeries(CandlestickSeries, buildCandlestickOptions(chartTheme));
      series.setData(
        currentData.prices.map((p) => ({
          time: chartTime(p),
          open: p.open,
          high: p.high,
          low: p.low,
          close: p.close,
        })),
      );
      priceSeries = series;
      cleanups.push(() => chart.removeSeries(series));
    }

    // --- Dividend markers ---
    if (showDividends) {
      const divPoints = currentData.prices
        .map((price, index) => ({ price, index }))
        .filter(({ price }) => price.dividend > 0);
      if (divPoints.length > 0) {
        const buildMarkers = (withText: boolean) => divPoints.map(({ price }) => ({
          time: chartTime(price),
          position: 'belowBar' as const,
          shape: 'circle' as const,
          color: DIVIDEND_MARKER_COLOR,
          text: withText ? `D ${price.dividend.toFixed(2)}` : undefined,
        }));

        // Smallest distance between two consecutive dividends, in bars.
        let minGapBars = Infinity;
        for (let i = 1; i < divPoints.length; i++) {
          minGapBars = Math.min(minGapBars, divPoints[i].index - divPoints[i - 1].index);
        }

        // Hide the "D 0.00" labels once neighbouring labels would collide
        // (~48px per label at the current zoom); dots always stay visible.
        const MIN_LABEL_SPACE_PX = 48;
        const markers = createSeriesMarkers(priceSeries, []);
        let textVisible: boolean | null = null;
        const updateMarkerText = () => {
          const range = chart.timeScale().getVisibleLogicalRange();
          const width = chart.timeScale().width();
          const barSpacing = range && width > 0 && range.to > range.from
            ? width / (range.to - range.from)
            : 0;
          const show = minGapBars === Infinity || barSpacing * minGapBars >= MIN_LABEL_SPACE_PX;
          if (show !== textVisible) {
            textVisible = show;
            markers.setMarkers(buildMarkers(show));
          }
        };
        updateMarkerText();
        chart.timeScale().subscribeVisibleLogicalRangeChange(updateMarkerText);
        cleanups.push(() => {
          chart.timeScale().unsubscribeVisibleLogicalRangeChange(updateMarkerText);
          markers.detach();
        });
      }
    }

    // --- Volume ---
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    volumeSeries.setData(
      currentData.prices.map((p) => ({
        time: chartTime(p),
        value: p.volume,
        color: p.close >= p.open ? withAlpha(chartTheme.up, '40') : withAlpha(chartTheme.down, '40'),
      })),
    );
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      borderVisible: false,
    });
    cleanups.push(() => chart.removeSeries(volumeSeries));

    chart.priceScale('right').applyOptions({
      autoScale: true,
      mode: logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    });

    if (resetRef) {
      resetRef.current = () => {
        fittingRef.current = true;
        chart.timeScale().fitContent();
        scheduleFitReset();
        onZoomChange?.(false);
      };
    }

    const dataChanged = prevDataRef.current !== currentData;
    prevDataRef.current = currentData;
    if (dataChanged) {
      fittingRef.current = true;
      chart.timeScale().fitContent();
      scheduleFitReset();
    }
    onZoomChange?.(false);

    baseCleanupRef.current = cleanups;
    return () => {
      runChartCleanups(cleanups);
      if (baseCleanupRef.current === cleanups) baseCleanupRef.current = [];
    };
  // onZoomChange/resetRef are stable refs from parent — including them causes infinite loops
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentData, lineChart, showDividends, chartTheme]);

  // ---- Indicators (kept separate so toggles do not recreate price/volume series) ----
  useEffect(() => {
    const chart = chartRef.current;
    runChartCleanups(indicatorCleanupRef.current);
    indicatorCleanupRef.current = [];

    const ind = currentData?.indicators;
    const active = activeIndicators ?? new Set<string>();
    if (!chart || !ind) {
      indRef.current = new Map();
      setIndLegend(null);
      chart?.panes()[0]?.setStretchFactor(1);
      return;
    }

    indRef.current = buildIndicatorLookup(ind, active);
    setIndLegend(null);

    const cleanups: (() => void)[] = [];
    const indicatorPanes: IndicatorPaneKind[] = [];

    // --- Overlay indicators (SMA, EMA, BB on pane 0) ---
    const overlayKeys = ['sma50', 'sma200', 'ema50', 'ema200'] as const;
    for (const key of overlayKeys) {
      if (!active.has(key)) continue;
      const values = ind[key];
      if (!values) continue;
      const series = chart.addSeries(LineSeries, {
        color: INDICATOR_COLORS[key],
        lineWidth: 1,
        priceScaleId: 'right',
      });
      series.setData(values.map((v) => ({ time: chartTime(v), value: v.value })));
      cleanups.push(() => chart.removeSeries(series));
    }

    if (ind.bb && active.has('bb')) {
      const bbLines = [
        { data: ind.bb.map((v) => ({ time: chartTime(v), value: v.upper })), color: INDICATOR_COLORS.bb_upper },
        { data: ind.bb.map((v) => ({ time: chartTime(v), value: v.middle })), color: INDICATOR_COLORS.bb_middle, style: 2 },
        { data: ind.bb.map((v) => ({ time: chartTime(v), value: v.lower })), color: INDICATOR_COLORS.bb_lower },
      ];
      for (const line of bbLines) {
        const series = chart.addSeries(LineSeries, {
          color: line.color,
          lineWidth: 1,
          lineStyle: (line as { style?: number }).style,
          priceScaleId: 'right',
        });
        series.setData(line.data);
        cleanups.push(() => chart.removeSeries(series));
      }
    }

    // --- RSI pane ---
    if (ind.rsi && active.has('rsi')) {
      indicatorPanes.push('rsi');
      const rsiPane = chart.addPane();
      const rsiPaneIdx = rsiPane.paneIndex();

      const rsiSeries = chart.addSeries(LineSeries, {
        color: INDICATOR_COLORS.rsi,
        lineWidth: 1,
        priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(0) },
      }, rsiPaneIdx);
      rsiSeries.setData(ind.rsi.map((v) => ({ time: chartTime(v), value: v.value })));
      cleanups.push(() => chart.removeSeries(rsiSeries));

      // Reference lines at 70 and 30
      for (const level of [70, 30]) {
        const refSeries = chart.addSeries(LineSeries, {
          color: chartTheme.scaleBorder,
          lineWidth: 1,
          lineStyle: 2,
          priceScaleId: 'right',
          crosshairMarkerVisible: false,
          lastValueVisible: false,
        }, rsiPaneIdx);
        refSeries.setData(ind.rsi.map((v) => ({ time: chartTime(v), value: level })));
        cleanups.push(() => chart.removeSeries(refSeries));
      }

      chart.priceScale('right', rsiPaneIdx).applyOptions({
        autoScale: true,
        mode: PriceScaleMode.Normal,
        scaleMargins: { top: 0.05, bottom: 0.05 },
      });
    }

    // --- MACD pane ---
    if (ind.macd && active.has('macd')) {
      indicatorPanes.push('macd');
      const macdPane = chart.addPane();
      const macdPaneIdx = macdPane.paneIndex();

      const macdSeries = chart.addSeries(LineSeries, {
        color: INDICATOR_COLORS.macd,
        lineWidth: 1,
        priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
      }, macdPaneIdx);
      macdSeries.setData(ind.macd.map((v) => ({ time: chartTime(v), value: v.macd })));
      cleanups.push(() => chart.removeSeries(macdSeries));

      const signalSeries = chart.addSeries(LineSeries, {
        color: INDICATOR_COLORS.macd_signal,
        lineWidth: 1,
      }, macdPaneIdx);
      signalSeries.setData(ind.macd.map((v) => ({ time: chartTime(v), value: v.signal })));
      cleanups.push(() => chart.removeSeries(signalSeries));

      const histSeries = chart.addSeries(HistogramSeries, {
        priceScaleId: 'right',
      }, macdPaneIdx);
      histSeries.setData(ind.macd.map((v) => ({
        time: chartTime(v),
        value: v.histogram,
        color: v.histogram >= 0 ? withAlpha(chartTheme.up, '80') : withAlpha(chartTheme.down, '80'),
      })));
      cleanups.push(() => chart.removeSeries(histSeries));

      chart.priceScale('right', macdPaneIdx).applyOptions({
        autoScale: true,
        mode: PriceScaleMode.Normal,
        scaleMargins: { top: 0.05, bottom: 0.05 },
      });
    }

    rebalancePanes(chart, indicatorPanes);
    indicatorCleanupRef.current = cleanups;

    return () => {
      runChartCleanups(cleanups);
      if (indicatorCleanupRef.current === cleanups) indicatorCleanupRef.current = [];
    };
  }, [currentData, activeIndicators, lineChart, showDividends, chartTheme]);

  // ---- Log scale (independent of series) ----
  useEffect(() => {
    chartRef.current?.priceScale('right').applyOptions({
      mode: logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    });
  }, [logScale]);

  if (!symbol) return null;

  const accessibleDescription = describePriceChart(
    symbol,
    currentData?.prices ?? [],
    currentData?.interval ?? interval,
    currentData?.currency ?? currency,
  );

  return (
    <figure className="relative">
      {legend && (
        <div className="absolute left-2 top-2 z-20 flex max-w-[calc(100%-70px)] flex-wrap gap-x-3 gap-y-0.5 rounded-lg border border-border bg-surface-raised/85 px-2.5 py-1.5 text-xs tabular-nums text-secondary shadow-sm backdrop-blur">
          <span>O <span className="text-primary">{legend.open.toFixed(2)}</span></span>
          <span>H <span className="text-primary">{legend.high.toFixed(2)}</span></span>
          <span>L <span className="text-primary">{legend.low.toFixed(2)}</span></span>
          <span>C <span className={legend.close >= legend.open ? 'text-up' : 'text-down'}>{legend.close.toFixed(2)}</span></span>
          <span>V <span className="text-primary">{fmtVol(legend.volume)}</span></span>
          {legend.dividend > 0 && <span>Div <span style={{ color: DIVIDEND_MARKER_COLOR }}>{legend.dividend.toFixed(2)}</span></span>}
          {indLegend?.sma50 != null && <span>SMA50 <span style={{ color: INDICATOR_COLORS.sma50 }}>{indLegend.sma50.toFixed(2)}</span></span>}
          {indLegend?.sma200 != null && <span>SMA200 <span style={{ color: INDICATOR_COLORS.sma200 }}>{indLegend.sma200.toFixed(2)}</span></span>}
          {indLegend?.ema50 != null && <span>EMA50 <span style={{ color: INDICATOR_COLORS.ema50 }}>{indLegend.ema50.toFixed(2)}</span></span>}
          {indLegend?.ema200 != null && <span>EMA200 <span style={{ color: INDICATOR_COLORS.ema200 }}>{indLegend.ema200.toFixed(2)}</span></span>}
          {indLegend?.bb != null && <span style={{ color: INDICATOR_COLORS.bb_middle }}>BB <span>{indLegend.bb.lower.toFixed(2)} / {indLegend.bb.middle.toFixed(2)} / {indLegend.bb.upper.toFixed(2)}</span></span>}
          {indLegend?.rsi != null && <span>RSI <span style={{ color: INDICATOR_COLORS.rsi }}>{indLegend.rsi.toFixed(0)}</span></span>}
          {indLegend?.macd != null && <span style={{ color: INDICATOR_COLORS.macd }}>MACD <span>{indLegend.macd.macd.toFixed(2)} / {indLegend.macd.signal.toFixed(2)} / {indLegend.macd.histogram.toFixed(2)}</span></span>}
        </div>
      )}
      <div
        ref={containerRef}
        role="img"
        tabIndex={0}
        aria-label={`${symbol.toUpperCase()} price chart`}
        aria-describedby={accessibleDescriptionId}
        className="h-[350px] w-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:h-[500px]"
      />
      {isFetching && (
        <div className={`absolute inset-0 z-10 flex items-center justify-center ${
          currentData ? 'bg-chart-bg/80' : 'bg-chart-bg'
        }`}>
          <div role="status" aria-label={`Loading ${symbol.toUpperCase()} chart data`} className="h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
        </div>
      )}
      {error && !currentData && (
        <div role="alert" className="absolute inset-0 z-10 flex items-center justify-center bg-chart-bg/80 text-danger">
          {error instanceof Error ? error.message : 'Failed to load chart data'}
        </div>
      )}
      {error && currentData && (
        <div className="absolute bottom-2 right-2 z-20 rounded-md border border-danger/30 bg-surface-raised/90 px-2 py-1 text-xs text-danger backdrop-blur">
          {error instanceof Error ? error.message : 'Failed to refresh chart data'}
        </div>
      )}
      <figcaption id={accessibleDescriptionId} className="sr-only">{accessibleDescription}</figcaption>
    </figure>
  );
}
