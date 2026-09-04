# DibNova License Generator (GUI)

**DibNova Technologies internal use only.** Do not ship with DNT Dental installers or USB delivery packages.

## Build once (developer machine)

```powershell
powershell -ExecutionPolicy Bypass -File tools\dibnova-license-generator-gui\build.ps1
```

This creates:

- `tools/dibnova-license-generator-gui/dist/DibNova License Generator/DibNova License Generator.exe`
- Bundled copy of the existing `generate-license.js` (same signing logic)
- Bundled portable Node runtime (runs hidden — you never run Node manually)
- Uses the **existing** private key at `tools/dibnova-license-generator/keys/license-private.pem` (not copied into customer packages)
- Desktop shortcut: **DibNova License Generator**

## Daily use

Double-click **DibNova License Generator** on the desktop.

Required fields:

- Clinic Name
- Clinic ID
- Installation ID (from the clinic activation screen)

Click **Generate License**, then **Copy License** to paste into DNT Dental activation.
