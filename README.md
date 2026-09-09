[![Tests](https://github.com/bourumir-wyngs/dspa-frontend/actions/workflows/test.yml/badge.svg)](https://github.com/bourumir-wyngs/dspa-frontend/actions/workflows/test.yml)

# DSPAtlas Frontend

[![Run Tests](https://github.com/bourumir-wyngs/dspa-frontend/actions/workflows/tests.yml/badge.svg)](https://github.com/bourumir-wyngs/dspa-frontend/actions/workflows/tests.yml)

## Function of this subproject

This subproject provides the browser-based user interface for the DSPAtlas/DynaProt platform. It is responsible for:

- authenticating access to the application,
- letting users search for proteins and browse conditions and experiments,
- rendering protein-centric visualizations that combine sequence context, structural references, and experiment-derived LiP score data,
- presenting experiment metadata, significant protein summaries, volcano plots, and GO enrichment views.

In the wider DSPA workspace, `dspa-frontend` is the presentation layer that consumes data prepared by the DSPA backend and exposes it as an interactive web application.

## Technologies
Built as a React 18 single-page application with React Router-based navigation and Create React App tooling, this frontend combines custom DSPA UI components with `react-select`-driven filtering and Nightingale web components for protein sequence/structure views. Data-rich charts such as volcano plots and GO enrichment views are rendered with D3.js, while the application integrates both the internal DSPA backend API and the UniProt REST API for biological data and structure references.

## E2E tests

Playwright tests live in `e2e/` and run against `http://localhost:3000` by default. Start the frontend separately before running the e2e suite.

- Install browser binaries once with `npx playwright install`.
- Run the suite with `npm run e2e`.
- Run interactively with `npm run e2e:ui`.

Set `PLAYWRIGHT_BASE_URL` only if you intentionally need to point the browser at a different local frontend URL.

## Backend API used by the frontend

The frontend talks primarily to the DSPA backend through the relative base path configured in `src/config.json`:

- `apiEndpoint`: `/api/v1/`

The application uses this backend API to retrieve searchable protein records, condition overviews, experiment metadata, experiment-level statistics, and GO enrichment data that are then rendered in the UI.

In addition to the internal DSPA API, the frontend also calls the external UniProt REST API to resolve structure references for a selected protein accession:

- `https://rest.uniprot.org/uniprotkb/{accession}.json`

That UniProt response is used to extract linked PDB entries and to supplement AlphaFold structure handling in the protein/condition visualizations.

## External endpoints consumed by the frontend

### DSPA backend endpoints

- `GET /api/v1/search?searchTerm=...`
  - Used by the Home and Search views to look up proteins and navigate to either a result list or a protein visualization page.
- `GET /api/v1/proteins?proteinName=...`
  - Fetches protein-specific data shown in the protein visualization and condition-driven protein detail views.
- `GET /api/v1/experiments`
  - Returns the experiment catalogue used by the experiments overview page and its filters.
- `GET /api/v1/experiment?experimentID=...`
  - Returns experiment metadata, differential abundance data, and significant protein summaries for a single experiment.
- `GET /api/v1/experiment?experimentID=...&includeQcPdf=true`
  - Retrieves QC PDF payload data for download from the experiment detail page.
- `GET /api/v1/condition/allconditions`
  - Provides the condition list used on the home page and in the condition view selector.
- `GET /api/v1/condition/data?condition=...`
  - Loads condition-specific experiment/protein data for the condition detail page.
### External third-party endpoint

- `GET https://rest.uniprot.org/uniprotkb/{accession}.json`
  - Used to discover UniProt-linked PDB entries and enrich structure selection for Nightingale-based views.

## Components overview

### Application shell and routing

- `src/index.js`
  - Application entry point.
  - Sets up routing, top-level navigation, and a simple login gate before exposing the main UI.

### Public privacy and terms pages

- `public/privacy/index.html` provides `/privacy` (redirecting to `/privacy/`).
- `public/terms/index.html` provides `/terms` (redirecting to `/terms/`).
- `public/legal.css` supplies their shared styling without third-party fonts or scripts.
- `src/components/LegalLinks.jsx` links to both documents from the login screen and application.

These are **draft templates**, not approved policies. Complete the bracketed fields and confirm
the processing descriptions before publishing. See [the publication notes](doc/legal-pages.md).
Create React App copies the files into `build/`. The production server in `dspa-main/index.mjs`
serves that directory with `express.static` before the React fallback, so these documents are
readable without JavaScript, an app login or a database request. Links deliberately use ordinary
anchors rather than React Router navigation. No MCP endpoint or Microsoft app-manifest change
is needed: the manifest already points to `https://dynaprot.org/privacy` and
`https://dynaprot.org/terms`.

### Main route components

- `src/components/Home.jsx`
  - Landing page with quick protein search and condition selection.
- `src/components/Search.jsx`
  - Dedicated protein search page with navigation to visualization results.
- `src/components/ProteinView.jsx`
  - Protein-centered view that loads backend protein data and external structure references.
- `src/components/ExperimentsOverview.jsx`
  - Filterable table of experiments with navigation into a selected experiment.
- `src/components/ExperimentView.jsx`
  - Detailed experiment page with metadata, significant proteins, volcano plots, and QC PDF download.
- `src/components/ConditionView.jsx`
  - Condition-focused analysis page combining protein selection, structural context, and volcano plots.
- `src/components/Impressum.jsx`
  - Static informational/legal page.
- `src/components/LoginForm.jsx`
  - Login form shown before the rest of the application is rendered.

### Shared UI and visualization components

- `src/components/NightingaleComponent.jsx`
  - Core interactive visualization component for sequence/structure rendering and LiP score overlays.
- `src/components/ProteinSearchResults.jsx`
  - Reusable search results table/list for protein lookups.
- `src/visualization/volcanoplot.js`
  - Volcano plot rendering for experiment and condition analyses.
- `src/visualization/ProteinScoresTable.js`
  - Tabular presentation of protein scoring/condition-associated results.

### Utilities and configuration

- `src/config.json`
  - Stores the backend base path used by the frontend.
