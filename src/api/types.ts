import type {
  BollingerValue,
  CompareResult,
  DataAdjustment,
  DataProvenance,
  DataStatus,
  Gain,
  HistoricalPrice,
  Indicators,
  Interval,
  MacdValue,
  MarketDataSource,
  Period,
  Quote,
  SearchResult,
  SingleValue,
  StockHistory as ContractStockHistory,
} from './generated/types.gen';

/** Client-only identity attached after a successful history request. */
export interface HistoryRequest {
  symbol: string;
  period: Period;
  interval?: Interval;
  indicatorsKey: string;
  currency: string | null;
  dividends: boolean;
}

/** Generated wire contract plus local request identity used to reject stale UI data. */
export type StockHistory = ContractStockHistory & {
  request?: HistoryRequest;
};

export type {
  BollingerValue,
  CompareResult,
  DataAdjustment,
  DataProvenance,
  DataStatus,
  Gain,
  HistoricalPrice,
  Indicators,
  Interval,
  MacdValue,
  MarketDataSource,
  Period,
  Quote,
  SearchResult,
  SingleValue,
};

export const INTRADAY_INTERVALS: Interval[] = ['1m', '5m', '15m', '30m', '1h'];

const ALL_INTERVALS: readonly string[] = [...INTRADAY_INTERVALS, '1d', '1wk', '1mo'];

export function isInterval(value: string | null | undefined): value is Interval {
  return value != null && ALL_INTERVALS.includes(value);
}
