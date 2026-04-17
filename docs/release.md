# Release Notes

This repo now supports Electron desktop auto-updates through GitHub Releases.

## What the release workflow does

- Workflow: `.github/workflows/release.yml`
- Triggers:
  - push tags matching `v*.*.*` for stable releases
  - scheduled nightly at `09:00 UTC`
  - manual `workflow_dispatch` for either channel
- Runs `lint`, `typecheck`, and `test` before packaging.
- Builds desktop artifacts for:
  - macOS `arm64` DMG + ZIP
  - macOS `x64` DMG + ZIP
  - Linux `x64` AppImage
  - Windows `x64` NSIS installer
- Publishes the build outputs and Electron updater metadata to GitHub Releases.

## Desktop updater behavior

- Runtime updater: `electron-updater` in `apps/desktop/src/main.ts`
- Checks run:
  - 15 seconds after startup
  - every 4 hours after that
- Downloads are manual.
- Installs are manual and require a restart confirmation.
- Release channels:
  - `latest` for stable releases
  - `nightly` for prerelease builds

## GitHub repository assumption

The builder config defaults to `github.com/not-ani/tex`.

You can override that by setting one of:

- `TEX_DESKTOP_UPDATE_REPOSITORY`
- `GITHUB_REPOSITORY`

Both must use the `owner/repo` format.

## Required release assets

Electron updater expects these files to be attached to the GitHub release:

- `.dmg`, `.zip`, `.exe`, `.AppImage`
- `latest*.yml` or `nightly*.yml`
- `.blockmap`

The workflow merges the per-arch macOS updater manifests back into one canonical manifest before publishing the release.
