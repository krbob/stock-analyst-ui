# Development guide

This document covers local development, verification and the two versioned contracts maintained by Stock Analyst
UI. Deployment-specific behavior is documented in [DEPLOYMENT.md](DEPLOYMENT.md).

## Prerequisites

- Node.js `24.18.0` from `.node-version`.
- npm `11.16.x` as declared in `package.json`.
- Stock Analyst API listening on `http://localhost:8080` for interactive development.
- Docker for production-image and container checks.
- Playwright Chromium for browser tests.

Install exactly from the lockfile without dependency lifecycle scripts:

```bash
npm ci --ignore-scripts
```

## Local request model

Browser code always targets same-origin `/api`; there is intentionally no `VITE_API_URL`. During development,
Vite forwards `/api/*` to `http://localhost:8080` and removes the `/api` prefix. In the container, Nginx performs the
same translation against the required `API_URL` upstream.

```text
Development: browser /api/v1/quote/AAPL -> Vite  -> http://localhost:8080/v1/quote/AAPL
Container:   browser /api/v1/quote/AAPL -> Nginx -> ${API_URL}/v1/quote/AAPL
```

Start the development server with:

```bash
npm run dev
```

Optional local settings belong in `.env.local`. Only `VITE_SHOW_CHART_ATTRIBUTION` and `VITE_PORTFOLIO_URL` are
supported. Every `VITE_*` value is public browser configuration and must never contain a secret.

## Project layout

```text
src/api/          pinned generated OpenAPI client, adapters and TanStack Query hooks
src/components/   analysis, chart, navigation, provenance and accessibility components
src/data/         browser-supported currency definitions
src/hooks/        debounce and theme/chart-theme hooks
src/lib/          formatting, recommendations, app links, themes and provenance helpers
src/styles/       framework-neutral token contract and manifest
e2e/              Playwright accessibility, mobile, offline, hand-off and fan-out checks
openapi/          pinned backend contract snapshot and source manifest
public/           PWA shell, runtime-config stub, icons and pre-paint theme bootstrap
scripts/          contract, token, coverage and supply-chain validation
```

Generated files under `src/api/generated` must not be edited manually.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite on port 5173. |
| `npm run build` | Supply-chain, OpenAPI and token checks, TypeScript build and production bundle. |
| `npm run preview` | Serve an existing production bundle. |
| `npm run docs:check` | Verify relative documentation links and documented configuration contracts. |
| `npm run lint` | Run ESLint over the repository. |
| `npm test` | Run the Node contract test, token check and Vitest suite. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run test:coverage` | Run all-source coverage with fixed floors. |
| `npm run coverage:report` | Render the existing JSON coverage summary. |
| `npm run test:e2e:ci` | Run the blocking Chromium browser suite against `BASE_URL`. |
| `npm run contract:check` | Verify snapshot integrity and deterministic generated-client output. |
| `npm run contract:generate` | Regenerate the client from the pinned snapshot and update its tree hash. |
| `npm run tokens:check` | Verify token inventory, version and SHA-256. |
| `npm run supply-chain:check` | Verify immutable tool, Action and container policy. |

Coverage includes all owned source files rather than only modules reached by tests. Scope, exclusions and fixed
non-auto-updating thresholds live in `coverage-baseline.json`. Generated API code, tests and declarations are the
intended exclusions.

## Browser tests

The offline test must exercise the production container: Vite development mode does not register the service worker,
and `vite preview` does not reproduce the Nginx cache and fallback behavior gated by CI. Build and start the same
container shape used by the workflow:

```bash
docker build -t stock-analyst-ui:e2e .
docker run --rm -d --name stock-analyst-ui-e2e -p 3000:8080 \
  -e API_URL=http://localhost:8080 \
  -e 'PORTFOLIO_URL=https://portfolio.example/app?tenant=personal' \
  stock-analyst-ui:e2e
