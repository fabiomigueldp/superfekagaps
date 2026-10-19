/** Cached SSH-side publisher. Uses Torbware's existing pack/store and atomic catalog. */
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const cache = '/home/ubuntu/.cache/superfekagaps-deploy';
const root = '/home/ubuntu/torbware-world';
const site = '/home/ubuntu/torbware';
const blobs = path.join(cache, 'blobs');
const hash = data => createHash('sha256').update(data).digest('hex');
const validRun = id => /^[a-f0-9]{40}-[a-f0-9]{12}$/.test(id);
const blobPath = digest => {
  if (!/^[a-f0-9]{64}$/.test(digest)) throw Error('Invalid content hash');
  return path.join(blobs, digest);
};
async function exists(file) { try { await fs.access(file); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } }
async function store() {
  const original = await fs.readFile(path.join(site, 'scripts/world/store.mjs'), 'utf8');
  const automated = "report?.command === 'npm run check'";
  const manual = "(report?.command === 'npm run check' || (report?.command === 'node node_modules/vite/bin/vite.js build' && report.tests === 'not-run' && report.publicationMode === 'manual-no-tests' && report.authorizedBy === 'explicit-user-request'))";
  if (original.split(automated).length !== 2) throw Error('Torbware report contract changed; update the manual-build adapter.');
  // Adapt only a private operator copy. Production service sources stay untouched.
  const source = original.replace(automated, manual);
  const directory = path.join(cache, `operator-${hash(source).slice(0, 12)}`);
  if (!await exists(path.join(directory, 'store.mjs'))) {
    await fs.mkdir(directory, { recursive: true });
    await fs.copyFile(path.join(site, 'scripts/world/storage.js'), path.join(directory, 'storage.js'));
    await fs.writeFile(path.join(directory, 'store.mjs'), source);
  } else await fs.copyFile(path.join(site, 'scripts/world/storage.js'), path.join(directory, 'storage.js'));
  if (!await exists(path.join(cache, 'node_modules/es-module-lexer/package.json'))) {
    await fs.mkdir(path.join(cache, 'node_modules'), { recursive: true });
    const copied = spawnSync('docker', ['cp', 'torbware-world-1:/app/node_modules/es-module-lexer', path.join(cache, 'node_modules')], { encoding: 'utf8' });
    if (copied.status !== 0) throw Error(copied.error?.message || copied.stderr || 'Could not reuse the installed module lexer.');
  }
  process.env.WORLD_PUBLIC = path.join(site, 'public');
  return import(pathToFileURL(path.join(directory, 'store.mjs')).href);
}
async function cacheFile(source, digest) {
  try { await fs.copyFile(source, blobPath(digest), constants.COPYFILE_EXCL); }
  catch (e) { if (e.code !== 'EEXIST') throw e; }
}
function validate(request, api) {
  if (!validRun(request.runId) || !/^[a-f0-9]{40}$/.test(request.commit) || !request.runId.startsWith(request.commit + '-')) throw Error('Invalid release identity');
  if (!request.report?.passed || request.report.tests !== 'not-run' || request.report.publicationMode !== 'manual-no-tests' || request.report.authorizedBy !== 'explicit-user-request') throw Error('Expected an explicit manual build report');
  if (!Array.isArray(request.files) || !request.files.length || request.files.length > 10000) throw Error('Invalid build manifest');
  const names = new Set(); let total = 0;
  for (const file of request.files) {
    api.safePath(file.name); blobPath(file.sha256);
    if (names.has(file.name) || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > 100_000_000) throw Error('Invalid asset record');
    names.add(file.name); total += file.bytes;
  }
  if (!names.has('index.html') || total > 500_000_000) throw Error('Invalid public build');
}
export async function prepare(request) {
  const api = await store(); validate(request, api);
  await fs.mkdir(blobs, { recursive: true });
  const state = await api.readState(root);
  // Seed from the installed release: large unchanged media need no first-run upload.
  const current = state.active?.experiences.find(e => e.id === 'world')?.build;
  if (current && api.BUILD_ID.test(current)) {
    const installed = path.join(root, 'builds', current);
    const meta = await api.json(path.join(installed, 'build.json'));
    await Promise.all(Object.entries(meta.files).map(async ([name, record]) => {
      api.safePath(name);
      if (!await exists(blobPath(record.sha256))) await cacheFile(path.join(installed, 'payload', name), record.sha256);
    }));
  }
  const job = path.join(cache, 'jobs', request.runId);
  await fs.mkdir(job, { recursive: true });
  const missing = [];
  for (const file of request.files) {
    const stat = await fs.stat(blobPath(file.sha256)).catch(e => { if (e.code !== 'ENOENT') throw e; return null; });
    if (!stat?.isFile() || stat.size !== file.bytes) missing.push(file.name);
  }
  await fs.writeFile(path.join(job, 'request.json'), JSON.stringify({ ...request, missing }), { flag: 'wx' });
  console.log('DEPLOY_PLAN ' + JSON.stringify({ missing }));
}
async function publish(runId) {
  if (!validRun(runId)) throw Error('Invalid deployment workspace');
  const api = await store(), job = path.join(cache, 'jobs', runId);
  const request = await api.json(path.join(job, 'request.json')); validate(request, api);
  const uploaded = path.join(job, 'upload'), dist = path.join(job, 'dist');
  await fs.mkdir(uploaded); await fs.mkdir(dist);
  if (request.missing.length) {
    const unpacked = spawnSync('tar', ['-xzf', '-', '--no-same-owner', '--no-same-permissions', '-C', uploaded], { stdio: ['inherit', 'ignore', 'pipe'], encoding: 'utf8' });
    if (unpacked.status !== 0) throw Error(unpacked.error?.message || unpacked.stderr || 'Incomplete delta upload');
    for (const name of request.missing) {
      const file = request.files.find(f => f.name === name), source = path.join(uploaded, name);
      if (!(await fs.lstat(source)).isFile()) throw Error(`Invalid uploaded asset: ${name}`);
      const content = await fs.readFile(source);
      if (content.length !== file.bytes || hash(content) !== file.sha256) throw Error(`Upload checksum mismatch: ${name}`);
      await cacheFile(source, file.sha256);
    }
  }
  for (let offset = 0; offset < request.files.length; offset += 16) {
    await Promise.all(request.files.slice(offset, offset + 16).map(async file => {
      const content = await fs.readFile(blobPath(file.sha256));
      if (content.length !== file.bytes || hash(content) !== file.sha256) throw Error(`Cached asset checksum mismatch: ${file.name}`);
      const target = path.join(dist, file.name);
      await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content);
    }));
  }
  const packed = await api.packBuild({ dist, commit: request.commit, report: request.report, out: path.join(job, 'package') });
  await api.installBuild(root, packed.path);
  const release = await api.withLock(root, async () => {
    const bytes = await fs.readFile(path.join(root, 'state.json')), state = JSON.parse(bytes), catalog = structuredClone(state.active);
    if (catalog?.recommended !== 'world') throw Error('Unexpected active catalog');
    const previousBuilds = [...new Set(catalog.experiences.map(e => e.build))];
    for (const item of catalog.experiences) {
      item.build = packed.id;
      const note = `Commit ${request.commit.slice(0, 7)}: publicação manual sem execução de testes.`;
      item.changes = [note, ...item.changes.filter(c => c !== note)].slice(0, 6);
    }
    await api.validateCatalog(catalog, root);
    const next = { schema: 1, active: catalog, previous: state.active, pinned: state.pinned };
    if (api.retentionPlan(await api.installedBuilds(root), next).remove.length) throw Error('Unexpected retention cleanup during promotion');
    const history = path.join(cache, 'history'); await fs.mkdir(history, { recursive: true });
    await fs.writeFile(path.join(history, `${runId}.before.json`), bytes, { flag: 'wx' });
    const same = JSON.stringify(catalog) === JSON.stringify(state.active);
    if (!same) await api.atomicJson(path.join(root, 'state.json'), next);
    return { commit: request.commit, build: packed.id, experiences: catalog.experiences.length, tests: 'not-run', previous: previousBuilds };
  });
  await fs.writeFile(path.join(cache, 'history', `${runId}.json`), JSON.stringify({ ...release, report: request.report }, null, 2));
  // Only this freshly created job directory is disposable; runtime/cache/history persist.
  if (path.dirname(path.resolve(job)) !== path.join(cache, 'jobs') || (await fs.lstat(job)).isSymbolicLink()) throw Error('Unsafe job cleanup path');
  await fs.rm(job, { recursive: true, force: true });
  console.log('DEPLOY_RESULT ' + JSON.stringify(release));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] !== 'publish') throw Error('Expected publish RUN_ID');
    await publish(process.argv[3]);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
