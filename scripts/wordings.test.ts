/**
 * The translated wording catalogs are listed in three places that cannot import each other:
 * `TRANSLATED_WORDINGS` in `catalog.ts`, `$translatedWordings` in `refresh-catalog.ps1`, and
 * the string tables in `Views/PromoLocalization.cs`. A wording in one but not the others would
 * leave a language without its descriptions, or without its page text, with no error at all.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { TRANSLATED_WORDINGS } from '../catalog.js'

/** Read a repo file as text. */
function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

/** The quoted tags on the `$translatedWordings = ...` line of the refresh script, in order. */
function refreshScriptWordings(script: string): string[] {
  const line = script.match(/^\$translatedWordings = (.+)$/m)
  assert.ok(line, 'refresh-catalog.ps1 defines $translatedWordings')
  return [...line[1]!.matchAll(/"([\w-]+)"/g)].map((match) => match[1]!)
}

/** The keys of the page's string tables (`["es-ES"] = new()`), in order. */
function pageStringTables(source: string): string[] {
  return [...source.matchAll(/^\s*\["([\w-]+)"\] = new\(\)/gm)].map(
    (match) => match[1]!,
  )
}

test('the refresh script copies the same wordings, in the same order, as catalog.ts', () => {
  assert.deepEqual(
    refreshScriptWordings(readRepoFile('scripts/refresh-catalog.ps1')),
    [...TRANSLATED_WORDINGS],
  )
})

test('the page has a string table for exactly the translated wordings', () => {
  assert.deepEqual(
    pageStringTables(readRepoFile('Views/PromoLocalization.cs')).sort(),
    [...TRANSLATED_WORDINGS].sort(),
  )
})
