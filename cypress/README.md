# End-to-end tests (Cypress)

These smoke specs drive the real app against a real connector, so they need three things running:

1. **The Vite dev server** — `npm run dev` (serves the app at `http://localhost:5173`, the Cypress `baseUrl`).
2. **A HikaShop site with the connector plugin** — e.g. the local Joomla site at `http://localhost:8080/joomla6`.
3. **`cypress.env.json`** — a paired device token so the suite can talk to the connector without the interactive pairing flow. Copy `cypress.env.example.json` to `cypress.env.json` (gitignored) and fill in:
   - `storeUrl` — the site's base URL
   - `storeId` / `storeName` — any identifiers (used only for the seeded local store)
   - `token` — a device token with `read,write` scope (create a device under **System › App Devices** in the backend, or reuse an existing one)

The `visitApp` command (in `support/commands.ts`) seeds these into the app's `localStorage` (the same `hk.data.*` / `hk.secret.*` keys the app uses) so it boots already connected.

## Running

```bash
npm run e2e        # headless (cypress run)
npm run cypress    # interactive (cypress open)
```

The specs are deliberately data-agnostic (they assert "at least one row", open the first item, etc.) so they pass against any seeded store rather than depending on specific records.
