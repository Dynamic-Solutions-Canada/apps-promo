import assert from 'node:assert/strict'
import { test } from 'node:test'
import manifest from '../Assets/PromotedApps/apps.json'
import ids from '../ids.json'
import { findBlurbProblems } from './blurb-checks.js'

/** Deep copies of the committed manifest and translations, so each test can break one thing. */
function committed() {
  return {
    manifest: structuredClone(manifest) as Record<string, any>,
    translations: structuredClone(ids.blurbTranslations) as Record<string, any>,
  }
}

test('the committed translations are complete and match the manifest', () => {
  const { manifest, translations } = committed()
  assert.deepEqual(findBlurbProblems(manifest, translations), [])
})

test('reports a missing or empty wording, and an unknown one', () => {
  const { manifest, translations } = committed()
  delete translations.repilot['ja-JP']
  translations.repilot['de-DE'] = ' '
  translations.repilot['fr-CA'] = 'Rendez votre touche Copilot vraiment utile.'
  manifest.apps.find((app: any) => app.appId === 'repilot').blurbs = {
    ...translations.repilot,
    source: undefined,
  }

  const problems = findBlurbProblems(manifest, translations)
  assert.ok(problems.includes('repilot has no ja-JP blurb in ids.json'))
  assert.ok(problems.includes('repilot has no de-DE blurb in ids.json'))
  assert.ok(
    problems.includes(
      'repilot blurbTranslations has fr-CA, which is not a translated wording catalog',
    ),
  )
})

test('reports translations of English that has since changed', () => {
  const { manifest, translations } = committed()
  manifest.apps.find((app: any) => app.appId === 'persistent').blurb =
    'Reminders that keep going.'

  assert.deepEqual(findBlurbProblems(manifest, translations), [
    'persistent translations were made from different English; retranslate them, then set blurbTranslations.persistent.source to the current blurb',
  ])
})

test('reports a manifest whose blurbs differ from ids.json', () => {
  const { manifest, translations } = committed()
  manifest.apps.find((app: any) => app.appId === 'printstream').blurbs[
    'es-ES'
  ] = 'Otra cosa.'

  assert.deepEqual(findBlurbProblems(manifest, translations), [
    'printstream blurbs in apps.json differ from its blurbTranslations in ids.json',
  ])
})

test('reports an app with no translations, and translations for no app', () => {
  const { manifest, translations } = committed()
  translations['old-app'] = translations['drive-for-immich']
  delete translations['drive-for-immich']

  assert.deepEqual(findBlurbProblems(manifest, translations), [
    'drive-for-immich has no blurbTranslations entry in ids.json',
    'blurbTranslations names old-app, which is not in apps.json',
  ])
})
