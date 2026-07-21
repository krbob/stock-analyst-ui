import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function filesUnder(directory, extension) {
  const absoluteDirectory = resolve(root, directory);
  if (!existsSync(absoluteDirectory)) return [];

  return readdirSync(absoluteDirectory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = resolve(absoluteDirectory, entry.name);
      if (entry.isDirectory()) {
        return filesUnder(relative(root, path), extension);
      }
      return entry.isFile() && extname(entry.name).toLowerCase() === extension ? [path] : [];
    })
    .sort();
}

function fail(message) {
  failures.push(message);
}

function githubAnchors(markdown) {
  const anchors = new Set();
  const occurrences = new Map();

  for (const match of markdown.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    const base = match[1]
      .replace(/<[^>]*>/g, '')
      .replace(/[`*~]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s+/g, '-');
    if (!base) continue;

    const occurrence = occurrences.get(base) ?? 0;
    occurrences.set(base, occurrence + 1);
    anchors.add(occurrence === 0 ? base : `${base}-${occurrence}`);
  }
  return anchors;
}

function decoded(value, context) {
  try {
    return decodeURIComponent(value);
  } catch {
    fail(`${context}: invalid URL encoding in ${value}`);
    return null;
  }
}

const markdownFiles = [resolve(root, 'README.md'), ...filesUnder('docs', '.md')];
let relativeLinkCount = 0;

for (const sourcePath of markdownFiles) {
  const source = readFileSync(sourcePath, 'utf8');
  const sourceLabel = relative(root, sourcePath);

  if (/\bbobinski\.net\b/i.test(source)) {
    fail(`${sourceLabel}: public documentation must not reference private deployment domains`);
  }

  for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, '').split(/\s+["']/u, 1)[0];
    if (!rawTarget || /^[a-z][a-z0-9+.-]*:/i.test(rawTarget) || rawTarget.startsWith('//')) continue;
    if (rawTarget.startsWith('/')) continue;

    relativeLinkCount += 1;
    const [rawPath, rawFragment] = rawTarget.split('#', 2);
    const pathWithoutQuery = rawPath.split('?', 1)[0];
    const decodedPath = decoded(pathWithoutQuery, sourceLabel);
    if (decodedPath == null) continue;

    const targetPath = decodedPath ? resolve(dirname(sourcePath), decodedPath) : sourcePath;
    if (targetPath !== root && !targetPath.startsWith(`${root}${sep}`)) {
      fail(`${sourceLabel}: relative link escapes the repository: ${rawTarget}`);
      continue;
    }
    if (!existsSync(targetPath) || !statSync(targetPath).isFile()) {
      fail(`${sourceLabel}: missing relative link target: ${rawTarget}`);
      continue;
    }

    if (rawFragment && extname(targetPath).toLowerCase() === '.md') {
      const fragment = decoded(rawFragment, sourceLabel);
      if (fragment != null && !githubAnchors(readFileSync(targetPath, 'utf8')).has(fragment.toLowerCase())) {
        fail(`${sourceLabel}: missing Markdown anchor: ${rawTarget}`);
      }
    }
  }
}

const readme = read('README.md');
const development = read('docs/DEVELOPMENT.md');
const deployment = read('docs/DEPLOYMENT.md');
const envExample = read('.env.example');
const entrypoint = read('docker-entrypoint.sh');
const sourceFiles = filesUnder('src', '.ts').concat(filesUnder('src', '.tsx'));
const sourceText = sourceFiles.map((path) => readFileSync(path, 'utf8')).join('\n');

if (/^\s*#?\s*VITE_API_URL\s*=/m.test(envExample)) {
  fail('.env.example must not advertise the unsupported VITE_API_URL setting');
}
if (/import\.meta\.env\.VITE_API_URL\b/.test(sourceText)) {
  fail('browser API routing must remain same-origin; VITE_API_URL is unsupported');
}

const runtimeSettings = new Set(
  [...entrypoint.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)].map((match) => match[1]),
);
const buildTimeSettings = new Set(
  [...sourceText.matchAll(/import\.meta\.env\.(VITE_[A-Z0-9_]+)/g)].map((match) => match[1]),
);
const envExampleSettings = new Set(
  [...envExample.matchAll(/^\s*#?\s*(VITE_[A-Z0-9_]+)\s*=/gm)].map((match) => match[1]),
);

for (const required of ['API_URL', 'SHOW_CHART_ATTRIBUTION', 'PORTFOLIO_URL']) {
  if (!runtimeSettings.has(required)) fail(`runtime setting disappeared from docker-entrypoint.sh: ${required}`);
}
for (const required of ['VITE_SHOW_CHART_ATTRIBUTION', 'VITE_PORTFOLIO_URL']) {
  if (!buildTimeSettings.has(required)) fail(`build-time setting disappeared from browser source: ${required}`);
}

for (const setting of runtimeSettings) {
  if (!readme.includes(`\`${setting}\``)) fail(`README.md does not document runtime setting ${setting}`);
  if (!deployment.includes(`\`${setting}\``)) fail(`docs/DEPLOYMENT.md does not document runtime setting ${setting}`);
}
for (const setting of buildTimeSettings) {
  if (!readme.includes(`\`${setting}\``)) fail(`README.md does not document build-time setting ${setting}`);
  if (!development.includes(`\`${setting}\``)) {
    fail(`docs/DEVELOPMENT.md does not document build-time setting ${setting}`);
  }
  if (!envExampleSettings.has(setting)) fail(`.env.example does not list build-time setting ${setting}`);
}
for (const setting of envExampleSettings) {
  if (!buildTimeSettings.has(setting)) fail(`.env.example advertises unused build-time setting ${setting}`);
}

if (failures.length > 0) {
  console.error('Documentation contract violations:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Documentation contract valid: ${markdownFiles.length} Markdown files, ${relativeLinkCount} relative links, `
    + `${runtimeSettings.size} runtime settings, ${buildTimeSettings.size} build-time settings`,
  );
}
