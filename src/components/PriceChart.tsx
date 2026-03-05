import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, LineSeries, HistogramSeries, ColorType, PriceScaleMode, type IChartApi } from 'lightweight-charts';
import type { HistoricalPrice, Indicators } from '../api/types';
import { useStockHistory } from '../api/queries';
import type { Interval, Period } from '../api/types';

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
  const getSnap = (date: string) => {
    let s = lookup.get(date);
    if (!s) { s = {}; lookup.set(date, s); }
    return s;
  };

  for (const key of ['sma50', 'sma200', 'ema50', 'ema200'] as const) {
    if (!active.has(key)) continue;
    for (const v of ind[key] ?? []) getSnap(v.date)[key] = v.value;
  }
  if (active.has('bb')) {
    for (const v of ind.bb ?? []) getSnap(v.date).bb = { upper: v.upper, middle: v.middle, lower: v.lower };
  }
  if (active.has('rsi')) {
    for (const v of ind.rsi ?? []) getSnap(v.date).rsi = v.value;
  }
  if (active.has('macd')) {
    for (const v of ind.macd ?? []) getSnap(v.date).macd = { macd: v.macd, signal: v.signal, histogram: v.histogram };
  }
  return lookup;
}

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

const OVERLAY_COLORS: Record<string, string> = {
  sma50: '#f59e0b',
  sma200: '#3b82f6',
  ema50: '#f97316',
  ema200: '#6366f1',
  bb_upper: '#8b5cf6',
  bb_middle: '#a78bfa',
  bb_lower: '#8b5cf6',
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
  indicators?: string[];
  activeIndicators?: Set<string>;
  onZoomChange?: (zoomed: boolean) => void;
  resetRef?: React.MutableRefObject<(() => void) | null>;
}

