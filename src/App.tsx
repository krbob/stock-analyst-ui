import { useState, type FormEvent } from 'react';
import PriceChart from './components/PriceChart';
import { usePrice } from './api/queries';
import type { Period } from './api/types';

const PERIODS: { label: string; value: Period }[] = [
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: '1Y', value: '1y' },
  { label: '2Y', value: '2y' },
  { label: '5Y', value: '5y' },
  { label: 'Max', value: 'max' },
];

function Spinner() {
  return (
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
  );
}

function StockInfo({ symbol }: { symbol: string }) {
  const { data, isLoading, error } = usePrice(symbol);

  if (!symbol) return null;

  if (isLoading) {
    return (
      <div className="flex items-baseline gap-4">
        <h2 className="text-2xl font-bold text-white">{symbol.toUpperCase()}</h2>
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-baseline gap-4">
        <h2 className="text-2xl font-bold text-white">{symbol.toUpperCase()}</h2>
        <span className="text-sm text-red-400">Not found</span>
      </div>
    );
  }

  if (!data) return null;

  const dailyChange = data.gain.daily;

  return (
    <div className="flex items-baseline gap-4">
      <h2 className="text-2xl font-bold text-white">{data.name}</h2>
      <span className="text-xl text-gray-300">{data.lastPrice.toFixed(2)}</span>
      {dailyChange != null && (
        <span className={`text-lg font-medium ${dailyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {dailyChange >= 0 ? '+' : ''}{dailyChange.toFixed(2)}%
        </span>
      )}
    </div>
  );
}

export default function App() {
  const [input, setInput] = useState('');
  const [symbol, setSymbol] = useState('');
  const [period, setPeriod] = useState<Period>('1y');

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
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <StockInfo symbol={symbol} />
              <div className="flex gap-1">
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
              </div>
            </div>
            <PriceChart symbol={symbol} period={period} />
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
