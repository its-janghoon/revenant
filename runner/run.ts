// Revenant runner: one Kiro CLI headless run on one app repo, inside CodeBuild.
// clone -> (seed) -> steering -> kiro-cli -> checks (scripts) -> push. See runner/README.md.

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { read } from './kiro.ts';
import { change, emit, relay, run, RUNNER_PREFIX, type ErrorStep } from './log.ts';
import { committed, parse, started, type Task } from './tasks.ts';

const here = dirname(fileURLToPath(import.meta.url));
const t0 = Date.now();
const home = join(here, '..');
const env = process.env;

// State shared with the stop path. `ready` turns on once the inputs are valid.
let ready = false;
let cloned = false;
let held = false;
let child: ChildProcess | null = null;
let used = 0;
let initial: Task[] = [];
const done = new Set<string>();

process.on('uncaughtException', fail);

// check: no Kiro, no push; the checks on COMMIT of BRANCH (Code tab commits, lib/deploy/check.ts).
const MODES = ['spec', 'build', 'change', 'repair', 'check'] as const;
type Mode = (typeof MODES)[number];

class Step extends Error {
  step: ErrorStep;
  code: number;
  constructor(step: ErrorStep, text: string, code = 1) {
    super(text);
    this.step = step;
    this.code = code;
  }
}

function need(name: string): string {
  const v = env[name]?.trim();
  if (!v) fail(new Step('input', `${name} is not set`, 2));
  return v;
}

function num(name: string, fallback: number): number {
  const v = Number(env[name] ?? '');
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const tail = (s: string, n = 40) => s.trim().split('\n').slice(-n).join('\n');

// ---- inputs ----

need('RV_PROJECT_ID');
const mode = need('MODE') as Mode;
if (!MODES.includes(mode)) fail(new Step('input', `MODE must be one of ${MODES.join(', ')}`, 2));
const app = need('APP');
if (!/^[a-z][a-z0-9-]{1,30}$/.test(app)) fail(new Step('input', 'APP must be lowercase kebab-case', 2));
const repo = need('REPO');
const branch = need('BRANCH');
if (branch === 'main') fail(new Step('input', 'runs never push main; publish does', 2));
const base = env.BASE_BRANCH?.trim() || 'main';
const region = need('AWS_REGION');
const model = (env.MODEL?.trim() || 'auto').toLowerCase() === 'auto' ? 'auto' : env.MODEL!.trim();
const payer = env.KIRO_PAYER?.trim() === 'own' ? 'own' : 'company';
const creditsLimit = num('CREDITS_LIMIT', 0);
const totalMs = num('TIME_LIMIT_MIN', 45) * 60_000;
const reserveMs = Math.min(10 * 60_000, totalMs / 3);
const work = env.WORK_DIR?.trim() || '/work/app';
const hold = `rv/run-${run}`;
const spec = `.kiro/specs/${app}`;
const commitId = env.COMMIT?.trim() || '';
if (mode === 'check' && !/^[0-9a-f]{40}$/.test(commitId)) fail(new Step('input', 'COMMIT must be a full commit id in check mode', 2));

const identity = {
  GIT_AUTHOR_NAME: env.GIT_NAME || 'Revenant',
  GIT_AUTHOR_EMAIL: env.GIT_EMAIL || 'revenant@example.com',
  GIT_COMMITTER_NAME: env.GIT_NAME || 'Revenant',
  GIT_COMMITTER_EMAIL: env.GIT_EMAIL || 'revenant@example.com',
};

// The runner's own git: CodeCommit credential helper, set per process, never in a config file.
const gitEnv: NodeJS.ProcessEnv = {
  ...env,
  ...identity,
  GIT_TERMINAL_PROMPT: '0',
  GIT_CONFIG_COUNT: '2',
  GIT_CONFIG_KEY_0: 'credential.helper',
  GIT_CONFIG_VALUE_0: '!aws codecommit credential-helper $@',
  GIT_CONFIG_KEY_1: 'credential.UseHttpPath',
  GIT_CONFIG_VALUE_1: 'true',
};

// The agent and the checks get no AWS credentials and no push access.
function bare(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const e: NodeJS.ProcessEnv = { ...env, ...identity, ...extra };
  for (const k of [
    'AWS_CONTAINER_CREDENTIALS_RELATIVE_URI',
    'AWS_CONTAINER_CREDENTIALS_FULL_URI',
    'AWS_CONTAINER_AUTHORIZATION_TOKEN',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_SESSION_TOKEN',
    'KIRO_SECRET_ARN',
  ]) {
    delete e[k];
  }
  return e;
}

// ---- shell ----

type Out = { ok: boolean; out: string; err: string };

function sh(cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): Out {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd ?? work,
    env: opts.env ?? gitEnv,
    encoding: 'utf8',
    maxBuffer: 64 << 20,
  });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() || String(r.error ?? '') };
}

