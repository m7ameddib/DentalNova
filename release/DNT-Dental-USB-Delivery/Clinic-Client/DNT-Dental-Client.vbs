Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
installRoot = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = installRoot & "\Start-DNT-Dental-Client.ps1"
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """", 0, False
