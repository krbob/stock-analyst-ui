# Stock Analyst UI

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/krbob/stock-analyst-ui/ci-build.yml)

Interactive stock analysis dashboard built with React and [lightweight-charts](https://github.com/nicosommi/lightweight-charts). Connects to the [stock-analyst](https://github.com/krbob/stock-analyst) API backend.

![Stock Analyst UI](docs/screenshot-main.png)

## Features

**Charting**
- Candlestick and line chart modes
- Logarithmic scale
- 8 time periods (1D to Max) with automatic intraday/daily interval selection
- Manual interval override (1m, 5m, 15m, 30m, 1h / 1D, 1W, 1M)
- Live intraday updates (auto-refresh every 30s)
- Dividend markers on chart

**Technical indicators**
- Moving averages: SMA 50/200, EMA 50/200
- Bollinger Bands (upper, middle, lower)
- RSI (14-period) in a separate pane with 70/30 reference lines
- MACD (line, signal, histogram) in a separate pane

![Technical Indicators](docs/screenshot-indicators.png)

**Fundamentals & technicals panel**
- P/E, EPS, P/B, Market Cap, ROE, Beta, Dividend Yield/Growth
- RSI (daily/weekly/monthly), MACD, Bollinger Bands, Moving Averages, ATR
- 52-week high/low, sector, industry, next earnings date
- Analyst consensus rating with count
- Tooltips explaining each metric

**Compare mode**
- Side-by-side comparison of up to 6 stocks
- Normalized percentage overlay chart
- Comparison table with fundamental and performance metrics
- Best-in-group highlighting

![Compare Mode](docs/screenshot-compare.png)

**Other**
- Currency conversion (150+ currencies via the API)
- Shareable URLs — full chart state encoded in query parameters
- Ticker search with autocomplete and recent history
- Dark theme, fully responsive

## Quick start

### Docker Compose (with backend)

The easiest way to run the full stack:

```yaml
services:
  stock-analyst-ui:
    image: ghcr.io/krbob/stock-analyst-ui:latest
    ports:
      - "3001:80"
    depends_on:
      - stock-analyst
    environment:
      - API_URL=http://stock-analyst:8080
    restart: unless-stopped

  stock-analyst:
    image: ghcr.io/krbob/stock-analyst:main
    ports:
      - "8080:8080"
    depends_on:
      - stock-analyst-backend-yfinance
    environment:
      - BACKEND_URL=http://stock-analyst-backend-yfinance:8081
    restart: unless-stopped

  stock-analyst-backend-yfinance:
    image: ghcr.io/krbob/stock-analyst-backend-yfinance:main
    restart: unless-stopped
```

```bash
docker compose up
# Open http://localhost:3001
```

### Development

Requires the [stock-analyst](https://github.com/krbob/stock-analyst) API running on port 8080 (Vite proxies `/api/*` to it automatically).

The UI expects intraday `timestamp` values from the API to be standard UTC epoch seconds and surfaces backend error messages directly, including `422` responses when currency conversion is unavailable for a symbol. History responses are matched against the current request before rendering so quick symbol/currency changes do not flash stale chart or indicator data.

```bash
npm install
npm run dev
# Open http://localhost:5173
```

## URL parameters

Chart state is encoded in the URL for sharing:

| Parameter | Example           | Description                              |
|-----------|-------------------|------------------------------------------|
| `s`       | `AAPL`            | Stock symbol                             |
| `p`       | `1y`              | Period (1d, 5d, 1mo, 6mo, ytd, 1y, 5y, max) |
| `i`       | `1wk`             | Interval override                        |
| `line`    | `1`               | Line chart mode                          |
| `log`     | `1`               | Logarithmic scale                        |
| `div`     | `1`               | Show dividends                           |
| `ind`     | `sma50,sma200,rsi`| Active indicators (comma-separated)      |
| `cur`     | `EUR`             | Currency conversion                      |
| `cmp`     | `AAPL,MSFT,GOOG`  | Compare mode symbols (comma-separated)   |

Example: `?s=AAPL&p=5y&log=1&ind=sma50,sma200&cmp=AAPL,MSFT`

## Architecture

```
Browser → Nginx (:80) → /api/* → stock-analyst API (:8080)
                       → /*    → React SPA (index.html)
```

### Project structure

```
src/
├── api/            API client, React Query hooks, types
├── components/     UI components
│   ├── PriceChart      Interactive chart (lightweight-charts)
│   ├── StockDetails    Fundamentals & technicals panels
│   ├── CompareView     Multi-stock comparison
│   ├── TickerSearch    Search with autocomplete
│   └── CurrencyPicker  Currency selector dropdown
├── data/           Currency definitions (Intl API)
├── hooks/          Custom hooks (useDebounce)
├── url-state.ts    URL ↔ state serialization
├── App.tsx         Main layout and state management
└── main.tsx        Entry point
```

### Key dependencies

| Library | Purpose |
|---------|---------|
| [lightweight-charts](https://github.com/nicosommi/lightweight-charts) | Financial charting (TradingView) |
| [TanStack Query](https://tanstack.com/query) | Server state, caching, auto-refetch |
| [Tailwind CSS](https://tailwindcss.com) | Styling |
| React 19 | UI framework |

## Scripts

```bash
npm run dev          # Start dev server (port 5173)
npm run build        # Type check + production build
npm run lint         # ESLint
npm test             # Run tests (Vitest)
npm run test:watch   # Tests in watch mode
```

## Docker

Multi-stage build: Node 24 for compilation, Nginx Alpine for serving.

```bash
# Build
docker build -t stock-analyst-ui .

# Run (API_URL defaults to http://localhost:8080)
docker run -p 3001:80 -e API_URL=http://your-api:8080 stock-analyst-ui
```

The `API_URL` environment variable is substituted into the Nginx config at container startup.

## CI/CD

GitHub Actions pipeline (`.github/workflows/ci-build.yml`):

1. **Type check** — `tsc --noEmit`
2. **Lint** — ESLint
3. **Test** — Vitest
4. **Docker build** — multi-stage image
5. **Smoke test** — container serves HTML with expected content
6. **Publish** (main only) — push to `ghcr.io/krbob/stock-analyst-ui`

## Tech stack

| Component | Technology |
|-----------|------------|
| Framework | React 19, TypeScript 5.9 |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 |
| Charts | lightweight-charts 5 |
| State | TanStack Query 5 |
| Testing | Vitest, React Testing Library |
| CI/CD | GitHub Actions |
| Deployment | Docker (Nginx Alpine), GHCR |
