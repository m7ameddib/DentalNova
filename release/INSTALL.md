# DNT Dental v1.1.3 — Installation Guide

## Package contents

- **DNT-Dental-Main-Clinic-Setup-v1.1.3.exe** — Windows installer for the main clinic computer (recommended)
- **Main-Clinic/** — Portable main clinic package (server + UI + bundled runtime)
- **Clinic-Client/** — Second laptop launcher (connects via LAN, no local database)

## A. Main clinic laptop

### Option 1 — Windows installer (recommended)

1. Run **DNT-Dental-Main-Clinic-Setup-v1.1.3.exe**
2. Choose installation type:
   - **A) New Installation** — for a new computer; creates ProgramData folders if needed
   - **B) Update Existing Installation** — replaces application files only; **never** deletes or replaces `clinic.db` or patient data
3. Accept the default install location: `C:\Program Files\DibNova\DNTDental\`
4. Double-click **DNT Dental** on the desktop
5. On first run (new install only):
   - Copy **Installation ID** from the activation screen
   - Request a signed license from DibNova Technologies
   - Paste license → Complete first setup (clinic info + admin account)
6. On later runs, log in with your clinic user account

### AI Assistant (Gemini)

After installation, edit `C:\Program Files\DibNova\DNTDental\server\.env` (created from `.env.example` on new install):

```
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-3.6-flash
```

Restart DNT Dental after saving. Clinic data stays local; only chat messages/images are sent to Gemini.

### Option 2 — Portable folder + install script

1. Copy **Main-Clinic** to e.g. `C:\Program Files\DibNova\DNTDental\`
2. Right-click **install-main-clinic.ps1** → Run with PowerShell
3. Launch from the **DNT Dental** desktop shortcut

### Data location (never inside program folder)

`C:\ProgramData\DibNova\DNTDental\`

- `data\clinic.db` — SQLite database
- `attachments\` — X-rays, photos, documents
- `backups\` — Backup ZIP files
- `config\` — JWT secret (auto-generated at setup)
- `license\` — License storage
- `logs\` — Server logs

## B. Second clinic laptop

1. Copy **Clinic-Client** folder to the second PC
2. Double-click **DNT-Dental-Client.vbs**
3. Enter main computer name or LAN IP
4. Log in with your clinic user account

## C. Backup & restore

Use **Settings → Backup** in the application before any update.

## D. Updates (v1.1+)

1. Stop DNT Dental server
2. Safety backup via Settings
3. Run the new installer and choose **B) Update Existing Installation**
4. Start server — migrations apply automatically once

The update process replaces program files only. Your `clinic.db` and all patient/treatment/appointment/payment data remain untouched.

## E. Requirements

- Windows 10/11
- Clinic Wi-Fi / LAN between devices
- No Node.js required on clinic PCs (runtime bundled)

---

**DNT Dental v1.1.3** — DibNova Technologies
