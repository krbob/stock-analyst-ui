import { describe, expect, it } from 'vitest';
import { getPaneStretchFactors } from './price-chart-layout';

describe('getPaneStretchFactors', () => {
  it('keeps a single-pane chart unchanged', () => {
    expect(getPaneStretchFactors([])).toEqual([1]);
  });

  it('gives RSI a moderate amount of space', () => {
    expect(getPaneStretchFactors(['rsi'])).toEqual([2, 0.5]);
  });

  it('gives MACD more space than RSI', () => {
    expect(getPaneStretchFactors(['macd'])).toEqual([2, 0.7]);
  });

  it('keeps pane-specific sizing when multiple indicators are visible', () => {
    expect(getPaneStretchFactors(['rsi', 'macd'])).toEqual([2, 0.5, 0.7]);
  });
});
