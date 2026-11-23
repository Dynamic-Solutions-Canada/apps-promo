import assert from 'node:assert/strict'
import { test } from 'node:test'
import manifest from '../Assets/PromotedApps/apps.json'
import ids from '../ids.json'
import {
  APP_REPO_ICON_PATH,
  findCatalogProblems,
  listIconsBelowTarget,
} from './catalog-checks.js'
import { pngHeader } from './png-fixture.js'

/** A deep copy of the committed sources with 50 px icons, so each test can break one thing. */
function committedInputs() {
  return {
    ids: structuredClone(ids) as Record<string, any>,
    manifest: structuredClone(manifest) as Record<string, any>,
    readIcon: (_fileName: string): Uint8Array | undefined => pngHeader(50),
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
  inputs.readIcon = (fileName) =>
    fileName === 'printstream.png' ? undefined : pngHeader(50)

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

test('reports an icon that is not a PNG, or not square', () => {
  const inputs = committedInputs()
  inputs.readIcon = (fileName) => {
    if (fileName === 'printstream.png') {
      return new TextEncoder().encode('<svg></svg> padded to 24 bytes')
    }
    return fileName === '9PB5FJ08PNVJ.png' ? pngHeader(64, 32) : pngHeader(50)
  }

  assert.deepEqual(findCatalogProblems(inputs), [
    'printstream icon printstream.png is not a PNG',
    'repilot icon 9PB5FJ08PNVJ.png is 64x32; icons must be square',
  ])
})

test('holds an icon from the app repo path to 256 px', () => {
  const inputs = committedInputs()
  inputs.ids.appOverrides['9PB5FJ08PNVJ'].iconUrl =
    `https://raw.githubusercontent.com/Dynamic-Solutions-Canada/repilot/main${APP_REPO_ICON_PATH}`

  assert.deepEqual(findCatalogProblems(inputs), [
    'repilot icon 9PB5FJ08PNVJ.png is 50 px; /assets/generated/icon-256.png must be 256 px',
  ])

  inputs.readIcon = (fileName) =>
    pngHeader(fileName === '9PB5FJ08PNVJ.png' ? 256 : 50)
  assert.deepEqual(findCatalogProblems(inputs), [])
})

test('lists icons still below 256 px without failing', () => {
  const inputs = committedInputs()
  inputs.readIcon = (fileName) =>
    pngHeader(fileName === 'printstream.png' ? 256 : 50)

  assert.deepEqual(listIconsBelowTarget(inputs), [
    'persistent (50 px)',
    'little-launcher (50 px)',
    'drive-for-immich (50 px)',
    'repilot (50 px)',
    'hub-display-switch (50 px)',
    'chatmixr (50 px)',
  ])
})
