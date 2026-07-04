import { useEffect, useId, useRef, useState } from 'react';
import { INDICATOR_COLORS } from '../lib/chart-theme';

export interface IndicatorGroup {
  label: string;
  keys: string[];
}

/** Palette chips shown next to each indicator group, matching the chart colors. */
function chipColors(keys: string[]): string[] {
  return keys.flatMap((key) => {
    if (key === 'bb') return [INDICATOR_COLORS.bb_upper, INDICATOR_COLORS.bb_middle];
    if (key === 'macd') return [INDICATOR_COLORS.macd, INDICATOR_COLORS.macd_signal];
    const color = INDICATOR_COLORS[key];
    return color ? [color] : [];
  });
}

interface IndicatorsPopoverProps {
  groups: readonly IndicatorGroup[];
  active: Set<string>;
  onToggleGroup: (keys: string[]) => void;
}

export default function IndicatorsPopover({ groups, active, onToggleGroup }: IndicatorsPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const activeCount = groups.filter((group) => group.keys.every((key) => active.has(key))).length;

  // Outside click + Escape close the panel; Escape restores focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>('input')?.focus();
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="true"
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent sm:px-2.5 sm:text-sm ${
          activeCount > 0
            ? 'border-accent/40 bg-accent/15 text-accent'
            : 'border-border bg-surface text-muted hover:text-primary'
        }`}
      >
        <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M1 14h6m2-6h6m2 8h6" />
        </svg>
        Indicators
        {activeCount > 0 && (
          <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-4 text-accent-foreground">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="group"
          aria-label="Chart indicators"
          className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-surface-raised p-1.5 shadow-lg"
        >
          {groups.map((group) => {
            const isActive = group.keys.every((key) => active.has(key));
            return (
              <label
                key={group.label}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-secondary transition-colors hover:bg-surface"
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => onToggleGroup(group.keys)}
                  className="h-3.5 w-3.5 accent-accent outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                <span className="flex-1 text-primary">{group.label}</span>
                <span className="flex items-center gap-1">
                  {chipColors(group.keys).map((color, index) => (
                    <span
                      key={index}
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
