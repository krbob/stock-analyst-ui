import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 300));
    expect(result.current).toBe('hello');
  });

  it('does not update value before delay', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'ab' });
    vi.advanceTimersByTime(200);
    expect(result.current).toBe('a');

    vi.useRealTimers();
  });

  it('updates value after delay', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'ab' });
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe('ab');

    vi.useRealTimers();
  });

  it('resets timer on rapid changes', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'ab' });
    vi.advanceTimersByTime(200);
    rerender({ value: 'abc' });
    vi.advanceTimersByTime(200);
    // Only 200ms since last change — should still be 'a'
    expect(result.current).toBe('a');

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('abc');

    vi.useRealTimers();
  });

  it('works with different types', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: 42 } },
    );

    rerender({ value: 99 });
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe(99);

    vi.useRealTimers();
  });
});
