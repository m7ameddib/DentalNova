; DNT Dental — Main Clinic Windows Installer (Inno Setup)
; Compile: iscc /DMyAppVersion=1.1.3 release\installer\DNT-Dental-Main-Clinic.iss

#ifndef MyAppVersion
  #define MyAppVersion "1.1.3"
#endif

#define MyAppName "DNT Dental"
#define MyAppPublisher "DibNova Technologies"
#define MyAppExeName "DNT-Dental.vbs"
#define ReleaseDir "..\DNT-Dental-v" + MyAppVersion
#define SetupBaseName "DNT-Dental-Main-Clinic-Setup-v" + MyAppVersion

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\DibNova\DNTDental
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir={#ReleaseDir}
OutputBaseFilename={#SetupBaseName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
SetupIconFile=..\branding\dnt-dental.ico
UninstallDisplayIcon={app}\dnt-dental.ico
UsePreviousAppDir=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; Application files only — never ships clinic.db or ProgramData content.
Source: "{#ReleaseDir}\Main-Clinic\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autodesktop}\{#MyAppName}"; Filename: "wscript.exe"; Parameters: """{app}\{#MyAppExeName}"""; WorkingDir: "{app}"; IconFilename: "{app}\dnt-dental.ico"; Comment: "DNT Dental — Main Clinic"
Name: "{group}\{#MyAppName}"; Filename: "wscript.exe"; Parameters: """{app}\{#MyAppExeName}"""; WorkingDir: "{app}"; IconFilename: "{app}\dnt-dental.ico"

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\install-firewall-rule.ps1"""; Flags: runhidden waituntilterminated; StatusMsg: "Configuring firewall..."; Check: not WizardSilent and IsNewInstallMode

[Code]
var
  InstallModePage: TWizardPage;
  NewInstallRadio: TRadioButton;
  UpdateInstallRadio: TRadioButton;
  IsNewInstall: Boolean;

function ExistingClinicDbPath(): String;
begin
  Result := ExpandConstant('{commonappdata}\DibNova\DNTDental\data\clinic.db');
end;

function ClinicDbExists(): Boolean;
begin
  Result := FileExists(ExistingClinicDbPath());
end;

function InitializeSetup(): Boolean;
begin
  IsNewInstall := not ClinicDbExists();
  Result := True;
end;

procedure InitializeWizard();
var
  TopPos: Integer;
begin
  InstallModePage := CreateCustomPage(wpWelcome,
    'Installation Type', 'Choose how to install DNT Dental on this computer.');

  TopPos := 0;

  NewInstallRadio := TRadioButton.Create(InstallModePage);
  NewInstallRadio.Parent := InstallModePage.Surface;
  NewInstallRadio.Caption := 'A) New Installation — for a new computer (creates data folders if needed)';
  NewInstallRadio.Left := 0;
  NewInstallRadio.Top := TopPos;
  NewInstallRadio.Width := InstallModePage.SurfaceWidth;

  TopPos := TopPos + ScaleY(28);

  UpdateInstallRadio := TRadioButton.Create(InstallModePage);
  UpdateInstallRadio.Parent := InstallModePage.Surface;
  UpdateInstallRadio.Caption := 'B) Update Existing Installation — replaces application files only; preserves clinic database and all patient data';
  UpdateInstallRadio.Left := 0;
  UpdateInstallRadio.Top := TopPos;
  UpdateInstallRadio.Width := InstallModePage.SurfaceWidth;

  if ClinicDbExists() then
    UpdateInstallRadio.Checked := True
  else
    NewInstallRadio.Checked := True;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = InstallModePage.ID then
  begin
    IsNewInstall := NewInstallRadio.Checked;
    if IsNewInstall and ClinicDbExists() then
    begin
      if MsgBox(
        'An existing clinic database was found at:' + #13#10 +
        ExistingClinicDbPath() + #13#10#13#10 +
        'New Installation will NOT delete your database, but Update Existing Installation is recommended when upgrading DNT Dental.' + #13#10#13#10 +
        'Continue with New Installation anyway?',
        mbConfirmation, MB_YESNO) = IDNO then
        Result := False;
    end;
  end;
end;

function IsNewInstallMode(): Boolean;
begin
  Result := IsNewInstall;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  DataDir, ServerDir, EnvExample, EnvFile: String;
begin
  if CurStep = ssPostInstall then
  begin
    DataDir := ExpandConstant('{commonappdata}\DibNova\DNTDental');
    ServerDir := ExpandConstant('{app}\server');
    EnvExample := ServerDir + '\.env.example';
    EnvFile := ServerDir + '\.env';

    if IsNewInstall then
    begin
      ForceDirectories(DataDir + '\data');
      ForceDirectories(DataDir + '\attachments');
      ForceDirectories(DataDir + '\backups');
      ForceDirectories(DataDir + '\logs');
      ForceDirectories(DataDir + '\config');
      ForceDirectories(DataDir + '\license');

      if (not FileExists(EnvFile)) and FileExists(EnvExample) then
        FileCopy(EnvExample, EnvFile, False);
    end;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    MsgBox(
      'DNT Dental has been removed from this computer.' + #13#10#13#10 +
      'Your clinic data was NOT deleted and remains at:' + #13#10 +
      ExpandConstant('{commonappdata}\DibNova\DNTDental'),
      mbInformation, MB_OK);
  end;
end;
