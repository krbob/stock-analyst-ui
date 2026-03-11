export interface Currency {
  code: string;
  name: string;
}

const displayNames = new Intl.DisplayNames(['en'], { type: 'currency' });

export const CURRENCIES: Currency[] = Intl.supportedValuesOf('currency').map((code) => ({
  code,
  name: displayNames.of(code) ?? code,
}));

const CURRENCY_MAP = new Map(CURRENCIES.map((c) => [c.code, c]));

export function getCurrencyName(code: string): string {
  return CURRENCY_MAP.get(code.toUpperCase())?.name ?? code;
}
