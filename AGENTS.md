# Apps Promo: Agent Instructions

Shared "Our other apps" catalog and WinUI 3 page for the publisher's apps. Every Windows app consumes it as a git submodule at `external/promo` and imports `PromotedApps.projitems`; web and Android consumers read the public manifest through `catalog.ts`. Installed copies of every shipped app fetch the catalog from this repo at runtime, so a mistake here reaches every app at once.

## Standards

This repo follows the shared standards at https://github.com/Dynamic-Solutions-Canada/app-standards. Read the index for this stack, https://github.com/Dynamic-Solutions-Canada/app-standards/blob/main/stacks/kits.md, then the topic file for the area you are changing (`standards/promo.md` first). If `external/standards/` exists, it is the same content pinned for offline use. Where this file differs from the standards, this file wins and says why.

## Architecture

The repo owns the catalog data, the script that regenerates it, the WinUI page and its localization, and `catalog.ts` for web consumers. It does not own where the page sits in an app, or any app's store listing.

| Area                                                     | Files                                                                                           |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Catalog source (hand-edited)                             | `ids.json`                                                                                      |
| Generated catalog and icons (public, fetched at runtime) | `Assets/PromotedApps/`                                                                          |
| Catalog generator, the only Store client                 | `scripts/refresh-catalog.ps1`                                                                   |
| WinUI page                                               | `Views/PromotedAppsPage.xaml`, `Views/PromotedAppsPage.xaml.cs`, `Views/TrailingActionPanel.cs` |
| WinUI page text                                          | `Views/PromoLocalization.cs`                                                                    |
| Shared-items import for WinUI apps                       | `PromotedApps.projitems`                                                                        |
| Compile and format host for the page (never shipped)     | `Views/CompileCheck/`                                                                           |
| Web and Android types, URL and validation                | `catalog.ts`, `catalog.test.ts`                                                                 |
| Repo checks and the test runner                          | `scripts/`                                                                                      |

## Conventions and gotchas

- **Permanent names.** Never rename or move `Assets/PromotedApps/apps.json` on `main`, `PromotedApps.projitems` at the root, the `TechnicallyReal.Promo` namespace or the `PromotedAppsPage` type, or any existing `appId` (including `drive-for-immich`). Shipped apps reference each of them and cannot be patched.
- **The old repo name stays unused.** Older releases fetch the catalog through the pre-rename owner and repo name and GitHub's redirect; see "Permanent URLs" in the README.
- **Only `refresh-catalog.ps1` talks to the Store backend.** The page and `catalog.ts` read only the committed public manifest and its icons, so a Store endpoint change cannot break shipped apps. Do not run `refresh-catalog.ps1` unless the maintainer asks: it rewrites the public catalog.
- **Catalog edits go in `ids.json` and the generated manifest together**, so a later `refresh-catalog.ps1` run preserves them.
- **App descriptions are translated in `ids.json`.** `blurbTranslations` holds every app's description in the six non-English wording catalogs, with the English it was made from as `source`. Changing an app's English means retranslating all six and updating `source`; `npm run check:catalog` fails until then. Mark new translations in the README's "Languages" table (LOC-12).
- **Page strings are keyed by their English text** in `Views/PromoLocalization.cs`. A new string is added to every locale table there. The page never references a consumer's localization classes.
- **The page takes its styles from the host.** It uses only the keys in the README's "Host requirements" table, from winui-app-kit's `Styles.xaml`, and writes no padding, radius or font size inline (UI-3). A new key is a major version, because hosts without it fail when the page opens; `scripts/xaml-keys.test.ts` keeps the table and the page in step.
- **Keep the page's element names and root.** The ScrollViewer > StackPanel root and `AppList`, `TitleText` and `SubtitleText` are reached by translation adapters in apps on older pins, until each app deletes its adapter (PROMO-7).
- **`refresh-catalog.ps1` stays ASCII-only**, because Windows PowerShell 5.1 reads a BOM-less script as the system code page.

## Commands

| Command                                                         | Proves                                                                                                                                                            | Does not prove                                       |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `npm run validate`                                              | The whole gate: `format:check`, `check:catalog` and `test`. CI runs the same command, and compiles the page on Windows when it changes                            | That the WinUI page compiles; that needs Windows     |
| `npm test`                                                      | Every `*.test.ts` and `*.test.mjs` in the repo passes, found by `scripts/run-tests.mjs`                                                                           | That the WinUI page compiles                         |
| `npm run check:catalog`                                         | `ids.json`, the generated manifest and the icons agree, so a refresh will not drop an edit                                                                        | That the Store listings are current                  |
| `npm run format`                                                | Rewrites files with Prettier, and the page's C# with `dotnet format` through `scripts/dotnet` (Docker when no .NET SDK is installed). `format:check` only reports | XAML formatting; nothing checks that                 |
| `npm run catalog:refresh` (Windows PowerShell, maintainer only) | Regenerates `Assets/PromotedApps/` from live Store listings by running `refresh-catalog.ps1`                                                                      | Nothing by itself; review the diff before committing |

`catalog:refresh` is never part of `validate` or CI: it calls the Store backend and rewrites the public catalog.

The page's only host here is `Views/CompileCheck/`, which CI builds on Windows. To see the page in an app, build a copy of a consuming app under `.artifacts/` with this working tree as its `external/promo`; never build from, or write to, a real app checkout. How it looks in light, dark and high contrast can only be checked in an installed app.

## Release

A page-code or `catalog.ts` change is released as an annotated `vX.Y.Z` tag, with the version in `package.json` and user-facing notes in `release-notes/<version>.md`; the `Release` workflow creates the GitHub Release from them. Catalog-only changes are never released. Follow the `release` skill in `.agents/skills/release/`.

## Guidance map

| Guide, doc, or skill | Read or use when                                             | Governs                                                                   |
| -------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `README.md`          | Consuming the page or catalog, or updating the promoted apps | Consumer setup, localization hook, catalog update steps, permanent URLs   |
| `LICENSE`            | Adding files or changing the copyright line                  | Licence and holder; the README's License section repeats the holder       |
| `release` skill      | Releasing a page-code or `catalog.ts` change                 | `package.json` version, `release-notes/`, tags and the `Release` workflow |

## Keeping docs current

| What changed                                                            | Update                                                                              |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| A permanent path, name or URL                                           | This file's "Permanent names" and the README's "Permanent URLs"                     |
| How consumers import or configure the page                              | README "Consuming" and "Page language"                                              |
| A command                                                               | The Commands table above                                                            |
| Page code, `catalog.ts` or the projitems                                | Release it with the `release` skill; README "Versioning" says whether it is a major |
| An app's English description, or a translation review                   | `blurbTranslations` in `ids.json` and the manifest; README "Languages"              |
| An app gains a public listing, or an app repo publishes its 256 px icon | `ids.json` and a catalog refresh; README "Apps not yet in the catalog" and "Icons"  |
