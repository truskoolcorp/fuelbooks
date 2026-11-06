import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
test('live page mounts only disconnected read-only workspace', () => { const page = read('../app/FuelBooksApp.js'); assert.match(page, /const state = disconnectedFinance\(\)/); assert.doesNotMatch(page, /fetch\(|localStorage|EmailIngestModule|PayrollModule|Legacy|onCreate|recordPayment|Math\.random/); assert.doesNotMatch(page, /\$0|0\.00/); assert.match(page, /does not mean there are no transactions/); });
test('retained modules contain no fictional business seeds', () => { for (const path of ['../legacy/FuelBooksWorkspace.js', '../app/PayrollModule.js']) { const s = read(path); assert.doesNotMatch(s, /Lone Star Petroleum|Marcus Johnson|LD-5001|EXP-001|Simulate some as paid|PMT-7000|INV-3001/); } });
test('no sample tax or payroll module is imported by the production entry', () => { assert.doesNotMatch(read('../app/page.js') + read('../app/FuelBooksApp.js'), /PayrollModule|EmailIngestModule|FuelBooksWorkspace/); });
test('latest FuelBooks brand asset and AP Fuel identity are preserved', () => {
  const page = read('../app/FuelBooksApp.js');
  assert.match(page, /src="\/fuelbooks-mark\.svg"/);
  assert.match(page, /AP Fuel USA · by Tru Skool/);
  assert.match(read('../app/layout.js'), /FuelBooks — AP Fuel USA \| by Tru Skool/);
  assert.match(read('../app/layout.js'), /icon: "\/fuelbooks-mark\.svg"/);
  assert.match(read('../public/fuelbooks-mark.svg'), /<svg/);
});
