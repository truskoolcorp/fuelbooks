import test from 'node:test';
import assert from 'node:assert/strict';
import { disconnectedFinance, validateInvoiceSnapshot } from '../lib/finance-contract.mjs';
// Isolated contract probes, never business records or application seed data.
const observedAt = '2026-11-03T00:00:00.000Z';
const scope = { authorized: true, companyId: 'contract-test-company', projectId: 'contract-test-project', now: Date.parse(observedAt) };
function snapshot() { return { schemaVersion: 1, status: 'CONNECTED', readOnly: true,
  source: { system: 'quickbooks', companyId: scope.companyId, observedAt, complete: true, evidenceRef: 'contract-probe' },
  mapping: { status: 'VERIFIED', projectId: scope.projectId, sourceProjectId: 'contract-test-job', evidenceRef: 'contract-probe' },
  pagination: { complete: true, totalCount: 0, nextCursor: null }, invoices: [] }; }
function probeRow() { return { sourceId: 'contract-probe', companyId: scope.companyId, sourceProjectId: 'contract-test-job', evidenceRef: 'contract-probe', documentNumber: 'contract-probe', date: '2026-11-03', dueDate: null, currency: 'USD', total: '0.00', balance: '0.00', tax: null }; }
function withRow() { const s = snapshot(); s.invoices = [probeRow()]; s.pagination.totalCount = 1; return s; }
test('disconnected has null financials, never a zero balance', () => { const s = disconnectedFinance(); assert.equal(s.status, 'NOT_CONNECTED'); assert.equal(s.source.status, 'NOT_CONNECTED'); assert.equal(s.source.observedAt, null); assert.equal(s.metrics, null); assert.equal(s.capabilities.migrationReady, false); assert.equal(s.financials, null); assert.equal('invoices' in s, false); });
test('authorization is required even for a complete snapshot', () => { for (const authorized of [undefined, false, 'true', 1]) assert.equal(validateInvoiceSnapshot(snapshot(), { ...scope, authorized }).status, 'RESTRICTED'); });
test('missing source is not connected', () => assert.equal(validateInvoiceSnapshot(null, scope).status, 'NOT_CONNECTED'));
test('complete verified empty result does not invent totals', () => { const r = validateInvoiceSnapshot(snapshot(), scope); assert.equal(r.status, 'CONNECTED'); assert.deepEqual(r.invoices, []); assert.equal(r.financials, null); });
test('company and project must match trusted scope', () => { for (const field of ['companyId', 'projectId']) assert.equal(validateInvoiceSnapshot(snapshot(), { ...scope, [field]: 'different' }).status, 'REVIEW_REQUIRED'); });
test('missing source proof, incomplete pages and guessed mappings fail closed', () => { const cases = [s => delete s.source.evidenceRef, s => s.source.complete = false, s => s.pagination.complete = false, s => s.pagination.nextCursor = 'next', s => s.pagination.totalCount = 10, s => s.mapping.status = 'NAME_MATCH', s => delete s.mapping.evidenceRef]; for (const change of cases) { const s = snapshot(); change(s); const r = validateInvoiceSnapshot(s, scope); assert.equal(r.status, 'REVIEW_REQUIRED'); assert.equal(r.financials, null); assert.equal('invoices' in r, false); } });
test('stale, future or malformed timestamps cannot become live', () => { assert.equal(validateInvoiceSnapshot(snapshot(), { ...scope, now: scope.now + 300001 }).status, 'STALE'); assert.equal(validateInvoiceSnapshot(snapshot(), { ...scope, now: scope.now - 1 }).status, 'REVIEW_REQUIRED'); for (const t of [null, 'today', '2026-02-30T00:00:00Z']) { const s = snapshot(); s.source.observedAt = t; assert.equal(validateInvoiceSnapshot(s, scope).status, 'REVIEW_REQUIRED'); } });
test('rollover and invalid clock components fail closed instead of being normalized', () => {
  for (const observedAt of ['2026-11-02T24:00:00Z', '2026-11-02T24:00:00.000Z', '2026-11-03T00:60:00Z', '2026-11-03T00:00:60Z']) {
    const s = snapshot(); s.source.observedAt = observedAt;
    const result = validateInvoiceSnapshot(s, scope);
    assert.equal(result.reason, 'SOURCE_TIMESTAMP', observedAt);
    assert.equal('invoices' in result, false);
    assert.equal(result.financials, null);
  }
});
test('canonical source timestamps preserve supplied fractional precision', () => {
  for (const suffix of ['', '.0', '.00', '.000']) {
    const s = snapshot(); s.source.observedAt = `2026-11-03T00:00:00${suffix}Z`;
    const result = validateInvoiceSnapshot(s, scope);
    assert.equal(result.status, 'CONNECTED');
    assert.equal(result.source.observedAt, s.source.observedAt);
  }
});
test('currency requires a string and never coerces arrays or objects', () => {
  for (const currency of [['USD'], { toString: () => 'USD' }, null, undefined, 'usd', ' USD ', 840]) {
    const s = withRow(); s.invoices[0].currency = currency;
    const result = validateInvoiceSnapshot(s, scope);
    assert.equal(result.reason, 'RECORD_AMOUNT');
    assert.equal('invoices' in result, false);
  }
});
test('invalid records never return a partially accepted invoice list', () => {
  const s = withRow(); s.invoices.push({ ...probeRow(), sourceId: 'second-contract-probe', currency: ['USD'] });
  s.pagination.totalCount = 2;
  const result = validateInvoiceSnapshot(s, scope);
  assert.equal(result.reason, 'RECORD_AMOUNT');
  assert.equal('invoices' in result, false);
  assert.equal(result.records, null);
  assert.equal(result.financials, null);
});
test('decimal precision and unknown tax survive without defaulting to zero', () => { const s = withRow(); s.invoices[0].total = '0.00000001'; const r = validateInvoiceSnapshot(s, scope); assert.equal(r.status, 'CONNECTED'); assert.equal(r.invoices[0].total, '0.00000001'); assert.equal(r.invoices[0].tax, null); });
test('missing, nonfinite and floating-point monetary fields are rejected', () => { for (const bad of [undefined, null, NaN, Infinity, 0, '', '1e3', '1,000', 'NaN']) { const s = withRow(); s.invoices[0].total = bad; assert.equal(validateInvoiceSnapshot(s, scope).status, 'REVIEW_REQUIRED'); } });
test('records require provenance, matching identity and unique IDs', () => { for (const field of ['sourceId', 'evidenceRef', 'companyId', 'sourceProjectId']) { const s = withRow(); s.invoices[0][field] = ''; assert.equal(validateInvoiceSnapshot(s, scope).status, 'REVIEW_REQUIRED'); } const s = withRow(); s.invoices.push(probeRow()); s.pagination.totalCount = 2; assert.equal(validateInvoiceSnapshot(s, scope).status, 'REVIEW_REQUIRED'); });
test('dates must be real calendar dates and omitted due date must be explicit null', () => { for (const bad of ['2026-02-30', '', undefined]) { const s = withRow(); s.invoices[0].dueDate = bad; assert.equal(validateInvoiceSnapshot(s, scope).status, 'REVIEW_REQUIRED'); } });
test('only approved presentation fields are returned', () => { const s = withRow(); s.secret = 'never-forward'; s.invoices[0].raw = { secret: 'never-forward' }; s.financials = { paid: 123 }; const r = validateInvoiceSnapshot(s, scope); assert.equal(JSON.stringify(r).includes('never-forward'), false); assert.equal(r.financials, null); assert.equal(r.invoices[0].evidenceRef, undefined); });
