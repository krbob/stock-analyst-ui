import { useState, useRef, useEffect, useCallback, useId, type KeyboardEvent } from 'react';
import { CURRENCIES, getCurrencyName } from '../data/currencies';
import { addRecentItem, loadRecentItems, removeRecentItem } from '../lib/recents';

const RECENTS_KEY = 'recentCurrencies';
const MAX_RECENTS = 5;

function normalizeCurrencyCode(code: string): string {
  return code.trim().toUpperCase();
}

const recentCurrencyOptions = {
  maxItems: MAX_RECENTS,
  normalize: (value: unknown): string | null => (
    typeof value === 'string' && value.trim() !== '' ? normalizeCurrencyCode(value) : null
  ),
  keyOf: (code: string) => code,
};

function loadRecents(): string[] {
  return loadRecentItems(RECENTS_KEY, recentCurrencyOptions);
}

function addRecent(code: string): string[] {
  return addRecentItem(RECENTS_KEY, normalizeCurrencyCode(code), recentCurrencyOptions);
}

function removeRecent(code: string): string[] {
  return removeRecentItem(RECENTS_KEY, normalizeCurrencyCode(code), recentCurrencyOptions);
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
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const focusFrameRef = useRef<number | null>(null);

  const displayCode = value ?? nativeCurrency ?? 'Currency';

  useEffect(() => {
    if (isOpen) {
      focusFrameRef.current = requestAnimationFrame(() => searchRef.current?.focus());
    }
    return () => {
      if (focusFrameRef.current != null) cancelAnimationFrame(focusFrameRef.current);
    };
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

  const closePicker = (restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const select = (code: string) => {
    const normalizedCode = normalizeCurrencyCode(code);
    if (nativeCurrency && normalizedCode === nativeCurrency.toUpperCase()) {
      onChange(undefined);
    } else {
      onChange(normalizedCode);
      try {
        setRecents(addRecent(normalizedCode));
      } catch {
        // Storage can be unavailable or full; selection must still succeed.
      }
    }
    closePicker(true);
  };

  const selectableOptions = (): HTMLButtonElement[] =>
    Array.from(listboxRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const options = selectableOptions();
    if (event.key === 'ArrowDown' && options.length > 0) {
      event.preventDefault();
      options[0].focus();
    } else if (event.key === 'ArrowUp' && options.length > 0) {
      event.preventDefault();
      options.at(-1)?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closePicker(true);
    }
  };

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const options = selectableOptions();
    const currentIndex = options.indexOf(event.currentTarget);
    if (event.key === 'Escape') {
      event.preventDefault();
      closePicker(true);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const nextIndex = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? options.length - 1
          : event.key === 'ArrowDown'
            ? (currentIndex + 1) % options.length
            : (currentIndex - 1 + options.length) % options.length;
      options[nextIndex]?.focus();
    }
  };

  const toggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) setSearch('');
      return next;
    });
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
  const showNoResults = filtered.length === 0 && recentCurrencies.length === 0
    && (!nativeCurrency || (query && !nativeCurrency.toLowerCase().includes(query) && !getCurrencyName(nativeCurrency).toLowerCase().includes(query)));

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? listboxId : undefined}
        aria-label="Select currency"
        className="inline-flex h-8 shrink-0 items-center rounded-md border border-border-strong bg-surface-raised px-2.5 text-sm text-secondary transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {displayCode}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-border bg-surface-raised shadow-lg sm:left-0 sm:right-auto">
          <div className="border-b border-border p-2">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search currency..."
              aria-label="Search currency"
              aria-controls={listboxId}
              onKeyDown={handleSearchKeyDown}
              className="w-full rounded border border-border-strong bg-surface px-2 py-1 text-sm text-primary placeholder-muted focus:border-accent focus:outline-none"
            />
          </div>

          <div ref={listboxRef} id={listboxId} role="listbox" aria-label="Currencies" className="max-h-64 overflow-y-auto">
            {/* Native currency — always on top */}
            {nativeCurrency && (!query || nativeCurrency.toLowerCase().includes(query) || getCurrencyName(nativeCurrency).toLowerCase().includes(query)) && (
              <button
                type="button"
                role="option"
                aria-selected={!value}
                onClick={() => select(nativeCurrency)}
                onKeyDown={handleOptionKeyDown}
                className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-surface ${
                  !value ? 'bg-surface/70 text-primary' : 'text-secondary'
                } w-full text-left`}
              >
                <span>
                  <span className="font-bold text-primary">{nativeCurrency}</span>
                  <span className="ml-2 text-secondary">{getCurrencyName(nativeCurrency)}</span>
                </span>
                <span className="text-xs text-accent">default</span>
              </button>
            )}
            {/* No conversion option — when no native currency */}
            {!nativeCurrency && (
              <button
                type="button"
                role="option"
                aria-selected={!value}
                onClick={() => { onChange(undefined); closePicker(true); }}
                onKeyDown={handleOptionKeyDown}
                className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-surface ${
                  !value ? 'bg-surface/70 text-primary' : 'text-secondary'
                } w-full text-left`}
              >
                <span className="text-secondary">No conversion</span>
              </button>
            )}

            {/* Recent currencies */}
            {recentCurrencies.length > 0 && (
              <>
                <div className="border-t border-border/70 px-3 py-1 text-xs text-muted">Recent</div>
                {recentCurrencies.map((code) => (
                  <div key={`recent-${code}`} className="flex items-center">
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === code}
                      onClick={() => select(code)}
                      onKeyDown={handleOptionKeyDown}
                      className={`flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm hover:bg-surface ${
                        value === code ? 'bg-surface/70 text-primary' : 'text-secondary'
                      } min-w-0 grow text-left`}
                    >
                      <div className="min-w-0 truncate">
                        <span className="font-medium">{code}</span>
                        <span className="ml-2 text-secondary">{getCurrencyName(code)}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        try {
                          setRecents(removeRecent(code));
                        } catch {
                          // Keep the picker usable when storage cannot be written.
                        }
                      }}
                      className="ml-1 shrink-0 rounded p-0.5 text-muted hover:bg-border hover:text-primary"
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
            <div className="border-t border-border/70 px-3 py-1 text-xs text-muted">All currencies</div>
            {showNoResults && (
              <div className="px-3 py-2 text-sm text-muted">No currencies found</div>
            )}
            {filtered.map((c) => (
              <button
                type="button"
                role="option"
                aria-selected={value === c.code || (!value && c.code === nativeCurrency)}
                key={c.code}
                onClick={() => select(c.code)}
                onKeyDown={handleOptionKeyDown}
                className={`flex cursor-pointer items-center px-3 py-1.5 text-sm hover:bg-surface ${
                  (value === c.code || (!value && c.code === nativeCurrency)) ? 'bg-surface/70 text-primary' : 'text-secondary'
                } w-full text-left`}
              >
                <span className="font-medium">{c.code}</span>
                <span className="ml-2 truncate text-secondary">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
