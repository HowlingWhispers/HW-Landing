# CodaLauncher 0.1.0

CodaLauncher is the desktop control center for Howling Whispers Minecraft/CML.

This prototype is a standalone Tauri 2 project kept under `HW-Landing/codalauncher`
until a dedicated `HW-CodaLauncher` repository is created. It does not import or
depend on the HW-Landing frontend.

## What works

- Home dashboard with Coda artwork and loader/game/mod status.
- Real **PLAY** command that starts `CodaLoader.jar` without a normal Windows
  console and redirects loader output to `run/logs/codalauncher-launch.log`.
- CodaLoader inspection through `--version-json`.
- CML mod discovery from `run/mods`, including `coda.mod.json` metadata.
- Latest CodaLauncher and Minecraft log view.
- Online news slot consuming the public launcher-feed JSON endpoint.
- Local settings for CodaLoader folder and launcher-feed URL.

## Deliberately not implemented yet

- CML accounts, Discord link, Minecraft ownership proof and avatar/profile editor.
- Launcher-owned CodaLoader update/download flow. CodaLoader still owns its
  updater for now.
- Mod enable/disable mutations or a mod marketplace.
- Whispering Currents.

## Development

Tauri uses the operating system web renderer rather than bundling a browser.
The frontend is plain local HTML/CSS/JS under `ui/`.

```powershell
cd codalauncher
npm install
npm run dev
```

For a native compile check:

```powershell
cargo check --manifest-path src-tauri/Cargo.toml
```

The first Windows release packaging/signing pass comes after the shell is
confirmed against a real CodaLoader install.
