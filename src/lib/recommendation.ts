export const RECOMMENDATION_LABELS: Record<string, string> = {
  strong_buy: 'Strong Buy',
  buy: 'Buy',
  hold: 'Hold',
  sell: 'Sell',
  strong_sell: 'Strong Sell',
};

export const RECOMMENDATION_COLORS: Record<string, string> = {
  strong_buy: 'text-green-400',
  buy: 'text-green-400',
  hold: 'text-yellow-400',
  sell: 'text-red-400',
  strong_sell: 'text-red-400',
};

export function formatRecommendation(value: string | null | undefined): string {
  return value ? RECOMMENDATION_LABELS[value] ?? value : '—';
}
