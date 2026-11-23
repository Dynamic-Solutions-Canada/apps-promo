import assert from 'node:assert/strict'
import { test } from 'node:test'
import manifest from './Assets/PromotedApps/apps.json'
import { blurbFor, parseCatalog, TRANSLATED_WORDINGS } from './catalog.js'

test('the bundled catalog has stable identities and browser-safe platform links', () => {
  const apps = parseCatalog(manifest)
  assert.equal(apps.length, 8)
  assert.deepEqual(
    apps.map((app) => app.name),
    [
      'ChatMixr',
      'DisplaySwitchr',
      'ImmichDrive',
      'Little Launcher',
      'Persistent',
      'PrintStream',
      'Repilot',
      'Tray Control for WSL',
    ],
  )
  // appOrder lists the apps alphabetically by display name, ignoring case.
  const names = apps.map((app) => app.name)
  assert.deepEqual(
    names,
    [...names].sort((a, b) =>
      a.localeCompare(b, 'en', { sensitivity: 'base' }),
    ),
  )
  assert.deepEqual(
    apps
      .find((app) => app.appId === 'repilot')
      ?.links.map((link) => link.platform),
    ['Windows'],
  )
  assert.deepEqual(
    apps
      .find((app) => app.appId === 'printstream')
      ?.links.map((link) => link.platform),
    ['Android', 'Windows', 'Web'],
  )
  assert.equal(apps.filter((app) => app.appId !== 'persistent').length, 7)
  assert.ok(
    apps
      .find((app) => app.appId === 'printstream')
      ?.blurb.includes('3D printers'),
  )
  assert.ok(
    apps
      .find((app) => app.appId === 'drive-for-immich')
      ?.blurb.includes('Immich'),
  )
})

test('rejects unsafe destinations, icon paths, duplicate ids and old catalog shapes', () => {
  for (const url of [
    'javascript:alert(1)',
    'ms-windows-store://pdp/',
    'http://example.com',
    'https://user:password@example.com',
  ]) {
    const value = structuredClone(manifest)
    value.apps[0]!.links[0]!.url = url
    assert.throws(() => parseCatalog(value))
  }
  const badIcon = structuredClone(manifest)
  badIcon.apps[0]!.icon = '../secret.png'
  assert.throws(() => parseCatalog(badIcon))
  assert.throws(() =>
    parseCatalog({ apps: [manifest.apps[0], manifest.apps[0]] }),
  )
  assert.throws(() => parseCatalog({ apps: [{ name: 'Old catalog' }] }))
  assert.deepEqual(parseCatalog({ apps: [] }), [])
})

test('every bundled app carries all six translated blurbs', () => {
  for (const app of parseCatalog(manifest)) {
    assert.deepEqual(Object.keys(app.blurbs ?? {}), [...TRANSLATED_WORDINGS])
  }
})

test('blurbFor resolves a locale to its wording catalog and falls back to English', () => {
  const app = parseCatalog(manifest).find(
    (entry) => entry.appId === 'persistent',
  )!

  assert.equal(blurbFor(app, 'fr-CA'), app.blurbs?.['fr-FR'])
  assert.equal(blurbFor(app, 'de'), app.blurbs?.['de-DE'])
  assert.equal(blurbFor(app, 'pt_PT'), app.blurbs?.['pt-BR'])
  assert.equal(blurbFor(app, 'zh-Hans-SG'), app.blurbs?.['zh-CN'])
  assert.equal(blurbFor(app, 'zh'), app.blurbs?.['zh-CN'])

  // English, Traditional Chinese and unsupported languages show the English blurb.
  for (const locale of ['en-CA', 'zh-TW', 'zh-Hant', 'it-IT', '']) {
    assert.equal(blurbFor(app, locale), app.blurb, locale)
  }
})

test('drops malformed translations instead of rejecting the catalog', () => {
  const value = structuredClone(manifest) as { apps: Record<string, unknown>[] }
  value.apps[0]!.blurbs = { 'es-ES': 42, 'fr-FR': '', 'de-DE': 'Gut.', xx: 'x' }
  value.apps[1]!.blurbs = 'not an object'
  delete value.apps[2]!.blurbs

  const apps = parseCatalog(value)
  assert.deepEqual(apps[0]!.blurbs, { 'de-DE': 'Gut.' })
  assert.deepEqual(apps[1]!.blurbs, {})
  assert.deepEqual(apps[2]!.blurbs, {})
  assert.equal(blurbFor(apps[0]!, 'es-ES'), apps[0]!.blurb)
})
