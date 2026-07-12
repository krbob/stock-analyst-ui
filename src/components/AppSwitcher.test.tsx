import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppSwitcher from './AppSwitcher';
import { THEME_CHANGE_EVENT } from '../lib/theme';

function createStorageMock(initialTheme?: string): Storage {
  const values = new Map<string, string>();
  if (initialTheme) values.set('theme', initialTheme);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    clear: () => { values.clear(); },
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

describe('AppSwitcher', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock('dark'));
    document.documentElement.lang = 'pl-PL';
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.documentElement.lang = 'en';
  });

  it('renders a native accessible link carrying only UI preferences', () => {
    render(<AppSwitcher configuredUrl="https://portfolio.example/app?tenant=personal" />);

    const link = screen.getByRole('link', { name: 'Open Portfolio application' });
    expect(link).toHaveAttribute(
      'href',
      'https://portfolio.example/app?tenant=personal&uiTheme=dark&uiLocale=pl-PL',
    );
    expect(link).toHaveAttribute('title', 'Switch to Portfolio');
    expect(link).not.toHaveAttribute('target');
  });

  it('updates the hand-off after a theme change', async () => {
    render(<AppSwitcher configuredUrl="/portfolio" />);
    localStorage.setItem('theme', 'light');

    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));

    await waitFor(() => expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/portfolio?uiTheme=light&uiLocale=pl-PL',
    ));
  });

  it('does not expose a broken or unsafe switch when configuration is absent', () => {
    const { container, rerender } = render(<AppSwitcher configuredUrl="" />);
    expect(container).toBeEmptyDOMElement();

    rerender(<AppSwitcher configuredUrl="javascript:alert(1)" />);
    expect(container).toBeEmptyDOMElement();
  });
});
