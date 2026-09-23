import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

export const EXIT = { VERIFIED: 0, FAILED: 1, INCOMPLETE: 2, NEEDS_DECISION: 3 };
const SPEC_NAMES = new Set(['requirement.yaml', 'behavior.yaml', 'contract.yaml', 'oracle.yaml', 'test-plan.yaml', 'traceability.yaml', 'requirement.yml', 'behavior.yml', 'contract.yml', 'oracle.yml', 'test-plan.yml', 'traceability.yml', 'requirement.json', 'behavior.json', 'contract.json', 'oracle.json', 'test-plan.json', 'traceability.json']);
const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'test-results', '.next', '.umi', '.cache']);
const STATUSES = new Set(['draft', 'clarified', 'confirmed', 'implemented', 'verified', 'superseded', 'provisional']);

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function stableJson(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeJson(file, value) {
  ensureDir(path.dirname(path.resolve(file)));
  fs.writeFileSync(file, stableJson(value), 'utf8');
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function findModule(name, start) {
  let current = path.resolve(start);
  while (true) {
    try {
      const req = createRequire(path.join(current, 'package.json'));
      return { req, resolved: req.resolve(name) };
    } catch {}
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function readStructured(file) {
  const text = fs.readFileSync(file, 'utf8');
  try {
    return JSON.parse(text);
  } catch {}
  const yaml = findModule('yaml', path.dirname(file));
  if (yaml) return yaml.req(yaml.resolved).parse(text);
  const jsYaml = findModule('js-yaml', path.dirname(file));
  if (jsYaml) return jsYaml.req(jsYaml.resolved).load(text);
  const error = new Error(`NEEDS_SETUP: ${file} is YAML but no compatible yaml or js-yaml parser is available from the target project`);
  error.code = 'YAML_PARSER_MISSING';
  throw error;
}

export function walk(root, predicate, output = []) {
  if (!fs.existsSync(root)) return output;
  const stat = fs.statSync(root);
  if (stat.isFile()) {
    if (predicate(root)) output.push(path.resolve(root));
    return output;
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && (IGNORE.has(entry.name) || /^_exports/i.test(entry.name))) continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) walk(full, predicate, output);
    else if (predicate(full)) output.push(path.resolve(full));
  }
  return output;
}

function rgFiles(root, globs) {
  const args = ['--files'];
  for (const glob of globs) args.push('-g', glob);
  args.push('--hidden', '-g', '!**/node_modules/**', '-g', '!**/.git/**', '-g', '!**/dist/**', '-g', '!**/build/**', '-g', '!**/coverage/**', '-g', '!**/test-results/**', '-g', '!**/_exports*/**');
  const result = spawnSync('rg', args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 50 * 1024 * 1024 });
  if (result.status !== 0 && result.status !== 1) return null;
  return result.stdout.split(/\r?\n/).filter(Boolean).map((file) => path.resolve(root, file));
}

function git(cwd, args) {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
  return result.status === 0 ? result.stdout.trim() : null;
}

function hashFile(file) {
  return fs.existsSync(file) ? sha256(fs.readFileSync(file)) : null;
}

export function discoverProjects(root) {
  const resolvedRoot = path.resolve(root);
  const packageFiles = rgFiles(resolvedRoot, ['package.json']) || walk(resolvedRoot, (file) => path.basename(file) === 'package.json');
  const allTestFiles = rgFiles(resolvedRoot, ['*.test.js', '*.test.jsx', '*.test.ts', '*.test.tsx', '*.spec.js', '*.spec.jsx', '*.spec.ts', '*.spec.tsx', '*.test.mjs', '*.spec.mjs', '*.test.cjs', '*.spec.cjs']) || walk(resolvedRoot, (file) => /(?:^|[.])(test|spec)\.[cm]?[jt]sx?$/.test(path.basename(file)));
  const projects = packageFiles.map((packageFile) => {
    const cwd = path.dirname(packageFile);
    let pkg;
    try { pkg = readJson(packageFile); } catch { pkg = {}; }
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const stack = [];
    if (deps['@angular/core']) stack.push('angular');
    if (deps['react']) stack.push('react');
    if (deps['umi'] || deps['@umijs/max']) stack.push('umi');
    if (deps['vite']) stack.push('vite');
    if (deps['@playwright/test']) stack.push('playwright');
    const lockNames = ['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json'];
    const locks = lockNames.filter((name) => fs.existsSync(path.join(cwd, name))).map((name) => ({ name, sha256: hashFile(path.join(cwd, name)) }));
    const head = git(cwd, ['rev-parse', 'HEAD']);
    const commonDir = git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
    const status = git(cwd, ['status', '--porcelain=v1', '--untracked-files=normal']);
    const staged = git(cwd, ['diff', '--cached', '--binary']);
    const unstaged = git(cwd, ['diff', '--binary']);
    const prefix = `${path.resolve(cwd)}${path.sep}`.toLowerCase();
    const testFiles = allTestFiles.filter((file) => file.toLowerCase().startsWith(prefix)).length;
    return {
      projectId: pkg.name || path.basename(cwd),
      checkoutId: sha256(`${path.resolve(cwd)}\n${commonDir || ''}`).slice(0, 16),
      path: path.resolve(cwd),
      packageFile: path.resolve(packageFile),
      packageManager: locks.map((item) => item.name),
      stack,
      scripts: pkg.scripts || {},
      locks,
      git: head ? {
        head,
        commonDir,
        dirty: Boolean(status),
        statusLines: status ? status.split(/\r?\n/).length : 0,
        stagedPatchSha256: sha256(staged || ''),
        unstagedPatchSha256: sha256(unstaged || ''),
      } : null,
      discoveredTestFiles: testFiles,
    };
  });
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    root: resolvedRoot,
    projectCount: projects.length,
    projects,
  };
}

