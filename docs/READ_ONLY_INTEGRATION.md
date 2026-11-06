# FuelBooks: verified read-only integration boundary

This local patch removes fictional runtime business data. It does not connect a ledger, complete a migration, or replace QuickBooks.

## Deployment boundary

The existing Next.js configuration uses `output: 'export'`. There is no authenticated server route, and public HTML must never contain accounting records. The only mounted workspace therefore displays NOT_CONNECTED, with unknown financial values and no financial actions. Do not hydrate a public static page with private invoices. Do not enable the retained legacy workspace by passing data directly to it.

The existing AP Fuel admin application can expose a finance-protected status route behind its existing FULL_FINANCE session. Its status response should include:

- `contractVersion: 1`
- `status: 'NOT_CONNECTED'`
- `reason: 'NO_VERIFIED_FUELBOOKS_ADAPTER'`
- `source: { system: 'fuelbooks', status: 'NOT_CONNECTED', observedAt: null, complete: false }`
- `metrics: null`, `records: null`
- `capabilities: { readOnly: true, ledgerPosting: false, payments: false, migrationReady: false }`

An optional generatedAt timestamp is only the time that status was generated, not the time accounting data was observed. Do not present it as a last-sync time.

## Future invoice snapshot adapter

`lib/finance-contract.mjs` defines a separate, pure `validateInvoiceSnapshot` schema boundary. It performs no fetching, OAuth, writes, imports or permission changes. It is not an authentication mechanism and cannot establish that a record is real. Only an authenticated, authorized server adapter may supply the snapshot and trusted scope.

Required server responsibilities before using the validator:

1. Enforce the existing AP Fuel session and FULL_FINANCE role on every read. Deny anonymous and operations-only sessions before contacting a provider. Use private, no-store caching.
2. Select company and authorized project scope server-side. Never accept the caller's role, company, project ownership, verified flags or evidence as authority.
3. Keep QBO company, source customer/job, Pipedrive deal and eventual FuelBooks project identifiers distinct. Use approved explicit mappings with evidence. Names and locations are only review suggestions.
4. Page through every requested record; mark completion false on any failure, truncation or partial result. Preserve missing fields as unknown.
5. Preserve provider document IDs, version/change identifiers, original currency, decimal amounts, dates, tax amounts and source references. Do not infer payment receipts from invoice total minus balance.
6. Use only approved source/endpoint configuration on the server, not arbitrary user-provided URLs. Keep credentials off the client, logs and exported files.

The validator requires an explicit company/project scope, complete pagination, source identity and observation time, a verified project mapping, unique record IDs, real calendar dates and decimal-string amounts. Invalid, stale or incomplete input has no returned invoice records or financial aggregates. Unknown tax and due date are explicit null values. It returns an allow-listed presentation projection only.

A passing schema check is NOT production integration proof. No invoice snapshot is wired to the static UI in this patch.

## Preserved code

`legacy/FuelBooksWorkspace.js` retains the prior workspace layout for selective future reuse, but its business seeds and simulated invoice/payment generation are removed. It is not imported by the application entry. Payroll employee/pay-run seeds are removed, and payroll and ingestion modules are not mounted. Their accounting behavior and hard-coded tax rules are not approved for production.

## Verification

- `npm test`: schema rejection and no-seeded-runtime regression tests. Contract probes are isolated to tests and never appear in production.
- `npm run build`: production Next.js static export.
- `git diff --check`: patch whitespace.
- `npm run audit:export`: repeatable scan of exported HTML and bundles for known retired fictional business records, test probes, zero-balance claims and financial submission/upload controls.
- `npm run verify`: all contract/regression tests, production build and export audit in order.

The invoice boundary rejects rollover clock values such as 24:00 rather than allowing JavaScript to normalize them into a different date. Currency must be a three-letter uppercase string; arrays and objects are rejected without coercion. These checks validate shape, not provider authenticity or accounting accuracy.

Browser interaction and visual QA must also pass on desktop and mobile before publication. The current execution environment could not launch Chromium due to socket restrictions. No live integration or deployment verification is claimed.
