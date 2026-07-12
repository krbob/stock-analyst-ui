import { describe, expect, it } from 'vitest';
import { ApiError, parseRetryAfterSeconds, shouldRetryApiQuery } from './errors';

describe('parseRetryAfterSeconds', () => {
  it('parses delta seconds', () => {
    expect(parseRetryAfterSeconds('60')).toBe(60);
  });

  it('parses an HTTP date relative to now', () => {
    expect(parseRetryAfterSeconds('Sun, 12 Jul 2026 12:01:00 GMT', Date.parse('2026-07-12T12:00:00Z')))
      .toBe(60);
  });

  it('ignores invalid and negative values', () => {
    expect(parseRetryAfterSeconds('invalid')).toBeNull();
    expect(parseRetryAfterSeconds('-1')).toBeNull();
  });
});

describe('shouldRetryApiQuery', () => {
  it('does not automatically retry rate limits or permanent client errors', () => {
    expect(shouldRetryApiQuery(0, new ApiError('rate limit', 429, 60))).toBe(false);
    expect(shouldRetryApiQuery(0, new ApiError('not found', 404))).toBe(false);
  });

  it('retries server and network failures at most once', () => {
    expect(shouldRetryApiQuery(0, new ApiError('upstream', 502))).toBe(true);
    expect(shouldRetryApiQuery(0, new TypeError('network failed'))).toBe(true);
    expect(shouldRetryApiQuery(1, new ApiError('upstream', 502))).toBe(false);
    expect(shouldRetryApiQuery(1, new TypeError('network failed'))).toBe(false);
  });
});
