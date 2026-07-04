export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';

/** Fired on window whenever the applied theme (data-theme attribute) changes. */
export const THEME_CHANGE_EVENT = 'app-themechange';

export const THEME_CYCLE: Record<ThemePreference, ThemePreference> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

export function loadThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* localStorage unavailable */
  }
  return 'system';
}

export function persistThemePreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* localStorage unavailable */
  }
}

/**
 * Applies the preference to <html> ("system" removes the override so
 * prefers-color-scheme wins) and notifies listeners (e.g. charts).
 */
export function applyThemePreference(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'system') delete root.dataset.theme;
  else root.dataset.theme = preference;
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}
