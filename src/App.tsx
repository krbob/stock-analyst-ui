import { useState, type FormEvent } from 'react';
import PriceChart from './components/PriceChart';
import { usePrice, useStockHistory } from './api/queries';
import type { Interval, Period } from './api/types';

const fmtPct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

const PERIODS: { label: string; value: Period }[] = [
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: 'YTD', value: 'ytd' },
  { label: '1Y', value: '1y' },
  { label: '2Y', value: '2y' },
  { label: '5Y', value: '5y' },
  { label: '10Y', value: '10y' },
  { label: 'Max', value: 'max' },
];

const INTERVALS: { label: string; value: Interval }[] = [
  { label: '1D', value: '1d' },
  { label: '1W', value: '1wk' },
  { label: '1M', value: '1mo' },
];

function Spinner() {
  return (
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
  );
}

const PERIOD_LABELS: Record<Period, string> = {
  '1d': '1D', '5d': '5D', '1mo': '1M', '3mo': '3M', '6mo': '6M',
  '1y': '1Y', '2y': '2Y', '5y': '5Y', '10y': '10Y', 'ytd': 'YTD', 'max': 'Max',
};

function PeriodChange({ symbol, period }: { symbol: string; period: Period }) {
  const { data } = useStockHistory(symbol, period);

  if (!data || data.prices.length < 2) return null;

  const first = data.prices[0].close;
  const last = data.prices[data.prices.length - 1].close;
  const change = ((last - first) / first) * 100;

  return (
    <span className={`text-sm ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
      {fmtPct(change)} ({PERIOD_LABELS[period]})
    </span>
  );
}

function StockInfo({ symbol, period }: { symbol: string; period: Period }) {
  const { data, isLoading, error } = usePrice(symbol);

  if (!symbol) return null;

  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-3">
        <h2 className="text-2xl font-bold text-white">{symbol.toUpperCase()}</h2>
        {isLoading && <Spinner />}
        {error && <span className="text-sm text-red-400">Not found</span>}
        {data && (
          <>
            <span className="text-xl text-gray-300">{data.lastPrice.toFixed(2)}</span>
            {data.gain.daily != null && (
              <span className={`text-lg font-medium ${data.gain.daily >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtPct(data.gain.daily)}
              </span>
            )}
            <PeriodChange symbol={symbol} period={period} />
          </>
        )}
      </div>
      {data?.name && (
        <p className="text-sm text-gray-500">{data.name}</p>
      )}
    </div>
  );
}

export default function App() {
  const [input, setInput] = useState('');
  const [symbol, setSymbol] = useState('');
  const [period, setPeriod] = useState<Period>('1y');
  const [interval, setInterval] = useState<Interval | undefined>();
  const [lineChart, setLineChart] = useState(false);
  const [logScale, setLogScale] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed) {
      setSymbol(trimmed);
      setPeriod('1y');
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <header className="border-b border-gray-800 px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">Stock Analyst</h1>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ticker"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-24 rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none sm:w-auto sm:placeholder:before:content-['(e.g._AAPL)']"
            />
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium hover:bg-blue-500 transition-colors"
            >
              Go
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        {symbol ? (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <StockInfo symbol={symbol} period={period} />
              <div className="flex shrink-0 items-center gap-1">
                {PERIODS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPeriod(p.value)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                      period === p.value
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <div className="mx-1 h-5 w-px bg-gray-700" />
                {INTERVALS.map((i) => (
                  <button
                    key={i.value}
                    onClick={() => setInterval(interval === i.value ? undefined : i.value)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                      interval === i.value
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    {i.label}
                  </button>
                ))}
                <div className="mx-1 h-5 w-px bg-gray-700" />
                <button
                  onClick={() => setLineChart(!lineChart)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                    lineChart
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  Line
                </button>
                <button
                  onClick={() => setLogScale(!logScale)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                    logScale
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  Log
                </button>
              </div>
            </div>
            <PriceChart symbol={symbol} period={period} interval={interval} lineChart={lineChart} logScale={logScale} />
          </>
        ) : (
          <div className="flex h-[500px] items-center justify-center text-gray-500 px-4 text-center">
            Enter a stock ticker to view the chart
          </div>
        )}
      </main>
    </div>
  );
}
