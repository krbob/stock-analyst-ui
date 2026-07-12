import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../src/styles/', import.meta.url);
const [css, manifestSource] = await Promise.all([
  readFile(new URL('tokens.css', root), 'utf8'),
  readFile(new URL('tokens.manifest.json', root), 'utf8'),
]);
const manifest = JSON.parse(manifestSource);

function fail(message) {
  throw new Error(`Design-token contract is invalid: ${message}`);
}

const digest = createHash('sha256').update(css).digest('hex');
if (digest !== manifest.sha256) fail(`expected sha256 ${manifest.sha256}, received ${digest}`);
if (!css.includes(`contract — v${manifest.version}`)) fail('CSS version and manifest version differ');
if (manifest.schemaVersion !== 1) fail(`unsupported schemaVersion ${manifest.schemaVersion}`);

const declared = new Set([...css.matchAll(/^\s*(--ui-[a-z0-9-]+):/gm)].map((match) => match[1]));
const inventory = Object.values(manifest.layers).flat();
if (new Set(inventory).size !== inventory.length) fail('a token belongs to more than one layer');

const missing = inventory.filter((token) => !declared.has(token));
const unlisted = [...declared].filter((token) => !inventory.includes(token));
if (missing.length > 0) fail(`manifest tokens missing from CSS: ${missing.join(', ')}`);
if (unlisted.length > 0) fail(`CSS tokens missing from manifest: ${unlisted.join(', ')}`);

for (const layer of manifest.publicLayers) {
  if (!manifest.layers[layer]) fail(`unknown public layer ${layer}`);
  if (manifest.layers[layer].some((token) => token.startsWith('--ui-ref-'))) {
    fail(`public layer ${layer} exposes primitive tokens`);
  }
}
if (/@(theme|utility|plugin|source)\b/.test(css)) {
  fail('framework-specific syntax leaked into tokens.css');
}

console.log(`Design-token contract ${manifest.version} verified (${inventory.length} tokens, ${digest.slice(0, 12)}).`);