const git = (...args: string[]) => sh('git', args);

function must(r: Out, step: ErrorStep): string {
  if (!r.ok) throw new Step(step, tail(r.err || r.out));
  return r.out;
}

const say = (text: string) => emit({ t: 'message', from: 'runner', text });

const head = () => git('rev-parse', '-q', '--verify', 'HEAD').out;
const dirty = () => git('status', '--porcelain').out !== '';
const remote = (b: string) => git('rev-parse', '-q', '--verify', `refs/remotes/origin/${b}`).ok;

function commitAll(message: string): void {
  must(git('add', '-A'), 'commit');
  must(git('commit', '-q', '--no-verify', '-m', message), 'commit');
}

// Commits go to a hold branch Amplify does not build, so a stopped run keeps its work.
function pushHold(): void {
  if (!cloned || !head()) return;
  if (git('push', '-q', 'origin', `HEAD:refs/heads/${hold}`).ok) held = true;
}

function save(): void {
  if (!cloned || mode === 'check') return; // a check commits nothing
  try {
    if (dirty()) commitAll(`chore: uncommitted work from run ${run}`);
  } catch {
    // keep going: pushing what is committed matters more
  }
  pushHold();
  if (held) say(`work saved on ${hold} at ${head()}`);
}

function credits(): void {
  emit({ t: 'credits', used, limit: creditsLimit || null, payer, model });
}

// The last line of every run, then exit. See the exit codes in runner/README.md.
function finish(code: number): never {
  const status = code === 0 ? 'succeeded' : code === 3 ? 'timeout' : code === 143 ? 'stopped' : 'failed';
  const commit = ready && cloned ? head() || null : null;
  emit({
    t: 'run_done',
    status,
    code,
    credits: used,
    commit,
    branch: code === 0 ? branch : held ? hold : null,
    seconds: Math.round((Date.now() - t0) / 1000),
  });
  process.exit(code);
}

// ---- steps ----

function secret(arn: string): string {
  const r = sh('aws', ['secretsmanager', 'get-secret-value', '--secret-id', arn, '--query', 'SecretString', '--output', 'text'], {
    cwd: '/',
    env,
  });
  if (!r.ok) throw new Step('secret', 'could not read the Kiro key from Secrets Manager');
  let v = r.out.trim();
  if (v.startsWith('{')) {
    try {
      const j = JSON.parse(v) as Record<string, unknown>;
      v = String(j.apiKey ?? j.KIRO_API_KEY ?? j.key ?? '');
    } catch {
      v = '';
    }
  }
  if (!v) throw new Step('secret', 'the Kiro key secret is empty');
  return v;
}

function request(): string {
  const bucket = env.PROMPT_BUCKET?.trim();
  const key = env.PROMPT_S3_KEY?.trim();
  if (!bucket || !key) {
    if (mode === 'build') return '';
    throw new Step('input', 'PROMPT_BUCKET and PROMPT_S3_KEY are required', 2);
  }
  const r = sh('aws', ['s3', 'cp', `s3://${bucket}/${key}`, '-', '--quiet'], { cwd: '/', env });
  if (!r.ok) throw new Step('prompt', 'could not read the prompt from S3');
  return r.out;
}

