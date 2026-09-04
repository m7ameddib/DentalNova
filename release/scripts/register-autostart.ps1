#Requires -RunAsAdministrator
param(
  [string]$MainBat = "$PSScriptRoot\..\Start-DNT-Dental-Main.bat"
)

$taskName = 'DNT Dental Server'
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Scheduled task already exists: $taskName"
  exit 0
}

$action = New-ScheduledTaskAction -Execute $MainBat -WorkingDirectory (Split-Path $MainBat)
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Description 'Start DNT Dental clinic server on Windows boot' | Out-Null
Write-Host "Registered auto-start task: $taskName"
