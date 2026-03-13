export type IndicatorPaneKind = 'rsi' | 'macd';

const PRICE_PANE_FACTOR = 2;

const INDICATOR_PANE_FACTORS: Record<IndicatorPaneKind, number> = {
  rsi: 0.5,
  macd: 0.7,
};

export function getPaneStretchFactors(indicatorPanes: IndicatorPaneKind[]): number[] {
  if (indicatorPanes.length === 0) return [1];
  return [PRICE_PANE_FACTOR, ...indicatorPanes.map((pane) => INDICATOR_PANE_FACTORS[pane])];
}
