import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = resolve(root, process.argv[2] ?? 'coverage/coverage-summary.json');
const baselinePath = resolve(root, 'coverage-baseline.json');
const [report, baseline] = await Promise.all([
  readFile(reportPath, 'utf8').then(JSON.parse),
  readFile(baselinePath, 'utf8').then(JSON.parse),
]);

if (baseline.schemaVersion !== 1 || report?.total == null) {
  throw new Error('Unsupported coverage baseline or malformed coverage summary');
}

const metrics = ['statements', 'branches', 'functions', 'lines'];
const rows = [];
const failures = [];
for (const metric of metrics) {
  const result = report.total[metric];
  const floor = baseline.thresholds[metric];
  if (
    result == null
    || !Number.isFinite(result.covered)
    || !Number.isFinite(result.total)
    || !Number.isFinite(result.pct)
    || !Number.isFinite(floor)
  ) {
    throw new Error('Coverage metric ' + metric + ' is malformed');
  }
  const passed = result.pct >= floor;
  if (!passed) failures.push(metric + ' ' + result.pct + '% < ' + floor + '%');
  rows.push('| ' + metric + ' | ' + result.covered + '/' + result.total + ' | ' + result.pct.toFixed(2) + '% | ' + floor + '% | ' + (passed ? 'pass' : 'FAIL') + ' |');
}

const code = String.fromCharCode(96);
console.log([
  '## All-source unit coverage',
  '',
  'Scope: ' + code + baseline.include.join(', ') + code + '; generated code, tests and declarations are explicitly excluded.',
  '',
  '| Metric | Covered | Actual | Floor | Gate |',
  '| --- | ---: | ---: | ---: | --- |',
  ...rows,
].join('\n'));

if (failures.length > 0) {
  throw new Error('Coverage floor failed: ' + failures.join(', '));
}
