import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TickerSearch from './TickerSearch';

// Mock the search query to avoid real API calls
vi.mock('../api/queries', () => ({
  useTickerSearch: vi.fn(() => ({ data: [] })),
}));

// jsdom localStorage stub
const store: Record<string, string> = {};
const storageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k in store) delete store[k]; },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
};
Object.defineProperty(globalThis, 'localStorage', { value: storageMock, writable: true });

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  storageMock.clear();
});

describe('TickerSearch', () => {
  it('renders input and Go button', () => {
    renderWithQuery(<TickerSearch onSelect={vi.fn()} />);
    expect(screen.getByPlaceholderText('Ticker')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });

  it('calls onSelect with uppercased value on submit', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(<TickerSearch onSelect={onSelect} />);

    await user.type(screen.getByPlaceholderText('Ticker'), 'aapl');
    await user.click(screen.getByRole('button', { name: 'Go' }));

    expect(onSelect).toHaveBeenCalledWith('AAPL');
  });

  it('calls onSelect on Enter key', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(<TickerSearch onSelect={onSelect} />);

    await user.type(screen.getByPlaceholderText('Ticker'), 'tsla{Enter}');
    expect(onSelect).toHaveBeenCalledWith('TSLA');
  });

  it('does not call onSelect when input is empty', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(<TickerSearch onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('blurs input after submit', async () => {
    const user = userEvent.setup();
    renderWithQuery(<TickerSearch onSelect={vi.fn()} />);

    const input = screen.getByPlaceholderText('Ticker');
    await user.type(input, 'AAPL{Enter}');
    expect(input).not.toHaveFocus();
  });

  it('saves to recents on submit', async () => {
    const user = userEvent.setup();
    renderWithQuery(<TickerSearch onSelect={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Ticker'), 'msft{Enter}');

    const stored = JSON.parse(storageMock.getItem('recentTickers') ?? '[]');
    expect(stored).toEqual([{ symbol: 'MSFT', name: '', exchange: '' }]);
  });

  it('shows recents dropdown on focus when empty', async () => {
    storageMock.setItem('recentTickers', JSON.stringify([
      { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NYQ' },
    ]));

    const user = userEvent.setup();
    renderWithQuery(<TickerSearch onSelect={vi.fn()} />);

    await user.click(screen.getByPlaceholderText('Ticker'));
    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
  });

  it('deduplicates recents case-insensitively', async () => {
    storageMock.setItem('recentTickers', JSON.stringify([
      { symbol: 'aapl', name: '', exchange: '' },
    ]));

    const user = userEvent.setup();
    renderWithQuery(<TickerSearch onSelect={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Ticker'), 'AAPL{Enter}');

    const stored = JSON.parse(storageMock.getItem('recentTickers') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].symbol).toBe('AAPL');
  });

  it('closes dropdown on Escape', async () => {
    storageMock.setItem('recentTickers', JSON.stringify([
      { symbol: 'AAPL', name: 'Apple', exchange: 'NYQ' },
    ]));

    const user = userEvent.setup();
    renderWithQuery(<TickerSearch onSelect={vi.fn()} />);

    await user.click(screen.getByPlaceholderText('Ticker'));
    expect(screen.getByText('Recent')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Recent')).not.toBeInTheDocument();
  });

  it('navigates dropdown with arrow keys and selects with Enter', async () => {
    storageMock.setItem('recentTickers', JSON.stringify([
      { symbol: 'AAPL', name: 'Apple', exchange: 'NYQ' },
      { symbol: 'MSFT', name: 'Microsoft', exchange: 'NYQ' },
    ]));

    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(<TickerSearch onSelect={onSelect} />);

    await user.click(screen.getByPlaceholderText('Ticker'));
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith('MSFT');
  });

  it('selects from dropdown on click', async () => {
    storageMock.setItem('recentTickers', JSON.stringify([
      { symbol: 'GOOG', name: 'Alphabet', exchange: 'NMS' },
    ]));

    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(<TickerSearch onSelect={onSelect} />);

    await user.click(screen.getByPlaceholderText('Ticker'));
    await user.click(screen.getByText('GOOG'));

    expect(onSelect).toHaveBeenCalledWith('GOOG');
  });

  it('removes a recent entry via × button', async () => {
    storageMock.setItem('recentTickers', JSON.stringify([
      { symbol: 'AAPL', name: 'Apple', exchange: 'NYQ' },
      { symbol: 'MSFT', name: 'Microsoft', exchange: 'NYQ' },
    ]));

    const user = userEvent.setup();
    renderWithQuery(<TickerSearch onSelect={vi.fn()} />);

    await user.click(screen.getByPlaceholderText('Ticker'));
    const removeButtons = screen.getAllByRole('button', { name: /Remove/ });
    await user.click(removeButtons[0]);

    const stored = JSON.parse(storageMock.getItem('recentTickers') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].symbol).toBe('MSFT');
  });

  it('limits recents to 8 entries', async () => {
    const recents = Array.from({ length: 8 }, (_, i) => ({
      symbol: `SYM${i}`, name: `Stock ${i}`, exchange: 'NYQ',
    }));
    storageMock.setItem('recentTickers', JSON.stringify(recents));

    const user = userEvent.setup();
    renderWithQuery(<TickerSearch onSelect={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Ticker'), 'NEW{Enter}');

    const stored = JSON.parse(storageMock.getItem('recentTickers') ?? '[]');
    expect(stored).toHaveLength(8);
    expect(stored[0].symbol).toBe('NEW');
    expect(stored[7].symbol).toBe('SYM6'); // SYM7 dropped
  });
});
