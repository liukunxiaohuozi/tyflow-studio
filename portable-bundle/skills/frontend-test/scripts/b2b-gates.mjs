#!/usr/bin/env node
import path from 'node:path';
import { EXIT, print, readJson, writeJson } from './lib.mjs';

const [inputFile, runDir] = process.argv.slice(2);

if (!inputFile || !runDir) {
  console.error('usage: b2b-gates.mjs <gate-input.json> <run-dir>');
  process.exit(2);
}

const BLOCK_RULES = new Set(Array.from({ length: 12 }, (_, index) => `B-${String(index + 1).padStart(2, '0')}`));
const NON_WAIVABLE = new Set(['B-03', 'B-04', 'B-08', 'B-09']);
const INCOMPLETE_STATUSES = new Set(['BLOCKED', 'NOT_RUN', 'FLAKY']);

function number(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

function percentChange(current, baseline) {
  if (baseline == null || baseline <= 0 || current == null) return undefined;
  return ((current - baseline) / baseline) * 100;
}

function classifyBaseline(performance = {}) {
  const independentRuns = number(performance.independentRuns) || 0;
  const sampleCount = number(performance.sampleCount) || 0;
  const distinctPeriods = number(performance.distinctPeriods) || 0;
  const distinctDays = number(performance.distinctDays) || 0;
  const variabilityPercent = number(performance.variabilityPercent);

  if (
    independentRuns >= 5 &&
    sampleCount >= 25 &&
    distinctDays >= 3 &&
    variabilityPercent != null &&
    variabilityPercent <= 15
  ) return 'FORMAL';

  if (independentRuns >= 3 && sampleCount >= 15 && distinctPeriods >= 2) return 'PROVISIONAL';
  return 'OBSERVATION_ONLY';
}

function evaluatePerformanceObservation(item) {
  const metricType = String(item.metricType || '').toLowerCase();
  const repeatCount = number(item.repeatCount) || 1;
  let candidate = false;
  let actual = {};

  if (['page', 'route', 'async', 'page-or-async'].includes(metricType)) {
    const current = number(item.currentMedianMs);
    const baseline = number(item.baselineMedianMs);
    const absoluteIncreaseMs = current != null && baseline != null ? current - baseline : undefined;
    const relativeIncreasePercent = percentChange(current, baseline);
    candidate = absoluteIncreaseMs > 500 && relativeIncreasePercent > 25;
    actual = { currentMedianMs: current, baselineMedianMs: baseline, absoluteIncreaseMs, relativeIncreasePercent };
  } else if (['interaction', 'immediate', 'immediate-interaction'].includes(metricType)) {
    const current = number(item.currentMedianMs);
    const baseline = number(item.baselineMedianMs);
    const absoluteIncreaseMs = current != null && baseline != null ? current - baseline : undefined;
    const relativeIncreasePercent = percentChange(current, baseline);
    candidate = absoluteIncreaseMs > 100 && relativeIncreasePercent > 30;
    actual = { currentMedianMs: current, baselineMedianMs: baseline, absoluteIncreaseMs, relativeIncreasePercent };
  } else if (['request', 'requests', 'request-count'].includes(metricType)) {
    const current = number(item.currentCount);
    const baseline = number(item.baselineCount);
    const increase = current != null && baseline != null ? current - baseline : undefined;
    const relativeIncreasePercent = percentChange(current, baseline);
    const duplicateRequests = number(item.duplicateRequests) || 0;
    candidate = duplicateRequests > 0 || (increase > 2 && relativeIncreasePercent > 20);
    actual = { currentCount: current, baselineCount: baseline, increase, relativeIncreasePercent, duplicateRequests };
  } else if (['bundle', 'bundle-size'].includes(metricType)) {
    const current = number(item.currentKb);
    const baseline = number(item.baselineKb);
    const increaseKb = current != null && baseline != null ? current - baseline : undefined;
    const relativeIncreasePercent = percentChange(current, baseline);
    candidate = increaseKb > 200 && relativeIncreasePercent > 10;
    actual = { currentKb: current, baselineKb: baseline, increaseKb, relativeIncreasePercent };
  } else if (['memory', 'resource', 'memory-resource'].includes(metricType)) {
    const growthPercent = number(item.growthPercent);
    const monotonicCheckpoints = number(item.monotonicCheckpoints) || 0;
    candidate = growthPercent > 30 || monotonicCheckpoints >= 3;
    actual = { growthPercent, monotonicCheckpoints };
  }

  let gateClass = 'OBSERVE';
  let status = candidate ? 'CANDIDATE' : 'PASS';
  let reasonCode = candidate ? 'PERFORMANCE_CANDIDATE' : null;

  if (item.severeDysfunction === true) {
    gateClass = 'BLOCK';
    status = 'FAIL';
    reasonCode = 'PERFORMANCE_UNUSABLE';
  } else if (item.budgetApproved === true && item.budgetExceeded === true && repeatCount >= 2) {
    gateClass = 'BLOCK';
    status = 'FAIL';
    reasonCode = 'APPROVED_PERFORMANCE_BUDGET_EXCEEDED';
  } else if (candidate && repeatCount >= 2) {
    gateClass = 'WARN';
    status = 'WARN';
    reasonCode = 'PERFORMANCE_REGRESSION_REPRODUCED';
  }

  return {
    id: item.id || null,
    metricType: item.metricType || null,
    gateClass,
    status,
    reasonCode,
    repeatCount,
    candidate,
    actual,
    evidenceRefs: Array.isArray(item.evidenceRefs) ? item.evidenceRefs : [],
  };
}

try {
  const input = readJson(inputFile);
  const riskLevel = String(input.riskLevel || '').toUpperCase();
  const normalizedRisk = ['R1', 'R2', 'R3', 'R4'].includes(riskLevel) ? riskLevel : null;
  const sourceFindings = [
    ...(Array.isArray(input.findings) ? input.findings : []),
    ...(Array.isArray(input.codeReview?.findings) ? input.codeReview.findings : []),
  ];
  const findings = [];
  let blockCount = 0;
  let warningCount = 0;
  let observeCount = 0;
  let incompleteCount = 0;
  let decisionCount = 0;

  if (!normalizedRisk) {
    decisionCount += 1;
    findings.push({ ruleId: 'B2B-RISK', gateClass: 'DECISION', status: 'NEEDS_DECISION', reasonCode: 'RISK_LEVEL_UNKNOWN' });
  }

  for (const item of sourceFindings) {
    const ruleId = String(item.ruleId || 'UNCLASSIFIED');
    const status = String(item.status || 'OBSERVE').toUpperCase();
    const required = item.required !== false;
    const nonWaivable = item.nonWaivable === true || NON_WAIVABLE.has(ruleId);
    let gateClass = String(item.gateClass || '').toUpperCase();

    if (status === 'NEEDS_DECISION') {
      gateClass = 'DECISION';
      decisionCount += 1;
    } else if (INCOMPLETE_STATUSES.has(status) && required) {
      gateClass = 'INCOMPLETE';
      incompleteCount += 1;
    } else if (status === 'FAIL' && BLOCK_RULES.has(ruleId) && (item.introduced !== false || item.touchedAndWorsened === true || nonWaivable)) {
      gateClass = 'BLOCK';
      blockCount += 1;
    } else if (status === 'FAIL' || status === 'WARN') {
      gateClass = 'WARN';
      warningCount += 1;
    } else if (gateClass === 'OBSERVE' || status === 'OBSERVE') {
      gateClass = 'OBSERVE';
      observeCount += 1;
    } else {
      gateClass = gateClass || 'PASS';
    }

    findings.push({ ...item, ruleId, status, gateClass, nonWaivable });
  }

  const humanReviewRequired = input.humanReviewRequired === true || ['R3', 'R4'].includes(normalizedRisk);
  const humanReviewStatus = String(input.humanReview?.status || '').toUpperCase();
  if (humanReviewRequired && !['PASS', 'APPROVED'].includes(humanReviewStatus)) {
    incompleteCount += 1;
    findings.push({ ruleId: 'B2B-HUMAN-REVIEW', gateClass: 'INCOMPLETE', status: 'BLOCKED', reasonCode: 'HUMAN_REVIEW_REQUIRED' });
  }

  const performance = input.performance || null;
  const performanceResults = Array.isArray(performance?.observations)
    ? performance.observations.map(evaluatePerformanceObservation)
    : [];
  for (const item of performanceResults) {
    if (item.gateClass === 'BLOCK') blockCount += 1;
    else if (item.gateClass === 'WARN') warningCount += 1;
    else observeCount += 1;
  }

  let conclusion = 'VERIFIED';
  let releaseRecommendation = warningCount > 0 ? 'GO_WITH_RISK' : 'GO';
  const reasons = [];
  if (blockCount > 0) {
    conclusion = 'FAILED';
    releaseRecommendation = 'NO_GO';
    reasons.push('B2B_BLOCKING_FINDING');
  } else if (decisionCount > 0) {
    conclusion = 'NEEDS_DECISION';
    releaseRecommendation = 'REVIEW_REQUIRED';
    reasons.push('B2B_DECISION_REQUIRED');
  } else if (incompleteCount > 0) {
    conclusion = 'INCOMPLETE';
    releaseRecommendation = 'REVIEW_REQUIRED';
    reasons.push('B2B_REQUIRED_CHECK_INCOMPLETE');
  }

  const output = {
    schemaVersion: 1,
    runId: input.runId || null,
    projectId: input.projectId || null,
    profile: input.profile || 'change',
    riskLevel: normalizedRisk,
    conclusion,
    exitCode: EXIT[conclusion],
    releaseRecommendation,
    reasons,
    counts: { block: blockCount, warn: warningCount, observe: observeCount, incomplete: incompleteCount, needsDecision: decisionCount },
    findings,
    performance: performance ? { baselineLevel: classifyBaseline(performance), observations: performanceResults } : null,
    generatedAt: new Date().toISOString(),
  };

  const resolvedRunDir = path.resolve(runDir);
  writeJson(path.join(resolvedRunDir, 'b2b-gates.json'), output);
  if (input.codeReview) writeJson(path.join(resolvedRunDir, 'code-review.json'), { ...input.codeReview, schemaVersion: 1, runId: input.runId || null });
  if (input.network) writeJson(path.join(resolvedRunDir, 'network-summary.json'), { ...input.network, schemaVersion: 1, runId: input.runId || null });
  if (performance) writeJson(path.join(resolvedRunDir, 'performance-observation.json'), { ...performance, schemaVersion: 1, runId: input.runId || null, baselineLevel: classifyBaseline(performance), evaluatedObservations: performanceResults });
  if (input.debtBaseline) writeJson(path.join(resolvedRunDir, 'debt-baseline.json'), { ...input.debtBaseline, schemaVersion: 1, runId: input.runId || null });
  print(output);
  process.exitCode = output.exitCode;
} catch (error) {
  print({ conclusion: 'INCOMPLETE', exitCode: 2, error: error.message });
  process.exitCode = 2;
}
