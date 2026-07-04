import { addRecentItem, loadRecentItems, removeRecentItem } from './recents';

const RECENTS_KEY = 'recentTickers';
const MAX_RECENTS = 8;

export interface RecentTicker {
  symbol: string;
  name: string;
  exchange: string;
}

const recentTickerOptions = {
  maxItems: MAX_RECENTS,
  normalize: (value: unknown): RecentTicker | null => {
    if (!value || typeof value !== 'object') return null;
    const item = value as Partial<RecentTicker>;
    if (typeof item.symbol !== 'string' || item.symbol.trim() === '') return null;
    return {
      symbol: item.symbol.trim().toUpperCase(),
      name: typeof item.name === 'string' ? item.name : '',
      exchange: typeof item.exchange === 'string' ? item.exchange : '',
    };
  },
  keyOf: (item: RecentTicker) => item.symbol.toLowerCase(),
  mergeDuplicate: (current: RecentTicker, next: RecentTicker) => (
    !current.name && next.name ? next : current
  ),
};

export function loadRecentTickers(): RecentTicker[] {
  return loadRecentItems(RECENTS_KEY, recentTickerOptions);
}

export function addRecentTicker(ticker: RecentTicker): RecentTicker[] {
  return addRecentItem(RECENTS_KEY, recentTickerOptions.normalize(ticker) ?? ticker, recentTickerOptions);
}

export function removeRecentTicker(symbol: string): RecentTicker[] {
  return removeRecentItem(RECENTS_KEY, symbol.toLowerCase(), recentTickerOptions);
}
