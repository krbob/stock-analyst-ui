import { useState } from 'react';
import { loadRecentTickers } from '../lib/ticker-recents';

interface EmptyStateProps {
  onSelect: (symbol: string) => void;
}

/** Hero shown when no ticker is selected, with recent tickers as chips. */
export default function EmptyState({ onSelect }: EmptyStateProps) {
  const [recents] = useState(loadRecentTickers);

  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface-raised text-accent shadow-sm">
        <svg aria-hidden="true" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v16a2 2 0 0 0 2 2h16" />
          <path d="M7 15l4-6 4 3 5-7" />
        </svg>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-primary">Analyze any stock</h2>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Search for a ticker to see charts, technical indicators, fundamentals and dividend history.
        </p>
      </div>
      {recents.length > 0 && (
        <div className="mt-2">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Recent</div>
          <div className="flex max-w-md flex-wrap justify-center gap-2">
            {recents.map((ticker) => (
              <button
                key={ticker.symbol}
                type="button"
                onClick={() => onSelect(ticker.symbol)}
                title={ticker.name || undefined}
                className="rounded-full border border-border bg-surface-raised px-3 py-1 text-sm font-medium text-secondary outline-none transition-colors hover:border-accent/50 hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
              >
                {ticker.symbol}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
