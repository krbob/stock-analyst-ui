import { useCallback, useEffect, useState } from 'react';
import {
  applyThemePreference,
  loadThemePreference,
  persistThemePreference,
  THEME_CYCLE,
  type ThemePreference,
} from '../lib/theme';

export interface UseThemeResult {
  theme: ThemePreference;
  setTheme: (preference: ThemePreference) => void;
  /** Cycles system → light → dark → system. */
  cycleTheme: () => void;
}

export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<ThemePreference>(loadThemePreference);

  useEffect(() => {
    applyThemePreference(theme);
  }, [theme]);

  const setTheme = useCallback((preference: ThemePreference) => {
    persistThemePreference(preference);
    setThemeState(preference);
  }, []);

  const cycleTheme = useCallback(() => {
    setTheme(THEME_CYCLE[theme]);
  }, [theme, setTheme]);

  return { theme, setTheme, cycleTheme };
}
