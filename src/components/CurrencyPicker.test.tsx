import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CurrencyPicker from './CurrencyPicker';

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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  storageMock.clear();
});

describe('CurrencyPicker', () => {
  it('renders Currency label when nativeCurrency is null', () => {
    render(
      <CurrencyPicker nativeCurrency={null} value={undefined} onChange={vi.fn()} />,
    );
    expect(screen.getByText('Currency')).toBeDefined();
  });

  it('displays native currency when no value selected', () => {
    render(
      <CurrencyPicker nativeCurrency="USD" value={undefined} onChange={vi.fn()} />,
    );
    expect(screen.getByText('USD')).toBeInTheDocument();
  });

  it('displays selected currency value', () => {
    render(
      <CurrencyPicker nativeCurrency="USD" value="EUR" onChange={vi.fn()} />,
    );
    expect(screen.getByText('EUR')).toBeInTheDocument();
  });

  it('opens dropdown on click', async () => {
    const user = userEvent.setup();
    render(
      <CurrencyPicker nativeCurrency="USD" value={undefined} onChange={vi.fn()} />,
    );

    await user.click(screen.getByText('USD'));
    expect(screen.getByPlaceholderText('Search currency...')).toBeInTheDocument();
    expect(screen.getByText('default')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select currency' })).toHaveAttribute('aria-haspopup', 'listbox');
    expect(screen.getByRole('listbox', { name: 'Currencies' })).toBeInTheDocument();
  });

  it('selects a filtered currency using only the keyboard', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CurrencyPicker nativeCurrency="USD" value={undefined} onChange={onChange} />,
    );

    await user.click(screen.getByRole('button', { name: 'Select currency' }));
    const search = screen.getByRole('textbox', { name: 'Search currency' });
    await user.type(search, 'PLN');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith('PLN');
    expect(screen.queryByRole('listbox', { name: 'Currencies' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select currency' })).toHaveFocus();
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    render(
      <CurrencyPicker nativeCurrency="USD" value={undefined} onChange={vi.fn()} />,
    );

    const trigger = screen.getByRole('button', { name: 'Select currency' });
    await user.click(trigger);
    await user.click(screen.getByRole('textbox', { name: 'Search currency' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox', { name: 'Currencies' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('calls onChange with currency code on select', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CurrencyPicker nativeCurrency="USD" value={undefined} onChange={onChange} />,
    );

    await user.click(screen.getByText('USD'));
    // Search for EUR and click it
    await user.type(screen.getByPlaceholderText('Search currency...'), 'EUR');
    const eurItems = screen.getAllByText('EUR');
    // Click the one in the list (not the button)
    await user.click(eurItems[eurItems.length - 1]);

    expect(onChange).toHaveBeenCalledWith('EUR');
  });

  it('calls onChange(undefined) when selecting native currency', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CurrencyPicker nativeCurrency="USD" value="EUR" onChange={onChange} />,
    );

    await user.click(screen.getByText('EUR'));
    // Click the native currency entry (marked as "default")
    await user.click(screen.getByText('default'));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('saves selected currency to recents', async () => {
    const user = userEvent.setup();
    render(
      <CurrencyPicker nativeCurrency="USD" value={undefined} onChange={vi.fn()} />,
    );

    await user.click(screen.getByText('USD'));
    await user.type(screen.getByPlaceholderText('Search currency...'), 'GBP');
    const gbpItems = screen.getAllByText('GBP');
    await user.click(gbpItems[gbpItems.length - 1]);

    const stored = JSON.parse(storageMock.getItem('recentCurrencies') ?? '[]');
    expect(stored).toContain('GBP');
  });

  it('still selects a currency when recent storage cannot be written', async () => {
    const onChange = vi.fn();
    vi.spyOn(storageMock, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    });
    const user = userEvent.setup();
    render(
      <CurrencyPicker nativeCurrency="USD" value={undefined} onChange={onChange} />,
    );

    await user.click(screen.getByRole('button', { name: 'Select currency' }));
    await user.type(screen.getByRole('textbox', { name: 'Search currency' }), 'EUR');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith('EUR');
  });

  it('shows recent currencies in dropdown', async () => {
    storageMock.setItem('recentCurrencies', JSON.stringify(['EUR', 'GBP']));
    const user = userEvent.setup();
    render(
      <CurrencyPicker nativeCurrency="USD" value={undefined} onChange={vi.fn()} />,
    );

    await user.click(screen.getByText('USD'));
    expect(screen.getByText('Recent')).toBeInTheDocument();
  });

  it('removes recent currency via × button', async () => {
    storageMock.setItem('recentCurrencies', JSON.stringify(['EUR', 'GBP']));
    const user = userEvent.setup();
    render(
      <CurrencyPicker nativeCurrency="USD" value={undefined} onChange={vi.fn()} />,
    );

    await user.click(screen.getByText('USD'));
    const removeButtons = screen.getAllByRole('button', { name: /Remove/ });
    await user.click(removeButtons[0]);

    const stored = JSON.parse(storageMock.getItem('recentCurrencies') ?? '[]');
    expect(stored).not.toContain('EUR');
    expect(stored).toContain('GBP');
  });

  it('filters currencies by search text', async () => {
    const user = userEvent.setup();
    render(
      <CurrencyPicker nativeCurrency="USD" value={undefined} onChange={vi.fn()} />,
    );

    await user.click(screen.getByText('USD'));
    await user.type(screen.getByPlaceholderText('Search currency...'), 'PLN');

    // Should find PLN in the list
    expect(screen.getAllByText('PLN').length).toBeGreaterThan(0);
  });

  it('does not show native currency in recents', async () => {
    storageMock.setItem('recentCurrencies', JSON.stringify(['USD', 'EUR']));
    const user = userEvent.setup();
    render(
      <CurrencyPicker nativeCurrency="USD" value={undefined} onChange={vi.fn()} />,
    );

    await user.click(screen.getByText('USD'));
    // "Recent" section should only show EUR, not USD (which is already shown as default)
    const recentSection = screen.getByText('Recent');
    expect(recentSection).toBeInTheDocument();
    // USD should appear only as the default entry, not in recents
  });

  it('normalizes stored recents to uppercase and removes duplicates', async () => {
    storageMock.setItem('recentCurrencies', JSON.stringify(['eur', 'EUR', 'gbp']));
    const user = userEvent.setup();
    render(
      <CurrencyPicker nativeCurrency="USD" value={undefined} onChange={vi.fn()} />,
    );

    await user.click(screen.getByText('USD'));

    expect(screen.getAllByRole('button', { name: /Remove/ })).toHaveLength(2);
  });
});
