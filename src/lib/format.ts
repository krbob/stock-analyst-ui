const EMPTY_VALUE = '—';

interface PercentOptions {
  signed?: boolean;
  decimals?: number;
}

export function formatNumber(value: number | null | undefined, decimals = 2): string {
  return value != null && Number.isFinite(value) ? value.toFixed(decimals) : EMPTY_VALUE;
}

export function formatPercent(value: number | null | undefined, options: PercentOptions = {}): string {
  if (value == null || !Number.isFinite(value)) return EMPTY_VALUE;
  const decimals = options.decimals ?? 2;
  const sign = options.signed && value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatRatioPercent(value: number | null | undefined, options: PercentOptions = {}): string {
  return formatPercent(value == null ? value : value * 100, options);
}

export function formatGain(value: number | null | undefined, decimals = 2): string {
  return formatRatioPercent(value, { signed: true, decimals });
}

/**
 * Position of `value` within [min, max] as a 0..1 fraction (clamped).
 * Returns null when any bound is missing/non-finite or the range is empty.
 */
export function rangeFraction(
  value: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined,
): number | null {
  if (value == null || min == null || max == null) return null;
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (max <= min) return null;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

export function formatMarketCap(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return EMPTY_VALUE;
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  return value.toFixed(0);
}
