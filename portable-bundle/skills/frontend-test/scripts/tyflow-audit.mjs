#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { print, readJson, walk, writeJson } from './lib.mjs';

const [rootArg = process.cwd(), output] = process.argv.slice(2);
const root = path.resolve(rootArg);
const packageFile = path.join(root, 'package.json');

if (!fs.existsSync(packageFile)) {
  print({ conclusion: 'INCOMPLETE', reasonCode: 'PACKAGE_JSON_MISSING', root });
  process.exit(2);
}

const pkg = readJson(packageFile);
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const reactApplicable = Boolean(deps.react);
const angular = Boolean(deps['@angular/core']);
const scripts = pkg.scripts || {};

function scriptMatches(pattern) {
  return Object.entries(scripts).filter(([name]) => pattern.test(name)).map(([name, command]) => ({ name, command }));
}

const gates = {
  lint: scriptMatches(/lint/i),
  typecheck: scriptMatches(/type|tsc/i),
  test: scriptMatches(/test|spec/i),
  build: scriptMatches(/build/i),
  i18n: scriptMatches(/scan|i18n|locale/i),
};
if (!gates.typecheck.length && deps.typescript) gates.typecheck.push({ name: 'direct-tsc-candidate', command: 'use the project-pinned TypeScript executable after config verification' });

const gitChanged = spawnSync('git', ['-C', root, 'diff', '--name-only', '--diff-filter=ACMR', 'HEAD'], { encoding: 'utf8', windowsHide: true });
const gitStatus = spawnSync('git', ['-C', root, 'status', '--porcelain=v1', '--untracked-files=all'], { encoding: 'utf8', windowsHide: true });
const changedNames = new Set(gitChanged.status === 0 ? gitChanged.stdout.split(/\r?\n/).filter(Boolean) : []);
const untrackedNames = new Set();
if (gitStatus.status === 0) {
  for (const entry of gitStatus.stdout.split(/\r?\n/).filter(Boolean)) {
    const rawName = entry.slice(3).trim();
    const name = rawName.includes(' -> ') ? rawName.split(' -> ').at(-1) : rawName;
    const normalized = name.replace(/^"|"$/g, '').replaceAll('\\', '/');
    changedNames.add(normalized);
    if (entry.startsWith('??')) untrackedNames.add(normalized);
  }
}
const changed = [...changedNames].map((name) => path.resolve(root, name)).filter((file) => fs.existsSync(file));
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.less', '.css', '.scss', '.sass']);
function isGeneratedSource(file) {
  const relative = path.relative(root, file).replaceAll('\\', '/');
  return /(^|\/)\.umi(?:[-.][^/]+)?\//.test(relative);
}

const allSource = walk(path.join(root, 'src'), (file) => extensions.has(path.extname(file).toLowerCase()) && !isGeneratedSource(file));
const files = changed.filter((file) => extensions.has(path.extname(file).toLowerCase()));
const selected = files.length ? files : allSource;
const hardViolations = [];
const reviewCandidates = [];
const maxFindings = 500;

function add(bucket, finding) {
  if (bucket.length < maxFindings) bucket.push(finding);
}

function changedLineNumbers(relative) {
  if (!files.length || untrackedNames.has(relative)) return null;
  const diff = spawnSync('git', ['-C', root, 'diff', '--unified=0', '--no-ext-diff', 'HEAD', '--', relative], { encoding: 'utf8', windowsHide: true });
  if (diff.status !== 0) return null;
  const numbers = new Set();
  for (const line of diff.stdout.split(/\r?\n/)) {
    const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (!match) continue;
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    for (let number = start; number < start + count; number += 1) numbers.add(number);
  }
  return numbers;
}

function baselineFile(relative) {
  const result = spawnSync('git', ['-C', root, 'show', `HEAD:${relative}`], { encoding: 'utf8', windowsHide: true });
  return result.status === 0 ? result.stdout : '';
}

function antdImports(source) {
  const names = new Set();
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]antd['"]/gs)) {
    for (const item of match[1].split(',')) names.add(item.trim().split(/\s+as\s+/)[0]);
  }
  return names;
}

