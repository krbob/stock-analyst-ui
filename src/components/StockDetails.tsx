import { useEffect, useRef, useState } from 'react';
import { useQuote } from '../api/queries';
import type { HistoricalPrice, Indicators } from '../api/types';

function fmtMktCap(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  return n.toFixed(0);
}

function fmtRate(n: number): string {
  return (n * 100).toFixed(2) + '%';
}

function fmtNum(n: number | null | undefined, decimals = 2): string {
  return n != null ? n.toFixed(decimals) : '—';
}

function Item({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  return (
    <div className="flex justify-between gap-2 py-1">
      {tooltip ? (
        <span className="group relative shrink-0 cursor-help text-gray-500 underline decoration-dotted decoration-gray-600 underline-offset-2">
          {label}
          <span className="pointer-events-none absolute bottom-full left-0 z-30 mb-1.5 hidden w-56 rounded bg-gray-800 px-2.5 py-1.5 text-xs leading-relaxed text-gray-200 shadow-lg group-hover:block">
            {tooltip}
          </span>
        </span>
      ) : (
        <span className="shrink-0 text-gray-500">{label}</span>
      )}
      <span className="truncate text-white">{value}</span>
    </div>
  );
}

function Recommendation({ value, count }: { value: string | null; count: number | null }) {
  const tip = 'Analyst consensus recommendation. Based on ratings from Wall Street analysts. Number in parentheses shows how many analysts cover this stock.';
  if (!value) return <Item label="Rating" value="—" tooltip={tip} />;
  const colors: Record<string, string> = {
    strong_buy: 'text-green-400',
    buy: 'text-green-400',
    hold: 'text-yellow-400',
    sell: 'text-red-400',
    strong_sell: 'text-red-400',
  };
  const labels: Record<string, string> = {
    strong_buy: 'Strong Buy',
    buy: 'Buy',
    hold: 'Hold',
    sell: 'Sell',
    strong_sell: 'Strong Sell',
  };
  const display = labels[value] ?? value;
  const countStr = count != null ? ` (${count})` : '';
  return (
    <div className="flex justify-between gap-2 py-1">
      <span className="group relative cursor-help text-gray-500 underline decoration-dotted decoration-gray-600 underline-offset-2">
        Rating
        <span className="pointer-events-none absolute bottom-full left-0 z-30 mb-1.5 hidden w-56 rounded bg-gray-800 px-2.5 py-1.5 text-xs leading-relaxed text-gray-200 shadow-lg group-hover:block">
          {tip}
        </span>
      </span>
      <span className={colors[value] ?? 'text-white'}>{display}{countStr}</span>
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
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
      <h3 className="mb-2 text-sm font-medium text-gray-400">Dividends</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-500">
            <th className="pb-1 text-left font-medium">Date</th>
            <th className="pb-1 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((p) => (
            <tr key={p.date} className="border-b border-gray-800/50">
              <td className="py-1 text-gray-300">{p.date}</td>
              <td className="py-1 text-right text-white">{p.amount.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {dividends.length > 6 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-gray-400 hover:text-white transition-colors"
        >
          {expanded ? 'Show less' : `Show all ${dividends.length} payments`}
        </button>
      )}
    </div>
  );
}

function CrossFade({ show, children }: { show: boolean; children: React.ReactNode }) {
  const [rendered, setRendered] = useState(show);
  const [visible, setVisible] = useState(show);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (show) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRendered(true);
      // Ensure the DOM is painted before transitioning opacity
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      timerRef.current = setTimeout(() => setRendered(false), 300);
    }
    return () => clearTimeout(timerRef.current);
  }, [show]);

  if (!rendered) return null;

  return (
    <div className={`transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {children}
    </div>
  );
}

function lastValue(arr?: { value: number }[]): number | undefined {
  return arr && arr.length > 0 ? arr[arr.length - 1].value : undefined;
}

export default function StockDetails({ symbol, currency, prices, indicators, showDividends }: { symbol: string; currency?: string; prices?: HistoricalPrice[]; indicators?: Indicators; showDividends?: boolean }) {
  const { data, isLoading, error } = useQuote(symbol, currency);
  const dividends = showDividends ? extractDividends(prices) : [];

  if (!symbol) return null;

  if (isLoading) {
    return (
      <div className="mt-4 flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
      </div>
    );
  }

  if (error || !data) return null;

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

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
          <h3 className="mb-2 text-sm font-medium text-gray-400">Fundamentals</h3>
          <div className="grid grid-cols-2 gap-x-6 text-sm">
            <Item label="P/E" value={fmtNum(data.peRatio)} tooltip="Price-to-Earnings ratio. Compares stock price to earnings per share. Lower P/E may indicate undervaluation; higher P/E suggests growth expectations. Compare within the same sector." />
            <Item label="EPS" value={fmtNum(data.eps)} tooltip="Earnings Per Share. Company's net profit divided by shares outstanding. Higher is better. Negative EPS means the company is losing money." />
            <Item label="P/B" value={fmtNum(data.pbRatio)} tooltip="Price-to-Book ratio. Compares stock price to book value (assets minus liabilities). Below 1.0 may indicate undervaluation; above 3.0 is typical for growth stocks." />
            <Item label="Mkt Cap" value={data.marketCap != null ? fmtMktCap(data.marketCap) : '—'} tooltip="Market Capitalization. Total market value of all shares. Mega cap: >$200B, Large: $10–200B, Mid: $2–10B, Small: <$2B." />
            <Item label="Yield" value={data.dividendYield ? fmtRate(data.dividendYield) : '—'} tooltip="Dividend Yield. Annual dividend payments as a percentage of stock price. Higher yield = more income, but very high yields (>8%) may signal risk." />
            <Item label="Div Grw" value={data.dividendGrowth ? fmtRate(data.dividendGrowth) : '—'} tooltip="Dividend Growth. Year-over-year change in annual dividend payments. Consistent growth is a sign of financial health." />
            <Item label="ROE" value={data.roe != null ? fmtRate(data.roe) : '—'} tooltip="Return on Equity. How efficiently a company uses shareholders' equity to generate profit. Above 15% is generally considered good." />
            <Item label="Beta" value={fmtNum(data.beta)} tooltip="Beta. Measures volatility relative to the market. Beta 1.0 = moves with market, >1.0 = more volatile, <1.0 = less volatile. Negative beta moves opposite to market." />
            <Item label="52W High" value={fmtNum(data.fiftyTwoWeekHigh)} tooltip="52-Week High. Highest price in the last year. Current price near the high suggests strength; far below may indicate weakness or a buying opportunity." />
            <Item label="52W Low" value={fmtNum(data.fiftyTwoWeekLow)} tooltip="52-Week Low. Lowest price in the last year." />
            <Item label="Sector" value={data.sector ?? '—'} />
            <Item label="Industry" value={data.industry ?? '—'} />
            <Item label="Earnings" value={data.earningsDate ?? '—'} tooltip="Next Earnings Date. When the company reports quarterly results. Stock prices often move significantly around earnings." />
            <Recommendation value={data.recommendation} count={data.analystCount} />
          </div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
          <h3 className="mb-2 text-sm font-medium text-gray-400">Technicals</h3>
          <div className="grid grid-cols-2 gap-x-6 text-sm">
            <Item label="RSI" value={fmtNum(rsiVal, 1)} tooltip="RSI (14-period). 0–100 scale. Above 70 = overbought, below 30 = oversold. Measures the speed and magnitude of recent price changes." />
            <div />
            <Item label="MACD" value={fmtNum(macdLine)} tooltip="MACD Line (12/26 EMA difference). When MACD crosses above the signal line = bullish signal; below = bearish." />
            <Item label="Signal" value={fmtNum(macdSignal)} tooltip="MACD Signal Line (9-period EMA of MACD). Acts as a trigger for buy/sell signals when crossed by the MACD line." />
            <Item label="Histogram" value={fmtNum(macdHist)} tooltip="MACD Histogram (MACD minus Signal). Positive and growing = strengthening bullish momentum. Negative and growing = strengthening bearish momentum." />
            <div />
            <Item label="SMA 50" value={fmtNum(sma50)} tooltip="50-day Simple Moving Average. Average closing price over the last 50 days. Price above SMA50 = short-term uptrend." />
            <Item label="SMA 200" value={fmtNum(sma200)} tooltip="200-day Simple Moving Average. Key long-term trend indicator. Price above SMA200 = long-term uptrend. SMA50 crossing SMA200 produces golden/death cross signals." />
            <Item label="EMA 50" value={fmtNum(ema50)} tooltip="50-day Exponential Moving Average. Like SMA50 but gives more weight to recent prices, reacting faster to changes." />
            <Item label="EMA 200" value={fmtNum(ema200)} tooltip="200-day Exponential Moving Average. Long-term trend with faster reaction than SMA200." />
            <Item label="BB Upper" value={fmtNum(bbUpper)} tooltip="Bollinger Band Upper (20-day SMA + 2 std dev). Price touching or exceeding this band suggests the stock may be overbought." />
            <Item label="BB Mid" value={fmtNum(bbMiddle)} tooltip="Bollinger Band Middle (20-day SMA). Acts as a dynamic support/resistance level." />
            <Item label="BB Lower" value={fmtNum(bbLower)} tooltip="Bollinger Band Lower (20-day SMA − 2 std dev). Price touching or going below suggests the stock may be oversold." />
          </div>
        </div>
      </div>

      <CrossFade show={dividends.length > 0}>
        <DividendTable dividends={dividends} />
      </CrossFade>
    </div>
  );
}
