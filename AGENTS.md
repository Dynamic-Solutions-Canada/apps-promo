# Apps Promo: Agent Instructions

Shared "Our other apps" catalog and WinUI 3 page for the publisher's apps. Every Windows app consumes it as a git submodule at `external/promo` and imports `PromotedApps.projitems`; web and Android consumers read the public manifest through `catalog.ts`. Installed copies of every shipped app fetch the catalog from this repo at runtime, so a mistake here reaches every app at once.

## Standards

This repo follows the shared standards at https://github.com/Dynamic-Solutions-Canada/app-standards. Read the index for this stack, https://github.com/Dynamic-Solutions-Canada/app-standards/blob/main/stacks/kits.md, then the topic file for the area you are changing (`standards/promo.md` first). If `external/standards/` exists, it is the same content pinned for offline use. Where this file differs from the standards, this file wins and says why.

## Architecture

The repo owns the catalog data, the script that regenerates it, the WinUI page and its localization, and `catalog.ts` for web consumers. It does not own where the page sits in an app, or any app's store listing.

| Area | Files |
| --- | --- |
| Catalog source (hand-edited) | `ids.json` |
| Generated catalog and icons (public, fetched at runtime) | `Assets/PromotedApps/` |
| Catalog generator, the only Store client | `refresh.ps1` |
| WinUI page | `Views/PromotedAppsPage.xaml`, `Views/PromotedAppsPage.xaml.cs` |
| WinUI page text | `Views/PromoLocalization.cs` |
| Shared-items import for WinUI apps | `PromotedApps.projitems` |
| Web and Android types, URL and validation | `catalog.ts`, `catalog.test.ts` |
| Repo checks and the test runner | `scripts/` |

## Conventions and gotchas

- **Permanent names.** Never rename or move `Assets/PromotedApps/apps.json` on `main`, `PromotedApps.projitems` at the root, the `TechnicallyReal.Promo` namespace or the `PromotedAppsPage` type, or any existing `appId` (including `drive-for-immich`). Shipped apps reference each of them and cannot be patched.
- **The old repo name stays unused.** Older releases fetch the catalog through the pre-rename owner and repo name and GitHub's redirect; see "Permanent URLs" in the README.
- **Only `refresh.ps1` talks to the Store backend.** The page and `catalog.ts` read only the committed public manifest and its icons, so a Store endpoint change cannot break shipped apps. Do not run `refresh.ps1` unless the maintainer asks: it rewrites the public catalog.
- **Catalog edits go in `ids.json` and the generated manifest together**, so a later `refresh.ps1` run preserves them.
- **Page strings are keyed by their English text** in `Views/PromoLocalization.cs`. A new string is added to every locale table there. The page never references a consumer's localization classes.
- **`refresh.ps1` stays ASCII-only**, because Windows PowerShell 5.1 reads a BOM-less script as the system code page.

## Commands

| Command | Proves | Does not prove |
| --- | --- | --- |
| `npm run validate` | The whole gate: `format:check`, `check:catalog` and `test`. CI runs the same command | That the WinUI page compiles |
| `npm test` | Every `*.test.ts` and `*.test.mjs` in the repo passes, found by `scripts/run-tests.mjs` | That the WinUI page compiles |
| `npm run check:catalog` | `ids.json`, the generated manifest and the icons agree, so a refresh will not drop an edit | That the Store listings are current |
| `npm run format` | Rewrites files with Prettier (`format:check` only reports) | C# and XAML formatting; nothing here checks those |
| `npm run catalog:refresh` (Windows PowerShell, maintainer only) | Regenerates `Assets/PromotedApps/` from live Store listings by running `refresh.ps1` | Nothing by itself; review the diff before committing |

`catalog:refresh` is never part of `validate` or CI: it calls the Store backend and rewrites the public catalog.

The WinUI page has no host in this repo. XAML and C# changes are checked by building a consuming app against this working tree, never by building a real app checkout.

## Guidance map

| Guide, doc, or skill | Read or use when | Governs |
| --- | --- | --- |
| `README.md` | Consuming the page or catalog, or updating the promoted apps | Consumer setup, localization hook, catalog update steps, permanent URLs |
| `LICENSE` | Adding files or changing the copyright line | Licence and holder; the README's License section repeats the holder |

## Keeping docs current

| What changed | Update |
| --- | --- |
| A permanent path, name or URL | This file's "Permanent names" and the README's "Permanent URLs" |
| How consumers import or configure the page | README "Consuming" and "Page language" |
| A command | The Commands table above |
