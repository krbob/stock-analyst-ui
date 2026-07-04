import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SegmentedControl from './SegmentedControl';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
] as const;

describe('SegmentedControl', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders radiogroup semantics with the active option checked', () => {
    render(<SegmentedControl options={OPTIONS} value="b" onChange={() => {}} ariaLabel="Test control" />);

    const group = screen.getByRole('radiogroup', { name: 'Test control' });
    expect(group).toBeInTheDocument();

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios[2]).toHaveAttribute('aria-checked', 'false');
  });

  it('uses a roving tabindex (only the active option is tabbable)', () => {
    render(<SegmentedControl options={OPTIONS} value="c" onChange={() => {}} ariaLabel="Test control" />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('tabindex', '-1');
    expect(radios[1]).toHaveAttribute('tabindex', '-1');
    expect(radios[2]).toHaveAttribute('tabindex', '0');
  });

  it('makes the first option tabbable when nothing is selected', () => {
    render(<SegmentedControl options={OPTIONS} value={undefined} onChange={() => {}} ariaLabel="Test control" />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('tabindex', '0');
    expect(radios.every((radio) => radio.getAttribute('aria-checked') === 'false')).toBe(true);
  });

  it('selects an option on click', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SegmentedControl options={OPTIONS} value="a" onChange={onChange} ariaLabel="Test control" />);

    await user.click(screen.getByRole('radio', { name: 'Gamma' }));
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('moves selection with arrow keys and wraps around', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SegmentedControl options={OPTIONS} value="c" onChange={onChange} ariaLabel="Test control" />);

    screen.getByRole('radio', { name: 'Gamma' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('a');

    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('b');
  });

  it('supports Home and End keys', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SegmentedControl options={OPTIONS} value="b" onChange={onChange} ariaLabel="Test control" />);

    screen.getByRole('radio', { name: 'Beta' }).focus();
    await user.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith('c');

    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenLastCalledWith('a');
  });

  it('applies option-level aria labels', () => {
    render(
      <SegmentedControl
        options={[{ value: 'line', label: 'Line', ariaLabel: 'Line chart' }]}
        value="line"
        onChange={() => {}}
        ariaLabel="Chart type"
      />,
    );
    expect(screen.getByRole('radio', { name: 'Line chart' })).toBeInTheDocument();
  });
});
