---
name: release
description: Releases a new version of the promo page and catalog contract. Gets the notes approved, bumps the version, tags vX.Y.Z, lets CI create the GitHub Release, then hands the pin bump to each consuming app. Use when asked to release, tag or publish apps-promo. Do not use for catalog-only changes, which reach apps without a release, or for bumping the promo pin inside an app.
---

Publish the current `main` as a tagged version that apps can pin.

Invoking this skill authorises its own bump commit, tag and push. It still stops twice: for approval of the notes, and on a dirty tree.

1. **Check the tree.** `git status` is clean and `git fetch` shows `HEAD` equal to `origin/main`. Stop and report if not; never commit unrelated work with the release.
2. **Check a release is needed.** Read the changes since the last tag (`git log $(git describe --tags --abbrev=0)..HEAD`). If only `ids.json`, `Assets/PromotedApps/` or docs changed, stop: the catalog reaches shipped apps at runtime, so there is nothing to release (README, "Versioning").
3. **Run the gate.** `npm run validate` passes. CI on `main` is green for `HEAD` (`gh run list --branch main --limit 5`).
4. **Choose the version.** Apply SemVer as the README's "Versioning" section defines it: a major for anything that needs an edit in a consuming app, a minor for new page or `catalog.ts` behaviour that needs none, a patch for fixes only.
5. **Draft the notes and stop for approval.** Write the proposed `release-notes/<version>.md` content in the reply: bullets only, no heading and no disclosure line, written for the developers of the consuming apps (what their page now does, and every edit a consumer must make). Wait for Ryan to approve or edit it. Change no files before that.
6. **Bump.** Run `npm version <version> --no-git-tag-version` (it updates `package.json` and `package-lock.json`), write the approved notes file, and commit all three together with the subject `Bump version to v<version>`.
7. **Tag and push.** `git tag -a v<version> -m "Apps Promo <version>"`, then `git push origin main v<version>`.
8. **Watch the Release.** Follow the `Release` workflow for the tag (`gh run watch`). It reruns the gate, checks that the tag, version and notes agree, and creates the GitHub Release titled `Apps Promo <version>`. If it fails, report the failing job; do not create or edit the Release by hand.
9. **Hand off the pin bump.** Each consuming app takes the bump as its own change, with the subject `Update Apps Promo: <what it changes for this app>`. Do not edit an app repo from this session: hand each app's session the tag, the Release link and the exact edits a major version requires, or list them for Ryan if no session is open.

Report: the version and why, the tag, the Release URL and its workflow result, and per consumer what its bump needs.