function clone(): void {
  mkdirSync(dirname(work), { recursive: true });
  const url = `https://git-codecommit.${region}.amazonaws.com/v1/repos/${repo}`;
  must(sh('git', ['clone', '-q', url, work], { cwd: dirname(work) }), 'clone');
  cloned = true;
}

function steering(): void {
  cpSync(join(home, 'steering'), join(work, '.kiro', 'steering'), { recursive: true });
}

// A new repo starts from the starter template with the building blocks.
function seed(): void {
  if (remote(base)) return;
  if (git('branch', '-r').out) throw new Step('clone', `base branch ${base} not found`);
  must(git('symbolic-ref', 'HEAD', `refs/heads/${base}`), 'seed');
  cpSync(join(home, 'templates', 'starter'), work, { recursive: true });
  cpSync(join(home, 'blocks'), join(work, 'blocks'), { recursive: true });
  steering();
  commitAll('chore: start from the Revenant starter');
  must(git('push', '-q', 'origin', `HEAD:refs/heads/${base}`), 'seed');
  say(`new repo started from the starter on ${base}`);
}

function checkout(): void {
  if (remote(branch)) must(git('checkout', '-q', '-B', branch, `origin/${branch}`), 'clone');
  else must(git('checkout', '-q', '-b', branch, `origin/${base}`), 'clone');
  steering();
  if (git('status', '--porcelain', '.kiro/steering').out) commitAll('chore: update Revenant steering');
}

function attachments(): string {
  const bucket = env.PROMPT_BUCKET?.trim();
  const prefix = env.ATTACH_S3_PREFIX?.trim();
  if (!bucket || !prefix) return '';
  const dir = join(work, '.rv', 'attachments');
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(work, '.git', 'info', 'exclude'), '\n.rv/\n');
  const r = sh('aws', ['s3', 'cp', '--recursive', '--quiet', `s3://${bucket}/${prefix}`, dir], { cwd: '/', env });
  if (!r.ok) throw new Step('prompt', 'could not read the attachments from S3');
  const names = readdirSync(dir);
  if (!names.length) return '';
  return `Files the user attached are in \`.rv/attachments/\` (not committed): ${names.join(', ')}. Copy into the app what it needs, for example a logo into \`public/\`.`;
}

function prompt(text: string, files: string): string {
  const t = readFileSync(join(here, 'prompts', `${mode}.md`), 'utf8')
    .replaceAll('{{app}}', app)
    .replaceAll('{{spec}}', spec)
    .replaceAll('{{branch}}', branch)
    .replaceAll('{{attempt}}', env.ATTEMPT?.trim() || '1')
    .replaceAll('{{attachments}}', files);
  return t.replace('{{request}}', () => text.trim() || '(none)');
}

function readTasks(): Task[] {
  const p = join(work, spec, 'tasks.md');
  return existsSync(p) ? parse(readFileSync(p, 'utf8')) : [];
}

function stopChild(): void {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  const c = child;
  setTimeout(() => c.exitCode === null && c.kill('SIGKILL'), 15_000).unref();
}

