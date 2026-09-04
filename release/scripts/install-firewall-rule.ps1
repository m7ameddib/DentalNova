#Requires -RunAsAdministrator
# DNT Dental — Windows Firewall rule (Private network / LAN only)
param(
  [int]$Port = 4000,
  [string]$RuleName = 'DNT Dental Server'
)

$existing = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Firewall rule already exists: $RuleName"
  exit 0
}

New-NetFirewallRule `
  -DisplayName $RuleName `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort $Port `
  -Profile Private `
  -Description "Allow DNT Dental clinic LAN access on port $Port (Private network only)"

Write-Host "Created firewall rule: $RuleName (TCP $Port, Private profile only)"