function visit(value, fn, pointer = '$') {
  fn(value, pointer);
  if (Array.isArray(value)) value.forEach((item, index) => visit(item, fn, `${pointer}[${index}]`));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) visit(item, fn, `${pointer}.${key}`);
  }
}

function collectIds(documents) {
  const ids = new Set();
  for (const { data } of documents) {
    visit(data, (value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return;
      for (const [key, item] of Object.entries(value)) {
        if (/(?:^|[A-Z_])id$/i.test(key) && typeof item === 'string') ids.add(item);
      }
    });
  }
  return ids;
}

export function loadSpecs(target) {
  const files = walk(target, (file) => SPEC_NAMES.has(path.basename(file).toLowerCase()));
  return files.map((file) => ({ file, kind: path.basename(file).replace(/\.(yaml|yml|json)$/i, ''), data: readStructured(file) }));
}

export function validateSpecs(target) {
  let documents;
  try { documents = loadSpecs(target); }
  catch (error) {
    return { valid: false, conclusion: 'INCOMPLETE', errors: [{ code: error.code || 'PARSE_ERROR', message: error.message }], warnings: [], documents: [] };
  }
  const errors = [];
  const warnings = [];
  if (!documents.length) errors.push({ code: 'NO_SPEC_FILES', message: `No SDD spec files found under ${path.resolve(target)}` });
  const ids = collectIds(documents);
  for (const doc of documents) {
    visit(doc.data, (value, pointer) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return;
      for (const [key, item] of Object.entries(value)) {
        if (key === 'status' && typeof item === 'string' && !STATUSES.has(item)) {
          errors.push({ code: 'INVALID_STATUS', file: doc.file, pointer: `${pointer}.${key}`, value: item });
        }
        if (/Refs?$/i.test(key)) {
          const refs = Array.isArray(item) ? item : [item];
          for (const ref of refs) {
            if (typeof ref === 'string' && !ids.has(ref)) warnings.push({ code: 'UNRESOLVED_REF', file: doc.file, pointer: `${pointer}.${key}`, ref });
          }
        }
      }
    });
    if (doc.kind === 'oracle') {
      const serialized = JSON.stringify(doc.data).toLowerCase();
      for (const forbidden of ['current-page', 'current-api', 'current-implementation', 'observed-current-implementation', '当前页面', '当前接口', '当前实现']) {
        if (serialized.includes(forbidden)) errors.push({ code: 'FORBIDDEN_ORACLE_SOURCE', file: doc.file, value: forbidden });
      }
      let oracleCount = 0;
      let sourcedCount = 0;
      visit(doc.data, (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return;
        if (value.oracleId || value.id) {
          oracleCount += 1;
          if ((Array.isArray(value.sourceRefs) && value.sourceRefs.length) || value.sourceRef || value.formula || value.invariant || value.expected !== undefined) sourcedCount += 1;
        }
      });
      if (oracleCount && sourcedCount < oracleCount) errors.push({ code: 'ORACLE_WITHOUT_SOURCE_OR_RULE', file: doc.file, oracleCount, sourcedCount });
    }
  }
  const blocking = errors.some((error) => ['FORBIDDEN_ORACLE_SOURCE', 'ORACLE_WITHOUT_SOURCE_OR_RULE'].includes(error.code));
  return {
    valid: errors.length === 0,
    conclusion: errors.length ? (blocking ? 'NEEDS_DECISION' : 'INCOMPLETE') : 'VERIFIED',
    errors,
    warnings,
    documents: documents.map((doc) => ({ file: doc.file, kind: doc.kind, sha256: sha256(stableJson(doc.data)) })),
  };
}