// Runs kiro-cli headless and turns its stream into runner lines. Resolves with the limit hit, if any.
function kiro(text: string, key: string, deadline: number): Promise<'time' | 'credits' | null> {
  const args = ['chat', '--v3', '--no-interactive', '--trust-all-tools', '--output-format', 'stream-json', '--model', model];
  const c = spawn('kiro-cli', args, { cwd: work, env: bare({ KIRO_API_KEY: key }), stdio: ['pipe', 'pipe', 'pipe'] });
  child = c;
  c.stdin.end(text);

  let limit: 'time' | 'credits' | null = null;
  let status = 'unknown';
  let buf = '';
  let errs = '';
  let before = readTasks();
  let last = head();
  const seen = new Set<string>();

  const hit = (why: 'time' | 'credits') => {
    if (limit) return;
    limit = why;
    emit({ t: 'error', step: 'limit', text: why === 'time' ? 'time limit reached' : `credits limit reached (${creditsLimit})` });
    stopChild();
  };
  const timer = setTimeout(() => hit('time'), Math.max(0, deadline - Date.now()));

  const flush = () => {
    const t = buf.trim();
    buf = '';
    if (!t) return;
    const cause = /^Cause:\s*(.+)$/m.exec(t)?.[1]?.trim();
    emit({ t: 'message', from: 'agent', text: t, ...(cause ? { cause } : {}) });
  };

  const after = () => {
    for (const line of git('status', '--porcelain', '-uall').out.split('\n')) {
      if (!line) continue;
      const code = line.slice(0, 2);
      const path = line.slice(3).split(' -> ').pop()!.replace(/^"|"$/g, '');
      if (seen.has(path)) continue;
      seen.add(path);
      emit({ t: 'file_changed', path, change: code.includes('?') || code.includes('A') ? 'add' : code.includes('D') ? 'delete' : 'modify' });
    }
    const now = readTasks();
    for (const t of started(before, now)) emit({ t: 'task_started', task: t.number, title: t.title });
    before = now;
    const h = head();
    if (h && h !== last) {
      const range = last ? `${last}..${h}` : h;
      for (const row of git('log', '--reverse', '--format=%H%x09%s', range).out.split('\n')) {
        const [sha, subject = ''] = row.split('\t');
        const task = committed(subject);
        if (task && !done.has(task.number)) {
          done.add(task.number);
          const title = now.find((t) => t.number === task.number)?.title ?? task.title;
          emit({ t: 'task_done', task: task.number, title, commit: sha });
        }
      }
      last = h;
      seen.clear();
      pushHold();
    }
  };

  const lines = createInterface({ input: c.stdout });
  lines.on('line', (line) => {
    for (const e of read(line, work)) {
      if (e.type === 'text') buf += e.text;
      else if (e.type === 'tool') flush();
      else if (e.type === 'file') {
        if (e.path.startsWith('.git/')) continue;
        seen.add(e.path);
        emit({ t: 'file_changed', path: e.path, change: change(e.op) });
      } else if (e.type === 'done') {
        flush();
        after();
      } else if (e.type === 'credits') {
        used = e.used;
        credits();
        if (creditsLimit > 0 && used >= creditsLimit) hit('credits');
      } else if (e.type === 'end') {
        flush();
        status = e.status;
      }
    }
  });
  c.stderr.on('data', (d: Buffer) => {
    errs = tail(errs + d.toString('utf8'), 30);
  });

  return new Promise((resolve, reject) => {
    c.on('error', (e) => reject(new Step('kiro', `could not start kiro-cli: ${e.message}`)));
    c.on('close', (code) => {
      clearTimeout(timer);
      child = null;
      flush();
      after();
      if (limit) return resolve(limit);
      if (code !== 0 || status !== 'success') return reject(new Step('kiro', tail(errs) || `kiro-cli exited with ${code}, status ${status}`));
      resolve(null);
    });
  });
}

