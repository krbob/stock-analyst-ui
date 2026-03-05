import { useState, useRef, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { useTickerSearch } from '../api/queries';

interface TickerSearchProps {
  onSelect: (symbol: string) => void;
}

export default function TickerSearch({ onSelect }: TickerSearchProps) {
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(input.trim(), 300);
  const { data: results = [] } = useTickerSearch(debouncedQuery);

  const showDropdown = isOpen && input.trim().length > 0 && results.length > 0;

  const selectSymbol = useCallback((symbol: string) => {
    setInput(symbol);
    setIsOpen(false);
    setActiveIndex(-1);
    onSelect(symbol);
  }, [onSelect]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed) {
      setIsOpen(false);
      setActiveIndex(-1);
      onSelect(trimmed);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!showDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case 'Enter':
        if (activeIndex >= 0 && activeIndex < results.length) {
          e.preventDefault();
          selectSymbol(results[activeIndex].symbol);
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
            <ul
              id="ticker-search-listbox"
              role="listbox"
              className="max-h-60 overflow-y-auto"
            >
              {results.map((result, index) => (
                <li
                  key={result.symbol}
                  id={`ticker-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSymbol(result.symbol);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
                    index === activeIndex
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <div className="min-w-0 truncate">
                    <span className="font-medium text-white">{result.symbol}</span>
                    <span className="ml-2 text-gray-400">{result.name}</span>
                  </div>
                  <span className="ml-2 shrink-0 text-xs text-gray-500">
                    {result.exchange}
                  </span>
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