function diffValues(before, after, pointer, changes) {
  if (Object.is(before, after)) return;
  const beforeObject = before && typeof before === 'object';
  const afterObject = after && typeof after === 'object';
  if (!beforeObject || !afterObject || Array.isArray(before) !== Array.isArray(after)) {
    changes.push({ pointer, before, after });
    return;
  }
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of [...keys].sort()) diffValues(before[key], after[key], `${pointer}.${key}`, changes);
}

export function diffStructured(beforePath, afterPath) {
  const before = readStructured(beforePath);
  const after = readStructured(afterPath);
  const changes = [];
  diffValues(before, after, '$', changes);
  const serialized = JSON.stringify(changes).toLowerCase();
  const classification = /permission|unit|timezone|default|boundary|error|status|expected|oracle|contract/.test(serialized) ? 'behavioral' : changes.length ? 'editorial-or-structural' : 'none';
  return { schemaVersion: 1, before: path.resolve(beforePath), after: path.resolve(afterPath), classification, changeCount: changes.length, changes };
}

function findCases(data, found = []) {
  if (Array.isArray(data)) {
    for (const item of data) findCases(item, found);
  } else if (data && typeof data === 'object') {
    const id = data.caseId || data.testCaseId;
    if (id) found.push(data);
    for (const value of Object.values(data)) findCases(value, found);
  }
  return found;
}

function findB2bGateConfig(data) {
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findB2bGateConfig(item);
      if (found) return found;
    }
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  if (data.b2bGates && typeof data.b2bGates === 'object') return data.b2bGates;
  for (const value of Object.values(data)) {
    const found = findB2bGateConfig(value);
    if (found) return found;
  }
  return null;
}