let scannedLines = 0;
for (const file of selected) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const relative = path.relative(root, file).replaceAll('\\', '/');
    const lines = text.split(/\r?\n/);
    const changedLines = changedLineNumbers(relative);
    const previousAntdImports = antdImports(baselineFile(relative));
    const hasRequestImport = /import\s+[\s\S]{0,200}\brequest\b[\s\S]{0,200}from\s+['"][^'"]*(?:request|umi|http|service)[^'"]*['"]/.test(text);
    const isServiceLayer = /(^|\/)(?:services?|api)(?:\/|\.(?:[cm]?[jt]sx?)$)/i.test(relative);
  lines.forEach((line, index) => {
    if (changedLines && !changedLines.has(index + 1)) return;
    scannedLines += 1;
    const location = { file: relative, line: index + 1 };
    const directNetworkCall = /\bfetch\s*\(|\baxios\s*\.\s*(get|post|put|patch|delete)\s*\(/.test(line) || (hasRequestImport && /\brequest\s*\(/.test(line));
    if (reactApplicable && /^src\/(pages|components)\//.test(relative) && !isServiceLayer && directNetworkCall) {
      add(reviewCandidates, { ruleId: 'TYF-SERVICE-DIRECT-NETWORK', ...location, message: 'React page/component appears to call the network directly; verify service-layer placement before treating it as a rule violation.' });
    }
    if (/eslint-disable/.test(line) && !/reason|原因|because|legacy|兼容/i.test(line)) {
      add(reviewCandidates, { ruleId: 'TYF-CODE-UNEXPLAINED-ESLINT-DISABLE', ...location, message: 'eslint-disable requires an explicit reason and impact scope.' });
    }
    if (/@ts-ignore/.test(line)) {
      add(reviewCandidates, { ruleId: 'TYF-CODE-TS-IGNORE', ...location, message: '@ts-ignore requires review, source, impact, and exit condition.' });
    }
    if (/\bas\s+any\b|:\s*any\b|<any>/.test(line)) {
      add(reviewCandidates, { ruleId: 'TYF-CODE-ANY', ...location, message: 'New or touched any usage requires type-quality review.' });
    }
    if (/from\s+['"]antd['"]/.test(line) && /\b(Table|Drawer|DatePicker|Empty|Input)\b/.test(line)) {
      const mentioned = [...line.matchAll(/\b(Table|Drawer|DatePicker|Empty|Input)\b/g)].map((match) => match[1]);
      const newlyIntroduced = mentioned.filter((name) => !previousAntdImports.has(name));
      if (newlyIntroduced.length) add(reviewCandidates, { ruleId: 'TYF-COMP-REUSE', ...location, message: `Check project wrappers and Tingyun components before using newly introduced raw Ant Design control(s): ${newlyIntroduced.join(', ')}.` });
    }
    if (/\.(less|css|scss|sass)$/.test(relative)) {
      if (/(#[0-9a-fA-F]{3,8}\b|rgba?\s*\()/.test(line) && !/var\s*\(/.test(line)) {
        add(reviewCandidates, { ruleId: 'TYF-DESIGN-HARDCODED-COLOR', ...location, message: 'Confirm no applicable semantic color token exists.' });
      }
      if (/\b(font-size|margin|padding|gap|border-radius|box-shadow)\s*:\s*[^;]*\b\d+(?:\.\d+)?px\b/.test(line) && !/var\s*\(/.test(line)) {
        add(reviewCandidates, { ruleId: 'TYF-DESIGN-HARDCODED-METRIC', ...location, message: 'Confirm no applicable spacing, typography, radius, or shadow token exists.' });
      }
    }
    if (/\.(tsx|jsx)$/.test(relative) && /[\u4e00-\u9fff]/.test(line) && !/I18nT\s*\(/.test(line)) {
      add(reviewCandidates, { ruleId: 'TYF-I18N-CHINESE-CANDIDATE', ...location, message: 'Potential user-visible Chinese text; verify i18n wrapping and generated locales.' });
    }
  });
}

const missingGateCandidates = Object.entries(gates).filter(([, matches]) => !matches.length).map(([gate]) => gate);
let conclusion = 'VERIFIED';
const reasonCodes = [];
if (hardViolations.length) { conclusion = 'FAILED'; reasonCodes.push('TYFLOW_HARD_RULE_VIOLATION'); }
if (conclusion !== 'FAILED' && (reviewCandidates.length || missingGateCandidates.length)) {
  conclusion = 'INCOMPLETE';
  if (reviewCandidates.length) reasonCodes.push('TYFLOW_REVIEW_REQUIRED');
  if (missingGateCandidates.length) reasonCodes.push('TYFLOW_GATE_COMMAND_UNCONFIRMED');
}

const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  root,
  applicability: { reactTypeScriptCompanyBaseline: reactApplicable, angularProjectAdaptation: angular },
  selection: files.length ? 'git-changed-lines' : 'all-src-files',
  scannedFiles: selected.length,
  scannedLines,
  gates,
  missingGateCandidates,
  hardViolations,
  reviewCandidates,
  truncated: hardViolations.length >= maxFindings || reviewCandidates.length >= maxFindings,
  conclusion,
  reasonCodes,
  boundary: 'Static candidate scan only. Run verified project commands and behavior/visual tests before a release conclusion.',
};

if (output) writeJson(output, result);
print(result);
process.exitCode = conclusion === 'VERIFIED' ? 0 : conclusion === 'FAILED' ? 1 : 2;
