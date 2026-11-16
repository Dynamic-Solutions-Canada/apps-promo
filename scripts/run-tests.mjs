#!/usr/bin/env node
/**
 * `npm test`: find every `*.test.ts` and `*.test.mjs` in the repo by walking the
 * tree (TEST-5), and run them with Node's test runner and the tsx loader (TEST-1),
 * so the TypeScript sources are tested directly with no build step.
 *
 * Skips dependencies, git internals, local build output (`.artifacts/` can hold a
 * whole consumer app copied in for compile checks) and any `external/` checkout.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const SKIPPED_FOLDERS = new Set([
  'node_modules',
  '.git',
  '.artifacts',
  'external',
])
const TEST_SUFFIXES = ['.test.ts', '.test.mjs']

/**
 * Collect test files under a folder, depth first.
 *
 * @param {string} folder Absolute folder to walk.
 * @param {string[]} found Receives repo-relative test file paths.
 */
function findTests(folder, found) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name)

    if (entry.isDirectory()) {
      if (!SKIPPED_FOLDERS.has(entry.name)) {
        findTests(path, found)
      }
      continue
    }

    if (TEST_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) {
      found.push(relative(repoRoot, path))
    }
  }
}

const tests = []
findTests(repoRoot, tests)
tests.sort()

if (tests.length === 0) {
  console.error(
    'run-tests: no test files found; a repo with tests should never reach this.',
  )
  process.exit(1)
}

const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', ...tests],
  {
    cwd: repoRoot,
    stdio: 'inherit',
  },
)

process.exit(result.status ?? 1)
