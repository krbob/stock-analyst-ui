import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IndicatorsPopover from './IndicatorsPopover';

const GROUPS = [
  { label: 'SMA 50/200', keys: ['sma50', 'sma200'] },
  { label: 'RSI', keys: ['rsi'] },
  { label: 'MACD', keys: ['macd'] },
];

describe('IndicatorsPopover', () => {
  afterEach(() => {
    cleanup();
  });

  it('is closed initially and exposes aria-expanded/controls', () => {
    render(<IndicatorsPopover groups={GROUPS} active={new Set()} onToggleGroup={() => {}} />);
    const button = screen.getByRole('button', { name: /indicators/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls');
    expect(screen.queryByRole('group', { name: 'Chart indicators' })).not.toBeInTheDocument();
  });

  it('opens on click, renders checkbox rows and focuses the first one', async () => {
    const user = userEvent.setup();
    render(<IndicatorsPopover groups={GROUPS} active={new Set(['rsi'])} onToggleGroup={() => {}} />);

    const button = screen.getByRole('button', { name: /indicators/i });
    await user.click(button);

    expect(button).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('group', { name: 'Chart indicators' });
    expect(panel.id).toBe(button.getAttribute('aria-controls'));

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
    expect(screen.getByRole('checkbox', { name: /rsi/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /sma 50\/200/i })).not.toBeChecked();
    expect(checkboxes[0]).toHaveFocus();
  });

  it('shows the count of fully-active groups on the trigger', () => {
    render(<IndicatorsPopover groups={GROUPS} active={new Set(['sma50', 'rsi'])} onToggleGroup={() => {}} />);
    // sma50 alone does not complete the SMA group — only RSI counts
    expect(screen.getByRole('button', { name: /indicators/i })).toHaveTextContent('Indicators1');
  });

  it('toggling a row reports the full key group', async () => {
    const onToggleGroup = vi.fn();
    const user = userEvent.setup();
    render(<IndicatorsPopover groups={GROUPS} active={new Set()} onToggleGroup={onToggleGroup} />);

    await user.click(screen.getByRole('button', { name: /indicators/i }));
    await user.click(screen.getByRole('checkbox', { name: /sma 50\/200/i }));
    expect(onToggleGroup).toHaveBeenCalledWith(['sma50', 'sma200']);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<IndicatorsPopover groups={GROUPS} active={new Set()} onToggleGroup={() => {}} />);

    const button = screen.getByRole('button', { name: /indicators/i });
    await user.click(button);
    expect(screen.getByRole('group', { name: 'Chart indicators' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Chart indicators' })).not.toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('closes on outside click', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <IndicatorsPopover groups={GROUPS} active={new Set()} onToggleGroup={() => {}} />
        <button type="button">outside</button>
      </div>,
    );

    await user.click(screen.getByRole('button', { name: /indicators/i }));
    expect(screen.getByRole('group', { name: 'Chart indicators' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('group', { name: 'Chart indicators' })).not.toBeInTheDocument();
  });
});
