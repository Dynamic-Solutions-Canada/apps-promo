/**
 * `npm run check:catalog`: fail when `ids.json`, the generated manifest and the
 * committed icons disagree. The checks themselves are in `catalog-checks.ts`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  findCatalogProblems,
  ICON_SIZE,
  listIconsBelowTarget,
  type CatalogInputs,
} from './catalog-checks.js'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const assetsDir = join(repoRoot, 'Assets', 'PromotedApps')

/** Read and parse a JSON file relative to the repo root. */
function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf8'))
}

/** Read an icon from `Assets/PromotedApps/`, or `undefined` when it is not committed. */
function readIcon(fileName: string): Uint8Array | undefined {
  const path = join(assetsDir, fileName)
  return existsSync(path) ? readFileSync(path) : undefined
}

const inputs: CatalogInputs = {
  ids: readJson('ids.json'),
  manifest: readJson('Assets/PromotedApps/apps.json'),
  readIcon,
}

const problems = findCatalogProblems(inputs)
if (problems.length > 0) {
  console.error('check:catalog: the catalog is inconsistent:')
  for (const problem of problems) {
    console.error(`  - ${problem}`)
  }
  process.exit(1)
}

console.log('check:catalog: ids.json, apps.json and the icons agree.')

// Progress toward 256 px icons; not a failure until each app repo publishes its icon.
const below = listIconsBelowTarget(inputs)
if (below.length > 0) {
  console.log(
    `check:catalog: not yet ${ICON_SIZE} px: ${below.join(', ')}. See "Icons" in the README.`,
  )
}
