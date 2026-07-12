import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { DataProvenanceItem } from '../lib/data-provenance';
import DataProvenanceBar from './DataProvenanceBar';

const provenance: Omit<DataProvenanceItem, 'label'> = {
  source: 'YAHOO_FINANCE',
  retrievedAt: '2026-07-12T10:00:00Z',
  unitScale: 1,
  adjustment: 'SPLIT_ADJUSTED',
  status: 'FRESH',
};

describe('DataProvenanceBar', () => {
  afterEach(cleanup);

  it('renders the strict provenance contract and represented market range', () => {
    render(
      <DataProvenanceBar
        items={[{
          ...provenance,
          label: 'History',
          marketFrom: '2025-07-11',
          marketTo: '2026-07-10',
          marketTimestamp: '2026-07-10T20:00:00Z',
          currency: 'USD',
          status: 'PARTIAL',
        }]}
      />,
    );

    const bar = screen.getByRole('region', { name: 'Market data provenance' });
    expect(bar).toHaveTextContent('History: 2025-07-11–2026-07-10');
    expect(bar).toHaveTextContent('Source: Yahoo Finance');
    expect(bar).toHaveTextContent('Market status: Partial');
    expect(bar).toHaveTextContent('Retrieved: 2026-07-12 10:00:00 UTC');
    expect(bar).toHaveTextContent('Market observed: 2026-07-10 20:00:00 UTC');
    expect(bar).toHaveTextContent('Currency: USD');
    expect(bar).toHaveTextContent('Adjustment: Split Adjusted');
    expect(bar).toHaveTextContent('Unit scale: ×1');
    expect(screen.getByText('Market status: Partial')).toHaveClass('text-highlight');
    expect(bar.querySelectorAll('time')).toHaveLength(4);
  });

  it('gives fresh, stale and error observations distinct semantic tones', () => {
    const { rerender } = render(
      <DataProvenanceBar items={[{ ...provenance, label: 'Quote' }]} />,
    );
    expect(screen.getByText('Market status: Fresh')).toHaveClass('text-up');

    rerender(
      <DataProvenanceBar
        items={[{ ...provenance, label: 'Quote', status: 'STALE' }]}
      />,
    );
    expect(screen.getByText('Market status: Stale')).toHaveClass('text-highlight');

    rerender(
      <DataProvenanceBar
        items={[{ ...provenance, label: 'Quote', status: 'ERROR' }]}
      />,
    );
    expect(screen.getByText('Market status: Error')).toHaveClass('text-danger');
  });

  it('reports optional metadata coverage and refresh activity accessibly', () => {
    render(
      <DataProvenanceBar
        coverageLabel="1 quote, 1 history"
        isRefreshing
        items={[
          {
            ...provenance,
            label: 'Quote',
            marketFrom: '2026-07-10',
            marketTimestamp: '2026-07-10T20:00:00Z',
            currency: 'USD',
          },
          { ...provenance, label: 'History', marketFrom: '2025-07-11', marketTo: '2026-07-10' },
        ]}
      />,
    );

    const bar = screen.getByRole('region');
    expect(screen.getByText('1 quote, 1 history')).toBeInTheDocument();
    expect(bar).toHaveTextContent('Market observed: 2026-07-10 20:00:00 UTC (1/2 datasets reported)');
    expect(bar).toHaveTextContent('Currency: USD (1/2 datasets reported)');
    expect(screen.getByRole('status')).toHaveTextContent('Refreshing');
  });

  it('names grouped quote and history ranges instead of using an ambiguous dataset label', () => {
    render(
      <DataProvenanceBar
        items={[
          { ...provenance, label: 'AAPL quote', marketFrom: '2026-07-10' },
          { ...provenance, label: 'MSFT quote', marketFrom: '2026-07-10' },
          { ...provenance, label: 'AAPL history', marketFrom: '2025-07-11', marketTo: '2026-07-10' },
          { ...provenance, label: 'MSFT history', marketFrom: '2025-07-11', marketTo: '2026-07-10' },
        ]}
      />,
    );

    const bar = screen.getByRole('region');
    expect(bar).toHaveTextContent('2 quotes: 2026-07-10');
    expect(bar).toHaveTextContent('2 histories: 2025-07-11–2026-07-10');
  });

  it('renders nothing before any dataset is available', () => {
    const { container } = render(<DataProvenanceBar items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
