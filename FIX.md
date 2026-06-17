# DSPA Frontend Security Fix Report

Audit date: 2026-06-17

Scope: `dspa-frontend`

Inputs:

- `MINIMAL_RUN.md`
- `package.json`
- `package-lock.json`
- Source review under `src/`
- `npm audit --json` using npm 11.6.2 and Node v22.21.1

Notes:

- This report lists only unresolved findings. Fixed findings have been removed.
- `MINIMAL_RUN.md` uses npm for the frontend, so this report treats `package-lock.json` as the dependency audit source of truth.
- `package-lock.json` is now the only frontend lockfile; keep npm as the single package manager source of truth.
- Current `npm audit` reports 16 vulnerable dependency entries: 0 critical, 10 high, 6 moderate, and 0 low.
- `react-scripts` is already at its latest published version, `5.0.1`. npm reports a forced fix path to `react-scripts@0.0.0`, but that is not a practical application fix. Treat `react-scripts`-pinned findings as requiring a CRA migration, replacement build tooling, or carefully tested npm overrides.

## Application Findings

| Fixed | Finding | Current version / state | Fixed version / state | Fix available | Severity |
| --- | --- | --- | --- | --- | --- |
| - [ ] | Client-side authentication bypass | `dspa-frontend@0.2.0`; `src/index.js` hardcodes `lipatlas` / `lipatlas` and trusts `localStorage.isAuthenticated === "true"` | Enforce authentication and authorization on the backend for `/api/v1/*`; frontend should only reflect backend session/token state | Yes | High |
| - [ ] | Plaintext credentials committed in frontend | `.env` contains `USERNAME_WEBSITE=lipatlas` and `PASSWORD_WEBSITE=lipatlas`; credentials are also embedded in bundled client code | Remove credentials from frontend files, rotate the shared password, and store secrets only in backend/server-side secret management | Yes | High |

## Dependency Findings

| Fixed | Package | Current version | Fixed version | Fix available | Severity | Vulnerability / path |
| --- | --- | --- | --- | --- | --- | --- |
| - [ ] | `@svgr/plugin-svgo` | 5.5.0 | 6.0.0+ | Only via CRA migration/overrides | high | via `svgo` |
| - [ ] | `@svgr/webpack` | 5.5.0 | 6.0.0+ | Only via CRA migration/overrides | high | via `@svgr/plugin-svgo` |
| - [ ] | `css-select` | 2.1.0 | 3.1.1+ | Only via CRA migration/overrides | high | via `nth-check` |
| - [ ] | `nth-check` | 1.0.2 | 2.0.1+ | Only via CRA migration/overrides | high | Inefficient regex complexity |
| - [ ] | `rollup-plugin-terser` | 7.0.2 | Replace vulnerable path through CRA migration/overrides | Only via CRA migration/overrides | high | via `serialize-javascript` |
| - [ ] | `serialize-javascript` | 4.0.0, 6.0.2 | 7.0.5+ | Only via CRA migration/overrides | high | RCE and CPU exhaustion |
| - [ ] | `svgo` | 1.3.2, 2.8.0 | 2.8.1+ | Only via CRA migration/overrides | high | Entity expansion DoS and vulnerable selector path |
| - [ ] | `workbox-build` | 6.6.1 | 7.1.0+ | Only via CRA migration/overrides | high | via `rollup-plugin-terser` |
| - [ ] | `workbox-webpack-plugin` | 6.6.1 | 7.1.0+ | Only via CRA migration/overrides | high | via `workbox-build` |
| - [ ] | `css-minimizer-webpack-plugin` | 3.4.1 | 8.0.0+ | Only via CRA migration/overrides | moderate | via `serialize-javascript` |
| - [ ] | `postcss` | 8.5.3, 7.0.39 | 8.5.10+ | Only via CRA migration/overrides | moderate | CSS stringify XSS / parser issue |
| - [ ] | `resolve-url-loader` | 4.0.0 | 5.0.0+ | Only via CRA migration/overrides | moderate | via `postcss` |
| - [ ] | `sockjs` | 0.3.24 | Replace vulnerable path through CRA migration/overrides | Only via CRA migration/overrides | moderate | via `uuid` |
| - [ ] | `uuid` | 8.3.2 | 11.1.1+ | Only via CRA migration/overrides | moderate | Buffer bounds issue |
| - [ ] | `webpack-dev-server` | 4.15.2 | 5.2.4+ | Only via CRA migration/overrides | moderate | Cross-origin source exposure |
| - [ ] | `react-scripts` | 5.0.1 | No fixed 5.x release; migrate from CRA or replace build tooling | No practical in-place fix | high | Direct dependency aggregating vulnerable build/test tooling |

## Recommended Fix Order

1. Replace the frontend-only login gate with backend-enforced authentication and authorization before relying on the app for access control.
2. Remove and rotate the hardcoded `lipatlas` credentials.
3. Plan a migration away from Create React App / `react-scripts`, or replace the build tooling, to remove the pinned CRA dependency chain.
4. Continue narrow npm overrides for remaining fix-available transitive findings, reviewing and testing each lockfile change.
