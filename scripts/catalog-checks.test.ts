import assert from 'node:assert/strict'
import { test } from 'node:test'
import manifest from '../Assets/PromotedApps/apps.json'
import ids from '../ids.json'
import { findCatalogProblems } from './catalog-checks.js'

/** A deep copy of the committed sources, so each test can break one thing. */
function committedInputs() {
  return {
    ids: structuredClone(ids) as Record<string, any>,
    manifest: structuredClone(manifest) as Record<string, any>,
    iconExists: (_fileName: string) => true,
  }
}

test('the committed catalog is consistent', () => {
  assert.deepEqual(findCatalogProblems(committedInputs()), [])
})

test('reports an app missing from, or repeated in, appOrder', () => {
  const inputs = committedInputs()
  inputs.ids.appOrder = [
    ...inputs.ids.appOrder.filter((id: string) => id !== 'repilot'),
    'persistent',
  ]

  assert.deepEqual(findCatalogProblems(inputs), [
    'appOrder lists persistent 2 times; it must appear exactly once',
    'appOrder lists repilot 0 times; it must appear exactly once',
  ])
})

test('reports a manifest out of appOrder order', () => {
  const inputs = committedInputs()
  inputs.manifest.apps.reverse()

  const problems = findCatalogProblems(inputs)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /differs from appOrder/)
})

test('reports links edited in only one of the two files', () => {
  const inputs = committedInputs()
  inputs.manifest.apps[0].links.pop()

  assert.deepEqual(findCatalogProblems(inputs), [
    'printstream links in apps.json differ from its links in ids.json',
  ])
})

test('reports two links for one platform', () => {
  const inputs = committedInputs()
  const repilot = inputs.manifest.apps.find(
    (app: any) => app.appId === 'repilot',
  )
  repilot.links.push({ ...repilot.links[0] })
  inputs.ids.appOverrides['9PB5FJ08PNVJ'].links = repilot.links

  assert.deepEqual(findCatalogProblems(inputs), [
    'repilot has more than one Windows link',
  ])
})

test('reports a Store product with no appOverrides entry', () => {
  const inputs = committedInputs()
  delete inputs.ids.appOverrides['9PB5FJ08PNVJ']

  assert.deepEqual(findCatalogProblems(inputs), [
    'repilot is in apps.json but not defined in ids.json',
    '(product 9PB5FJ08PNVJ has no appOverrides entry) is defined in ids.json but missing from apps.json',
  ])
})

test('reports a missing icon file', () => {
  const inputs = committedInputs()
  inputs.iconExists = (fileName) => fileName !== 'printstream.png'

  assert.deepEqual(findCatalogProblems(inputs), [
    'printstream icon printstream.png is missing from Assets/PromotedApps/',
  ])
})

test('stops at a manifest that consumers would reject', () => {
  const inputs = committedInputs()
  inputs.manifest.apps[0].icon = '../escape.png'

  assert.deepEqual(findCatalogProblems(inputs), [
    'apps.json fails parseCatalog: Invalid app identity or icon',
  ])
})
