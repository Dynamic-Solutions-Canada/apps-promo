/**
 * The page takes its styles from the host app (PROMO-8), and WinUI resolves a `StaticResource`
 * only when the page loads: a host without one of the keys crashes there, and no compile catches
 * it. This test keeps the README's "Host requirements" table identical to the keys the page uses,
 * so the documented contract is the real one.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

/** Styles WinUI itself provides through `XamlControlsResources`; every host has them. */
const WINUI_BUILT_IN_KEYS = new Set(['CaptionTextBlockStyle'])

/** Read a repo file as text. */
function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

/** Every `{StaticResource Key}` the page XAML uses, sorted. */
function staticResourceKeys(xaml: string): string[] {
  const keys = [...xaml.matchAll(/\{StaticResource\s+([\w.]+)\s*\}/g)].map(
    (match) => match[1],
  )
  return [...new Set(keys)].sort()
}

/** The backticked keys in the first column of the README's "Host requirements" table, sorted. */
function documentedHostKeys(readme: string): string[] {
  const section = readme
    .split(/^## /m)
    .find((part) => part.startsWith('Host requirements'))
  assert.ok(section, 'README has a "## Host requirements" section')

  const keys = [...section.matchAll(/^\| `(\w+)` +\|/gm)].map(
    (match) => match[1],
  )
  return keys.sort()
}

test('the README lists exactly the host style keys the page uses', () => {
  const pageKeys = staticResourceKeys(
    readRepoFile('Views/PromotedAppsPage.xaml'),
  )
  const hostKeys = pageKeys.filter((key) => !WINUI_BUILT_IN_KEYS.has(key))

  assert.deepEqual(documentedHostKeys(readRepoFile('README.md')), hostKeys)
})
