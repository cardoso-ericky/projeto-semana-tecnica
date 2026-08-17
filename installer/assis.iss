#define MyAppName "Assis"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Projeto escolar — Biblioteca Regente"

[Setup]
AppId={{E58D80B3-B1B8-4F36-9A55-A12FBF6A0149}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\Assis
DefaultGroupName=Assis
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=..\dist
OutputBaseFilename=Instalar Assis
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayName=Assis
UninstallDisplayIcon={app}\assis.ico
SetupIconFile=assis.ico
CloseApplications=yes
RestartApplications=no
SetupLogging=yes

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
Source: "..\dist\windows\Assis.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "assis.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\Assis"; Filename: "{app}\Assis.exe"; WorkingDir: "{app}"; IconFilename: "{app}\assis.ico"
Name: "{autodesktop}\Assis"; Filename: "{app}\Assis.exe"; WorkingDir: "{app}"; IconFilename: "{app}\assis.ico"

[Run]
Filename: "{app}\Assis.exe"; Description: "Abrir o Assis"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Os dados ficam em AppData\Local\Assis e não são apagados na desinstalação.
Type: filesandordirs; Name: "{app}"
