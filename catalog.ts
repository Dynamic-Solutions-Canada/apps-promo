/** Public catalog contract shared by web consumers. Legacy Windows fields stay intact. */
export interface AppLink {
  platform: 'Android' | 'Windows' | 'Web'
  url: string
  label: string
}

/**
 * The wording catalogs the blurbs are translated into: the nine-locale set's seven catalogs
 * less `en-US`, whose text is `blurb` itself. `en-CA` reads `en-US` and `fr-CA` reads `fr-FR`.
 */
export const TRANSLATED_WORDINGS = [
  'es-ES',
  'fr-FR',
  'de-DE',
  'zh-CN',
  'pt-BR',
  'ja-JP',
] as const

/** One of {@link TRANSLATED_WORDINGS}. */
export type TranslatedWording = (typeof TRANSLATED_WORDINGS)[number]

export interface CatalogApp {
  appId: string
  name: string
  /** The English (`en-US`) description, and the fallback for every other wording. */
  blurb: string
  /**
   * Translated descriptions by wording catalog; a missing one falls back to {@link blurb}.
   * `parseCatalog` always sets it. It is optional so callers that build entries themselves,
   * written before v2.2.0, still type-check.
   */
  blurbs?: Partial<Record<TranslatedWording, string>>
  icon: string
  links: AppLink[]
}

export const CATALOG_BASE_URL =
  'https://raw.githubusercontent.com/Dynamic-Solutions-Canada/apps-promo/main/Assets/PromotedApps/'

/** Validate untrusted remote or cached data before displaying it or following links. */
export function parseCatalog(value: unknown): CatalogApp[] {
  if (
    !value ||
    typeof value !== 'object' ||
    !('apps' in value) ||
    !Array.isArray(value.apps)
  ) {
    throw new Error('Invalid app catalog')
  }

  const ids = new Set<string>()
  return value.apps.map((app: unknown) => {
    if (!app || typeof app !== 'object') throw new Error('Invalid catalog app')
    const entry = app as Record<string, unknown>
    for (const key of ['appId', 'name', 'blurb', 'icon']) {
      if (typeof entry[key] !== 'string' || !entry[key])
        throw new Error(`Invalid ${key}`)
    }
    const { appId, name, blurb, icon } = entry as Record<string, string>
    if (
      !appId ||
      !name ||
      !blurb ||
      !icon ||
      !/^[\w-]+\.png$/.test(icon) ||
      ids.has(appId)
    ) {
      throw new Error('Invalid app identity or icon')
    }
    ids.add(appId)
    if (!Array.isArray(entry.links) || entry.links.length === 0)
      throw new Error('Missing app links')

    const links = entry.links.map((link: unknown): AppLink => {
      if (!link || typeof link !== 'object') throw new Error('Invalid app link')
      const fields = link as Record<string, unknown>
      if (
        fields.platform !== 'Android' &&
        fields.platform !== 'Windows' &&
        fields.platform !== 'Web'
      ) {
        throw new Error('Invalid app platform')
      }
      if (
        typeof fields.url !== 'string' ||
        typeof fields.label !== 'string' ||
        !fields.label
      ) {
        throw new Error('Invalid app destination')
      }
      const url = new URL(fields.url)
      if (url.protocol !== 'https:' || url.username || url.password)
        throw new Error('Unsafe app destination')
      return { platform: fields.platform, url: url.href, label: fields.label }
    })

    return {
      appId,
      name,
      blurb,
      blurbs: parseBlurbs(entry.blurbs),
      icon,
      links,
    }
  })
}

/**
 * Keep only well-formed translations. A bad or missing translation shows the English blurb
 * instead of rejecting the whole catalog, since the English is always valid by this point.
 */
function parseBlurbs(
  value: unknown,
): Partial<Record<TranslatedWording, string>> {
  const blurbs: Partial<Record<TranslatedWording, string>> = {}
  if (!value || typeof value !== 'object') {
    return blurbs
  }

  const entries = value as Record<string, unknown>
  for (const wording of TRANSLATED_WORDINGS) {
    const text = entries[wording]
    if (typeof text === 'string' && text) {
      blurbs[wording] = text
    }
  }

  return blurbs
}

/**
 * Map a BCP-47 locale tag to the wording catalog the promo page uses for it, by language,
 * as the WinUI page does: `fr-CA` reads `fr-FR`, `en-CA` reads `en-US`, and Chinese
 * selects `zh-CN` only for Simplified script (a `Hant` script or a TW, HK or MO region
 * never does).
 *
 * @returns The wording catalog, or `undefined` for English and unsupported languages.
 */
export function translatedWordingFor(
  locale: string,
): TranslatedWording | undefined {
  const parts = locale.trim().replace(/_/g, '-').split('-')
  const language = parts[0]?.toLowerCase()

  if (language === 'zh') {
    return isSimplifiedChinese(parts) ? 'zh-CN' : undefined
  }

  return TRANSLATED_WORDINGS.find(
    (wording) => wording.slice(0, 2).toLowerCase() === language,
  )
}

/** Whether a Chinese tag's script or region selects Simplified Chinese; no subtag means it does. */
function isSimplifiedChinese(parts: string[]): boolean {
  for (const part of parts.slice(1)) {
    // A singleton starts an extension (-u-, -x-), which never names the script.
    if (part.length === 1) {
      break
    }
    if (part.length === 4) {
      return part.toLowerCase() === 'hans'
    }
    if (['tw', 'hk', 'mo'].includes(part.toLowerCase())) {
      return false
    }
  }

  return true
}

/**
 * The app's description in the given BCP-47 locale, or the English blurb when that
 * language has no translation.
 */
export function blurbFor(app: CatalogApp, locale: string): string {
  const wording = translatedWordingFor(locale)
  return (wording && app.blurbs?.[wording]) || app.blurb
}
