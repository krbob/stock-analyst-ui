import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import MarketDataDate from './MarketDataDate';

describe('MarketDataDate', () => {
  afterEach(cleanup);

  it('exposes the market session date as structured metadata', () => {
    render(<MarketDataDate date="2026-07-10" />);

    const label = screen.getByLabelText('Market data as of 2026-07-10');
    const time = label.querySelector('time');
    expect(time).toHaveAttribute('datetime', '2026-07-10');
    expect(time).toHaveTextContent('2026-07-10');
  });

  it('renders nothing until a valid date is available', () => {
    const { container } = render(<MarketDataDate date={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
