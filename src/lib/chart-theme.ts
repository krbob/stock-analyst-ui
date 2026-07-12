import type { ColorType } from 'lightweight-charts';
import { THEME_CHANGE_EVENT } from './theme';

// ---------------------------------------------------------------------------
// Theme tokens → lightweight-charts options
// ---------------------------------------------------------------------------

export interface ChartTheme {
  background: string;
  text: string;
  grid: string;
  scaleBorder: string;
  up: string;
  down: string;
  accent: string;
}

/** Dark-theme values, used when CSS variables cannot be resolved (e.g. jsdom). */
export const FALLBACK_CHART_THEME: ChartTheme = {
  background: '#1a1a2e',
  text: '#e0e0e0',
  grid: '#2a2a3e',
  scaleBorder: '#3a3a4e',
  up: '#22c55e',
  down: '#ef4444',
  accent: '#3b82f6',
};

const TOKEN_MAP: Record<keyof ChartTheme, string> = {
  background: '--color-chart-bg',
  text: '--color-chart-text',
  grid: '--color-chart-grid',
  scaleBorder: '--color-chart-scale-border',
  up: '--color-up',
  down: '--color-down',
  accent: '--color-accent',
};

type TokenReader = (token: string) => string;

function defaultTokenReader(): TokenReader | null {
  // jsdom guard — getComputedStyle exists but does not resolve custom
  // properties from stylesheets; empty values fall back per-token below.
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') return null;
  const styles = getComputedStyle(document.documentElement);
  return (token) => styles.getPropertyValue(token);
}

/** Reads the chart colors from the resolved CSS design tokens. */
export function readChartTheme(read?: TokenReader): ChartTheme {
  const reader = read ?? defaultTokenReader();
  if (!reader) return FALLBACK_CHART_THEME;
  const theme = { ...FALLBACK_CHART_THEME };
  for (const key of Object.keys(TOKEN_MAP) as (keyof ChartTheme)[]) {
    const value = reader(TOKEN_MAP[key]).trim();
    if (value) theme[key] = value;
  }
  return theme;
}

export function chartThemesEqual(a: ChartTheme, b: ChartTheme): boolean {
  return (Object.keys(TOKEN_MAP) as (keyof ChartTheme)[]).every((key) => a[key] === b[key]);
}

/**
 * Subscribes to theme changes: the app-level theme toggle plus OS-level
 * scheme changes (relevant when the preference is "system").
 * Returns an unsubscribe function.
 */
export function subscribeChartTheme(onChange: () => void): () => void {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  const media = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
  media?.addEventListener?.('change', onChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    media?.removeEventListener?.('change', onChange);
  };
}

export function buildChartOptions(theme: ChartTheme = readChartTheme()) {
  return {
    layout: {
      background: { type: 'solid' as ColorType.Solid, color: theme.background },
      textColor: theme.text,
      attributionLogo: false,
      panes: {
        separatorColor: theme.scaleBorder,
        separatorHoverColor: withAlpha(theme.accent, '33'),
      },
    },
    grid: {
      vertLines: { color: theme.grid },
      horzLines: { color: theme.grid },
    },
    timeScale: { borderColor: theme.scaleBorder },
    rightPriceScale: { borderColor: theme.scaleBorder },
  };
}

export function buildCandlestickOptions(theme: ChartTheme) {
  return {
    upColor: theme.up,
    downColor: theme.down,
    borderUpColor: theme.up,
    borderDownColor: theme.down,
    wickUpColor: theme.up,
    wickDownColor: theme.down,
  };
}

export function buildLineSeriesOptions(theme: ChartTheme) {
  return {
    color: theme.accent,
    lineWidth: 2 as const,
  };
}

/** Appends a hex alpha channel to a #rrggbb color (no-op for other formats). */
export function withAlpha(color: string, alphaHex: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color + alphaHex : color;
}

// ---------------------------------------------------------------------------
// Fixed palettes (accessible on both light and dark chart surfaces)
// ---------------------------------------------------------------------------

export const COMPARE_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#db2777'];

export const INDICATOR_COLORS: Record<string, string> = {
  sma50: '#d97706',
  sma200: '#3b82f6',
  ema50: '#ea580c',
  ema200: '#6366f1',
  bb_upper: '#7c3aed',
  bb_middle: '#8b5cf6',
  bb_lower: '#7c3aed',
  rsi: '#ca8a04',
  macd: '#3b82f6',
  macd_signal: '#ea580c',
};

export const DIVIDEND_MARKER_COLOR = '#8b5cf6';
