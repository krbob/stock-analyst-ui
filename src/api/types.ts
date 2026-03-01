export interface Gain {
  daily: number | null;
  weekly: number | null;
  monthly: number | null;
  quarterly: number | null;
  yearly: number | null;
}

export interface Rsi {
  daily: number | null;
  weekly: number | null;
  monthly: number | null;
}

export interface Macd {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export interface BollingerBands {
  upper: number | null;
  middle: number | null;
  lower: number | null;
}

export interface MovingAverages {
  sma50: number | null;
  sma200: number | null;
  ema50: number | null;
  ema200: number | null;
}

export interface Analysis {
  symbol: string;
  name: string;
  conversionName: string | null;
  date: string;
  lastPrice: number;
  gain: Gain;
  rsi: Rsi;
  macd: Macd;
  bollingerBands: BollingerBands;
  movingAverages: MovingAverages;
  atr: number | null;
  dividendYield: number | null;
  dividendGrowth: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  eps: number | null;
  roe: number | null;
  marketCap: number | null;
  recommendation: string | null;
  analystCount: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  beta: number | null;
  sector: string | null;
  industry: string | null;
  earningsDate: string | null;
}

export interface Price {
  symbol: string;
  name: string;
  conversionName: string | null;
  date: string;
  lastPrice: number;
  gain: Gain;
}

export interface HistoricalPrice {
  date: string;
  open: number;
  close: number;
  low: number;
  high: number;
  volume: number;
  dividend: number;
}

export interface StockHistory {
  symbol: string;
  name: string;
  period: string;
  prices: HistoricalPrice[];
}

export interface DividendPayment {
  date: string;
  amount: number;
}

export interface DividendSummary {
  currentYield: number;
  growth: number | null;
  frequency: number;
}

export interface DividendHistory {
  symbol: string;
  name: string;
  payments: DividendPayment[];
  summary: DividendSummary;
}

export type Period = '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | '10y' | 'ytd' | 'max';
