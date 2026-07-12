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
  retrievedAt: string[];
  marketTimestamps: string[];
  marketTimestampReportedCount: number;
  currencies: string[];
  currencyReportedCount: number;
  adjustments: string[];
  unitScales: number[];
  statuses: string[];
}

function cleanText(value: string | null | undefined, maxLength = 120): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function cleanDate(value: string | null | undefined): string | null {
  return cleanText(value, 40);
}

function appendUnique<T>(items: T[], value: T): void {
  if (!items.includes(value)) items.push(value);
}

export function quoteProvenance(quote: Quote, label = 'Quote'): DataProvenanceItem {
  const { provenance } = quote;
  const marketDate = cleanDate(provenance.marketDate) ?? cleanDate(quote.date);
  return {
    ...provenance,
    label,
    marketFrom: cleanDate(provenance.coverageFrom) ?? marketDate,
    marketTo: cleanDate(provenance.coverageTo) ?? marketDate,
  };
}

export function historyProvenance(history: StockHistory, label = 'History'): DataProvenanceItem {
  const dates = history.prices
    .map((price) => cleanDate(price.date))
    .filter((date): date is string => date != null)
    .sort();
  const first = dates[0];
  const last = dates.at(-1) ?? first;
  const { provenance } = history;

  return {
    ...provenance,
    label,
    marketFrom: cleanDate(provenance.coverageFrom) ?? first,
    marketTo: cleanDate(provenance.coverageTo) ?? last,
  };
}

export function summarizeDataProvenance(items: DataProvenanceItem[]): DataProvenanceSummary {
  const marketScopeMap = new Map<string, MarketScope>();
  const sources: string[] = [];
  const retrievedAt: string[] = [];
  const marketTimestamps: string[] = [];
  const currencies: string[] = [];
  const adjustments: string[] = [];
  const unitScales: number[] = [];
  const statuses: string[] = [];
  let marketTimestampReportedCount = 0;
  let currencyReportedCount = 0;

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

    appendUnique(sources, item.source);
    appendUnique(retrievedAt, item.retrievedAt);
    appendUnique(adjustments, item.adjustment);
    appendUnique(unitScales, item.unitScale);
    appendUnique(statuses, item.status);

    const marketTimestamp = cleanText(item.marketTimestamp, 80);
    if (marketTimestamp) {
      marketTimestampReportedCount += 1;
      appendUnique(marketTimestamps, marketTimestamp);
    }
    const currency = cleanText(item.currency, 12);
    if (currency) {
      currencyReportedCount += 1;
      appendUnique(currencies, currency.toUpperCase());
    }
  }

  return {
    itemCount: items.length,
    marketScopes: [...marketScopeMap.values()],
    sources,
    retrievedAt: retrievedAt.sort(),
    marketTimestamps: marketTimestamps.sort(),
    marketTimestampReportedCount,
    currencies,
    currencyReportedCount,
    adjustments,
    unitScales: unitScales.sort((left, right) => left - right),
    statuses,
  };
}
