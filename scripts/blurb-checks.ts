/**
 * Checks for the catalog's translated blurbs (LOC-3): every app carries a description in
 * each translated wording catalog, `ids.json` and the generated manifest agree on them, and
 * each translation still matches the English it was made from.
 *
 * The translations live in `ids.json` under `blurbTranslations`, keyed by `appId`. Each
 * entry records its English `source`, so editing an app's English blurb fails the gate
 * until every translation is redone, instead of leaving a translation of older text.
 */
import { TRANSLATED_WORDINGS } from '../catalog.js'

/** One `blurbTranslations` entry: the English it translates, then one text per wording. */
type SourceTranslations = Record<string, unknown>

/** One manifest app's fields these checks read, exactly as committed. */
interface RawManifestApp {
  appId: string
  blurb: unknown
  blurbs?: unknown
}

/**
 * Find every problem with the translated blurbs.
 *
 * @param manifest Parsed `apps.json`, already accepted by `parseCatalog`.
 * @param blurbTranslations The `blurbTranslations` value from `ids.json`, unvalidated.
 * @returns One readable message per problem; empty when the translations are complete.
 */
export function findBlurbProblems(
  manifest: unknown,
  blurbTranslations: unknown,
): string[] {
  if (!isRecord(blurbTranslations)) {
    return ['ids.json has no blurbTranslations object']
  }

  const apps = (manifest as { apps: RawManifestApp[] }).apps
  const problems: string[] = []

  for (const app of apps) {
    const source = blurbTranslations[app.appId]
    if (!isRecord(source)) {
      problems.push(`${app.appId} has no blurbTranslations entry in ids.json`)
      continue
    }

    problems.push(
      ...checkSourceEnglish(app, source),
      ...checkWordings(app.appId, source),
      ...checkManifestMatchesSource(app, source),
    )
  }

  const manifestIds = new Set(apps.map((app) => app.appId))
  for (const appId of Object.keys(blurbTranslations)) {
    if (!manifestIds.has(appId)) {
      problems.push(
        `blurbTranslations names ${appId}, which is not in apps.json`,
      )
    }
  }

  return problems
}

/** The translations were made from the app's current English blurb. */
function checkSourceEnglish(
  app: RawManifestApp,
  source: SourceTranslations,
): string[] {
  if (source.source === app.blurb) {
    return []
  }

  return [
    `${app.appId} translations were made from different English; retranslate them, then set blurbTranslations.${app.appId}.source to the current blurb`,
  ]
}

/** `ids.json` has a non-empty text for every translated wording, and nothing else. */
function checkWordings(appId: string, source: SourceTranslations): string[] {
  const problems: string[] = []
  const known = new Set<string>([...TRANSLATED_WORDINGS, 'source'])

  for (const wording of TRANSLATED_WORDINGS) {
    const text = source[wording]
    if (typeof text !== 'string' || !text.trim()) {
      problems.push(`${appId} has no ${wording} blurb in ids.json`)
    }
  }

  for (const key of Object.keys(source)) {
    if (!known.has(key)) {
      problems.push(
        `${appId} blurbTranslations has ${key}, which is not a translated wording catalog`,
      )
    }
  }

  return problems
}

/**
 * The manifest's `blurbs` hold exactly the `ids.json` translations, so a later
 * `refresh-catalog.ps1` run reproduces them instead of dropping an edit.
 */
function checkManifestMatchesSource(
  app: RawManifestApp,
  source: SourceTranslations,
): string[] {
  const expected = Object.fromEntries(
    TRANSLATED_WORDINGS.map((wording) => [wording, source[wording]]),
  )

  if (JSON.stringify(app.blurbs) === JSON.stringify(expected)) {
    return []
  }

  return [
    `${app.appId} blurbs in apps.json differ from its blurbTranslations in ids.json`,
  ]
}

/** A plain JSON object (not null, not an array). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
