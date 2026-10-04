$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Enter-OcvEnvironment.ps1')
if (-not ('OcvPhysicalPathNative' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class OcvPhysicalPathNative {
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
 static extern SafeFileHandle CreateFile(string path,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
 static extern uint GetFinalPathNameByHandle(SafeFileHandle handle,StringBuilder buffer,uint size,uint flags);
 public static string Resolve(string path) {
  using(var handle=CreateFile(path,0,7,IntPtr.Zero,3,0x02000000,IntPtr.Zero)) {
   if(handle.IsInvalid)throw new System.ComponentModel.Win32Exception();
   var buffer=new StringBuilder(4096);
   if(GetFinalPathNameByHandle(handle,buffer,4096,0)==0)throw new System.ComponentModel.Win32Exception();
   return buffer.ToString();
  }
 }
}
'@
}
$ocvPaths = [ordered]@{
    node='F:\OCVdeps\tools\node\node.exe'
    pnpm='F:\OCVdeps\tools\pnpm\bin\pnpm.cjs'
    dependencies='E:\OmniCivitas\node_modules'
    archiveDependencies='E:\OmniCivitas\services\archive\node_modules'
    portalDependencies=(Join-Path (Split-Path $PSScriptRoot -Parent) 'config/apps\portal\node_modules')
    nextDependencies=(Join-Path (Split-Path $PSScriptRoot -Parent) 'config\apps\web2\node_modules')
    angularDependencies=(Join-Path (Split-Path $PSScriptRoot -Parent) 'config\apps\ng\node_modules')
    nextBuildCache=(Join-Path (Split-Path $PSScriptRoot -Parent) 'config\apps\web2\.next')
    angularBuildCache=(Join-Path (Split-Path $PSScriptRoot -Parent) 'config\apps\ng\.angular')
    generatedPrisma='E:\OmniCivitas\services\gateway\node_modules\.ocv-prisma'
    docker='F:\OCVdeps\docker-app\resources\bin\docker.exe'
    globalPlugin='C:\Program Files\Docker\cli-plugins\docker-compose.exe'
    desktopSettings='F:\OCVdeps\docker-desktop\appdata\Roaming\Docker\settings-store.json'
    desktopLogs='F:\OCVdeps\docker-desktop\appdata\Local\Docker\log\host'
    desktopUi='F:\OCVdeps\docker-desktop\electron'
    dockerDataDisk='F:\OCVdeps\docker-data\disk\docker_data.vhdx'
    dockerBootDisk='F:\OCVdeps\docker-data\main\ext4.vhdx'
    wsl='F:\OCVdeps\wsl-app\wslservice.exe'
    temporary='F:\OCVdeps\tmp'
    wslMaintenanceCache='C:\WINDOWS\Installer\281e930d.msi'
    wslConfig=(Join-Path $env:USERPROFILE '.wslconfig')
    dockerInstallSettings='C:\ProgramData\DockerDesktop\install-settings.json'
}
$ocvPhysical = [ordered]@{}
foreach ($ocvName in $ocvPaths.Keys) {
    $ocvActual = [OcvPhysicalPathNative]::Resolve($ocvPaths[$ocvName])
    if ($ocvName -notin @('wslMaintenanceCache','wslConfig','dockerInstallSettings') -and -not $ocvActual.StartsWith('\\?\F:\OCVdeps\', [StringComparison]::OrdinalIgnoreCase)) { throw "Physical path escaped F: $ocvName => $ocvActual" }
    $ocvPhysical[$ocvName] = [ordered]@{ requested=$ocvPaths[$ocvName]; physical=$ocvActual }
}
[ordered]@{ verifiedAt=[DateTime]::UtcNow.ToString('o'); paths=$ocvPhysical } | ConvertTo-Json -Depth 5 | Set-Content 'F:\OCVdeps\runtime\reports\physical-paths.json' -Encoding UTF8
Write-Output 'PASS: native file handles verify real F: tools, dependencies, data disks and caches; system exceptions are reported separately.'
