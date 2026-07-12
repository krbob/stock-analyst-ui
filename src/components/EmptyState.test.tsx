import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EmptyState from './EmptyState';

const store = new Map<string, string>();
const storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => { store.clear(); },
  key: (index: number) => [...store.keys()][index] ?? null,
  get length() { return store.size; },
};
Object.defineProperty(globalThis, 'localStorage', { value: storage, writable: true });

beforeEach(() => {
  storage.clear();
});

afterEach(cleanup);

describe('EmptyState', () => {
  it('renders the onboarding copy without an empty recent section', () => {
    render(<EmptyState onSelect={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Analyze any stock' })).toBeInTheDocument();
    expect(screen.getByText(/Search for a ticker/)).toBeInTheDocument();
    expect(screen.queryByText('Recent')).not.toBeInTheDocument();
  });

  it('loads normalized recent tickers and selects one', async () => {
    storage.setItem('recentTickers', JSON.stringify([
      { symbol: ' aapl ', name: 'Apple Inc.', exchange: 'NMS' },
      { symbol: 'msft', name: '', exchange: 'NMS' },
    ]));
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(<EmptyState onSelect={onSelect} />);

    expect(screen.getByText('Recent')).toBeInTheDocument();
    const apple = screen.getByRole('button', { name: 'AAPL' });
    expect(apple).toHaveAttribute('title', 'Apple Inc.');
    expect(screen.getByRole('button', { name: 'MSFT' })).not.toHaveAttribute('title');

    await user.click(apple);
    expect(onSelect).toHaveBeenCalledWith('AAPL');
  });
});
