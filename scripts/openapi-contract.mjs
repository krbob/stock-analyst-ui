import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient } from '@hey-api/openapi-ts';
import { openApiGeneratorConfig } from '../openapi-ts.config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'openapi/manifest.json');

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function readManifest() {
  return JSON.parse(await readFile(manifestPath, 'utf8'));
}

async function filesUnder(directory, base = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path, base));
    else if (entry.isFile()) files.push(relative(base, path).split(sep).join('/'));
  }
  return files.sort();
}

async function treeSnapshot(directory) {
  const files = await filesUnder(directory);
  const entries = [];
  const tree = createHash('sha256');
  for (const file of files) {
    const content = await readFile(join(directory, file));
    const fileHash = sha256(content);
    entries.push({ file, sha256: fileHash });
    tree.update(file);
    tree.update('\0');
    tree.update(content);
    tree.update('\0');
  }
  return { files: entries, sha256: tree.digest('hex') };
}

async function verifyInputs(manifest) {
  const generatorPackage = JSON.parse(
    await readFile(join(root, 'node_modules/@hey-api/openapi-ts/package.json'), 'utf8'),
  );
  if (generatorPackage.version !== manifest.generator.version) {
    throw new Error(
      `OpenAPI generator version drift: manifest=${manifest.generator.version}, installed=${generatorPackage.version}`,
    );
  }

  const snapshotPath = join(root, manifest.snapshot.path);
  const snapshotHash = sha256(await readFile(snapshotPath));
  if (snapshotHash !== manifest.snapshot.sha256) {
    throw new Error(
      `OpenAPI snapshot drift: manifest=${manifest.snapshot.sha256}, actual=${snapshotHash}`,
    );
  }
}

async function generateInto(output) {
  await rm(output, { recursive: true, force: true });
  await createClient(openApiGeneratorConfig(output));
  const outputStat = await stat(output);
  if (!outputStat.isDirectory()) throw new Error('OpenAPI generator did not create its output directory');
  return treeSnapshot(output);
}

export async function generateContract() {
  process.chdir(root);
  const manifest = await readManifest();
  await verifyInputs(manifest);
  const output = join(root, manifest.generator.output);
  const generated = await generateInto(output);
  manifest.generator.treeSha256 = generated.sha256;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return generated;
}

export async function checkContract() {
  process.chdir(root);
  const manifest = await readManifest();
  await verifyInputs(manifest);

  const committedOutput = join(root, manifest.generator.output);
  const committed = await treeSnapshot(committedOutput);
  if (committed.sha256 !== manifest.generator.treeSha256) {
    throw new Error(
      `Generated OpenAPI tree drift: manifest=${manifest.generator.treeSha256}, committed=${committed.sha256}`,
    );
  }

  const tempRoot = await mkdtemp(join(tmpdir(), 'stock-analyst-openapi-'));
  try {
    const regenerated = await generateInto(join(tempRoot, 'generated'));
    if (regenerated.sha256 !== committed.sha256) {
      const committedFiles = new Map(committed.files.map((entry) => [entry.file, entry.sha256]));
      const regeneratedFiles = new Map(regenerated.files.map((entry) => [entry.file, entry.sha256]));
      const changed = [...new Set([...committedFiles.keys(), ...regeneratedFiles.keys()])]
        .filter((file) => committedFiles.get(file) !== regeneratedFiles.get(file))
        .sort();
      throw new Error(`Generated OpenAPI artifacts are stale: ${changed.join(', ')}`);
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
  return committed;
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  const command = process.argv[2];
  const result = command === 'generate'
    ? await generateContract()
    : command === 'check'
      ? await checkContract()
      : null;
  if (!result) {
    throw new Error('Usage: node scripts/openapi-contract.mjs <generate|check>');
  }
  console.log(`OpenAPI contract ${command} verified (${result.files.length} files, ${result.sha256.slice(0, 12)}).`);
}
