import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LazyCompareView, LazyPriceChart, LazyStockDetails } from './LazyAnalysisViews';

const deferredModules = vi.hoisted(() => {
  let resolvePriceChart: (module: { default: () => React.ReactNode }) => void = () => {};
  let resolveCompareView: (module: { default: () => React.ReactNode }) => void = () => {};
  let resolveStockDetails: (module: { default: () => React.ReactNode }) => void = () => {};

  const priceChart = new Promise<{ default: () => React.ReactNode }>((resolve) => {
    resolvePriceChart = resolve;
  });
  const compareView = new Promise<{ default: () => React.ReactNode }>((resolve) => {
    resolveCompareView = resolve;
  });
  const stockDetails = new Promise<{ default: () => React.ReactNode }>((resolve) => {
    resolveStockDetails = resolve;
  });

  return {
    priceChart,
    compareView,
    stockDetails,
    resolvePriceChart,
    resolveCompareView,
    resolveStockDetails,
  };
});

vi.mock('./PriceChart', () => deferredModules.priceChart);
vi.mock('./CompareView', () => deferredModules.compareView);
vi.mock('./StockDetails', () => deferredModules.stockDetails);

afterEach(cleanup);

describe('lazy analysis views', () => {
  it('shows an accessible, size-preserving fallback until the price chart module loads', async () => {
    render(<LazyPriceChart symbol="AAPL" />);

    const fallback = screen.getByRole('status', { name: 'Loading price chart' });
    expect(fallback).toHaveClass('h-[350px]', 'sm:h-[500px]');
    expect(screen.queryByTestId('price-chart-module')).not.toBeInTheDocument();

    await act(async () => {
      deferredModules.resolvePriceChart({
        default: () => <div data-testid="price-chart-module">Price chart module</div>,
      });
      await deferredModules.priceChart;
    });

    expect(await screen.findByTestId('price-chart-module')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading price chart' })).not.toBeInTheDocument();
  });

  it('shows an accessible fallback until the comparison module loads', async () => {
    render(<LazyCompareView symbols={['AAPL', 'MSFT']} period="1y" />);

    const fallback = screen.getByRole('status', { name: 'Loading comparison view' });
    expect(fallback).toHaveClass('h-[310px]', 'sm:h-[400px]');
    expect(screen.queryByTestId('comparison-module')).not.toBeInTheDocument();

    await act(async () => {
      deferredModules.resolveCompareView({
        default: () => <div data-testid="comparison-module">Comparison module</div>,
      });
      await deferredModules.compareView;
    });

    expect(await screen.findByTestId('comparison-module')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading comparison view' })).not.toBeInTheDocument();
  });

  it('defers stock details behind its own accessible fallback', async () => {
    render(<LazyStockDetails symbol="AAPL" />);

    const fallback = screen.getByRole('status', { name: 'Loading stock details' });
    expect(fallback).toHaveClass('h-48');
    expect(screen.queryByTestId('stock-details-module')).not.toBeInTheDocument();

    await act(async () => {
      deferredModules.resolveStockDetails({
        default: () => <div data-testid="stock-details-module">Stock details module</div>,
      });
      await deferredModules.stockDetails;
    });

    expect(await screen.findByTestId('stock-details-module')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading stock details' })).not.toBeInTheDocument();
  });
});
