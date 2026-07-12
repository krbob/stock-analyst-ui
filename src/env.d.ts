interface StockAnalystRuntimeConfig {
  showChartAttribution?: boolean;
  portfolioUrl?: string;
}

interface ImportMetaEnv {
  readonly VITE_PORTFOLIO_URL?: string;
}

interface Window {
  __STOCK_ANALYST_CONFIG__?: StockAnalystRuntimeConfig;
}
