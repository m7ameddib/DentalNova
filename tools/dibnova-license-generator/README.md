# DibNova License Generator — PRIVATE

This tool stays at **DibNova Technologies only**. Never include it in client installers or production packages.

## Generate a license

```powershell
node generate-license.js --clinic-id CLINIC001 --clinic-name "Sunrise Dental Clinic"
```

Optional:

- `--installation-id <id>` — bind license to a specific clinic installation ID shown on activation screen
- `--expires 2027-12-31` — optional expiry date

Output: `output/<clinic-id>.dntlic`

The clinic pastes the license content into DNT Dental activation on first run.

## Keys

- **Private key**: `keys/license-private.pem` — DibNova only, never ship to clients
- **Public key**: copied to `server/keys/license-public.pem` in the application build

To rotate keys, generate a new RSA pair and rebuild DNT Dental with the new public key.
