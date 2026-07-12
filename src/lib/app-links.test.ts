import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildPortfolioHref,
  configuredPortfolioUrl,
  currentAppLinkPreferences,
} from './app-links';

describe('buildPortfolioHref', () => {
  const preferences = { theme: 'dark' as const, locale: 'pl-pl' };

  it('preserves configured path/query/hash and adds portable UI preferences', () => {
    expect(buildPortfolioHref(
      'https://portfolio.example/app?tenant=personal#holdings',
      preferences,
      'https://stocks.example',
    )).toBe('https://portfolio.example/app?tenant=personal&uiTheme=dark&uiLocale=pl-PL#holdings');
  });

  it('supports a same-origin root-relative deployment without making it absolute', () => {
    expect(buildPortfolioHref('/portfolio/', { theme: 'system', locale: 'en-GB' }, 'https://apps.example'))
      .toBe('/portfolio/?uiTheme=system&uiLocale=en-GB');
  });

  it.each([
    undefined,
    '',
    'portfolio.example',
    '//portfolio.example',
    'javascript:alert(1)',
    'data:text/html,hello',
    'https://user:secret@portfolio.example',
    'https://portfolio.example/\nmalformed',
  ])('rejects unsafe or ambiguous runtime URL %s', (url) => {
    expect(buildPortfolioHref(url, preferences, 'https://stocks.example')).toBeNull();
  });

  it('replaces untrusted preference params already present in the configured URL', () => {
    expect(buildPortfolioHref(
      'https://portfolio.example/?uiTheme=evil&uiLocale=evil',
      preferences,
      'https://stocks.example',
    )).toBe('https://portfolio.example/?uiTheme=dark&uiLocale=pl-PL');
  });

  it('falls back to a valid locale when the supplied tag is malformed', () => {
    expect(buildPortfolioHref(
      'https://portfolio.example',
      { theme: 'light', locale: 'not_a_locale' },
      'https://stocks.example',
    )).toBe('https://portfolio.example/?uiTheme=light&uiLocale=en');
  });
});

describe('app-link preferences and configuration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.__STOCK_ANALYST_CONFIG__ = undefined;
    document.documentElement.lang = 'en';
  });

  it('reads the current document locale and persisted theme without sharing domain state', () => {
    document.documentElement.lang = 'pl-PL';
    vi.stubGlobal('localStorage', { getItem: () => 'dark' });

    expect(currentAppLinkPreferences()).toEqual({ theme: 'dark', locale: 'pl-PL' });
  });

  it('uses runtime configuration when present', () => {
    window.__STOCK_ANALYST_CONFIG__ = { portfolioUrl: '/portfolio' };

    expect(configuredPortfolioUrl()).toBe('/portfolio');
  });
});
