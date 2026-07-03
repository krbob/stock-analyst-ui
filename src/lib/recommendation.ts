export const RECOMMENDATION_LABELS: Record<string, string> = {
  strong_buy: 'Strong Buy',
  buy: 'Buy',
  hold: 'Hold',
  sell: 'Sell',
  strong_sell: 'Strong Sell',
};

export const RECOMMENDATION_COLORS: Record<string, string> = {
  strong_buy: 'text-up',
  buy: 'text-up',
  hold: 'text-highlight',
  sell: 'text-down',
  strong_sell: 'text-down',
};

export function formatRecommendation(value: string | null | undefined): string {
  return value ? RECOMMENDATION_LABELS[value] ?? value : '—';
}
