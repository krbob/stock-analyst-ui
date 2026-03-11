import { useState, useRef, useEffect, useCallback } from 'react';
import { CURRENCIES, getCurrencyName } from '../data/currencies';

const RECENTS_KEY = 'recentCurrencies';
const MAX_RECENTS = 5;

function loadRecents(): string[] {
  try {
    const stored = localStorage.getItem(RECENTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecents(codes: string[]) {
  localStorage.setItem(RECENTS_KEY, JSON.stringify(codes));
}

function addRecent(code: string): string[] {
  const recents = loadRecents().filter((c) => c !== code);
  recents.unshift(code);
  const trimmed = recents.slice(0, MAX_RECENTS);
  saveRecents(trimmed);
  return trimmed;
}

function removeRecent(code: string): string[] {
  const recents = loadRecents().filter((c) => c !== code);
  saveRecents(recents);
  return recents;
}

interface CurrencyPickerProps {
  nativeCurrency: string | null;
  value: string | undefined;
  onChange: (currency: string | undefined) => void;
}

export default function CurrencyPicker({ nativeCurrency, value, onChange }: CurrencyPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [recents, setRecents] = useState(loadRecents);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const displayCode = value ?? nativeCurrency;

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, handleClickOutside]);

  const select = (code: string) => {
    if (nativeCurrency && code.toUpperCase() === nativeCurrency.toUpperCase()) {
      onChange(undefined);
    } else {
      onChange(code);
      setRecents(addRecent(code));
    }
    setIsOpen(false);
  };

  const query = search.toLowerCase();
  const filtered = query
    ? CURRENCIES.filter(
        (c) => c.code.toLowerCase().includes(query) || c.name.toLowerCase().includes(query),
      )
    : CURRENCIES;

  const recentCurrencies = recents
    .filter((code) => !nativeCurrency || code.toUpperCase() !== nativeCurrency.toUpperCase())
    .filter((code) => !query || code.toLowerCase().includes(query) || getCurrencyName(code).toLowerCase().includes(query));

  if (!nativeCurrency) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-md border border-gray-700 bg-gray-900 px-2 py-0.5 text-sm text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
      >
        {displayCode}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-md border border-gray-700 bg-gray-900 shadow-lg">
          <div className="border-b border-gray-700 p-2">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search currency..."
              className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {/* Native currency — always on top */}
            {(!query || nativeCurrency.toLowerCase().includes(query) || getCurrencyName(nativeCurrency).toLowerCase().includes(query)) && (
              <div
                onMouseDown={(e) => { e.preventDefault(); select(nativeCurrency); }}
                className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-gray-800 ${
                  !value ? 'bg-gray-800/50 text-white' : 'text-gray-300'
                }`}
              >
                <span>
                  <span className="font-bold text-white">{nativeCurrency}</span>
                  <span className="ml-2 text-gray-400">{getCurrencyName(nativeCurrency)}</span>
                </span>
                <span className="text-xs text-blue-400">default</span>
              </div>
            )}

            {/* Recent currencies */}
            {recentCurrencies.length > 0 && (
              <>
                <div className="border-t border-gray-700/50 px-3 py-1 text-xs text-gray-500">Recent</div>
                {recentCurrencies.map((code) => (
                  <div
                    key={`recent-${code}`}
                    onMouseDown={(e) => { e.preventDefault(); select(code); }}
                    className={`flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm hover:bg-gray-800 ${
                      value === code ? 'bg-gray-800/50 text-white' : 'text-gray-300'
                    }`}
                  >
                    <div className="min-w-0 truncate">
                      <span className="font-medium">{code}</span>
                      <span className="ml-2 text-gray-400">{getCurrencyName(code)}</span>
                    </div>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setRecents(removeRecent(code));
                      }}
                      className="ml-1 shrink-0 rounded p-0.5 text-gray-600 hover:bg-gray-700 hover:text-gray-300"
                      aria-label={`Remove ${code}`}
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* All currencies */}
            <div className="border-t border-gray-700/50 px-3 py-1 text-xs text-gray-500">All currencies</div>
            {filtered.map((c) => (
              <div
                key={c.code}
                onMouseDown={(e) => { e.preventDefault(); select(c.code); }}
                className={`flex cursor-pointer items-center px-3 py-1.5 text-sm hover:bg-gray-800 ${
                  (value === c.code || (!value && c.code === nativeCurrency)) ? 'bg-gray-800/50 text-white' : 'text-gray-300'
                }`}
              >
                <span className="font-medium">{c.code}</span>
                <span className="ml-2 truncate text-gray-400">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
