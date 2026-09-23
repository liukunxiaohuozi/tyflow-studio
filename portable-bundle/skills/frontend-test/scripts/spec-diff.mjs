#!/usr/bin/env node
import { diffStructured, print, writeJson } from './lib.mjs';
const [before, after, output] = process.argv.slice(2);
if (!before || !after) {
  console.error('usage: spec-diff.mjs <before> <after> [output.json]');
  process.exit(2);
}
try {
  const result = diffStructured(before, after);
  if (output) writeJson(output, result);
  print(result);
} catch (error) {
  print({ conclusion: error.code === 'YAML_PARSER_MISSING' ? 'INCOMPLETE' : 'FAILED', error: error.message });
  process.exitCode = error.code === 'YAML_PARSER_MISSING' ? 2 : 1;
}
