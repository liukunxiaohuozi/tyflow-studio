#!/usr/bin/env node
import { executePlan, print } from './lib.mjs';
const [plan, runDir] = process.argv.slice(2);
if (!plan || !runDir) {
  console.error('usage: run.mjs <execution-plan.json> <run-dir>');
  process.exit(2);
} else {
  try {
    const result = executePlan(plan, runDir);
    print(result);
    process.exitCode = result.results.some((item) => item.required !== false && item.status === 'FAIL') ? 1 : result.results.some((item) => item.required !== false && item.status !== 'PASS') || !result.results.length ? 2 : 0;
  } catch (error) { print({ conclusion: 'INCOMPLETE', error: error.message }); process.exitCode = 2; }
}
