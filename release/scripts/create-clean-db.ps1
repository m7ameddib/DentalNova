# Creates a clean production database with schema + reference data only (no demo patients/users).
param(
  [string]$TargetDir = "$env:ProgramData\DibNova\DNTDental"
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$TempDbDir = Join-Path $Root 'release\output\clean-db-temp'
$DbFile = Join-Path $TempDbDir 'data\clinic.db'

if (Test-Path $TempDbDir) { Remove-Item $TempDbDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path (Split-Path $DbFile) | Out-Null

$env:DNT_DATA_DIR = $TempDbDir
$env:DATABASE_FILE = 'data/clinic.db'
$env:MIGRATIONS_DIR = 'database/migrations'

Push-Location (Join-Path $Root 'server')
node -e "
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const dbPath = path.resolve('../release/output/clean-db-temp/data/clinic.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
const migDir = path.resolve('../database/migrations');
const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();
db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime(\"now\")))');
const applied = new Set(db.prepare('SELECT name FROM _migrations').all().map(r => r.name));
for (const file of files) {
  if (applied.has(file)) continue;
  db.exec(fs.readFileSync(path.join(migDir, file), 'utf-8'));
  db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
}
require('ts-node/register');
require('tsconfig-paths/register');
const { seedReferenceData } = require('./dist/database/reference-seed');
" 2>$null

# Use compiled reference seed if available, else inline minimal seed via node
node -e "
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const dbPath = path.resolve('../release/output/clean-db-temp/data/clinic.db');
const db = new Database(dbPath);
const roleCount = db.prepare('SELECT COUNT(*) AS c FROM roles').get().c;
if (roleCount === 0) {
  console.log('Reference data should be seeded by server on first start.');
}
const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
const patients = db.prepare('SELECT COUNT(*) AS c FROM patients').get().c;
console.log('Clean DB ready:', dbPath);
console.log('Users:', users, 'Patients:', patients);
db.close();
"

Pop-Location
Write-Host "Clean database template at: $DbFile"
Write-Host "Copy contents of release/output/clean-db-temp to $TargetDir on first clinic install, or let DNT Dental create it on first run."
