#!/usr/bin/env node
import { freezePlan, print } from './lib.mjs';
const [plan, runDir] = process.argv.slice(2);
if (!plan || !runDir) {
  console.error('usage: plan-freeze.mjs <execution-plan.json> <run-dir>');
  process.exit(2);
} else {
  try { print(freezePlan(plan, runDir)); }
  catch (error) { print({ conclusion: 'INCOMPLETE', error: error.message }); process.exitCode = 2; }
}
