import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getHistory, getAnalysis, getPrice, compareStocks, searchTickers } from './client';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

function errorResponse(body: string | object, status = 500) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return Promise.resolve({
    ok: false,
    status,
    statusText: 'Internal Server Error',
    json: () => Promise.resolve(typeof body === 'object' ? body : {}),
    text: () => Promise.resolve(text),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('getHistory', () => {
  it('builds URL with symbol and default period', async () => {
    mockFetch.mockReturnValue(jsonResponse({ prices: [] }));
    await getHistory('AAPL');
    expect(mockFetch).toHaveBeenCalledWith('/api/history/AAPL?period=1y');
  });

  it('includes period param', async () => {
    mockFetch.mockReturnValue(jsonResponse({ prices: [] }));
    await getHistory('MSFT', '5y');
    expect(mockFetch).toHaveBeenCalledWith('/api/history/MSFT?period=5y');
  });

  it('includes interval when provided', async () => {
    mockFetch.mockReturnValue(jsonResponse({ prices: [] }));
    await getHistory('AAPL', '1d', '5m');
    expect(mockFetch).toHaveBeenCalledWith('/api/history/AAPL?period=1d&interval=5m');
  });

  it('includes indicators', async () => {
    mockFetch.mockReturnValue(jsonResponse({ prices: [] }));
    await getHistory('AAPL', '1y', undefined, ['sma50', 'rsi']);
    expect(mockFetch).toHaveBeenCalledWith('/api/history/AAPL?period=1y&indicators=sma50,rsi');
  });

  it('includes currency', async () => {
    mockFetch.mockReturnValue(jsonResponse({ prices: [] }));
    await getHistory('AAPL', '1y', undefined, undefined, 'EUR');
    expect(mockFetch).toHaveBeenCalledWith('/api/history/AAPL?period=1y&currency=EUR');
  });

  it('includes dividends', async () => {
    mockFetch.mockReturnValue(jsonResponse({ prices: [] }));
    await getHistory('AAPL', '1y', undefined, undefined, undefined, true);
    expect(mockFetch).toHaveBeenCalledWith('/api/history/AAPL?period=1y&dividends=true');
  });

  it('builds full URL with all params', async () => {
    mockFetch.mockReturnValue(jsonResponse({ prices: [] }));
    await getHistory('AAPL', '5y', '1wk', ['sma50', 'bb'], 'GBP', true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/history/AAPL?period=5y&interval=1wk&indicators=sma50,bb&currency=GBP&dividends=true',
    );
  });

  it('encodes special characters in symbol', async () => {
    mockFetch.mockReturnValue(jsonResponse({ prices: [] }));
    await getHistory('BRK.B');
    expect(mockFetch).toHaveBeenCalledWith('/api/history/BRK.B?period=1y');
  });
});

describe('getAnalysis', () => {
  it('builds URL with symbol only', async () => {
    mockFetch.mockReturnValue(jsonResponse({}));
    await getAnalysis('AAPL');
    expect(mockFetch).toHaveBeenCalledWith('/api/analysis/AAPL');
  });

  it('includes currency', async () => {
    mockFetch.mockReturnValue(jsonResponse({}));
    await getAnalysis('AAPL', 'EUR');
    expect(mockFetch).toHaveBeenCalledWith('/api/analysis/AAPL?currency=EUR');
  });
});

describe('getPrice', () => {
  it('builds URL with symbol only', async () => {
    mockFetch.mockReturnValue(jsonResponse({}));
    await getPrice('TSLA');
    expect(mockFetch).toHaveBeenCalledWith('/api/price/TSLA');
  });

  it('includes currency', async () => {
    mockFetch.mockReturnValue(jsonResponse({}));
    await getPrice('TSLA', 'PLN');
    expect(mockFetch).toHaveBeenCalledWith('/api/price/TSLA?currency=PLN');
  });
});

describe('compareStocks', () => {
  it('builds URL with symbols', async () => {
    mockFetch.mockReturnValue(jsonResponse([]));
    await compareStocks(['AAPL', 'MSFT']);
    expect(mockFetch).toHaveBeenCalledWith('/api/compare?symbols=AAPL,MSFT');
  });

  it('includes currency', async () => {
    mockFetch.mockReturnValue(jsonResponse([]));
    await compareStocks(['AAPL', 'MSFT'], 'EUR');
    expect(mockFetch).toHaveBeenCalledWith('/api/compare?symbols=AAPL,MSFT&currency=EUR');
  });

  it('encodes symbols', async () => {
    mockFetch.mockReturnValue(jsonResponse([]));
    await compareStocks(['BRK.B']);
    expect(mockFetch).toHaveBeenCalledWith('/api/compare?symbols=BRK.B');
  });
});

describe('searchTickers', () => {
  it('builds URL with query', async () => {
    mockFetch.mockReturnValue(jsonResponse([]));
    await searchTickers('apple');
    expect(mockFetch).toHaveBeenCalledWith('/api/search/apple');
  });

  it('encodes special characters', async () => {
    mockFetch.mockReturnValue(jsonResponse([]));
    await searchTickers('a&b');
    expect(mockFetch).toHaveBeenCalledWith('/api/search/a%26b');
  });
});

describe('fetchApi error handling', () => {
  it('throws with JSON error message', async () => {
    mockFetch.mockReturnValue(errorResponse({ error: 'Stock not found' }, 404));
    await expect(getPrice('INVALID')).rejects.toThrow('Stock not found');
  });

  it('throws with plain text body', async () => {
    mockFetch.mockReturnValue(errorResponse('Something broke', 500));
    await expect(getPrice('AAPL')).rejects.toThrow('Something broke');
  });

  it('throws with status text when body is empty', async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: () => Promise.resolve(''),
      }),
    );
    await expect(getPrice('AAPL')).rejects.toThrow('503 Service Unavailable');
  });
});
