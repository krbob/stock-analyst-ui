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

function StockInfo({ symbol }: { symbol: string }) {
  const { data, isLoading } = usePrice(symbol);

  if (!symbol || isLoading || !data) return null;

  const dailyChange = data.gain.daily;
  const isPositive = dailyChange >= 0;

  return (
    <div className="flex items-baseline gap-4">
      <h2 className="text-2xl font-bold text-white">{data.name}</h2>
      <span className="text-xl text-gray-300">{data.lastPrice.toFixed(2)}</span>
      <span className={`text-lg font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
        {isPositive ? '+' : ''}{dailyChange.toFixed(2)}%
      </span>
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
    if (trimmed) setSymbol(trimmed);
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Stock Analyst</h1>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ticker (e.g. AAPL)"
              className="rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
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

      <main className="mx-auto max-w-6xl px-6 py-6">
        {symbol ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <StockInfo symbol={symbol} />
              <div className="flex gap-1">
                {PERIODS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPeriod(p.value)}
                    className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
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
          <div className="flex h-[500px] items-center justify-center text-gray-500">
            Enter a stock ticker to view the chart
          </div>
        )}
      </main>
    </div>
  );
}
