import { beforeEach, describe, expect, it, vi } from 'vitest';
import { compareStocks, getHistory, getQuote, searchTickers } from './client';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function response(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
  statusText = status === 200 ? 'OK' : 'Error',
): Promise<Response> {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return Promise.resolve(new Response(text, {
    status,
    statusText,
    headers: {
      'Content-Type': typeof body === 'string' ? 'text/plain' : 'application/json',
      ...headers,
    },
  }));
}

function lastRequest(): Request {
  const request = mockFetch.mock.lastCall?.[0];
  expect(request).toBeInstanceOf(Request);
  return request as Request;
}

function expectLastUrl(expected: string): void {
  const url = new URL(lastRequest().url);
  expect(`${url.pathname}${url.search}`).toBe(expected);
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('getHistory generated contract', () => {
  it('uses the canonical v1 path with the default period', async () => {
    mockFetch.mockReturnValue(response({ prices: [] }));
    await getHistory('AAPL');
    expectLastUrl('/api/v1/history/AAPL?period=1y');
  });

  it('includes each supported query parameter', async () => {
    mockFetch.mockReturnValue(response({ prices: [] }));
    await getHistory('AAPL', '5y', '1wk', ['sma50', 'bb'], 'GBP', true);
    expectLastUrl('/api/v1/history/AAPL?period=5y&interval=1wk&indicators=bb%2Csma50&currency=GBP&dividends=true');
  });

  it('omits disabled optional parameters', async () => {
    mockFetch.mockReturnValue(response({ prices: [] }));
    await getHistory('MSFT', '5y');
    expectLastUrl('/api/v1/history/MSFT?period=5y');
  });

  it('normalizes request identity and safely encodes the path', async () => {
    mockFetch.mockReturnValue(response({
      symbol: 'BRK.B',
      name: 'Berkshire',
      period: '1y',
      interval: '1d',
      prices: [],
      adjustment: 'split-adjusted',
      currency: 'EUR',
    }));

    const result = await getHistory(' brk.b ', '1y', '1d', ['sma50'], ' eur ', true);

    expectLastUrl('/api/v1/history/BRK.B?period=1y&interval=1d&indicators=sma50&currency=EUR&dividends=true');
    expect(result.request).toEqual({
      symbol: 'BRK.B',
      period: '1y',
      interval: '1d',
      indicatorsKey: 'sma50',
      currency: 'EUR',
      dividends: true,
    });
  });

  it('forwards aborts through the generated Request', async () => {
    const controller = new AbortController();
    mockFetch.mockReturnValue(response({ prices: [] }));

    await getHistory('AAPL', '1y', undefined, undefined, undefined, false, controller.signal);
    const request = lastRequest();
    expect(request.signal.aborted).toBe(false);

    controller.abort();
    expect(request.signal.aborted).toBe(true);
  });
});

describe('other generated SDK operations', () => {
  it('builds a canonical quote request', async () => {
    mockFetch.mockReturnValue(response({}));
    await getQuote('AAPL', 'EUR');
    expectLastUrl('/api/v1/quote/AAPL?currency=EUR');
  });

  it('forwards quote aborts', async () => {
    const controller = new AbortController();
    mockFetch.mockReturnValue(response({}));

    await getQuote('AAPL', undefined, controller.signal);
    const request = lastRequest();
    controller.abort();
    expect(request.signal.aborted).toBe(true);
  });

  it('serializes compare symbols according to the OpenAPI array contract', async () => {
    mockFetch.mockReturnValue(response([]));
    await compareStocks(['AAPL', 'MSFT'], 'EUR');
    expectLastUrl('/api/v1/compare?symbols=AAPL,MSFT&currency=EUR');
  });

  it('uses the canonical encoded search path', async () => {
    mockFetch.mockReturnValue(response([]));
    await searchTickers('a&b');
    expectLastUrl('/api/v1/search/a%26b');
  });
});

describe('generated ApiError adaptation', () => {
  it('preserves the generated error body, HTTP status, request ID and Retry-After', async () => {
    mockFetch.mockReturnValue(response({
      error: 'Data backend is busy',
      errorCode: 'SERVICE_UNAVAILABLE',
      retryable: true,
      requestId: 'req-123',
    }, 503, { 'Retry-After': '2' }, 'Service Unavailable'));

    await expect(getQuote('AAPL')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Data backend is busy',
      status: 503,
      retryAfterSeconds: 2,
      errorCode: 'SERVICE_UNAVAILABLE',
      retryable: true,
      requestId: 'req-123',
      body: {
        error: 'Data backend is busy',
        errorCode: 'SERVICE_UNAVAILABLE',
        retryable: true,
        requestId: 'req-123',
      },
    });
  });

  it('keeps rate-limit guidance and generated classification', async () => {
    mockFetch.mockReturnValue(response({
      error: 'Upstream rate limit',
      errorCode: 'UPSTREAM_RATE_LIMITED',
      retryable: true,
      requestId: null,
    }, 429, { 'Retry-After': '60' }, 'Too Many Requests'));

    await expect(getQuote('AAPL')).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 60,
      errorCode: 'UPSTREAM_RATE_LIMITED',
      retryable: true,
      message: 'Upstream rate limit Try again in 60 seconds.',
    });
  });

  it('remains backward-compatible with a partial JSON error body', async () => {
    mockFetch.mockReturnValue(response({ error: 'Stock not found' }, 404, {}, 'Not Found'));

    await expect(getQuote('INVALID')).rejects.toMatchObject({
      message: 'Stock not found',
      status: 404,
      errorCode: null,
      retryable: false,
      requestId: null,
    });
  });

  it('uses plain text but does not surface an HTML proxy body', async () => {
    mockFetch.mockReturnValueOnce(response('Something broke', 500, {}, 'Internal Server Error'));
    await expect(getQuote('AAPL')).rejects.toThrow('Something broke');

    mockFetch.mockReturnValueOnce(response('<html>proxy failure</html>', 502, {}, 'Bad Gateway'));
    await expect(getQuote('AAPL')).rejects.toThrow('502 Bad Gateway');
  });

  it('rejects a successful HTML proxy response before it reaches typed UI state', async () => {
    mockFetch.mockReturnValue(response('<html>SPA fallback</html>'));

    await expect(getQuote('AAPL')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'API returned an unexpected non-JSON response.',
      status: 502,
      retryable: true,
    });
  });

  it('preserves transport errors without misclassifying them as API responses', async () => {
    const networkError = new TypeError('fetch failed');
    mockFetch.mockRejectedValue(networkError);

    await expect(getQuote('AAPL')).rejects.toBe(networkError);
  });
});
