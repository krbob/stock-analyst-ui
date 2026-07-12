import { useEffect, useState } from 'react';
import { buildPortfolioHref, configuredPortfolioUrl } from '../lib/app-links';
import { THEME_CHANGE_EVENT } from '../lib/theme';

interface AppSwitcherProps {
  configuredUrl?: string;
}

function PortfolioIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" />
    </svg>
  );
}

export default function AppSwitcher({ configuredUrl = configuredPortfolioUrl() }: AppSwitcherProps) {
  const [href, setHref] = useState(() => buildPortfolioHref(configuredUrl));

  useEffect(() => {
    const updateHref = () => setHref(buildPortfolioHref(configuredUrl));
    window.addEventListener(THEME_CHANGE_EVENT, updateHref);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, updateHref);
  }, [configuredUrl]);

  if (!href) return null;

  return (
    <a
      href={href}
      aria-label="Open Portfolio application"
      title="Switch to Portfolio"
      className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-2 text-sm font-medium text-secondary outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-accent sm:px-2.5"
    >
      <PortfolioIcon />
      <span>Portfolio</span>
    </a>
  );
}
