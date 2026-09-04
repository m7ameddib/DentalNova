# DNT Dental Clinic Client — opens browser to main server (no local database)
Add-Type -AssemblyName Microsoft.VisualBasic
Add-Type -AssemblyName System.Windows.Forms

$defaultHost = 'DNT-DENTAL-SERVER'
$defaultPort = '4000'

$hostInput = [Microsoft.VisualBasic.Interaction]::InputBox(
  'Enter the main clinic computer name or LAN IP:',
  'DNT Dental — Connect to Main Server',
  $defaultHost
)
if ([string]::IsNullOrWhiteSpace($hostInput)) { exit 0 }

$portInput = [Microsoft.VisualBasic.Interaction]::InputBox(
  'Enter the server port:',
  'DNT Dental — Server Port',
  $defaultPort
)
if ([string]::IsNullOrWhiteSpace($portInput)) { $portInput = $defaultPort }

Start-Process "http://${hostInput}:${portInput}/"
