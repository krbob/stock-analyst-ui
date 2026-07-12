import { lazy, Suspense } from 'react';
import type { CompareViewProps } from './CompareView';
import type { PriceChartProps } from './PriceChart';
import type { StockDetailsProps } from './StockDetails';

const PriceChart = lazy(() => import('./PriceChart'));
const CompareView = lazy(() => import('./CompareView'));
const StockDetails = lazy(() => import('./StockDetails'));

interface ModuleFallbackProps {
  label: string;
  className: string;
}

export function ModuleFallback({ label, className }: ModuleFallbackProps) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className={`flex items-center justify-center ${className}`}>
      <span aria-hidden="true" className="h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function LazyPriceChart(props: PriceChartProps) {
  return (
    <Suspense
      fallback={(
        <ModuleFallback
          label="Loading price chart"
          className="h-[350px] w-full bg-chart-bg sm:h-[500px]"
        />
      )}
    >
      <PriceChart {...props} />
    </Suspense>
  );
}

export function LazyCompareView(props: CompareViewProps) {
  return (
    <Suspense
      fallback={(
        <ModuleFallback
          label="Loading comparison view"
          className="h-[300px] w-full rounded-xl border border-border bg-chart-bg shadow-sm sm:h-[400px]"
        />
      )}
    >
      <CompareView {...props} />
    </Suspense>
  );
}

export function LazyStockDetails(props: StockDetailsProps) {
  return (
    <Suspense
      fallback={(
        <ModuleFallback
          label="Loading stock details"
          className="mt-4 h-48 w-full rounded-xl border border-border bg-surface-raised shadow-sm"
        />
      )}
    >
      <StockDetails {...props} />
    </Suspense>
  );
}
