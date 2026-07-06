interface StockAnalystRuntimeConfig {
  showChartAttribution?: boolean;
}

interface Window {
  __STOCK_ANALYST_CONFIG__?: StockAnalystRuntimeConfig;
}
