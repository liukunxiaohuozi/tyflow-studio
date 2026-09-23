#!/usr/bin/env node
import { print, verifyEvidence } from './lib.mjs';
const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: evidence-verify.mjs <run-dir>');
  process.exit(2);
} else {
  try { const result = verifyEvidence(runDir); print(result); process.exitCode = result.valid ? 0 : 2; }
  catch (error) { print({ valid: false, conclusion: 'INCOMPLETE', error: error.message }); process.exitCode = 2; }
}