// install, lint, synth, cfn-lint, guard: scripts, not agent turns.
function checks(): Promise<void> {
  const c = spawn('bash', [join(here, 'check.sh'), work, branch], {
    cwd: work,
    env: bare({ RV_APP: app, RV_BRANCH: branch }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child = c;
  let step: ErrorStep = 'install';
  let out = '';
  const keep = (line: string) => {
    if (line.startsWith('RV-STEP ')) {
      step = line.slice(8).trim() as ErrorStep;
      say(`check: ${step}`);
      return;
    }
    process.stdout.write(`${relay(line)}\n`);
    if (line.startsWith(RUNNER_PREFIX)) return;
    out = tail(`${out}\n${line}`, 40);
  };
  createInterface({ input: c.stdout }).on('line', keep);
  createInterface({ input: c.stderr }).on('line', keep);
  return new Promise((resolve, reject) => {
    c.on('error', (e) => reject(new Step('check', e.message)));
    c.on('close', (code) => {
      child = null;
      if (code === 0) resolve();
      else reject(new Step(step, out || `check failed at ${step}`));
    });
  });
}

function specOnly(start: string): void {
  const changed = git('diff', '--name-only', `${start}..HEAD`).out.split('\n').filter(Boolean);
  const outside = changed.filter((f) => !f.startsWith('.kiro/specs/'));
  if (outside.length) throw new Step('spec', `spec runs change only the spec; also changed: ${outside.join(', ')}`);
  for (const f of ['requirements.md', 'design.md', 'tasks.md']) {
    if (!existsSync(join(work, spec, f))) throw new Step('spec', `missing ${spec}/${f}`);
  }
}

async function push(): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (git('push', '-q', 'origin', `HEAD:refs/heads/${branch}`).ok) return;
    // Someone committed to the branch meanwhile (Code tab): rebase onto it and check again.
    must(git('pull', '-q', '--rebase', 'origin', branch), 'push');
    if (mode !== 'spec') await checks();
  }
  throw new Step('push', `could not push ${branch}`);
}

// MODE=check: the commit is already on BRANCH; run the checks on it and push nothing.
async function check(): Promise<void> {
  say(`run ${run}: check ${commitId.slice(0, 8)} on ${branch}`);
  clone();
  if (!remote(branch)) throw new Step('clone', `branch ${branch} not found`);
  must(git('checkout', '-q', '-B', branch, commitId), 'clone');
  await checks();
  say(`checks passed on ${branch} at ${commitId.slice(0, 8)}`);
  finish(0);
}

async function main(): Promise<void> {
  if (mode === 'check') {
    setTimeout(() => {
      emit({ t: 'error', step: 'limit', text: 'time limit reached' });
      stopChild();
      finish(3);
    }, totalMs).unref();
    return check();
  }
  const startedAt = Date.now();
  const end = startedAt + totalMs;
  const watchdog = setTimeout(() => {
    emit({ t: 'error', step: 'limit', text: 'time limit reached' });
    stopChild();
    save();
    credits();
    finish(3);
  }, totalMs);

  say(`run ${run}: ${mode} on ${branch}, model ${model}, ${payer} key`);
  const key = secret(need('KIRO_SECRET_ARN'));
  const text = request();
  clone();
  seed();
  checkout();
  const files = attachments();
  const start = head();
  initial = readTasks();

  const limit = await kiro(prompt(text, files), key, end - reserveMs);
  if (dirty()) commitAll(`chore: uncommitted work from run ${run}`);
  // Tasks the agent marked done without a `task <n>:` commit.
  const was = new Map(initial.map((t) => [t.number, t.state]));
  for (const t of readTasks()) {
    if (t.state === 'done' && was.get(t.number) !== 'done' && !done.has(t.number)) {
      done.add(t.number);
      emit({ t: 'task_done', task: t.number, title: t.title, commit: head() });
    }
  }
  if (limit) {
    save();
    credits();
    finish(3);
  }

  if (mode === 'spec') specOnly(start);
  else {
    await checks();
    // check.sh resyncs package-lock.json when the agent left it behind package.json.
    if (git('status', '--porcelain', 'package-lock.json').out) {
      must(git('add', 'package-lock.json'), 'commit');
      must(git('commit', '-q', '--no-verify', '-m', 'chore: sync package-lock.json'), 'commit');
    }
  }
  await push();
  if (held) git('push', '-q', 'origin', '--delete', hold);

  clearTimeout(watchdog);
  credits();
  say(`pushed to ${branch}`);
  finish(0);
}

function fail(e: unknown): never {
  const s = e instanceof Step ? e : new Step('runner', e instanceof Error ? e.message : String(e));
  emit({ t: 'error', step: s.step, text: s.message });
  if (ready) {
    stopChild();
    save();
    credits();
  }
  finish(s.code);
}

process.on('SIGTERM', () => {
  emit({ t: 'error', step: 'stopped', text: 'run stopped' });
  stopChild();
  save();
  credits();
  finish(143);
});

ready = true;
main().catch(fail);
