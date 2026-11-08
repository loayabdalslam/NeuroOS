# Building Neuro OS desktop installers

The app ships as an Electron desktop application for Windows and Linux (Ubuntu/Debian, Fedora/RHEL and portable AppImage).

## GitHub Actions (recommended)

Workflow: [`.github/workflows/build.yml`](../.github/workflows/build.yml)

- **Manual run:** Actions → **Build desktop apps** → *Run workflow*.
- **Release run:** push a tag such as `v1.0.0`; the workflow builds installers, uploads artifacts and creates a GitHub Release with every file attached.

Outputs:

| Platform | Files |
| --- | --- |
| Windows | NSIS installer (`Neuro OS Setup 1.0.0.exe`) and portable `.exe` |
| Linux | `.AppImage` (any distro), `.deb` (Ubuntu/Debian), `.rpm` (Fedora/RHEL/openSUSE) |

Artifacts are also attached to the run (`neuro-os-windows`, `neuro-os-linux`) for 14 days.

## Local builds

```bash
npm ci
npm run build

# Windows (run on Windows)
npx electron-builder --win nsis portable --x64

# Linux (run on Linux; install rpm + libarchive-tools for rpm/deb)
npx electron-builder --linux AppImage deb rpm --x64
```

Installers are written to `release/`. Scripts `npm run dist:win` and `npm run dist:linux` wrap the same commands.

## Fullscreen

- **F11** toggles fullscreen in the desktop window.
- **Escape** leaves fullscreen.
- The window state (`fullscreen`) is broadcast through `window:state`, and `window.toggleFullscreen` is available for UI commands.
