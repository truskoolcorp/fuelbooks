/** Read-only schema boundary, not authentication or source verification.
 * Future server gateway must enforce FULL_FINANCE and derive scope from session.
 * No endpoint, credentials, source connection or mutation is configured here. */
export function disconnectedFinance() {
  return {
    schemaVersion: 1, contractVersion: 1, status: 'NOT_CONNECTED', readOnly: true,
    reason: 'NO_VERIFIED_FUELBOOKS_ADAPTER',
    message: 'No authenticated accounting source is connected to this FuelBooks workspace.',
    source: { system: 'fuelbooks', status: 'NOT_CONNECTED', observedAt: null, complete: false },
    mapping: null, financials: null, metrics: null, records: null,
    capabilities: { readOnly: true, ledgerPosting: false, payments: false, migrationReady: false },
  };
}
const sources = new Set(['quickbooks', 'fuelbooks']);
const text = value => typeof value === 'string' && value.trim().length > 0;
const decimal = value => typeof value === 'string' && /^-?\d+(?:\.\d{1,8})?$/.test(value);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
// Date.parse normalizes 24:00 into the next day. Reject noncanonical times
// before parsing so source observation times are never silently rewritten.
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/.test(value) && date(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
const currency = value => typeof value === 'string' && /^[A-Z]{3}$/.test(value);
const invalid = reason => ({ ...disconnectedFinance(), status: 'REVIEW_REQUIRED', reason,
  message: 'Source records need verification before financial data can be shown.' });

/** Shape-check a trusted server's complete project-invoice snapshot.
 * Decimal strings are preserved. No cash receipts or financial totals are
 * inferred: invoice total minus balance is not proof of cash paid.
 * This function must NOT be wired to public/browser-submitted snapshot input.
 */
export function validateInvoiceSnapshot(snapshot, scope) {
  if (scope?.authorized !== true) return { ...disconnectedFinance(), status: 'RESTRICTED', message: 'Finance access is required.' };
  if (!snapshot) return disconnectedFinance();
  if (!text(scope.companyId) || !text(scope.projectId)) return invalid('SCOPE_REQUIRED');
  if (snapshot.schemaVersion !== 1 || snapshot.readOnly !== true || snapshot.status !== 'CONNECTED') return invalid('SOURCE_STATUS');
  const source = snapshot.source;
  if (!source || !sources.has(source.system) || source.companyId !== scope.companyId || source.complete !== true || !text(source.evidenceRef)) return invalid('SOURCE_PROVENANCE');
  const observed = Date.parse(source.observedAt);
  const now = scope.now ?? Date.now();
  const maxAge = scope.maxAgeMs ?? 300000;
  if (!timestamp(source.observedAt) || !Number.isFinite(now) || !Number.isFinite(maxAge) || maxAge <= 0 || observed > now) return invalid('SOURCE_TIMESTAMP');
  if (now - observed > maxAge) return { ...invalid('SOURCE_STALE'), status: 'STALE' };
  const mapping = snapshot.mapping;
  if (!mapping || mapping.status !== 'VERIFIED' || mapping.projectId !== scope.projectId || !text(mapping.sourceProjectId) || !text(mapping.evidenceRef)) return invalid('PROJECT_MAPPING');
  if (!Array.isArray(snapshot.invoices) || snapshot.pagination?.complete !== true || snapshot.pagination?.nextCursor != null || snapshot.pagination?.totalCount !== snapshot.invoices.length) return invalid('INCOMPLETE_RECORDS');
  const seen = new Set();
  const invoices = [];
  for (const row of snapshot.invoices) {
    if (!row || !text(row.sourceId) || seen.has(row.sourceId) || row.companyId !== scope.companyId || row.sourceProjectId !== mapping.sourceProjectId || !text(row.evidenceRef)) return invalid('RECORD_IDENTITY');
    if (!currency(row.currency) || !decimal(row.total) || !decimal(row.balance) || (row.tax !== null && !decimal(row.tax))) return invalid('RECORD_AMOUNT');
    if (!text(row.documentNumber) || !date(row.date) || (row.dueDate !== null && !date(row.dueDate))) return invalid('RECORD_FIELDS');
    seen.add(row.sourceId);
    // Allow-list prevents forwarding secrets, contacts, raw payloads, arbitrary
    // URLs or caller-claimed aggregates to a browser.
    invoices.push({ sourceId: row.sourceId, documentNumber: row.documentNumber,
      date: row.date, dueDate: row.dueDate, currency: row.currency,
      total: row.total, balance: row.balance, tax: row.tax });
  }
  return {
    schemaVersion: 1, status: 'CONNECTED', readOnly: true,
    source: { system: source.system, companyId: source.companyId, observedAt: source.observedAt, complete: true },
    mapping: { status: 'VERIFIED', projectId: mapping.projectId, sourceProjectId: mapping.sourceProjectId },
    invoices, financials: null,
  };
}
