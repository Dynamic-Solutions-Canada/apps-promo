/**
 * Consistency checks between the hand-edited catalog source (`ids.json`) and the
 * generated public catalog (`Assets/PromotedApps/apps.json`).
 *
 * `refresh-catalog.ps1` derives the manifest from `ids.json`, but catalog edits are also
 * made to both files by hand (README, "Updating the promoted apps"), so the two
 * can drift. A drift is invisible until the next refresh silently drops an edit,
 * which is why the gate checks it on every change.
 */
import { parseCatalog, type AppLink, type CatalogApp } from '../catalog.js'
import { findBlurbProblems } from './blurb-checks.js'
import { readPngSize } from './png-size.js'

/** Catalog icons are 256 px squares (PROMO-5, D-070). */
export const ICON_SIZE = 256

/**
 * Where each app repo publishes its 256 px catalog icon (ASSET-12). An entry whose
 * `iconUrl` ends with this path is held to {@link ICON_SIZE} exactly.
 */
export const APP_REPO_ICON_PATH = '/assets/generated/icon-256.png'

/** One `ids.json` entry's fields these checks read. */
interface SourceEntry {
  appId: string
  links?: AppLink[]
  /** Optional on Store products; when set, it replaces the Store's 50 px logo. */
  iconUrl?: string
}

/** The parts of `ids.json` these checks read. Everything else is ignored. */
interface CatalogSource {
  productIds: string[]
  externalApps: SourceEntry[]
  appOverrides: Record<string, SourceEntry>
  appOrder: string[]
  /** Translated blurbs by `appId`; validated by `findBlurbProblems`. */
  blurbTranslations: unknown
}

/** Inputs to {@link findCatalogProblems}, injected so tests need no files. */
export interface CatalogInputs {
  /** Parsed `ids.json`. */
  ids: unknown
  /** Parsed `Assets/PromotedApps/apps.json`. */
  manifest: unknown
  /** The bytes of an icon in `Assets/PromotedApps/`, or `undefined` when the file is missing. */
  readIcon: (fileName: string) => Uint8Array | undefined
}

/**
 * Find every disagreement between `ids.json`, the generated manifest and the icon files.
 *
 * @returns One readable message per problem; an empty array means the catalog is consistent.
 */
export function findCatalogProblems(inputs: CatalogInputs): string[] {
  // The manifest must pass the same validation consumers apply before anything else is compared.
  let apps: CatalogApp[]
  try {
    apps = parseCatalog(inputs.manifest)
  } catch (error) {
    return [`apps.json fails parseCatalog: ${(error as Error).message}`]
  }

  const source = readSource(inputs.ids)
  if (typeof source === 'string') {
    return [source]
  }

  return [
    ...checkOrder(apps, source.appOrder),
    ...checkSourceLinks(
      rawLinksByAppId(inputs.manifest),
      sourceLinksByAppId(source),
    ),
    ...checkLinksPerPlatform(apps),
    ...checkIcons(apps, iconUrlsByAppId(source), inputs.readIcon),
    ...findBlurbProblems(inputs.manifest, source.blurbTranslations),
  ]
}

/**
 * List the entries whose committed icon is not yet {@link ICON_SIZE} px, for example the
 * Store's 50 px logos. This is progress, not a failure: each entry moves to a 256 px
 * `iconUrl` once its app repo publishes one at {@link APP_REPO_ICON_PATH}.
 *
 * @returns `"<appId> (<width> px)"` per entry; empty once every icon is 256 px.
 */
export function listIconsBelowTarget(inputs: CatalogInputs): string[] {
  let apps: CatalogApp[]
  try {
    apps = parseCatalog(inputs.manifest)
  } catch {
    return []
  }

  const below: string[] = []
  for (const app of apps) {
    const bytes = inputs.readIcon(app.icon)
    const size = bytes ? readPngSize(bytes) : undefined
    if (size && size.width !== ICON_SIZE) {
      below.push(`${app.appId} (${size.width} px)`)
    }
  }

  return below
}

/**
 * Narrow parsed `ids.json` to the fields the checks need.
 *
 * @returns The source, or a message describing the first missing field.
 */
function readSource(value: unknown): CatalogSource | string {
  if (!value || typeof value !== 'object') {
    return 'ids.json is not an object'
  }

  const ids = value as Partial<CatalogSource>
  if (!Array.isArray(ids.productIds)) {
    return 'ids.json has no productIds array'
  }
  if (!Array.isArray(ids.appOrder)) {
    return 'ids.json has no appOrder array'
  }

  return {
    productIds: ids.productIds,
    externalApps: Array.isArray(ids.externalApps) ? ids.externalApps : [],
    appOverrides: ids.appOverrides ?? {},
    appOrder: ids.appOrder,
    blurbTranslations: ids.blurbTranslations,
  }
}

/**
 * Every app appears exactly once in `appOrder`, `appOrder` names no unknown app,
 * and the manifest lists apps in that order (consumers keep the manifest order).
 */
