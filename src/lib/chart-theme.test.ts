import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildCandlestickOptions,
  buildChartOptions,
  buildLineSeriesOptions,
  chartThemesEqual,
  FALLBACK_CHART_THEME,
  readChartTheme,
  subscribeChartTheme,
  withAlpha,
} from './chart-theme';
import { THEME_CHANGE_EVENT } from './theme';

describe('readChartTheme', () => {
  it('reads colors from the provided token reader', () => {
    const tokens: Record<string, string> = {
      '--color-chart-bg': '#ffffff',
      '--color-chart-text': ' #111111 ',
      '--color-chart-grid': '#eeeeee',
      '--color-chart-scale-border': '#cccccc',
      '--color-up': '#15803d',
      '--color-down': '#dc2626',
      '--color-accent': '#2563eb',
    };
    const theme = readChartTheme((token) => tokens[token] ?? '');
    expect(theme).toEqual({
      background: '#ffffff',
      text: '#111111',
      grid: '#eeeeee',
      scaleBorder: '#cccccc',
      up: '#15803d',
      down: '#dc2626',
      accent: '#2563eb',
    });
  });

  it('falls back per-token when a variable is unresolved', () => {
    const theme = readChartTheme((token) => (token === '--color-up' ? '#00ff00' : ''));
    expect(theme.up).toBe('#00ff00');
    expect(theme.background).toBe(FALLBACK_CHART_THEME.background);
    expect(theme.grid).toBe(FALLBACK_CHART_THEME.grid);
  });

  it('does not throw in jsdom without resolved CSS variables', () => {
    const theme = readChartTheme();
    // jsdom does not cascade custom properties from stylesheets → dark fallbacks
    for (const value of Object.values(theme)) {
      expect(value).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('buildChartOptions', () => {
  it('maps theme colors and disables the attribution logo', () => {
    const theme = { ...FALLBACK_CHART_THEME, background: '#123456', grid: '#654321' };
    const options = buildChartOptions(theme);
    expect(options.layout.background.color).toBe('#123456');
    expect(options.layout.textColor).toBe(theme.text);
    expect(options.layout.attributionLogo).toBe(false);
    expect(options.grid.vertLines.color).toBe('#654321');
    expect(options.grid.horzLines.color).toBe('#654321');
    expect(options.timeScale.borderColor).toBe(theme.scaleBorder);
    expect(options.rightPriceScale.borderColor).toBe(theme.scaleBorder);
  });
});

describe('series option builders', () => {
  it('candlesticks use the up/down tokens for body, border and wick', () => {
    const options = buildCandlestickOptions({ ...FALLBACK_CHART_THEME, up: '#0f0', down: '#f00' });
    expect(options).toEqual({
      upColor: '#0f0',
      downColor: '#f00',
      borderUpColor: '#0f0',
      borderDownColor: '#f00',
      wickUpColor: '#0f0',
      wickDownColor: '#f00',
    });
  });

  it('line series uses the accent token', () => {
    expect(buildLineSeriesOptions({ ...FALLBACK_CHART_THEME, accent: '#abcdef' }).color).toBe('#abcdef');
  });
});

describe('withAlpha', () => {
  it('appends the alpha channel to 6-digit hex colors', () => {
    expect(withAlpha('#22c55e', '40')).toBe('#22c55e40');
  });

  it('leaves non-hex values untouched', () => {
    expect(withAlpha('rgb(1, 2, 3)', '40')).toBe('rgb(1, 2, 3)');
    expect(withAlpha('#fff', '40')).toBe('#fff');
  });
});

describe('chartThemesEqual', () => {
  it('compares all color fields', () => {
    expect(chartThemesEqual(FALLBACK_CHART_THEME, { ...FALLBACK_CHART_THEME })).toBe(true);
    expect(chartThemesEqual(FALLBACK_CHART_THEME, { ...FALLBACK_CHART_THEME, up: '#000000' })).toBe(false);
  });
});

describe('subscribeChartTheme', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invokes the callback on app theme changes and stops after unsubscribe', () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeChartTheme(onChange);

    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe();
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('subscribes to prefers-color-scheme changes when matchMedia is available', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ addEventListener, removeEventListener }));

    const unsubscribe = subscribeChartTheme(() => {});
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    unsubscribe();
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    vi.unstubAllGlobals();
  });
});
