import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  ariaLabel?: string;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  /** May be undefined (no option selected yet). */
  value: T | undefined;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Radiogroup-semantics segmented control with a sliding active pill.
 * Keyboard: arrows move & select (roving tabindex), Home/End jump.
 */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: SegmentedControlProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const activeIndex = options.findIndex((option) => option.value === value);

  const measure = useCallback(() => {
    const group = groupRef.current;
    const target = activeIndex >= 0
      ? group?.querySelectorAll<HTMLElement>('[role="radio"]')[activeIndex]
      : undefined;
    // offsetWidth of 0 → not measurable (e.g. jsdom); buttons fall back to a static background
    if (!target || target.offsetWidth === 0) {
      setPill(null);
      return;
    }
    setPill({ left: target.offsetLeft, width: target.offsetWidth });
  }, [activeIndex]);

  useLayoutEffect(() => {
    // Measuring the active option and mirroring it into state is the point of
    // this layout effect (DOM → overlay position); it settles in one pass.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure();
    const group = groupRef.current;
    if (!group || !('ResizeObserver' in window)) return;
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    return () => observer.disconnect();
  }, [measure, options.length]);

  const focusOption = (index: number) => {
    groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[index]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (options.length === 0) return;
    const current = activeIndex >= 0 ? activeIndex : 0;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (current + 1) % options.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (current - 1 + options.length) % options.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = options.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(options[next].value);
    focusOption(next);
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={`relative flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5 ${className}`}
    >
      {pill && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0.5 z-0 rounded-md bg-accent transition-[left,width] duration-200 ease-out motion-reduce:transition-none"
          style={{ left: pill.left, width: pill.width }}
        />
      )}
      {options.map((option, index) => {
        const active = index === activeIndex;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.ariaLabel}
            tabIndex={active || (activeIndex < 0 && index === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={`relative z-10 inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent sm:px-2.5 sm:text-sm ${
              active
                ? `text-accent-foreground ${pill ? '' : 'bg-accent'}`
                : 'text-muted hover:text-primary'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
