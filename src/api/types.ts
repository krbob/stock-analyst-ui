export interface Gain {
  daily: number;
  weekly: number;
  monthly: number;
  quarterly: number;
  yearly: number;
}

export interface Rsi {
  daily: number;
  weekly: number;
  monthly: number;
}

export interface Macd {
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
}

export interface MovingAverages {
  sma50: number;
  sma200: number;
  ema50: number;
  ema200: number;
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
  atr: number;
  dividendYield: number;
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
