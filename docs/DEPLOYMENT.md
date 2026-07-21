# Deployment guide

Stock Analyst UI is a static React application served by an unprivileged Nginx container. Nginx also exposes the
same-origin `/api` proxy, so browsers do not need the backend origin or CORS access.

## Published image

The `main` workflow publishes `linux/amd64` and `linux/arm64` images to:

```text
ghcr.io/krbob/stock-analyst-ui
```

CI creates a commit tag named `sha-<short-commit>` and also updates `latest`. Treat `latest` as a discovery alias,
not a deployment reference. Production Compose files must pin the tested manifest digest:

```yaml
services:
  stock-analyst-ui:
    image: ghcr.io/krbob/stock-analyst-ui@sha256:REPLACE_WITH_64_HEX_DIGEST
    restart: unless-stopped
    environment:
      API_URL: http://stock-analyst:8080
      SHOW_CHART_ATTRIBUTION: "true"
      PORTFOLIO_URL: https://portfolio.example.com
    ports:
      - "3001:8080"
```

Resolve and review the digest from a successful workflow before editing the stack:

```bash
docker buildx imagetools inspect ghcr.io/krbob/stock-analyst-ui:sha-<short-commit>
```

Retain the previous digest in deployment history so rollback is a one-line image change.

The repository's root [Compose stack](../docker-compose.yml) intentionally uses moving tags to make a disposable
three-service evaluation possible with one command. It is not a production template. Durable installations should
override all three image variables with mutually compatible digest references and keep the same readiness chain.

## Runtime configuration

The image is built once and configured when the container starts.

### `API_URL`

`API_URL` is required. The entrypoint refuses to start when it is empty and substitutes the trusted value into the
Nginx proxy configuration. It is server-side configuration, not browser JavaScript.

Use a backend base without a trailing slash, normally:

```text
http://stock-analyst:8080
```

The mapping is:

```text
browser GET /api/v1/history/AAPL
       -> Nginx GET ${API_URL}/v1/history/AAPL
```

If the backend is in another Compose stack, both containers need a shared external Docker network and the upstream
service name must resolve from the UI container. `localhost` means the UI container itself. A stable public upstream
such as `https://stock.example.com/api` also works, but routes API traffic through the public reverse proxy; a direct
private network is simpler and avoids that extra dependency.

`API_URL` is inserted into Nginx syntax. It must come from trusted deployment configuration, never request data or
an untrusted tenant setting.

### `SHOW_CHART_ATTRIBUTION`

The default is `true`. The values `false`, `0`, `no` and `off` are recognized case-insensitively as disabled. Any
other or missing value keeps the footer visible.

The runtime value overrides the build-time `VITE_SHOW_CHART_ATTRIBUTION` fallback.

### `PORTFOLIO_URL`

When set, this enables the Portfolio switcher. Accepted destinations are a same-origin root-relative path or an
absolute HTTP(S) URL without credentials. Invalid, executable-scheme, protocol-relative and control-character
values are not rendered.

The destination receives only:

- `uiTheme`: `light`, `dark` or `system`;
- `uiLocale`: canonical first browser locale, used as a navigation-only hint.

Selected symbols, currency and analysis state are deliberately excluded. The destination must not persist an
automatically supplied locale as an explicit user choice.

At startup, the entrypoint safely encodes `PORTFOLIO_URL` into `/runtime-config.js`. That response is sent with
`no-cache, no-store, must-revalidate`. Do not place credentials or secrets in it: the browser can read it.

## Reverse proxy

The container listens as non-root user 101 on port 8080. A reverse proxy should route the public application host to
that port. There are two supported API-routing topologies:

1. **Container-owned proxy:** send the whole application host to the UI container. Nginx owns `/api`, removes that
   prefix and forwards to `API_URL`. The outer proxy must not strip it first.
2. **Split edge routing:** send `/api/*` directly to Stock Analyst API and all other paths to the UI container. The
   edge router removes `/api` exactly once. In this layout the browser normally bypasses the UI container's API
   proxy, but `API_URL` remains required by the image entrypoint and provides a valid fallback path.

Do not combine both prefix transformations. A request for `/api/v1/quote/AAPL` must reach the backend as
`/v1/quote/AAPL`, not `/api/v1/quote/AAPL` or `/quote/AAPL`.

The bundled Nginx configuration sends:

- a restrictive same-origin Content Security Policy;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Referrer-Policy: same-origin`.

Hashed JavaScript, CSS, font and image assets receive one-year immutable caching. `/runtime-config.js` and `/sw.js`
must retain their no-cache/no-store policies through any outer proxy.

## Health semantics

The image declares a Docker health check against:

```text
GET http://127.0.0.1:8080/healthz
```

This endpoint proves only that Nginx can serve the static shell. It does **not** call Stock Analyst API, yfinance or
any market-data provider. Use it as container liveness, not ecosystem readiness.

Backend readiness must be checked separately before exposing a coupled rollout. A healthy UI with an unavailable
API will load its shell and then show request errors.

## Service worker and cache

Production builds register `/sw.js`. It precaches the shell and hashed build assets and uses network-first behavior
for navigation/static requests. Requests under `/api/*` bypass the service worker entirely.

Consequences:

- offline navigation can reopen a previously cached UI route;
- quotes, history, search and comparisons are unavailable offline;
- a successful UI health check says nothing about cached or current market data;
- after rollback, verify both a fresh browser profile and an existing profile with an installed service worker.

When diagnosing an apparent old frontend, compare the hashed asset referenced by `/index.html`, inspect
`/runtime-config.js`, and check the active service worker in browser developer tools before changing backend data.

## Rollout

1. Wait for the exact commit's test and publish jobs to succeed.
2. Record the new image digest and the currently deployed rollback digest.
3. For a coordinated contract change, deploy and verify the compatible backend first.
4. Pull the pinned digest and recreate only the UI service.
5. Verify container health, public headers, a backend request and the critical browser flows below.
6. Keep the previous image available until existing-profile/service-worker checks pass.

Example HTTP checks, using the deployment's real hostname:

```bash
curl -fsS https://stock.example.com/healthz
curl -fsSI https://stock.example.com/runtime-config.js
curl -fsS https://stock.example.com/api/v1/quote/AAPL >/dev/null
```

Browser verification should cover:

- clean-profile and existing-profile startup without raw fetch errors;
- symbol search, quote/history chart and provenance status;
- intraday and long historical ranges;
- currency success plus a classified unavailable-FX response;
- light, dark and system themes;
- 320 px mobile layout and keyboard navigation;
- Portfolio destination, theme hint and browser locale hint;
- online-to-offline shell reload without claiming offline data availability.

For locale-sensitive changes, check Chrome on Windows and Safari on macOS. Automated CI currently covers Chromium,
not WebKit.

## Rollback

Replace the image reference with the recorded previous digest and recreate the UI service. A frontend-only rollback
is safe only while the deployed backend still satisfies the older pinned OpenAPI contract. Repeat the HTTP and
existing-browser checks after rollback; immutable assets and an installed service worker can make a browser symptom
look newer or older than the running container.
