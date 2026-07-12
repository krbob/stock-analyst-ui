import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shouldRetryApiQuery } from './errors';
import { useQuote, useStockHistory } from './queries';

function queryClient(retry: false | typeof shouldRetryApiQuery = false) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
        retry,
        retryDelay: 0,
        staleTime: 5 * 60 * 1000,
      },
    },
  });
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    statusText: 'Error',
    headers: { 'Content-Type': 'application/json' },
  });
}

function HistoryObserver() {
  useStockHistory('AAPL', '1y', undefined, ['sma50']);
  return null;
}

function QuoteObserver() {
  const { data, error } = useQuote('AAPL');
  if (error) return <div role="alert">{error.message}</div>;
  return <div>{data?.name ?? 'Loading quote'}</div>;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('query request lifecycle', () => {
  it('coalesces identical observers and aborts only after the last one unmounts', async () => {
    let requestSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = input instanceof Request ? input.signal : init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = queryClient();

    const view = render(
      <QueryClientProvider client={client}>
        <HistoryObserver />
        <HistoryObserver />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const generatedRequest = fetchMock.mock.calls[0][0] as Request;
    const generatedUrl = new URL(generatedRequest.url);
    expect(`${generatedUrl.pathname}${generatedUrl.search}`)
      .toBe('/api/v1/history/AAPL?period=1y&indicators=sma50');
    expect(generatedRequest.signal).toBeInstanceOf(AbortSignal);
    expect(requestSignal?.aborted).toBe(false);

    view.rerender(
      <QueryClientProvider client={client}>
        <HistoryObserver />
      </QueryClientProvider>,
    );
    expect(requestSignal?.aborted).toBe(false);

    view.unmount();
    await waitFor(() => expect(requestSignal?.aborted).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    client.clear();
  });

  it('keeps the existing one-retry policy for transient server errors', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(errorResponse(503, 'Upstream unavailable'))
      .mockResolvedValueOnce(jsonResponse({ symbol: 'AAPL', name: 'Apple Inc.' }));
    vi.stubGlobal('fetch', fetchMock);
    const client = queryClient(shouldRetryApiQuery);

    render(
      <QueryClientProvider client={client}>
        <QuoteObserver />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Apple Inc.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([request]) => (
      request instanceof Request && request.signal instanceof AbortSignal
    ))).toBe(true);
    client.clear();
  });

  it('surfaces permanent errors without retrying them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(404, 'Stock not found'));
    vi.stubGlobal('fetch', fetchMock);
    const client = queryClient(shouldRetryApiQuery);

    render(
      <QueryClientProvider client={client}>
        <QuoteObserver />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Stock not found');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    client.clear();
  });
});
