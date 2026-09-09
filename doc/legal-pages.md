# Privacy and terms templates

The Microsoft app manifest already names `https://dynaprot.org/privacy` and
`https://dynaprot.org/terms`. Previously, the frontend had no matching pages; the
production Express fallback returned the React application, whose login screen
hid the routes from anonymous visitors.

The templates now live in `public/privacy/index.html` and `public/terms/index.html`.
They are ordinary HTML documents served before the React fallback. The extensionless
URLs redirect to the corresponding directory URL with a trailing slash and then
return HTML. They require neither a sign-in nor JavaScript. Their CSS and favicon
are hosted on the same site.

## Complete before publication

The operator should edit the HTML directly and replace all bracketed fields:

- Responsible legal entity, postal address, privacy and service contacts. The
  existing Impressum's optional lab link does not establish the data controller.
- Effective dates, actual hosting providers/countries, other recipients and any
  international processing arrangements.
- Retention and deletion rules for operational/SQL logs, authentication records,
  memories and backups. The code does not establish approved retention periods.
- Applicable data-protection law and processing grounds, rights-request handling
  and supervisory contact.
- Approved DSPA data-reuse licence, citation, service commitments, liability,
  change-notification process and governing-law provisions.

Confirm the described behavior against the deployed configuration, then remove the
visible draft-template notice. These documents are starting text for review; they
do not establish legal compliance or replace the operator's existing agreements.

## Basis for the privacy wording

Source paths below are relative to the frontend repository root.

- `src/index.js` stores the website's `isAuthenticated` flag in local storage.
- `public/index.html` loads Google Fonts for the React application. The legal
  pages themselves use system fonts and do not load the application bundle.
- The research frontend uses UniProt and EMBL-EBI/AlphaFold services. The MCP
  tools also support UniProt lookups.
- `../dspa-main/index.mjs` and its reverse proxy handle website requests; the
  development Express logger and deployed proxy settings determine HTTP logging.
- `../dspa-mcp/database_mcp-fat.yml` enables SQL file auditing, caller-isolated
  memory by default, ETHZ/Entra authentication, and persisted OAuth state.
- `../dspa-mcp/documentation/FAT_COPILOT_DEPLOYMENT.md` describes the separate
  production MCP listener on port 7778 and persistent storage.
- `../dspa-mcp/technical_doc/MS365.md` describes the two OAuth relationships:
  Copilot to DSPA and DSPA to ETHZ/Entra. Copilot conversations and tool exchanges
  also pass through Microsoft's service.
- `../dspa-mcp/src/mcp/web.rs` also supports optional diagnostic payload logging.
  If enabled in the deployed service, extend the notice to cover logged tool
  arguments, which can include memory content, and their retention/access rules.

The template structure follows the topics in the Swiss data-protection authority's
[privacy-statement guidance](https://www.edoeb.admin.ch/en/privacy-statements-on-the-internet):
responsibility, collected data, purpose, recipients, retention and user rights.
The applicable legal obligations still depend on the confirmed operator and users.

## Build and deploy

Run `npm run build` in `dspa-frontend` to include the reviewed documents. The
production `dspa-main/Dockerfile` already copies and builds this frontend; deploy
the updated webapp image through the existing website release process. Rebuilding
or redeploying only the MCP server on port 7778 will not update the website on 443.

After the website deployment, verify anonymously:

```bash
curl --fail --location https://dynaprot.org/privacy
curl --fail --location https://dynaprot.org/terms
```

Each final response should be HTML containing the matching document heading,
with completed operator details and no draft-template notice. Also open the links
from the login screen and check them with JavaScript disabled. The Microsoft ZIP
does not need rebuilding for unchanged privacy and terms URLs.
