import type { ReactNode } from 'react';

interface ToggleButtonProps {
  pressed: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
  title?: string;
  className?: string;
}

/** Icon + label toggle button with aria-pressed semantics. */
export default function ToggleButton({ pressed, onClick, icon, children, title, className = '' }: ToggleButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={title}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent sm:px-2.5 sm:text-sm ${
        pressed
          ? 'border-accent/40 bg-accent/15 text-accent'
          : 'border-border bg-surface text-muted hover:text-primary'
      } ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}
