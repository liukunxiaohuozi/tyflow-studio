#!/usr/bin/env node
import { discoverProjects, print, writeJson } from './lib.mjs';
const root = process.argv[2] || process.cwd();
const output = process.argv[3];
const result = discoverProjects(root);
if (output) writeJson(output, result);
print(result);
process.exitCode = result.projectCount ? 0 : 2;
