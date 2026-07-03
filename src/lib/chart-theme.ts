import { ColorType } from 'lightweight-charts';

export const CHART_OPTIONS = {
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

export const COMPARE_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];
