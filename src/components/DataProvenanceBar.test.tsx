import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import DataProvenanceBar from './DataProvenanceBar';

describe('DataProvenanceBar', () => {
  afterEach(cleanup);

  it('renders supplied source, retrieval time, status and represented market range', () => {
    render(
      <DataProvenanceBar
        items={[{
          label: 'History',
          marketFrom: '2025-07-11',
          marketTo: '2026-07-10',
          source: 'Provider A',
          retrievedAt: '2026-07-12T10:00:00Z',
          status: 'delayed',
        }]}
      />,
    );

    const bar = screen.getByRole('region', { name: 'Market data provenance' });
    expect(bar).toHaveTextContent('History: 2025-07-11–2026-07-10');
    expect(bar).toHaveTextContent('Source: Provider A');
    expect(bar).toHaveTextContent('Retrieved: 2026-07-12T10:00:00Z');
    expect(bar).toHaveTextContent('Freshness status: delayed');
    expect(bar.querySelectorAll('time')).toHaveLength(2);
  });

  it('states missing API metadata without inventing a provider or freshness', () => {
    render(
      <DataProvenanceBar
        items={[{ label: 'Quote', marketFrom: '2026-07-10', marketTo: '2026-07-10' }]}
      />,
    );

    const bar = screen.getByRole('region');
    expect(bar).toHaveTextContent('Quote: 2026-07-10');
    expect(bar).toHaveTextContent('Source: not reported by API');
    expect(bar).toHaveTextContent('Retrieved: not reported by API');
    expect(bar).toHaveTextContent('Freshness status: not reported by API');
    expect(bar).not.toHaveTextContent(/fresh data|Yahoo/i);
  });

  it('reports partial metadata coverage and refresh activity accessibly', () => {
    render(
      <DataProvenanceBar
        coverageLabel="1 quote, 1 history"
        isRefreshing
        items={[
          { label: 'Quote', marketFrom: '2026-07-10', source: 'Provider A' },
          { label: 'History', marketFrom: '2025-07-11', marketTo: '2026-07-10' },
        ]}
      />,
    );

    expect(screen.getByText('1 quote, 1 history')).toBeInTheDocument();
    expect(screen.getByRole('region')).toHaveTextContent('Source: Provider A (1/2 datasets reported)');
    expect(screen.getByRole('status')).toHaveTextContent('Refreshing');
  });

  it('names grouped quote and history ranges instead of using an ambiguous dataset label', () => {
    render(
      <DataProvenanceBar
        items={[
          { label: 'AAPL quote', marketFrom: '2026-07-10' },
          { label: 'MSFT quote', marketFrom: '2026-07-10' },
          { label: 'AAPL history', marketFrom: '2025-07-11', marketTo: '2026-07-10' },
          { label: 'MSFT history', marketFrom: '2025-07-11', marketTo: '2026-07-10' },
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
