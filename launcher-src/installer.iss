#define MyAppName "VTC Truck Hub Launcher"
#define MyAppVersion "0.9.13"
[Setup]
AppId={{8E88D94F-0DC9-4B23-9D54-A702678E1B2A}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={localappdata}\VTC Truck Hub\Launcher
DefaultGroupName=VTC Truck Hub
OutputDir=..\artifacts
OutputBaseFilename=VTC-Truck-Hub-Launcher-Setup-{#MyAppVersion}
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
Compression=lzma2
SolidCompression=yes
UninstallDisplayIcon={app}\VTC-Truck-Hub-Launcher.exe
[Files]
Source: "publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs
[Icons]
Name: "{autodesktop}\VTC Truck Hub Launcher"; Filename: "{app}\VTC-Truck-Hub-Launcher.exe"
Name: "{group}\VTC Truck Hub Launcher"; Filename: "{app}\VTC-Truck-Hub-Launcher.exe"
Name: "{userstartup}\VTC Truck Hub Launcher"; Filename: "{app}\VTC-Truck-Hub-Launcher.exe"
[Registry]
Root: HKCU; Subkey: "Software\Classes\vtctruckhub"; ValueType: string; ValueName: ""; ValueData: "URL:VTC Truck Hub"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\vtctruckhub"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\vtctruckhub\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\VTC-Truck-Hub-Launcher.exe,0"
Root: HKCU; Subkey: "Software\Classes\vtctruckhub\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\VTC-Truck-Hub-Launcher.exe"" ""%1"""
[Run]
Filename: "{app}\VTC-Truck-Hub-Launcher.exe"; Description: "Launcher starten"; Flags: nowait postinstall skipifsilent
