# DeepSeek Harness Desktop

Independent Windows desktop packaging for the DeepSeek Harness UI. The app
ships its own Node runtime and Harness backend, starts on an available local
loopback port, and does not depend on an existing `127.0.0.1:3080` service.

## Download

The ready-to-run Windows build is attached to the
[v0.1.0 release](https://github.com/starsqvq/deepseek-harness-desktop/releases/tag/v0.1.0):
download `deepseek-harness-desktop-v0.1.0-win-x64.zip`, extract the ZIP as a
whole, keep `deepseek-harness.exe` beside the `deepseek-harness-app`
directory, and double-click the EXE.

The launcher is intentionally small and starts the unpacked Electron app
directory directly. This avoids the long CPU-heavy extraction step of a
single-file Electron portable executable.

`v0.1.1` is a source-only release. It carries the `--no-open` desktop-shell
fix and the recovery notes under `docs/`, together with the source archives
GitHub generates for the tag. It does not ship a rebuilt ZIP, because the build
inputs (`node_modules`, `packed-dsh`, `packed-vendor`, `runtime`) and the
original DeepSeek Harness checkout are no longer present on the build machine.

## Build

The build requires Node.js, npm, and the original DeepSeek Harness checkout at
`C:\Users\35062\Desktop\myWorks\一些项目\deepseek-harness` only when regenerating
the runtime dependency closure.

```powershell
npm install
npm run dist
g++ -std=c++17 -O2 -municode -mwindows -o deepseek-harness.exe deepseek-harness-launcher.cpp
```

Harness data and backend logs are stored under Electron's per-user application
data directory. See `LICENSE` and `THIRD_PARTY_NOTICES.md` for licensing.
