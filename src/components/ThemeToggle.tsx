import { useTheme } from '../hooks/useTheme';
import { THEME_CYCLE, type ThemePreference } from '../lib/theme';

const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'System theme',
  light: 'Light theme',
  dark: 'Dark theme',
};

function ThemeIcon({ theme }: { theme: ThemePreference }) {
  const common = {
    className: 'h-4 w-4',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (theme === 'light') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }
  if (theme === 'dark') {
    return (
      <svg {...common}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <path d="M8 22h8m-4-4v4" />
    </svg>
  );
}

/** Cycling theme toggle: system → light → dark → system. */
export default function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();
  const next = THEME_CYCLE[theme];

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={`${THEME_LABELS[theme]} active — switch to ${THEME_LABELS[next].toLowerCase()}`}
      title={`${THEME_LABELS[theme]} — click for ${THEME_LABELS[next].toLowerCase()}`}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-secondary outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-accent"
    >
      <ThemeIcon theme={theme} />
    </button>
  );
}
