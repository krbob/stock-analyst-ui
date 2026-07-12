import { useState, useRef, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { useTickerSearch } from '../api/queries';
import {
  addRecentTicker as addRecent,
  loadRecentTickers as loadRecents,
  removeRecentTicker as removeRecent,
} from '../lib/ticker-recents';

interface TickerSearchProps {
  onSelect: (symbol: string) => void;
  className?: string;
}

export default function TickerSearch({ onSelect, className = '' }: TickerSearchProps) {
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recents, setRecents] = useState(loadRecents);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(input.trim(), 300);
  const {
    data: results = [],
    isFetching,
    isError,
    error,
    refetch,
  } = useTickerSearch(debouncedQuery);

  const hasQuery = input.trim().length > 0;
  const isCurrentQuery = debouncedQuery === input.trim();
  const showSearchError = isOpen && hasQuery && isCurrentQuery && !isFetching && isError;
  const showSearchResults = isOpen && hasQuery && !showSearchError && results.length > 0;
  const showRecents = isOpen && !hasQuery && recents.length > 0;
  const showSearching = isOpen && hasQuery && isCurrentQuery && isFetching;
  const showNoResults = isOpen && hasQuery && isCurrentQuery && !isFetching && !isError && results.length === 0;
  const showDropdown = showSearchResults || showRecents || showSearching || showNoResults || showSearchError;

  const items = showSearchResults ? results : showRecents ? recents : [];

  const selectSymbol = useCallback((symbol: string, name?: string, exchange?: string) => {
    setInput(symbol);
    setIsOpen(false);
    setActiveIndex(-1);
    setRecents(addRecent({ symbol, name: name ?? '', exchange: exchange ?? '' }));
    inputRef.current?.blur();
    onSelect(symbol);
  }, [onSelect]);

  const handleRemoveRecent = useCallback((symbol: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRecents(removeRecent(symbol));
    setActiveIndex(-1);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed) {
      const upper = trimmed.toUpperCase();
      setIsOpen(false);
      setActiveIndex(-1);
      setRecents(addRecent({ symbol: upper, name: '', exchange: '' }));
      inputRef.current?.blur();
      onSelect(upper);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!showDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
        break;
      case 'Enter':
        if (activeIndex >= 0 && activeIndex < items.length) {
          e.preventDefault();
          const item = items[activeIndex];
          selectSymbol(item.symbol, item.name, item.exchange);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`relative flex min-w-0 gap-2 ${className}`}>
      <div className="relative min-w-0 flex-1">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            if (document.activeElement === inputRef.current) return;
            if (input.length === 0) return;
            setInput('');
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onChange={(e) => {
            setInput(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 150);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ticker"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-label="Search ticker"
          aria-busy={showSearching}
          aria-invalid={showSearchError || undefined}
          aria-describedby={showSearchError ? 'ticker-search-error' : undefined}
          aria-controls={showSearchError ? 'ticker-search-error' : 'ticker-search-listbox'}
          aria-activedescendant={
            activeIndex >= 0 ? `ticker-option-${activeIndex}` : undefined
          }
          className="w-full min-w-0 rounded-md border border-border-strong bg-surface-raised px-3 py-1.5 text-base text-primary placeholder-muted focus:border-accent focus:outline-none sm:w-auto sm:text-sm"
        />

        {showDropdown && (
          <div className="absolute left-0 top-full z-50 mt-1 w-[calc(100vw-1.5rem)] max-w-72 overflow-hidden rounded-lg border border-border bg-surface-raised shadow-lg sm:left-auto sm:right-0 sm:w-72">
            {showRecents && (
              <div className="px-3 py-1.5 text-xs text-muted">Recent</div>
            )}
            {showSearchError && (
              <div id="ticker-search-error" role="alert" className="px-3 py-2 text-sm">
                <div className="font-medium text-danger">Ticker search unavailable</div>
                <div className="mt-0.5 break-words text-muted">
                  {error instanceof Error ? error.message : 'Check your connection and try again.'}
                </div>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => { void refetch(); }}
                  className="mt-2 rounded-md border border-border-strong px-2 py-1 text-xs font-medium text-secondary outline-none hover:bg-surface hover:text-primary focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Retry search
                </button>
              </div>
            )}
            {!showSearchError && <ul
              id="ticker-search-listbox"
              role="listbox"
              className="max-h-60 overflow-y-auto"
            >
              {showSearching && (
                <li className="px-3 py-2 text-sm text-muted">Searching...</li>
              )}
              {showNoResults && (
                <li className="px-3 py-2 text-sm text-muted">No tickers found</li>
              )}
              {items.map((item, index) => (
                <li
                  key={item.symbol}
                  id={`ticker-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSymbol(item.symbol, item.name, item.exchange);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
                    index === activeIndex
                      ? 'bg-surface text-primary'
                      : 'text-secondary hover:bg-surface hover:text-primary'
                  }`}
                >
                  <div className="min-w-0 truncate">
                    <span className="font-medium text-primary">{item.symbol}</span>
                    {item.name && <span className="ml-2 text-secondary">{item.name}</span>}
                  </div>
                  <div className="ml-2 flex shrink-0 items-center gap-1">
                    {item.exchange && (
                      <span className="text-xs text-muted">{item.exchange}</span>
                    )}
                    {showRecents && (
                      <button
                        type="button"
                        onMouseDown={(e) => handleRemoveRecent(item.symbol, e)}
                        className="ml-1 rounded p-0.5 text-muted hover:bg-border hover:text-primary"
                        aria-label={`Remove ${item.symbol}`}
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>}
          </div>
        )}
      </div>

      <button
        type="submit"
        className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-4"
      >
        Go
      </button>
    </form>
  );
}