export function compilePlan(specPath, profile = 'change') {
  const validation = validateSpecs(specPath);
  if (!validation.valid) return { validation, plan: null };
  const docs = loadSpecs(specPath);
  const planDocs = docs.filter((doc) => doc.kind === 'test-plan');
  const b2bGates = planDocs.map((doc) => findB2bGateConfig(doc.data)).find(Boolean) || null;
  const cases = planDocs.flatMap((doc) => findCases(doc.data)).map((item) => ({
    id: item.caseId || item.testCaseId,
    projectId: item.projectId || null,
    required: item.required !== false,
    mode: item.mode || 'mock',
    cwd: item.cwd || null,
    command: item.command || null,
    args: Array.isArray(item.args) ? item.args : [],
    evidence: item.evidence || [],
    oracleRefs: item.oracleRefs || [],
  }));
  const revisions = new Set();
  for (const doc of docs) visit(doc.data, (value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, item] of Object.entries(value)) if (/revision$/i.test(key) && ['string', 'number'].includes(typeof item)) revisions.add(String(item));
    }
  });
  const runSeed = `${path.resolve(specPath)}\n${profile}\n${[...revisions].sort().join(',')}\n${cases.map((item) => item.id).sort().join(',')}`;
  const plan = {
    schemaVersion: 1,
    runId: `${new Date().toISOString().replace(/[:.]/g, '-')}-${sha256(runSeed).slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    profile,
    specPath: path.resolve(specPath),
    specRevisions: [...revisions].sort(),
    expectedCaseCount: cases.length,
    cases,
    requiredChecks: [
      'source-identity',
      'spec-validation',
      'evidence',
      'cleanup',
      ...(b2bGates?.enabled === true ? ['b2b-gates'] : []),
    ],
    b2bGates: b2bGates?.enabled === true ? {
      policy: 'b2b-practical-v1',
      riskLevel: b2bGates.riskLevel || null,
      efficiencyTargetMinutes: b2bGates.efficiencyTargetMinutes || null,
    } : null,
  };
  return { validation, plan };
}

export function freezePlan(planFile, runDir) {
  const plan = readJson(planFile);
  if (!Array.isArray(plan.cases)) throw new Error('execution plan must contain cases[]');
  ensureDir(runDir);
  for (const name of ['logs', 'traces', 'screenshots', 'visual-diffs', 'downloads']) ensureDir(path.join(runDir, name));
  const canonical = stableJson(plan);
  const digest = sha256(canonical);
  fs.writeFileSync(path.join(runDir, 'execution-plan.json'), canonical, 'utf8');
  fs.writeFileSync(path.join(runDir, 'execution-plan.sha256'), `${digest}\n`, 'utf8');
  writeJson(path.join(runDir, 'run.json'), { schemaVersion: 1, runId: plan.runId, state: 'FROZEN', profile: plan.profile, planHash: digest, createdAt: new Date().toISOString() });
  return { runDir: path.resolve(runDir), planHash: digest, caseCount: plan.cases.length };
}

function sanitizeName(value) {
  return String(value || 'case').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
}

export function executePlan(planFile, runDir) {
  const frozen = freezePlan(planFile, runDir);
  const plan = readJson(path.join(runDir, 'execution-plan.json'));
  const results = [];
  for (const item of plan.cases) {
    const startedAt = new Date().toISOString();
    if (!item.command || !item.cwd) {
      results.push({ id: item.id, required: item.required !== false, mode: item.mode, status: 'BLOCKED', reasonCode: 'NEEDS_SETUP', message: 'command or cwd missing', startedAt, finishedAt: new Date().toISOString() });
      continue;
    }
    const cwd = path.resolve(item.cwd);
    const result = spawnSync(item.command, Array.isArray(item.args) ? item.args : [], {
      cwd,
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
      timeout: Number(item.timeoutMs || 15 * 60 * 1000),
      maxBuffer: 50 * 1024 * 1024,
      env: { ...process.env, FRONTEND_TEST_RUN_ID: plan.runId || '' },
    });
    const logName = `${sanitizeName(item.id)}.log`;
    fs.writeFileSync(path.join(runDir, 'logs', logName), `${result.stdout || ''}${result.stderr || ''}`, 'utf8');
    let status = result.status === 0 ? 'PASS' : 'FAIL';
    let reasonCode = result.error?.code || (result.signal ? `SIGNAL_${result.signal}` : null);
    if (result.error && ['ENOENT', 'ETIMEDOUT'].includes(result.error.code)) status = 'BLOCKED';
    results.push({ id: item.id, required: item.required !== false, mode: item.mode, status, exitCode: result.status, signal: result.signal, reasonCode, log: `logs/${logName}`, startedAt, finishedAt: new Date().toISOString() });
  }
  const raw = { schemaVersion: 1, runId: plan.runId, planHash: frozen.planHash, expectedCaseCount: plan.cases.length, discoveredCaseCount: results.length, results };
  writeJson(path.join(runDir, 'raw-results.json'), raw);
  writeJson(path.join(runDir, 'cleanup.json'), { schemaVersion: 1, runId: plan.runId, status: 'NOT_REQUIRED', resources: [] });
  return raw;
}

export function verifyEvidence(runDir) {
  const requiredFiles = ['run.json', 'execution-plan.json', 'execution-plan.sha256', 'raw-results.json', 'cleanup.json'];
  const missing = requiredFiles.filter((name) => !fs.existsSync(path.join(runDir, name)));
  const errors = missing.map((name) => ({ code: 'MISSING_EVIDENCE', file: name }));
  if (!missing.includes('execution-plan.json') && !missing.includes('execution-plan.sha256')) {
    const plan = readJson(path.join(runDir, 'execution-plan.json'));
    const actual = sha256(stableJson(plan));
    const expected = fs.readFileSync(path.join(runDir, 'execution-plan.sha256'), 'utf8').trim();
    if (actual !== expected) errors.push({ code: 'PLAN_HASH_MISMATCH', expected, actual });
  }
  if (!missing.includes('raw-results.json') && !missing.includes('execution-plan.json')) {
    const raw = readJson(path.join(runDir, 'raw-results.json'));
    const plan = readJson(path.join(runDir, 'execution-plan.json'));
    if (raw.runId !== plan.runId) errors.push({ code: 'RUN_ID_MISMATCH', planRunId: plan.runId, resultRunId: raw.runId });
    if (raw.discoveredCaseCount !== plan.cases.length) errors.push({ code: 'CASE_COUNT_MISMATCH', expected: plan.cases.length, actual: raw.discoveredCaseCount });
    if (plan.cases.length === 0) errors.push({ code: 'ZERO_TESTS' });
  }
  if (!missing.includes('execution-plan.json')) {
    const plan = readJson(path.join(runDir, 'execution-plan.json'));
    if (Array.isArray(plan.requiredChecks) && plan.requiredChecks.includes('b2b-gates')) {
      const gateFile = path.join(runDir, 'b2b-gates.json');
      if (!fs.existsSync(gateFile)) errors.push({ code: 'MISSING_EVIDENCE', file: 'b2b-gates.json' });
      else {
        const gateResult = readJson(gateFile);
        if (gateResult.runId && gateResult.runId !== plan.runId) errors.push({ code: 'RUN_ID_MISMATCH', planRunId: plan.runId, gateRunId: gateResult.runId, file: 'b2b-gates.json' });
      }
    }
  }
  if (!missing.includes('cleanup.json')) {
    const cleanup = readJson(path.join(runDir, 'cleanup.json'));
    if (!['PASS', 'NOT_REQUIRED'].includes(cleanup.status)) errors.push({ code: 'CLEANUP_INCOMPLETE', status: cleanup.status });
  }
  const report = { schemaVersion: 1, runDir: path.resolve(runDir), valid: errors.length === 0, errors };
  writeJson(path.join(runDir, 'evidence-verification.json'), report);
  return report;
}

export function summarize(runDir) {
  const evidence = verifyEvidence(runDir);
  const rawPath = path.join(runDir, 'raw-results.json');
  const raw = fs.existsSync(rawPath) ? readJson(rawPath) : { results: [] };
  const required = (raw.results || []).filter((item) => item.required !== false);
  const counts = {};
  for (const item of raw.results || []) counts[item.status] = (counts[item.status] || 0) + 1;
  let conclusion = 'VERIFIED';
  const reasons = [];
  if (required.some((item) => item.status === 'FAIL')) { conclusion = 'FAILED'; reasons.push('REQUIRED_TEST_FAILED'); }
  if (required.some((item) => item.status === 'NEEDS_DECISION') && conclusion !== 'FAILED') { conclusion = 'NEEDS_DECISION'; reasons.push('ORACLE_DECISION_REQUIRED'); }
  if ((!evidence.valid || required.some((item) => ['BLOCKED', 'NOT_RUN', 'FLAKY'].includes(item.status)) || required.length === 0) && !['FAILED', 'NEEDS_DECISION'].includes(conclusion)) {
    conclusion = 'INCOMPLETE';
    if (!evidence.valid) reasons.push('EVIDENCE_INCOMPLETE');
    if (required.length === 0) reasons.push('ZERO_REQUIRED_TESTS');
    if (required.some((item) => ['BLOCKED', 'NOT_RUN', 'FLAKY'].includes(item.status))) reasons.push('REQUIRED_TEST_INCOMPLETE');
  }
  const b2bPath = path.join(runDir, 'b2b-gates.json');
  const b2b = fs.existsSync(b2bPath) ? readJson(b2bPath) : null;
  if (b2b?.conclusion === 'FAILED') {
    conclusion = 'FAILED';
    reasons.push(...(b2b.reasons || ['B2B_BLOCKING_FINDING']));
  } else if (b2b?.conclusion === 'NEEDS_DECISION' && conclusion !== 'FAILED') {
    conclusion = 'NEEDS_DECISION';
    reasons.push(...(b2b.reasons || ['B2B_DECISION_REQUIRED']));
  } else if (b2b?.conclusion === 'INCOMPLETE' && !['FAILED', 'NEEDS_DECISION'].includes(conclusion)) {
    conclusion = 'INCOMPLETE';
    reasons.push(...(b2b.reasons || ['B2B_REQUIRED_CHECK_INCOMPLETE']));
  }
  const releaseRecommendation = b2b?.releaseRecommendation || (conclusion === 'VERIFIED' ? 'GO' : conclusion === 'FAILED' ? 'NO_GO' : 'REVIEW_REQUIRED');
  const result = { schemaVersion: 1, runId: raw.runId || null, conclusion, exitCode: EXIT[conclusion], releaseRecommendation, counts, reasons: [...new Set(reasons)], evidence: evidence.valid, b2b: b2b ? { riskLevel: b2b.riskLevel, counts: b2b.counts } : null, generatedAt: new Date().toISOString() };
  writeJson(path.join(runDir, 'results.json'), result);
  const lines = [
    '# Frontend verification', '',
    `- Conclusion: **${conclusion}**`,
    `- Run: ${result.runId || 'unknown'}`,
    `- Exit code: ${result.exitCode}`,
    `- Evidence complete: ${evidence.valid ? 'yes' : 'no'}`,
    `- Counts: ${JSON.stringify(counts)}`,
    `- Reasons: ${reasons.length ? reasons.join(', ') : 'none'}`,
    `- Release recommendation: ${releaseRecommendation}`,
    ...(b2b ? [`- B2B risk: ${b2b.riskLevel || 'unknown'}`, `- B2B gates: ${JSON.stringify(b2b.counts || {})}`] : []),
    '', '## Cases', '',
    ...(raw.results || []).map((item) => `- ${item.id}: ${item.status}${item.log ? ` (${item.log})` : ''}`),
    '', '## Evidence errors', '',
    ...(evidence.errors.length ? evidence.errors.map((item) => `- ${item.code}: ${JSON.stringify(item)}`) : ['- none']),
    '',
  ];
  fs.writeFileSync(path.join(runDir, 'VERIFY.md'), lines.join('\n'), 'utf8');
  return result;
}

export function print(value) {
  process.stdout.write(stableJson(value));
}
