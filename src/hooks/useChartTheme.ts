import { useEffect, useState } from 'react';
import { chartThemesEqual, readChartTheme, subscribeChartTheme, type ChartTheme } from '../lib/chart-theme';

/**
 * Resolved chart colors from the CSS design tokens.
 * Re-reads the tokens whenever the app theme or the OS color scheme changes;
 * identity is preserved when the resolved colors are unchanged so chart
 * effects do not rebuild needlessly.
 */
export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(readChartTheme);

  useEffect(() => subscribeChartTheme(() => {
    const next = readChartTheme();
    setTheme((prev) => (chartThemesEqual(prev, next) ? prev : next));
  }), []);

  return theme;
}