export default function PriceChart({ symbol, period = '1y', interval, lineChart, logScale, indicators, activeIndicators, onZoomChange, resetRef }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const pricesRef = useRef<Map<string, HistoricalPrice>>(new Map());
  const indRef = useRef<Map<string, IndicatorSnapshot>>(new Map());
  const [legend, setLegend] = useState<HistoricalPrice | null>(null);
  const [indLegend, setIndLegend] = useState<IndicatorSnapshot | null>(null);
  const fittingRef = useRef(false);

  const { data, isFetching, error } = useStockHistory(symbol, period, interval, indicators);
  const prevDataRef = useRef(data);

  const active = activeIndicators ?? new Set<string>();

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
    indRef.current = data.indicators ? buildIndicatorLookup(data.indicators, active) : new Map();
    setLegend(null);
    setIndLegend(null);

    const cleanups: (() => void)[] = [];

    // --- Price series (pane 0) ---
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

    // --- Volume ---
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

    // --- Overlay indicators (SMA, EMA, BB on pane 0) ---
    const ind = data.indicators;
    if (ind) {
      const overlayKeys = ['sma50', 'sma200', 'ema50', 'ema200'] as const;
      for (const key of overlayKeys) {
        if (!active.has(key)) continue;
        const values = ind[key];
        if (!values) continue;
        const series = chart.addSeries(LineSeries, {
          color: OVERLAY_COLORS[key],
          lineWidth: 1,
          priceScaleId: 'right',
        });
        series.setData(values.map((v) => ({ time: v.date, value: v.value })));
        cleanups.push(() => chart.removeSeries(series));
      }

      if (ind.bb && active.has('bb')) {
        const bbLines = [
          { data: ind.bb.map((v) => ({ time: v.date, value: v.upper })), color: OVERLAY_COLORS.bb_upper },
          { data: ind.bb.map((v) => ({ time: v.date, value: v.middle })), color: OVERLAY_COLORS.bb_middle, style: 2 },
          { data: ind.bb.map((v) => ({ time: v.date, value: v.lower })), color: OVERLAY_COLORS.bb_lower },
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
        const rsiPane = chart.addPane();
        const rsiPaneIdx = rsiPane.paneIndex();
        rsiPane.setStretchFactor(0.3);

        const rsiSeries = chart.addSeries(LineSeries, {
          color: '#eab308',
          lineWidth: 1,
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(0) },
        }, rsiPaneIdx);
        rsiSeries.setData(ind.rsi.map((v) => ({ time: v.date, value: v.value })));
        cleanups.push(() => chart.removeSeries(rsiSeries));

        // Reference lines at 70 and 30
        for (const level of [70, 30]) {
          const refSeries = chart.addSeries(LineSeries, {
            color: '#4b5563',
            lineWidth: 1,
            lineStyle: 2,
            priceScaleId: 'right',
            crosshairMarkerVisible: false,
            lastValueVisible: false,
          }, rsiPaneIdx);
          refSeries.setData(ind.rsi.map((v) => ({ time: v.date, value: level })));
          cleanups.push(() => chart.removeSeries(refSeries));
        }

        chart.priceScale('right', rsiPaneIdx).applyOptions({
          autoScale: true,
          scaleMargins: { top: 0.05, bottom: 0.05 },
        });
      }

      // --- MACD pane ---
      if (ind.macd && active.has('macd')) {
        const macdPane = chart.addPane();
        const macdPaneIdx = macdPane.paneIndex();
        macdPane.setStretchFactor(0.3);

        const macdSeries = chart.addSeries(LineSeries, {
          color: '#3b82f6',
          lineWidth: 1,
          priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) },
        }, macdPaneIdx);
        macdSeries.setData(ind.macd.map((v) => ({ time: v.date, value: v.macd })));
        cleanups.push(() => chart.removeSeries(macdSeries));

        const signalSeries = chart.addSeries(LineSeries, {
          color: '#f97316',
          lineWidth: 1,
        }, macdPaneIdx);
        signalSeries.setData(ind.macd.map((v) => ({ time: v.date, value: v.signal })));
        cleanups.push(() => chart.removeSeries(signalSeries));

        const histSeries = chart.addSeries(HistogramSeries, {
          priceScaleId: 'right',
        }, macdPaneIdx);
        histSeries.setData(ind.macd.map((v) => ({
          time: v.date,
          value: v.histogram,
          color: v.histogram >= 0 ? '#22c55e80' : '#ef444480',
        })));
        cleanups.push(() => chart.removeSeries(histSeries));

        chart.priceScale('right', macdPaneIdx).applyOptions({
          autoScale: true,
          scaleMargins: { top: 0.05, bottom: 0.05 },
        });
      }
    }

    chart.priceScale('right').applyOptions({ autoScale: true });

    if (resetRef) {
      resetRef.current = () => {
        fittingRef.current = true;
        chart.timeScale().fitContent();
        requestAnimationFrame(() => { fittingRef.current = false; });
        onZoomChange?.(false);
      };
    }

    const dataChanged = prevDataRef.current !== data;
    prevDataRef.current = data;
    if (dataChanged) {
      fittingRef.current = true;
      chart.timeScale().fitContent();
      requestAnimationFrame(() => { fittingRef.current = false; });
    }
    onZoomChange?.(false);

    return () => cleanups.forEach((fn) => fn());
  }, [data, lineChart, activeIndicators]);

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
        <div className="absolute left-2 top-2 z-20 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-300 max-w-[calc(100%-70px)]">
          <span>O <span className="text-white">{legend.open.toFixed(2)}</span></span>
          <span>H <span className="text-white">{legend.high.toFixed(2)}</span></span>
          <span>L <span className="text-white">{legend.low.toFixed(2)}</span></span>
          <span>C <span className={legend.close >= legend.open ? 'text-green-400' : 'text-red-400'}>{legend.close.toFixed(2)}</span></span>
          <span>V <span className="text-white">{fmtVol(legend.volume)}</span></span>
          {indLegend?.sma50 != null && <span>SMA50 <span style={{ color: OVERLAY_COLORS.sma50 }}>{indLegend.sma50.toFixed(2)}</span></span>}
          {indLegend?.sma200 != null && <span>SMA200 <span style={{ color: OVERLAY_COLORS.sma200 }}>{indLegend.sma200.toFixed(2)}</span></span>}
          {indLegend?.ema50 != null && <span>EMA50 <span style={{ color: OVERLAY_COLORS.ema50 }}>{indLegend.ema50.toFixed(2)}</span></span>}
          {indLegend?.ema200 != null && <span>EMA200 <span style={{ color: OVERLAY_COLORS.ema200 }}>{indLegend.ema200.toFixed(2)}</span></span>}
          {indLegend?.bb != null && <span style={{ color: OVERLAY_COLORS.bb_middle }}>BB <span>{indLegend.bb.lower.toFixed(2)} / {indLegend.bb.middle.toFixed(2)} / {indLegend.bb.upper.toFixed(2)}</span></span>}
          {indLegend?.rsi != null && <span>RSI <span style={{ color: '#eab308' }}>{indLegend.rsi.toFixed(0)}</span></span>}
          {indLegend?.macd != null && <span style={{ color: '#3b82f6' }}>MACD <span>{indLegend.macd.macd.toFixed(2)} / {indLegend.macd.signal.toFixed(2)} / {indLegend.macd.histogram.toFixed(2)}</span></span>}
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
