/**
 * `npm run check:catalog`: fail when `ids.json`, the generated manifest and the
 * committed icons disagree. The checks themselves are in `catalog-checks.ts`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findCatalogProblems } from './catalog-checks.js'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const assetsDir = join(repoRoot, 'Assets', 'PromotedApps')

/** Read and parse a JSON file relative to the repo root. */
function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf8'))
}

const problems = findCatalogProblems({
  ids: readJson('ids.json'),
  manifest: readJson('Assets/PromotedApps/apps.json'),
  iconExists: (fileName) => existsSync(join(assetsDir, fileName)),
})

if (problems.length > 0) {
  console.error('check:catalog: the catalog is inconsistent:')
  for (const problem of problems) {
    console.error(`  - ${problem}`)
  }
  process.exit(1)
}

console.log('check:catalog: ids.json, apps.json and the icons agree.')
