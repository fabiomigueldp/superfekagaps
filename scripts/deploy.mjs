/** One command: commit, push, build and publish to Oracle. No tests or prebuild hooks. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const stateDir = path.join(root, '.tmp/deploy');
const remoteCache = '/home/ubuntu/.cache/superfekagaps-deploy';
const sshArgs = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4', 'oracle'];
const hash = data => createHash('sha256').update(data).digest('hex');
const start = performance.now();
const options = process.argv.slice(2);
let message = 'Deploy latest game changes', commitChanges = true;
for (let i = 0; i < options.length; i++) {
  if (options[i] === '--help' || options[i] === '-h') {
    console.log('npm run deploy [-- -m "Commit message"] [-- --no-commit]\nCommits pending changes, pushes main, builds and deploys to Oracle. Tests are not run.');
    process.exit(0);
  }
  if (options[i] === '--no-commit') commitChanges = false;
  else if (options[i] === '-m' || options[i] === '--message') {
    message = options[++i];
    if (!message?.trim()) throw Error('A commit message is required after -m.');
  } else throw Error(`Unknown option: ${options[i]}`);
}
function git(...args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 8_000_000 });
  if (r.error || r.status !== 0) throw Error(r.error?.message || r.stderr.trim() || `git ${args[0]} failed`);
  return r.stdout.trim();
}
function launch(command, args, { cwd = root, input, stdin = 'pipe' } = {}) {
  const child = spawn(command, args, { cwd, windowsHide: true, stdio: [stdin, 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', b => { stdout += b; });
  child.stderr.on('data', b => { stderr += b; });
  child.stdin?.on('error', e => { if (e.code !== 'EPIPE') child.kill(); });
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
  if (input !== undefined) child.stdin.end(input);
  return { child, done };
}
async function success(job, label, log) {
  const r = await job.done;
  if (log) await fs.writeFile(log, r.stdout + r.stderr);
  if (r.code !== 0) throw Error(`${label} failed${log ? `; log: ${log}` : ''}\n${(r.stderr || r.stdout).slice(-2500)}`);
  return r.stdout;
}
function result(output, prefix) {
  const line = output.split(/\r?\n/).findLast(line => line.startsWith(prefix));
  if (!line) throw Error(`Oracle did not return ${prefix.trim()}: ${output.slice(-1500)}`);
  return JSON.parse(line.slice(prefix.length));
}
async function remote(request) {
  const helper = await fs.readFile(path.join(root, 'scripts/deploy/oracle.mjs'));
  // Code and request travel over stdin, avoiding Windows command-length and shell-quoting limits.
  const program = `import fs from 'node:fs/promises';import {pathToFileURL} from 'node:url';
const dir=${JSON.stringify(remoteCache)};await fs.mkdir(dir,{recursive:true});
const target=dir+'/oracle.mjs',source=Buffer.from('${helper.toString('base64')}','base64');
let old;try{old=await fs.readFile(target)}catch(e){if(e.code!=='ENOENT')throw e}
if(!old?.equals(source)){const tmp=target+'.'+process.pid;await fs.writeFile(tmp,source);await fs.rename(tmp,target)}
const tool=await import(pathToFileURL(target).href);await tool.prepare(${JSON.stringify(request)});`;
  return result(await success(launch('ssh', [...sshArgs, 'sudo', '-n', 'node', '--input-type=module'], { input: program }), 'Oracle preparation'), 'DEPLOY_PLAN ');
}
async function snapshot(commit, destination) {
  await fs.mkdir(destination);
  // Exclude large review galleries, editable models and tests from the build snapshot.
  const inputs = git('ls-tree', '--name-only', commit).split(/\r?\n/).filter(p => !['docs', 'tests', 'tools'].includes(p));
  const source = spawn('git', ['archive', commit, '--', ...inputs], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const unpack = launch('tar', ['-xf', '-', '-C', destination]);
  source.stdout.pipe(unpack.child.stdin);
  let archiveError = '';
  source.stderr.on('data', b => { archiveError += b; });
  const archived = new Promise((resolve, reject) => {
    source.on('error', reject); source.on('close', code => resolve(code));
  });
  const [code] = await Promise.all([archived, success(unpack, 'Source snapshot')]);
  if (code !== 0) throw Error(`git archive failed: ${archiveError}`);
  await fs.symlink(path.join(root, 'node_modules'), path.join(destination, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
}
async function manifest(directory) {
  const entries = [];
  async function walk(prefix = '') {
    for (const entry of await fs.readdir(path.join(directory, prefix), { withFileTypes: true })) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw Error(`Asset symlink rejected: ${name}`);
      if (entry.isDirectory()) await walk(name);
      else {
        if (!entry.isFile() || /[\\\x00-\x20\x7f-\uffff]/u.test(name) || name.split('/').some(p => p === '..' || p.startsWith('.'))) throw Error(`Unsupported asset path: ${name}`);
        const bytes = await fs.readFile(path.join(directory, name));
        entries.push({ name, bytes: bytes.length, sha256: hash(bytes) });
      }
    }
  }
  await walk();
  return entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
}
await fs.mkdir(stateDir, { recursive: true });
let lock;
try { lock = await fs.open(path.join(stateDir, 'lock'), 'wx'); }
catch (e) {
  if (e.code === 'EEXIST') throw Error('Another deploy owns .tmp/deploy/lock. If it was interrupted, remove that file after confirming it is no longer running.');
  throw e;
}
await lock.writeFile(String(process.pid));
let work;
try {
  if (git('branch', '--show-current') !== 'main') throw Error('Run this command on main; it never switches branches or force-pushes.');
  if (git('status', '--porcelain=v1', '--untracked-files=normal')) {
    if (!commitChanges) throw Error('Uncommitted changes found; remove --no-commit or commit them first.');
    git('add', '--all'); git('commit', '-m', message);
  }
  const commit = git('rev-parse', 'HEAD');
  const runId = `${commit}-${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const logs = path.join(stateDir, runId);
  await fs.mkdir(logs);
  console.log(`[deploy] ${commit.slice(0, 7)}: build + push (no tests)`);
  work = await fs.mkdtemp(path.join(stateDir, 'work-'));
  const source = path.join(work, 'source');
  const push = success(launch('git', ['push', 'origin', 'main']), 'Git push', path.join(logs, 'push.log'));
  const build = (async () => {
    await snapshot(commit, source);
    const output = await success(launch(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: source }), 'Production build', path.join(logs, 'build.log'));
    return { passed: true, command: 'node node_modules/vite/bin/vite.js build', checkedAt: new Date().toISOString(),
      logSha256: hash(output), tests: 'not-run', publicationMode: 'manual-no-tests', authorizedBy: 'explicit-user-request',
      summary: 'Publicação manual sem testes, por solicitação do usuário. Apenas o build de produção foi gerado com sucesso.' };
  })();
  // Wait for both operations, including on failure, before removing the source snapshot.
  const outcomes = await Promise.allSettled([build, push]);
  for (const outcome of outcomes) if (outcome.status === 'rejected') throw outcome.reason;
  const report = outcomes[0].value;
  // The report hashes the exact saved build log, including any stderr diagnostics.
  report.logSha256 = hash(await fs.readFile(path.join(logs, 'build.log')));
  const files = await manifest(path.join(source, 'dist'));
  const request = { runId, commit, report, files };
  await fs.writeFile(path.join(logs, 'request.json'), JSON.stringify(request, null, 2));
  const plan = await remote(request);
  const missing = new Set(plan.missing);
  const uploadBytes = files.filter(f => missing.has(f.name)).reduce((n, f) => n + f.bytes, 0);
  console.log(`[deploy] upload ${missing.size}/${files.length} files; ${(uploadBytes / 1e6).toFixed(2)} MB instead of ${(files.reduce((n, f) => n + f.bytes, 0) / 1e6).toFixed(2)} MB`);
  const publish = launch('ssh', [...sshArgs, 'sudo', '-n', 'node', `${remoteCache}/oracle.mjs`, 'publish', runId]);
  let archive;
  if (missing.size) {
    const list = path.join(logs, 'upload.list');
    await fs.writeFile(list, [...missing].join('\0') + '\0');
    archive = launch('tar', ['-czf', '-', '-C', path.join(source, 'dist'), '--null', '-T', list]);
    archive.child.stdout.removeAllListeners('data');
    archive.child.stdout.pipe(publish.child.stdin);
  } else publish.child.stdin.end();
  const transferred = await Promise.allSettled([success(publish, 'Oracle publication', path.join(logs, 'publish.log')),
    ...(archive ? [success(archive, 'Delta archive')] : [])]);
  for (const outcome of transferred) if (outcome.status === 'rejected') throw outcome.reason;
  const released = result(transferred[0].value, 'DEPLOY_RESULT ');
  const summary = { ...released, uploadFiles: missing.size, uploadBytes, seconds: Number(((performance.now() - start) / 1000).toFixed(2)), logs };
  await fs.writeFile(path.join(stateDir, 'last.json'), JSON.stringify(summary, null, 2));
  console.log(`[deploy] published ${released.build} (${summary.seconds}s)`);
  console.log('https://torbware.space/jogar/super-feka-gaps/world/');
  console.log(`https://feka-world.torbware.space/play/${released.build}/world/index.html?encounter=hipotetico`);
  const pending = git('status', '--porcelain=v1', '--untracked-files=normal');
  if (pending) console.log('[deploy] New local edits made during publication remain outside this release.');
} catch (error) {
  console.error(`[deploy] ${error.message}`); process.exitCode = 1;
} finally {
  if (work) {
    // Never follow the dependency junction into the user's actual node_modules.
    await fs.unlink(path.join(work, 'source/node_modules')).catch(e => { if (e.code !== 'ENOENT') throw e; });
    if (path.dirname(path.resolve(work)) !== path.resolve(stateDir) || (await fs.lstat(work)).isSymbolicLink()) throw Error('Unsafe snapshot cleanup path');
    await fs.rm(work, { recursive: true, force: true });
  }
  await lock.close(); await fs.unlink(path.join(stateDir, 'lock'));
}
