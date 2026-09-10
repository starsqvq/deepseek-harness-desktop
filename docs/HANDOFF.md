# DeepSeek Harness Desktop Handoff

## 2026-09-09/10: plugin and desktop startup recovery

The backend originally exited because `dsh-better-sidebar@0.18.1` imported the
missing `SessionLogOffset` export from `@deepseek-ai/dsh-session`. The web
profile was fixed by removing that plugin from its dependency and bundle lists,
with backups stored as `package.json.bak-20260909` and
`pnpm-lock.yaml.bak-20260909` under `%APPDATA%\\deepseek-harness-desktop-runtime\\harness-data\\profiles\\web`.

The first regenerated `resources/app.asar` then made the desktop process exit
before showing a window. The original `resources/app.asar.bak` was restored;
the generated package was preserved as `app.asar.after-web-fix` for diagnosis.
After the rollback, `DeepSeek Harness.exe` remained running and the backend
served a local web endpoint successfully.

The desktop shell source also passes `--no-open` to keep the embedded window
from opening the URL in the OS browser. Rebuild the package before distributing
that source change.
