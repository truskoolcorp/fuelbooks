import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditStaticExport } from '../scripts/audit-static-export.mjs';

const disconnected = 'Source not connected. Verified financial data is unavailable. This does not mean there are no transactions or that the balance is zero.';
function probe(t, html = disconnected) {
  const directory = mkdtempSync(join(tmpdir(), 'fuelbooks-export-audit-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(join(directory, 'index.html'), html);
  return directory;
}
test('export audit accepts explicit disconnected status without business values', t => {
  assert.equal(auditStaticExport(probe(t)).financialSource, 'NOT_CONNECTED');
});
test('export audit rejects missing disconnected notice', t => {
  assert.throws(() => auditStaticExport(probe(t, '')));
});
test('export audit rejects an invented zero balance', t => {
  for (const value of [' $0.00', ' &#36;0.00', ' &#x24;0.00', ' &dollar;0.00']) {
    assert.throws(() => auditStaticExport(probe(t, disconnected + value)));
  }
});
test('framework serialization references are not displayed balances', t => {
  assert.equal(auditStaticExport(probe(t, disconnected + '<script>self.__next_f.push(["$0:props"])</script>')).status, 'passed');
});
test('a notice hidden only in script metadata is not a visible unavailable state', t => {
  assert.throws(() => auditStaticExport(probe(t, `<script>${disconnected}</script>`)));
});
test('export audit rejects upload controls and submission forms', t => {
  for (const control of ['<input type="file">', '<form action="/invoice">']) {
    assert.throws(() => auditStaticExport(probe(t, disconnected + control)));
  }
});
test('export audit scans nested bundles for leaked test probes', t => {
  const directory = probe(t);
  mkdirSync(join(directory, '_next', 'static'), { recursive: true });
  writeFileSync(join(directory, '_next', 'static', 'leak.js'), 'contract-test-company');
  assert.throws(() => auditStaticExport(directory), /Business seeds or contract probes leaked/);
});
