#!/usr/bin/env node
import { EXIT, compilePlan, print, writeJson } from './lib.mjs';
const [specPath, output, profile = 'change'] = process.argv.slice(2);
if (!specPath || !output) {
  console.error('usage: spec-compile.mjs <spec-path> <execution-plan.json> [profile]');
  process.exit(2);
} else {
  const result = compilePlan(specPath, profile);
  if (result.plan) writeJson(output, result.plan);
  print(result);
  process.exitCode = result.plan ? 0 : EXIT[result.validation.conclusion];
}
