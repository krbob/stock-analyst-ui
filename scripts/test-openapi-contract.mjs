import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { checkContract } from './openapi-contract.mjs';

test('committed OpenAPI snapshot and generated client have no drift', async () => {
  const result = await checkContract();
  assert.ok(result.files.some(({ file }) => file === 'types.gen.ts'));
  assert.ok(result.files.some(({ file }) => file === 'sdk.gen.ts'));
  assert.ok(result.files.some(({ file }) => file === 'client.gen.ts'));

  const sdk = await readFile(new URL('../src/api/generated/sdk.gen.ts', import.meta.url), 'utf8');
  const types = await readFile(new URL('../src/api/generated/types.gen.ts', import.meta.url), 'utf8');
  const adapterTypes = await readFile(new URL('../src/api/types.ts', import.meta.url), 'utf8');
  for (const path of [
    '/v1/quote/{stock}',
    '/v1/compare',
    '/v1/history/{stock}',
    '/v1/indicators/{stock}',
    '/v1/search/{query}',
  ]) {
    assert.match(sdk, new RegExp(`url: '${path.replace(/[{}]/g, '\\$&')}'`));
  }
  assert.doesNotMatch(sdk, /url: '\/(quote|compare|history|indicators|search)/);
  assert.match(types, /export type DataProvenance = \{/);
  assert.match(types, /provenance: DataProvenance;/);
  assert.match(types, /unitScale: 1;/);
  assert.match(types, /status: DataStatus;/);
  assert.match(adapterTypes, /DataProvenance,/);
  assert.doesNotMatch(adapterTypes, /(?:interface|type)\s+DataProvenance\s*[={]/);
});
