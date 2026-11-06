import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const prohibited = /Lone Star Petroleum|Marcus Johnson|LD-5001|EXP-001|INV-3001|PMT-7000|contract-test-company|contract-probe|Simulate some as paid/;

/** Local build audit only. Never contacts a provider or reads accounting data. */
export function auditStaticExport(directory) {
  const files = [];
  function walk(path) {
    for (const name of readdirSync(path)) {
      const child = join(path, name);
      if (statSync(child).isDirectory()) walk(child);
      else if (/\.(?:html|js|json|txt)$/.test(name)) files.push(child);
    }
  }
  walk(directory);
  const html = readFileSync(join(directory, 'index.html'), 'utf8');
  // Next's serialized component references can contain "$0". Those are not
  // displayed balances; inspect page text separately from code and metadata.
  const pageText = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ' ')
    .replace(/&(?:dollar|#36|#x24);/gi, '$').replace(/&(?:nbsp|#160|#xa0);/gi, ' ');
  assert.match(pageText, /Source not connected/, 'Export must show the disconnected source state');
  assert.match(pageText, /Verified financial data is unavailable/, 'Export must explicitly state unavailable financials');
  assert.match(pageText, /does not mean there are no transactions or that the balance is zero/, 'Unavailable data must not imply zero');
  assert.doesNotMatch(pageText, /\$\s*0(?:[.,]00)?(?:\D|$)/, 'Export must not show an invented zero balance');
  assert.doesNotMatch(html, /<input\b[^>]*type=["']file["']/i, 'Disconnected export must not expose uploads');
  assert.doesNotMatch(html, /<form\b/i, 'Disconnected export must not expose a financial submission form');
  for (const file of files) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), prohibited, `Business seeds or contract probes leaked into ${file}`);
  }
  return { status: 'passed', filesChecked: files.length, financialSource: 'NOT_CONNECTED' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = auditStaticExport(resolve(process.argv[2] ?? 'out'));
  console.log(JSON.stringify(result, null, 2));
}
