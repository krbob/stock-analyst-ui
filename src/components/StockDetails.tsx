import { useId, useState } from 'react';
import { useQuote } from '../api/queries';
import type { HistoricalPrice, Indicators, Interval, Quote } from '../api/types';
import { formatMarketCap, formatNumber, formatRatioPercent, rangeFraction } from '../lib/format';
import { formatRecommendation, RECOMMENDATION_COLORS } from '../lib/recommendation';

/** Horizontal RSI gauge (0–100) with 30/70 zone marks and a value marker. */
function RsiBar({ value }: { value?: number }) {
  if (value == null || !Number.isFinite(value)) return null;
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      role="meter"
      aria-label="RSI gauge"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="relative col-span-2 mb-1.5 mt-1 h-1.5 rounded-full bg-surface"
    >
      <div aria-hidden="true" className="absolute inset-y-0 left-[30%] w-[40%] rounded-sm bg-border/70" />
      <div aria-hidden="true" className="absolute inset-y-0 left-[30%] w-px bg-border-strong" />
      <div aria-hidden="true" className="absolute inset-y-0 left-[70%] w-px bg-border-strong" />
      <div
        aria-hidden="true"
        className="absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

/** 52-week range position bar: low — current — high. */
function FiftyTwoWeekRange({ low, high, price }: { low: number | null; high: number | null; price: number | null }) {
  const fraction = rangeFraction(price, low, high);
  if (fraction == null) return null;
  return (
    <div className="col-span-2 py-1">
      <div className="flex justify-between text-xs text-muted">
        <span>52W Low {formatNumber(low)}</span>
        <span>52W High {formatNumber(high)}</span>
      </div>
      <div
        role="meter"
        aria-label="Position in 52-week range"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
        className="relative mt-1.5 h-1.5 rounded-full bg-surface"
      >
        <div aria-hidden="true" className="absolute inset-y-0 left-0 rounded-full bg-accent/25" style={{ width: `${fraction * 100}%` }} />
        <div
          aria-hidden="true"
          className="absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
          style={{ left: `${fraction * 100}%` }}
        />
      </div>
    </div>
  );
}

/** Pulse-block skeleton mirroring the two details cards while the quote loads. */
function DetailsSkeleton() {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1" aria-hidden="true">
      {[0, 1].map((card) => (
        <div key={card} className="rounded-xl border border-border bg-surface-raised px-4 py-3 shadow-sm">
          <div className="mb-3 h-4 w-28 animate-pulse rounded bg-surface" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            {Array.from({ length: 10 }, (_, row) => (
              <div key={row} className="h-3.5 animate-pulse rounded bg-surface" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TooltipLabel({ label, tooltip }: { label: string; tooltip: string }) {
  const tooltipId = useId();
  return (
    <span
      tabIndex={0}
      aria-describedby={tooltipId}
      className="group relative shrink-0 cursor-help text-muted underline decoration-dotted decoration-border-strong underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {label}
      <span
        role="tooltip"
        id={tooltipId}
        className="pointer-events-none absolute bottom-full left-0 z-30 mb-1.5 hidden w-56 rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-xs leading-relaxed text-secondary shadow-lg group-hover:block group-focus:block"
      >
        {tooltip}
      </span>
    </span>
  );
}

function Item({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  return (
    <div className="flex justify-between gap-2 py-1">
      {tooltip ? (
        <TooltipLabel label={label} tooltip={tooltip} />
      ) : (
        <span className="shrink-0 text-muted">{label}</span>
      )}
      <span className="truncate text-primary">{value}</span>
    </div>
  );
}

function Recommendation({ value, count }: { value: string | null; count: number | null }) {
  const tip = 'Analyst consensus recommendation. Based on ratings from Wall Street analysts. Number in parentheses shows how many analysts cover this stock.';
  if (!value) return <Item label="Rating" value="—" tooltip={tip} />;
  const countStr = count != null ? ` (${count})` : '';
  return (
    <div className="flex justify-between gap-2 py-1">
      <TooltipLabel label="Rating" tooltip={tip} />
      <span className={RECOMMENDATION_COLORS[value] ?? 'text-primary'}>{formatRecommendation(value)}{countStr}</span>
    </div>
  );
}

interface DividendEntry {
  date: string;
  amount: number;
}

function extractDividends(prices?: HistoricalPrice[]): DividendEntry[] {
  if (!prices) return [];
  return prices
    .filter((p) => p.dividend > 0)
    .map((p) => ({ date: p.date, amount: p.dividend }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function DividendTable({ dividends }: { dividends: DividendEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? dividends : dividends.slice(0, 6);

  return (
    <div className="rounded-xl border border-border bg-surface-raised px-4 py-3 shadow-sm">
      <h3 className="mb-2 text-sm font-medium text-muted">Dividends</h3>
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-border text-muted">
            <th className="pb-1 text-left font-medium">Date</th>
            <th className="pb-1 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((p) => (
            <tr key={p.date} className="border-b border-border/60">
              <td className="py-1 text-secondary">{p.date}</td>
              <td className="py-1 text-right text-primary">{p.amount.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {dividends.length > 6 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="mt-2 text-xs text-muted transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {expanded ? 'Show less' : `Show all ${dividends.length} payments`}
        </button>
      )}
    </div>
  );
}

function lastValue(arr?: { value: number }[]): number | undefined {
  return arr && arr.length > 0 ? arr[arr.length - 1].value : undefined;
}

function windowDescription(length: number, interval: Interval): string {
  if (interval === '1d') return `${length}-day`;
  if (interval === '1wk') return `${length}-week`;
  if (interval === '1mo') return `${length}-month`;

  const unit = interval === '1h' ? 'hour' : 'minute';
  const amount = interval === '1h' ? '1' : interval.slice(0, -1);
  return `${length}-bar (${amount}-${unit} candles)`;
}

export interface StockDetailsProps {
  symbol: string;
  currency?: string;
  prices?: HistoricalPrice[];
  indicators?: Indicators;
  interval?: Interval;
  showDividends?: boolean;
  quoteState?: {
    data: Quote | undefined;
    isLoading: boolean;
    error: Error | null;
  };
}

export default function StockDetails({ symbol, currency, prices, indicators, interval = '1d', showDividends, quoteState }: StockDetailsProps) {
  const fallbackQuote = useQuote(quoteState ? '' : symbol, currency);
  const { data, isLoading, error } = quoteState ?? fallbackQuote;
  const dividends = showDividends ? extractDividends(prices) : [];
  const dividendKey = dividends.length > 0 ? `${symbol}:${dividends[0].date}:${dividends.length}` : `${symbol}:empty`;

  if (!symbol) return null;

  if (isLoading) {
    return <DetailsSkeleton />;
  }

  if (error || !data) {
    const message = error instanceof Error ? error.message : `No quote data returned for ${symbol.toUpperCase()}.`;
    return (
      <div role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-primary">
        <div className="font-medium">Unable to load stock details</div>
        <div className="mt-1 break-words text-danger">{message}</div>
      </div>
    );
  }

  // Derive technicals from the last point of each indicator series
  const rsiVal = lastValue(indicators?.rsi);
  const macdLine = indicators?.macd?.at(-1)?.macd ?? null;
  const macdSignal = indicators?.macd?.at(-1)?.signal ?? null;
  const macdHist = indicators?.macd?.at(-1)?.histogram ?? null;
  const sma50 = lastValue(indicators?.sma50);
  const sma200 = lastValue(indicators?.sma200);
  const ema50 = lastValue(indicators?.ema50);
  const ema200 = lastValue(indicators?.ema200);
  const bbUpper = indicators?.bb?.at(-1)?.upper ?? null;
  const bbMiddle = indicators?.bb?.at(-1)?.middle ?? null;
  const bbLower = indicators?.bb?.at(-1)?.lower ?? null;
  const fiftyTwoWeekFraction = rangeFraction(data.lastPrice, data.fiftyTwoWeekLow, data.fiftyTwoWeekHigh);

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <div className="rounded-xl border border-border bg-surface-raised px-4 py-3 shadow-sm">
          <h3 className="mb-2 text-sm font-medium text-muted">Fundamentals</h3>
          <div className="grid grid-cols-2 gap-x-6 text-sm tabular-nums">
            <Item label="Forward P/E" value={formatNumber(data.peRatio)} tooltip="Forward Price-to-Earnings ratio. Compares stock price to analysts' estimated future earnings per share. Lower P/E may indicate undervaluation; higher P/E suggests growth expectations. Compare within the same sector." />
            <Item label="EPS" value={formatNumber(data.eps)} tooltip="Earnings Per Share. Company's net profit divided by shares outstanding. Higher is better. Negative EPS means the company is losing money." />
            <Item label="P/B" value={formatNumber(data.pbRatio)} tooltip="Price-to-Book ratio. Compares stock price to book value (assets minus liabilities). Below 1.0 may indicate undervaluation; above 3.0 is typical for growth stocks." />
            <Item label="Mkt Cap" value={formatMarketCap(data.marketCap)} tooltip="Market Capitalization. Total market value of all shares. Mega cap: >$200B, Large: $10–200B, Mid: $2–10B, Small: <$2B." />
            <Item label="Yield" value={formatRatioPercent(data.dividendYield)} tooltip="Dividend Yield. Annual dividend payments as a percentage of stock price. Higher yield = more income, but very high yields (>8%) may signal risk." />
            <Item label="Div Grw" value={formatRatioPercent(data.dividendGrowth)} tooltip="Dividend Growth. Year-over-year change in annual dividend payments. Consistent growth is a sign of financial health." />
            <Item label="ROE" value={formatRatioPercent(data.roe)} tooltip="Return on Equity. How efficiently a company uses shareholders' equity to generate profit. Above 15% is generally considered good." />
            <Item label="Beta" value={formatNumber(data.beta)} tooltip="Beta. Measures volatility relative to the market. Beta 1.0 = moves with market, >1.0 = more volatile, <1.0 = less volatile. Negative beta moves opposite to market." />
            {fiftyTwoWeekFraction == null && (
              <>
                <Item label="52W High" value={formatNumber(data.fiftyTwoWeekHigh)} tooltip="52-Week High. Highest price in the last year. Current price near the high suggests strength; far below may indicate weakness or a buying opportunity." />
                <Item label="52W Low" value={formatNumber(data.fiftyTwoWeekLow)} tooltip="52-Week Low. Lowest price in the last year." />
              </>
            )}
            <Item label="Sector" value={data.sector ?? '—'} />
            <Item label="Industry" value={data.industry ?? '—'} />
            <Item label="Earnings" value={data.earningsDate ?? '—'} tooltip="Next Earnings Date. When the company reports quarterly results. Stock prices often move significantly around earnings." />
            <Recommendation value={data.recommendation ?? null} count={data.analystCount ?? null} />
            <FiftyTwoWeekRange low={data.fiftyTwoWeekLow ?? null} high={data.fiftyTwoWeekHigh ?? null} price={data.lastPrice} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-raised px-4 py-3 shadow-sm">
          <h3 className="mb-2 text-sm font-medium text-muted">Technicals</h3>
          <div className="grid grid-cols-2 gap-x-6 text-sm tabular-nums">
            <Item label="RSI" value={formatNumber(rsiVal, 1)} tooltip="RSI (14-period). 0–100 scale. Above 70 = overbought, below 30 = oversold. Measures the speed and magnitude of recent price changes." />
            <div />
            <RsiBar value={rsiVal} />
            <Item label="MACD" value={formatNumber(macdLine)} tooltip="MACD Line (12/26 EMA difference). When MACD crosses above the signal line = bullish signal; below = bearish." />
            <Item label="Signal" value={formatNumber(macdSignal)} tooltip="MACD Signal Line (9-period EMA of MACD). Acts as a trigger for buy/sell signals when crossed by the MACD line." />
            <Item label="Histogram" value={formatNumber(macdHist)} tooltip="MACD Histogram (MACD minus Signal). Positive and growing = strengthening bullish momentum. Negative and growing = strengthening bearish momentum." />
            <div />
            <Item label={`SMA 50 · ${interval}`} value={formatNumber(sma50)} tooltip={`${windowDescription(50, interval)} Simple Moving Average. It averages the last 50 closing-price candles at the selected interval.`} />
            <Item label={`SMA 200 · ${interval}`} value={formatNumber(sma200)} tooltip={`${windowDescription(200, interval)} Simple Moving Average. It describes 200 candles at the selected interval, not necessarily 200 trading days.`} />
            <Item label={`EMA 50 · ${interval}`} value={formatNumber(ema50)} tooltip={`${windowDescription(50, interval)} Exponential Moving Average. It gives more weight to recent candles at the selected interval.`} />
            <Item label={`EMA 200 · ${interval}`} value={formatNumber(ema200)} tooltip={`${windowDescription(200, interval)} Exponential Moving Average. It describes 200 candles at the selected interval.`} />
            <Item label={`BB Upper · ${interval}`} value={formatNumber(bbUpper)} tooltip={`Upper Bollinger Band based on a ${windowDescription(20, interval)} moving average plus two standard deviations.`} />
            <Item label={`BB Mid · ${interval}`} value={formatNumber(bbMiddle)} tooltip={`Middle Bollinger Band: the ${windowDescription(20, interval)} moving average.`} />
            <Item label={`BB Lower · ${interval}`} value={formatNumber(bbLower)} tooltip={`Lower Bollinger Band based on a ${windowDescription(20, interval)} moving average minus two standard deviations.`} />
          </div>
        </div>
      </div>

      {dividends.length > 0 && <DividendTable key={dividendKey} dividends={dividends} />}
    </div>
  );
}
