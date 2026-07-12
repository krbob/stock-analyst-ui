import type { DataProvenance, Quote, StockHistory } from '../api/types';

export interface DataProvenanceItem extends DataProvenance {
  label: string;
  marketFrom?: string | null;
  marketTo?: string | null;
}

export interface MarketScope {
  from: string;
  to: string;
  labels: string[];
}

export interface DataProvenanceSummary {
  itemCount: number;
  marketScopes: MarketScope[];
  sources: string[];
  sourceReportedCount: number;
  retrievedAt: string[];
  retrievedAtReportedCount: number;
  statuses: string[];
  statusReportedCount: number;
}

function cleanText(value: string | null | undefined, maxLength = 120): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function cleanDate(value: string | null | undefined): string | null {
  return cleanText(value, 40);
}

export function quoteProvenance(quote: Quote, label = 'Quote'): DataProvenanceItem {
  return {
    label,
    marketFrom: quote.date,
    marketTo: quote.date,
    source: quote.source,
    retrievedAt: quote.retrievedAt,
    status: quote.status,
  };
}

export function historyProvenance(history: StockHistory, label = 'History'): DataProvenanceItem {
  const dates = history.prices
    .map((price) => cleanDate(price.date))
    .filter((date): date is string => date != null)
    .sort();
  // Requested bounds describe the query, not necessarily returned market data.
  // Only actual represented price points qualify as a market-data range.
  const first = dates[0];
  const last = dates.at(-1) ?? first;

  return {
    label,
    marketFrom: first,
    marketTo: last,
    source: history.source,
    retrievedAt: history.retrievedAt,
    status: history.status,
  };
}

export function summarizeDataProvenance(items: DataProvenanceItem[]): DataProvenanceSummary {
  const marketScopeMap = new Map<string, MarketScope>();
  const sources: string[] = [];
  const retrievedAt: string[] = [];
  const statuses: string[] = [];
  let sourceReportedCount = 0;
  let retrievedAtReportedCount = 0;
  let statusReportedCount = 0;

  for (const item of items) {
    const from = cleanDate(item.marketFrom);
    const to = cleanDate(item.marketTo) ?? from;
    if (from && to) {
      const ordered = from <= to ? [from, to] : [to, from];
      const key = ordered.join('\0');
      const existing = marketScopeMap.get(key);
      if (existing) existing.labels.push(cleanText(item.label, 40) ?? 'Data');
      else marketScopeMap.set(key, {
        from: ordered[0],
        to: ordered[1],
        labels: [cleanText(item.label, 40) ?? 'Data'],
      });
    }

    const source = cleanText(item.source);
    if (source) {
      sourceReportedCount += 1;
      if (!sources.includes(source)) sources.push(source);
    }
    const retrieved = cleanText(item.retrievedAt, 80);
    if (retrieved) {
      retrievedAtReportedCount += 1;
      if (!retrievedAt.includes(retrieved)) retrievedAt.push(retrieved);
    }
    const status = cleanText(item.status, 40);
    if (status) {
      statusReportedCount += 1;
      if (!statuses.includes(status)) statuses.push(status);
    }
  }

  return {
    itemCount: items.length,
    marketScopes: [...marketScopeMap.values()],
    sources,
    sourceReportedCount,
    retrievedAt: retrievedAt.sort(),
    retrievedAtReportedCount,
    statuses,
    statusReportedCount,
  };
}
