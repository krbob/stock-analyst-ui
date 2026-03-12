import { describe, it, expect } from 'vitest';
import { CURRENCIES, getCurrencyName } from './currencies';

describe('CURRENCIES', () => {
  it('contains common currencies', () => {
    const codes = CURRENCIES.map((c) => c.code);
    expect(codes).toContain('USD');
    expect(codes).toContain('EUR');
    expect(codes).toContain('GBP');
    expect(codes).toContain('JPY');
    expect(codes).toContain('PLN');
  });

  it('each entry has code and name', () => {
    for (const c of CURRENCIES) {
      expect(c.code).toBeTruthy();
      expect(c.name).toBeTruthy();
    }
  });

  it('codes are uppercase', () => {
    for (const c of CURRENCIES) {
      expect(c.code).toBe(c.code.toUpperCase());
    }
  });
});

describe('getCurrencyName', () => {
  it('returns name for known currency', () => {
    const name = getCurrencyName('USD');
    expect(name).toBeTruthy();
    expect(name).not.toBe('USD'); // Should be a display name like "US Dollar"
  });

  it('is case-insensitive via toUpperCase', () => {
    // getCurrencyName uppercases the code internally
    expect(getCurrencyName('usd')).toBe(getCurrencyName('USD'));
  });

  it('returns code for unknown currency', () => {
    expect(getCurrencyName('XYZ')).toBe('XYZ');
  });
});
