# Stock Analyst UI

[![CI/CD](https://img.shields.io/github/actions/workflow/status/krbob/stock-analyst-ui/ci-build.yml?branch=main&label=CI%2FCD)](https://github.com/krbob/stock-analyst-ui/actions/workflows/ci-build.yml)

Responsive stock-analysis frontend built with React and the official
[TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts) library. It consumes the
[Stock Analyst API](https://github.com/krbob/stock-analyst) through a same-origin `/api` proxy.

Market data may be delayed or incomplete. The UI displays the backend-provided source, coverage, retrieval time,
market-observation time, adjustment basis, unit scale and freshness status instead of inferring freshness in the
browser.

![Stock Analyst UI showing a synthetic AAPL analysis in dark mode](docs/screenshot-main.png)

## What it provides

- Candlestick and line charts, logarithmic scale, dividends and adaptive intraday refresh.
- SMA, EMA, Bollinger Bands, RSI and MACD overlays or panes.
- Fundamentals, technical metrics and analyst-consensus context.
- Comparison of up to six symbols with normalized returns and neutral descriptive metrics.
- Currency conversion when the backend has the required FX data.
- Shareable analysis URLs, ticker search and recent symbols.
- Light, dark and system themes; keyboard workflows; responsive layouts from 320 px.
- Optional Portfolio application hand-off with transient theme and browser-locale hints.
- Installable production shell that can open offline; market-data requests still require the API.

## Quick start

### Complete Docker stack

The bundled [Compose file](docker-compose.yml) starts the UI, Stock Analyst API and its private yfinance adapter:

```bash
docker compose up --detach --pull always --wait

curl --fail http://127.0.0.1:3001/healthz
curl --fail http://127.0.0.1:3001/api/v1/quote/AAPL >/dev/null
```

Open <http://127.0.0.1:3001>. The API is also available directly at <http://127.0.0.1:8080>; the yfinance adapter
is deliberately not published on the host. Stop and remove the test stack with `docker compose down`.

The defaults use the moving `main` and `latest` image tags for a convenient local evaluation only. Override the
three `*_IMAGE` variables with reviewed immutable digest references for any durable deployment; see the
[deployment guide](docs/DEPLOYMENT.md).

### Frontend development

Node.js 24.18 and npm 11.16 are required. Start the Stock Analyst API on `http://localhost:8080`, then run:

```bash
npm ci --ignore-scripts
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api/*` to the local backend and removes the `/api` prefix. There is no
client-side API-origin setting.

To exercise a locally built UI container against an already running API:

```bash
docker build -t stock-analyst-ui:local .
docker run --rm -p 3001:8080 \
  -e API_URL=http://host.docker.internal:8080 \
  stock-analyst-ui:local
```

Open <http://localhost:3001>. Linux hosts may need a Docker-network hostname instead of `host.docker.internal`.

## Configuration

| Setting | Scope | Default | Meaning |
|---|---|---|---|
| `API_URL` | Container runtime | required | Trusted Nginx upstream base, normally `http://stock-analyst:8080`. The browser still calls same-origin `/api`. |
| `SHOW_CHART_ATTRIBUTION` | Container runtime | `true` | Set to `false`, `0`, `no` or `off` to hide the footer. |
| `PORTFOLIO_URL` | Container runtime | unset | Root-relative or absolute HTTP(S) destination shown in the application switcher. |
| `VITE_SHOW_CHART_ATTRIBUTION` | Local/build time | enabled | Build-time fallback for source or Vite-preview sessions. Runtime container configuration takes precedence. |
| `VITE_PORTFOLIO_URL` | Local/build time | unset | Build-time fallback for the Portfolio switcher. Runtime container configuration takes precedence. |

Copy `.env.example` to `.env.local` for local Vite overrides. Never put secrets in `VITE_*` variables: Vite embeds
them in browser assets.

`PORTFOLIO_URL` rejects executable schemes, protocol-relative URLs, control characters and embedded credentials.
The generated link carries only `uiTheme` and `uiLocale`; it never forwards the selected symbol, currency or chart
state.

## Locale, freshness and offline behavior

Stock Analyst UI currently renders English copy and declares `lang="en"`. The Portfolio link derives a canonical,
navigation-only locale hint from the first non-empty `navigator.languages` value, then `navigator.language`, then
the document language. The hint does not change this UI and must not become a durable language choice in the
destination application.

Intraday history normally refreshes every 30 seconds. After three unchanged snapshots it backs off to five minutes
until data changes or the request identity changes. The displayed market status is the backend's cadence-aware
assessment. `Retrieved` means when the API obtained a response; it is not the observation time.

Production builds register a service worker that caches the application shell and hashed assets. It deliberately
bypasses `/api/*`, so an offline reload can open the UI but cannot fetch or update market data.

## Shareable URL parameters

| Parameter | Example | Meaning |
|---|---|---|
| `s` | `AAPL` | Primary symbol. |
| `p` | `1y` | Period: `1d`, `5d`, `1mo`, `3mo`, `6mo`, `1y`, `2y`, `5y`, `10y`, `ytd`, `max`. The toolbar exposes the common eight. |
| `i` | `1wk` | Interval override: `1m`, `5m`, `15m`, `30m`, `1h`, `1d`, `1wk`, `1mo`. |
| `line` | `1` | Line-chart mode. |
| `log` | `1` | Logarithmic scale. |
| `div` | `1` | Dividend markers. |
| `ind` | `sma50,sma200,rsi` | Enabled indicators. |
| `cur` | `EUR` | Requested response currency. |
| `cmp` | `AAPL,MSFT,GOOG` | Comparison symbols, deduplicated and limited to six. |

Example: `?s=AAPL&p=5y&log=1&ind=sma50,sma200&cmp=AAPL,MSFT`

These parameters preserve analysis controls, not every visual preference. Chart zoom is transient; theme and the
details-panel preference are stored locally.

## Verification

```bash
npm run lint
npm run docs:check
npm test
npm run test:coverage
npm run build
```

`docs:check` verifies repository-relative links and keeps documented runtime/build-time settings aligned with their
sources. `npm run build` also verifies the pinned supply-chain policy, OpenAPI client and design-token manifest.
Browser tests need the production container and a `BASE_URL`; see
[development documentation](docs/DEVELOPMENT.md#browser-tests).
CI currently automates Chromium. Chrome on Windows and Safari on macOS remain explicit release-check targets until
WebKit is added to the pipeline.

## Architecture

```text
Browser -> Nginx (:8080) -> /api/* -> Stock Analyst API
                         -> /*     -> React application
```

This is the container-owned proxy topology. A reverse proxy may instead route `/api/*` directly to the backend;
the prefix must be removed exactly once. Both supported layouts are described in the deployment guide.

The container's `/healthz` endpoint is Nginx/static-shell liveness only. It does not prove that the API or its market
data provider is ready.

## Further documentation

- [Development, tests, API contract and design tokens](docs/DEVELOPMENT.md)
- [Container configuration, immutable deployment and rollback](docs/DEPLOYMENT.md)
- [Pinned OpenAPI snapshot](openapi/manifest.json)
- [Versioned design-token manifest](src/styles/tokens.manifest.json)

The main stack is React 19, TypeScript 6, Vite 8, Tailwind CSS 4, TanStack Query 5 and Lightweight Charts 5.
