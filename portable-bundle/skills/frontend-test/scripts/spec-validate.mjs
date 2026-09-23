#!/usr/bin/env node
import { EXIT, print, validateSpecs } from './lib.mjs';
const target = process.argv[2] || process.cwd();
const result = validateSpecs(target);
print(result);
process.exitCode = EXIT[result.conclusion];
