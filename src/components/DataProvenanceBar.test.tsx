import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { DataProvenanceItem } from '../lib/data-provenance';
import DataProvenanceBar from './DataProvenanceBar';

const provenance: Omit<DataProvenanceItem, 'label'> = {
  source: 'YAHOO_FINANCE',
  retrievedAt: '2026-07-12T10:00:00.123456789Z',
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
          marketTimestamp: '2026-07-10T20:00:00.987654321Z',
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
    expect(bar).not.toHaveTextContent('.123');
    expect(bar).not.toHaveTextContent('.987');
    expect(bar).toHaveTextContent('Currency: USD');
    expect(bar).toHaveTextContent('Adjustment: Split Adjusted');
    expect(bar).toHaveTextContent('Unit scale: ×1');
    expect(screen.getByText('Market status: Partial')).toHaveClass('text-highlight');
    expect(bar.querySelectorAll('time')).toHaveLength(4);
    expect(bar.querySelector('time[datetime="2026-07-12T10:00:00.123456789Z"]'))
      .toHaveTextContent('2026-07-12 10:00:00 UTC');
    expect(bar.querySelector('time[datetime="2026-07-10T20:00:00.987654321Z"]'))
      .toHaveTextContent('2026-07-10 20:00:00 UTC');
  });

  it('gives fresh, stale and error observations distinct semantic tones', () => {
    const { rerender } = render(
      <DataProvenanceBar items={[{ ...provenance, label: 'Quote inputs' }]} />,
    );
    expect(screen.getByText('Market status: Fresh')).toHaveClass('text-up');

    rerender(
      <DataProvenanceBar
        items={[{ ...provenance, label: 'Quote inputs', status: 'STALE' }]}
      />,
    );
    expect(screen.getByText('Market status: Stale')).toHaveClass('text-highlight');

    rerender(
      <DataProvenanceBar
        items={[{ ...provenance, label: 'Quote inputs', status: 'ERROR' }]}
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
            label: 'Quote inputs',
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

  it('deduplicates instants by visible UTC second before applying the display limit', () => {
    const retrievedAt = [
      '2026-07-12T10:00:00.100000000Z',
      '2026-07-12T10:00:00.900000000Z',
      '2026-07-12T10:00:01.100000000Z',
      '2026-07-12T10:00:02.100000000Z',
      '2026-07-12T10:00:03.100000000Z',
    ];
    const marketTimestamps = [
      '2026-07-10T20:00:00.100000000Z',
      '2026-07-10T20:00:00.900000000Z',
      '2026-07-10T20:00:01.100000000Z',
      '2026-07-10T20:00:02.100000000Z',
      '2026-07-10T20:00:03.100000000Z',
    ];
    render(
      <DataProvenanceBar
        items={retrievedAt.map((value, index) => ({
          ...provenance,
          label: `Dataset ${index + 1}`,
          retrievedAt: value,
          marketTimestamp: marketTimestamps[index],
        }))}
      />,
    );

    const bar = screen.getByRole('region');
    expect(bar).toHaveTextContent(
      'Retrieved: 2026-07-12 10:00:00 UTC, 2026-07-12 10:00:01 UTC, 2026-07-12 10:00:02 UTC +1 more',
    );
    expect(bar).toHaveTextContent(
      'Market observed: 2026-07-10 20:00:00 UTC, 2026-07-10 20:00:01 UTC, 2026-07-10 20:00:02 UTC +1 more',
    );
    expect([...bar.querySelectorAll('time')].filter((time) => (
      time.textContent === '2026-07-12 10:00:00 UTC'
    ))).toHaveLength(1);
    expect(bar.querySelector('time[datetime="2026-07-12T10:00:00.100000000Z"]'))
      .toHaveTextContent('2026-07-12 10:00:00 UTC');
    expect(bar.querySelector('time[datetime="2026-07-12T10:00:00.900000000Z"]'))
      .not.toBeInTheDocument();
  });

  it('names grouped quote and history ranges instead of using an ambiguous dataset label', () => {
    render(
      <DataProvenanceBar
        items={[
          { ...provenance, label: 'AAPL quote inputs', marketFrom: '2026-07-10' },
          { ...provenance, label: 'MSFT quote inputs', marketFrom: '2026-07-10' },
          { ...provenance, label: 'AAPL history', marketFrom: '2025-07-11', marketTo: '2026-07-10' },
          { ...provenance, label: 'MSFT history', marketFrom: '2025-07-11', marketTo: '2026-07-10' },
        ]}
      />,
    );

    const bar = screen.getByRole('region');
    expect(bar).toHaveTextContent('2 quote inputs: 2026-07-10');
    expect(bar).toHaveTextContent('2 histories: 2025-07-11–2026-07-10');
  });

  it('renders nothing before any dataset is available', () => {
    const { container } = render(<DataProvenanceBar items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
