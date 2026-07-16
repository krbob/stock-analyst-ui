import { loadThemePreference, type ThemePreference } from './theme';

export interface AppLinkPreferences {
  theme: ThemePreference;
  locale: string;
}

function canonicalLocale(locale: string): string {
  try {
    return Intl.getCanonicalLocales(locale.trim())[0] ?? 'en';
  } catch {
    return 'en';
  }
}

export function currentAppLinkPreferences(): AppLinkPreferences {
  const locale = navigator.languages?.find((candidate) => candidate.trim())
    || navigator.language.trim()
    || document.documentElement.lang.trim()
    || 'en';
  return {
    theme: loadThemePreference(),
    locale: canonicalLocale(locale),
  };
}

/**
 * Builds a navigation-only app link. The allow-list deliberately excludes
 * executable schemes, protocol-relative URLs and embedded credentials.
 */
export function buildPortfolioHref(
  configuredUrl: string | undefined,
  preferences: AppLinkPreferences = currentAppLinkPreferences(),
  currentOrigin: string = window.location.origin,
): string | null {
  const raw = configuredUrl?.trim();
  if (!raw || [...raw].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  })) return null;

  const isRootRelative = raw.startsWith('/') && !raw.startsWith('//');
  const isHttpAbsolute = /^https?:\/\//i.test(raw);
  if (!isRootRelative && !isHttpAbsolute) return null;

  try {
    const target = new URL(raw, currentOrigin);
    if (!['http:', 'https:'].includes(target.protocol)) return null;
    if (target.username || target.password) return null;

    target.searchParams.set('uiTheme', preferences.theme);
    target.searchParams.set('uiLocale', canonicalLocale(preferences.locale));

    if (isRootRelative && target.origin === currentOrigin) {
      return `${target.pathname}${target.search}${target.hash}`;
    }
    return target.toString();
  } catch {
    return null;
  }
}

export function configuredPortfolioUrl(): string | undefined {
  const runtimeUrl = window.__STOCK_ANALYST_CONFIG__?.portfolioUrl;
  if (typeof runtimeUrl === 'string' && runtimeUrl.trim()) return runtimeUrl;

  const buildTimeUrl = import.meta.env.VITE_PORTFOLIO_URL;
  return typeof buildTimeUrl === 'string' && buildTimeUrl.trim() ? buildTimeUrl : undefined;
}
