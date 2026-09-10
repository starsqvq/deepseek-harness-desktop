# Summary

## DeepSeek Harness recovery

- 2026-09-09: disabled incompatible `dsh-better-sidebar@0.18.1`; it required
  the missing `SessionLogOffset` export.
- Updated profile: `%APPDATA%\\deepseek-harness-desktop-runtime\\harness-data\\profiles\\web`.
- Backups: `package.json.bak-20260909`, `pnpm-lock.yaml.bak-20260909`.
- 2026-09-10: regenerated `app.asar` caused the desktop process to exit before
  displaying a window; restored `resources/app.asar.bak`.
- Preserved diagnostic copy: `resources/app.asar.after-web-fix`.
- Verification: desktop process stayed alive and backend served a local URL.
