# FuelBooks Pro

FuelBooks finance workspace, currently disconnected from an authenticated accounting source. This build shows explicit unavailable states, not sample transactions or fabricated balances. QuickBooks remains the accounting source of record until a verified replacement is accepted.

## Local development

```sh
npm ci
npm test
npm run dev
npm run build
npm run audit:export
```

The project currently exports a static site to `out/`. It has no authenticated API or durable ledger. Do not place private financial records into the static output.

See [the read-only integration contract](docs/READ_ONLY_INTEGRATION.md) for scope, security boundaries and the future authenticated server adapter requirements.

No invoice, payment, tax, payroll, import, send or ledger-posting action is enabled in the mounted workspace. Existing source components are retained for development review, not production accounting use.

`npm run verify` runs the contract/regression tests, production export and static-export safety audit together. The audit rejects known retired business seeds, test probes, misleading zero-balance text, upload controls and submission forms. It supplements browser QA; it does not prove a live accounting connection or verify real business data.
