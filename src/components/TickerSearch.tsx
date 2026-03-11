import { useState, useRef, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { useTickerSearch } from '../api/queries';

const RECENTS_KEY = 'recentTickers';
const MAX_RECENTS = 8;

interface RecentTicker {
  symbol: string;
  name: string;
  exchange: string;
}

function loadRecents(): RecentTicker[] {
  try {
    const stored = localStorage.getItem(RECENTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecents(items: RecentTicker[]) {
  localStorage.setItem(RECENTS_KEY, JSON.stringify(items));
}

function addRecent(ticker: RecentTicker): RecentTicker[] {
  const recents = loadRecents().filter((t) => t.symbol !== ticker.symbol);
  recents.unshift(ticker);
  const trimmed = recents.slice(0, MAX_RECENTS);
  saveRecents(trimmed);
  return trimmed;
}

function removeRecent(symbol: string): RecentTicker[] {
  const recents = loadRecents().filter((t) => t.symbol !== symbol);
  saveRecents(recents);
  return recents;
}

interface TickerSearchProps {
  onSelect: (symbol: string) => void;
}

export default function TickerSearch({ onSelect }: TickerSearchProps) {
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recents, setRecents] = useState(loadRecents);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(input.trim(), 300);
  const { data: results = [] } = useTickerSearch(debouncedQuery);

  const hasQuery = input.trim().length > 0;
  const showSearchResults = isOpen && hasQuery && results.length > 0;
  const showRecents = isOpen && !hasQuery && recents.length > 0;
  const showDropdown = showSearchResults || showRecents;

  const items = showSearchResults ? results : showRecents ? recents : [];

  const selectSymbol = useCallback((symbol: string, name?: string, exchange?: string) => {
    setInput(symbol);
    setIsOpen(false);
    setActiveIndex(-1);
    setRecents(addRecent({ symbol, name: name ?? '', exchange: exchange ?? '' }));
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
      setIsOpen(false);
      setActiveIndex(-1);
      setRecents(addRecent({ symbol: trimmed, name: '', exchange: '' }));
      onSelect(trimmed);
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
    <form onSubmit={handleSubmit} className="relative flex gap-2">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={input}
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
          aria-controls="ticker-search-listbox"
          aria-activedescendant={
            activeIndex >= 0 ? `ticker-option-${activeIndex}` : undefined
          }
          className="w-24 rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-base text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none sm:w-auto sm:text-sm"
        />

        {showDropdown && (
          <div className="absolute right-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-md border border-gray-700 bg-gray-900 shadow-lg">
            {showRecents && (
              <div className="px-3 py-1.5 text-xs text-gray-500">Recent</div>
            )}
            <ul
              id="ticker-search-listbox"
              role="listbox"
              className="max-h-60 overflow-y-auto"
            >
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
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <div className="min-w-0 truncate">
                    <span className="font-medium text-white">{item.symbol}</span>
                    {item.name && <span className="ml-2 text-gray-400">{item.name}</span>}
                  </div>
                  <div className="ml-2 flex shrink-0 items-center gap-1">
                    {item.exchange && (
                      <span className="text-xs text-gray-500">{item.exchange}</span>
                    )}
                    {showRecents && (
                      <button
                        type="button"
                        onMouseDown={(e) => handleRemoveRecent(item.symbol, e)}
                        className="ml-1 rounded p-0.5 text-gray-600 hover:bg-gray-700 hover:text-gray-300"
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
            </ul>
          </div>
        )}
      </div>

      <button
        type="submit"
        className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium hover:bg-blue-500 transition-colors"
      >
        Go
      </button>
    </form>
  );
}
