#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { print, readJson, walk, writeJson } from './lib.mjs';

const [rootArg = process.cwd(), output] = process.argv.slice(2);
const projectRoot = path.resolve(rootArg);
const packageFile = path.join(projectRoot, 'package.json');

function digest(file) {
  const stat = fs.statSync(file);
  return {
    path: file.replaceAll('\\', '/'),
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    modifiedAt: stat.mtime.toISOString(),
  };
}

function findKnowledgeBase() {
  const candidates = [];
  if (process.env.TYFLOW_KB_ROOT) candidates.push(path.resolve(process.env.TYFLOW_KB_ROOT));
  let current = projectRoot;
  for (;;) {
    candidates.push(path.join(current, 'web-skills', 'tyflow', 'baseline', '观云 知识库'));
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  candidates.push('C:/Users/tingyun/Desktop/project/web-skills/tyflow/baseline/观云 知识库');
  return [...new Set(candidates)].find((candidate) => fs.existsSync(path.join(candidate, 'knowledge-base-entry.md')));
}

const kbRoot = findKnowledgeBase();
const relativeSources = [
  'knowledge-base-entry.md',
  'engineering/engineering-overview.md',
  'engineering/engineering-full-reference.md',
  'engineering/structure-and-routing.md',
  'engineering/request-and-service.md',
  'engineering/quality-and-delivery.md',
  'engineering/project-standards-template.md',
  'design/design-overview.md',
  'design/design-tokens-and-theme.md',
  'design/typography-and-color.md',
  'design/layout-and-spacing.md',
  'design/implementation-checklist.md',
  'components/component-reuse-overview.md',
  'components/component-selection-flow.md',
  'components/component-library-index.md',
];

const missingSources = [];
const companySources = [];
for (const relative of relativeSources) {
  const file = kbRoot ? path.join(kbRoot, relative) : relative;
  if (!kbRoot || !fs.existsSync(file)) missingSources.push(relative);
  else companySources.push({ role: relative === 'knowledge-base-entry.md' ? 'entry' : 'referenced-standard', ...digest(file) });
}
if (kbRoot) {
  const tyflowRoot = path.dirname(path.dirname(kbRoot));
  const webSkillsRoot = path.dirname(tyflowRoot);
  const adjacentSources = [
    { role: 'release-verification', file: path.join(tyflowRoot, 'shared', 'VERIFICATION.md') },
    { role: 'legacy-interaction-defaults', file: path.join(webSkillsRoot, 'tingyun-interaction-skill', 'references', 'interaction-patterns.md') },
    { role: 'legacy-acceptance-checklist', file: path.join(webSkillsRoot, 'tingyun-interaction-skill', 'references', 'acceptance-checklist.md') },
  ];
  for (const source of adjacentSources) {
    if (fs.existsSync(source.file)) companySources.push({ role: source.role, ...digest(source.file) });
    else missingSources.push(path.relative(tyflowRoot, source.file).replaceAll('\\', '/'));
  }
}

const projectRuleCandidates = [
  'AGENTS.md',
  'CLAUDE.md',
  '.testing/policies/tyflow-frontend.yaml',
  '.testing/project.yaml',
].map((relative) => path.join(projectRoot, relative)).filter((file) => fs.existsSync(file));

const themeName = /(?:^|[-_.])(theme|themes|token|tokens|css-var)(?:[-_.]|$)/i;
const themeExtensions = new Set(['.ts', '.tsx', '.js', '.json', '.css', '.less', '.scss']);
const discoveredThemeSources = walk(path.join(projectRoot, 'src'), (file) => themeExtensions.has(path.extname(file).toLowerCase()) && themeName.test(path.basename(file)));
const explicitThemeCandidates = [
  'config/config.ts',
  'src/global.less',
  'src/styles/init.less',
  'src/styles/common.less',
  'src/styles/override.less',
].map((relative) => path.join(projectRoot, relative)).filter((file) => fs.existsSync(file));
const themeSources = [...new Set([...discoveredThemeSources, ...explicitThemeCandidates])]
  .filter((file) => {
    if (themeName.test(path.basename(file))) return true;
    const content = fs.readFileSync(file, 'utf8');
    return /--ty-|\btheme\s*:|root-entry-name|@(?:primary|font|text|bg|border)/i.test(content);
  })
  .slice(0, 100);

let pkg = {};
if (fs.existsSync(packageFile)) pkg = readJson(packageFile);
const dependencies = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const components = Object.entries(dependencies)
  .filter(([name]) => /(?:^@ty[-/]|tingyun|ty-component|^antd$)/i.test(name))
  .map(([name, version]) => ({ name, version }));
const react = Boolean(dependencies.react);
const typescript = Boolean(dependencies.typescript);
const angular = Boolean(dependencies['@angular/core']);

const snapshot = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  projectRoot: projectRoot.replaceAll('\\', '/'),
  profile: react && typescript ? 'tyflow-react-typescript' : angular ? 'tyflow-common-plus-project-angular' : 'tyflow-common-plus-project',
  applicability: {
    companyReactTypeScriptEngineeringBaseline: react && typescript,
    commonDesignBehaviorQualityRules: true,
    projectAdaptationRequired: !(react && typescript),
  },
  precedence: {
    productBehavior: ['explicit-user-decision', 'confirmed-sdd-prd-contract', 'approved-design-od', 'project-doc', 'provisional-observation'],
    engineering: ['target-repository-rules', 'project-standards', 'applicable-tyflow-baseline'],
    designValues: ['target-theme-source', 'version-matched-token-reference', 'approved-design-exception'],
    componentChoice: ['project-wrapper-and-usage', 'tingyun-component', 'ant-design', 'justified-local-component'],
  },
  companySources,
  missingSources,
  projectSources: projectRuleCandidates.map(digest),
  themeSources: themeSources.map(digest),
  componentVersions: components,
  knownConflicts: [{
    conflictId: 'TYF-TYPOGRAPHY-DEFAULT-SIZE',
    description: 'Tyflow token reference documents --ty-font-size as 12px while an older interaction checklist uses 14px/22px for common text.',
    resolution: themeSources.length ? 'Resolve from the target theme source and version-matched approved design; keep evidence.' : 'NEEDS_DECISION until a target theme source or version-matched approved design is identified.',
  }],
  snapshotStatus: missingSources.length ? 'PARTIAL' : 'COMPLETE',
  boundary: 'This snapshot freezes standards inputs. It does not prove source conformance or product correctness.',
};

if (output) writeJson(output, snapshot);
print(snapshot);
process.exitCode = missingSources.length ? 2 : 0;
