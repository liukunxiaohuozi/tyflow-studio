#!/usr/bin/env node
import { print, summarize } from './lib.mjs';
const runDir = process.argv[2];
if (!runDir) {
  console.error('usage: result-summarize.mjs <run-dir>');
  process.exit(2);
} else {
  try { const result = summarize(runDir); print(result); process.exitCode = result.exitCode; }
  catch (error) { print({ conclusion: 'INCOMPLETE', error: error.message }); process.exitCode = 2; }
}