```

The upstream does not need to be reachable for mocked market-data flows, but `API_URL` remains a required container
setting. Install Chromium once and run the blocking suite:

```bash
npx playwright install chromium
BASE_URL=http://127.0.0.1:3000 npm run test:e2e:ci
docker stop stock-analyst-ui-e2e
```

The blocking suite mocks canonical `/api/v1` market-data responses and covers:

- single-stock and comparison accessibility with automated WCAG A/AA rules;
- keyboard search, currency, mode and application-switcher flows;
- 320 px and 375 px layouts;
- offline query-string reload of the cached application shell;
- request fan-out and reuse of cached active-indicator results;
- transient Portfolio hand-off of theme and browser locale without analysis-state leakage.

CI currently installs Chromium only. Before a release that changes locale, theme initialization, scrolling, service
worker behavior or responsive controls, manually check current Chrome on Windows and Safari on macOS as well. This
is a documented gap, not a claim of automated cross-browser coverage.

### Screenshots

The files named `docs/screenshot-*.png` were generated before the current provenance, app-switcher and
active-indicator behavior. They are deliberately not embedded in the README.

`npm run screenshots` is a legacy maintainer command that currently reads mutable market data from a running API.
Do not point it at production and do not use it as a release check. Before publishing a new gallery, change
`e2e/screenshots.spec.ts` to reuse deterministic local fixtures, run it against a local production build, review all
themes and viewport sizes, and commit the images with the behavior change.

Avoid an unqualified `npx playwright test`: it also discovers the screenshot-writing spec. Use the named npm script
for the blocking suite.

## OpenAPI client contract

`openapi/stock-analyst-v1.json` is an intentionally pinned snapshot. `openapi/manifest.json` records its backend
repository, source commit, path and SHA-256 together with the exact generator version and generated-tree hash.

`npm run contract:check` proves that the committed client can be reproduced from that snapshot. It does **not**
prove that the snapshot matches the current backend `main` branch.

When an API change is intentionally adopted:

1. Select a tested Stock Analyst backend commit.
2. Replace `openapi/stock-analyst-v1.json` with the canonical specification from that commit.
3. Update `source.commit`, `source.path` and `snapshot.sha256` in `openapi/manifest.json`.
4. Run `npm run contract:generate`.
5. Review the generated diff, then run `npm run contract:check`, `npm test` and `npm run build`.

Use `shasum -a 256 openapi/stock-analyst-v1.json` to calculate the snapshot digest on macOS. Never repair contract
drift by editing `src/api/generated` directly.

## Design-token contract

`src/styles/tokens.css` is the portable `stock-ecosystem-ui` contract. Public consumers may depend on semantic and
component `--ui-*` properties. `--ui-ref-*` primitives are private implementation details.

`src/styles/tokens.manifest.json` records:

- contract and schema versions;
- light, dark and system theme support;
- public layers and complete token inventory;
- SHA-256 of `tokens.css`.

For an intentional contract change:

1. Update `tokens.css` and bump the manifest contract version.
2. Update the manifest inventory when tokens are added, removed or moved.
3. Calculate and store the new CSS digest.
4. Run `npm run tokens:check`, unit tests, browser checks and visual review.
5. Update consumers by vendoring `tokens.css` and the manifest together and recording this repository's source
   commit. There is currently no automatically published token package.

Consumers must not copy only selected primitives or silently overwrite a vendored manifest. Compatibility should be
reviewed from the public semantic/component inventory and contract version.

## Continuous integration

`.github/workflows/ci-build.yml` is the source of truth. It gates documentation links/configuration, dependency
advisories, deterministic contracts, types, lint, all-source coverage, container lint, image SBOM, actionable
HIGH/CRITICAL image findings and the Chromium browser suite. A successful push to `main` publishes multi-platform
`linux/amd64` and `linux/arm64` images with provenance and SBOM attestations.

Renovate behavior belongs in `renovate.json`; do not duplicate its exact schedule or grouping rules in prose.