function checkOrder(apps: CatalogApp[], appOrder: string[]): string[] {
  const problems: string[] = []
  const manifestIds = apps.map((app) => app.appId)

  for (const appId of manifestIds) {
    const count = appOrder.filter((entry) => entry === appId).length
    if (count !== 1) {
      problems.push(
        `appOrder lists ${appId} ${count} times; it must appear exactly once`,
      )
    }
  }

  for (const entry of appOrder) {
    if (!manifestIds.includes(entry)) {
      problems.push(`appOrder lists ${entry}, which is not in apps.json`)
    }
  }

  // Only meaningful once both lists hold the same ids, so it does not repeat the problems above.
  if (problems.length === 0 && manifestIds.join() !== appOrder.join()) {
    problems.push(
      `apps.json order (${manifestIds.join(', ')}) differs from appOrder (${appOrder.join(', ')})`,
    )
  }

  return problems
}

/**
 * Map each `appId` defined in `ids.json` to the links it declares there.
 * Store products take theirs from `appOverrides`, web apps from `externalApps`.
 * A product with no override maps to `undefined` links, which the caller reports.
 */
function sourceLinksByAppId(
  source: CatalogSource,
): Map<string, AppLink[] | undefined> {
  const links = new Map<string, AppLink[] | undefined>()

  for (const productId of source.productIds) {
    const override = source.appOverrides[productId]
    links.set(
      override?.appId ?? `(product ${productId} has no appOverrides entry)`,
      override?.links,
    )
  }

  for (const externalApp of source.externalApps) {
    links.set(externalApp.appId, externalApp.links)
  }

  return links
}

/**
 * Map each manifest `appId` to its links exactly as committed. `parseCatalog` normalises
 * URLs (adding a trailing slash, for example), so its output cannot be compared with
 * `ids.json`, which `refresh-catalog.ps1` copies verbatim. Call only after `parseCatalog` passed.
 */
function rawLinksByAppId(manifest: unknown): Map<string, unknown> {
  const apps = (manifest as { apps: { appId: string; links: unknown }[] }).apps
  return new Map(apps.map((app) => [app.appId, app.links]))
}

/**
 * `ids.json` and the manifest define the same apps with the same links, so a later
 * `refresh-catalog.ps1` run reproduces the committed manifest instead of dropping an edit.
 */
function checkSourceLinks(
  manifestLinks: Map<string, unknown>,
  sourceLinks: Map<string, AppLink[] | undefined>,
): string[] {
  const problems: string[] = []

  for (const [appId, links] of manifestLinks) {
    if (!sourceLinks.has(appId)) {
      problems.push(`${appId} is in apps.json but not defined in ids.json`)
      continue
    }

    const declared = sourceLinks.get(appId)
    if (!declared || JSON.stringify(declared) !== JSON.stringify(links)) {
      problems.push(
        `${appId} links in apps.json differ from its links in ids.json`,
      )
    }
  }

  for (const appId of sourceLinks.keys()) {
    if (!manifestLinks.has(appId)) {
      problems.push(
        `${appId} is defined in ids.json but missing from apps.json`,
      )
    }
  }

  return problems
}

/** Each entry has at most one link per platform, so a consumer never has to pick between two. */
function checkLinksPerPlatform(apps: CatalogApp[]): string[] {
  const problems: string[] = []

  for (const app of apps) {
    const platforms = app.links.map((link) => link.platform)
    const duplicates = platforms.filter(
      (platform, index) => platforms.indexOf(platform) !== index,
    )
    for (const platform of new Set(duplicates)) {
      problems.push(`${app.appId} has more than one ${platform} link`)
    }
  }

  return problems
}

/**
 * Map each `appId` to the `iconUrl` `ids.json` gives it, if any. Web apps always have one;
 * Store products have one only once they move off the Store logo.
 */
function iconUrlsByAppId(source: CatalogSource): Map<string, string> {
  const urls = new Map<string, string>()
  const entries = [
    ...Object.values(source.appOverrides),
    ...source.externalApps,
  ]

  for (const entry of entries) {
    if (entry?.appId && typeof entry.iconUrl === 'string') {
      urls.set(entry.appId, entry.iconUrl)
    }
  }

  return urls
}

/**
 * Every icon the manifest names is committed beside it (the offline fallback), is a square
 * PNG, and is exactly {@link ICON_SIZE} px when it comes from an app repo's published path.
 */
function checkIcons(
  apps: CatalogApp[],
  iconUrls: Map<string, string>,
  readIcon: (fileName: string) => Uint8Array | undefined,
): string[] {
  const problems: string[] = []

  for (const app of apps) {
    const bytes = readIcon(app.icon)
    if (!bytes) {
      problems.push(
        `${app.appId} icon ${app.icon} is missing from Assets/PromotedApps/`,
      )
      continue
    }

    const size = readPngSize(bytes)
    if (!size) {
      problems.push(`${app.appId} icon ${app.icon} is not a PNG`)
      continue
    }
    if (size.width !== size.height) {
      problems.push(
        `${app.appId} icon ${app.icon} is ${size.width}x${size.height}; icons must be square`,
      )
      continue
    }

    const fromAppRepo = iconUrls.get(app.appId)?.endsWith(APP_REPO_ICON_PATH)
    if (fromAppRepo && size.width !== ICON_SIZE) {
      problems.push(
        `${app.appId} icon ${app.icon} is ${size.width} px; ${APP_REPO_ICON_PATH} must be ${ICON_SIZE} px`,
      )
    }
  }

  return problems
}
