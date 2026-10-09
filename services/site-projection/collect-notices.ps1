$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../../scripts/Enter-OcvEnvironment.ps1')
$ocvProjectionLicenseCache = Join-Path $env:OCV_DEPS_ROOT 'cache/elixir/site-projection/notices'
$ocvProjectionNoticeFolder = Join-Path $PSScriptRoot 'notices'
New-Item -ItemType Directory -Path $ocvProjectionLicenseCache -Force | Out-Null
New-Item -ItemType Directory -Path $ocvProjectionNoticeFolder -Force | Out-Null
$ocvProjectionResolvedPackages = [ordered]@{
    castore = '1.0.21'; cowboy = '2.20.0'; cowboy_telemetry = '0.4.0'; cowlib = '2.21.0'
    jason = '1.4.4'; mime = '2.0.7'; phoenix = '1.7.24'; phoenix_pubsub = '2.4.1'
    phoenix_template = '1.1.0'; plug = '1.20.3'; plug_cowboy = '2.8.1'; plug_crypto = '2.2.0'
    ranch = '2.3.0'; telemetry = '1.4.2'; websock = '0.5.3'; websock_adapter = '0.5.9'
}
$ocvProjectionNoticeIndex = [Collections.Generic.List[object]]::new()
foreach ($ocvProjectionPackage in $ocvProjectionResolvedPackages.GetEnumerator()) {
    $ocvProjectionName = [string]$ocvProjectionPackage.Key
    $ocvProjectionVersion = [string]$ocvProjectionPackage.Value
    $ocvProjectionStem = "$ocvProjectionName-$ocvProjectionVersion"
    $ocvProjectionArchive = Join-Path $ocvProjectionLicenseCache "$ocvProjectionStem.tar"
    $ocvProjectionMetadata = Invoke-RestMethod -Uri "https://hex.pm/api/packages/$ocvProjectionName/releases/$ocvProjectionVersion" -TimeoutSec 30
    if (-not (Test-Path -LiteralPath $ocvProjectionArchive)) {
        Invoke-WebRequest -Uri "https://repo.hex.pm/tarballs/$ocvProjectionStem.tar" -OutFile $ocvProjectionArchive -TimeoutSec 120
    }
    $ocvProjectionArchiveSha = (Get-FileHash -LiteralPath $ocvProjectionArchive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($ocvProjectionMetadata.checksum -and $ocvProjectionArchiveSha -ne $ocvProjectionMetadata.checksum) {
        throw "Hex archive checksum mismatch for $ocvProjectionStem"
    }
    $ocvProjectionContents = Join-Path $ocvProjectionLicenseCache "$ocvProjectionStem.contents.tar.gz"
    $ocvProjectionOuter = [IO.File]::OpenRead($ocvProjectionArchive)
    $ocvProjectionOuterReader = [System.Formats.Tar.TarReader]::new($ocvProjectionOuter, $false)
    try {
        while ($null -ne ($ocvProjectionEntry = $ocvProjectionOuterReader.GetNextEntry())) {
            if ($ocvProjectionEntry.Name -eq 'contents.tar.gz') {
                $ocvProjectionPayload = [IO.File]::Create($ocvProjectionContents)
                try { $ocvProjectionEntry.DataStream.CopyTo($ocvProjectionPayload) } finally { $ocvProjectionPayload.Dispose() }
            }
        }
    } finally { $ocvProjectionOuterReader.Dispose(); $ocvProjectionOuter.Dispose() }
    if (-not (Test-Path -LiteralPath $ocvProjectionContents)) { throw "Missing Hex contents for $ocvProjectionStem" }
    $ocvProjectionInner = [IO.File]::OpenRead($ocvProjectionContents)
    $ocvProjectionGzip = [IO.Compression.GZipStream]::new($ocvProjectionInner, [IO.Compression.CompressionMode]::Decompress)
    $ocvProjectionInnerReader = [System.Formats.Tar.TarReader]::new($ocvProjectionGzip, $false)
    $ocvProjectionWritten = [Collections.Generic.List[string]]::new()
    $ocvProjectionReadmeNotice = $null
    try {
        while ($null -ne ($ocvProjectionEntry = $ocvProjectionInnerReader.GetNextEntry())) {
            if ($ocvProjectionEntry.DataStream -and $ocvProjectionEntry.Name -match '(?i)(^|/)README(\.[^/]*)?$') {
                $ocvProjectionReadmeReader = [IO.StreamReader]::new($ocvProjectionEntry.DataStream, [Text.Encoding]::UTF8, $true, 1024, $true)
                try { $ocvProjectionReadme = $ocvProjectionReadmeReader.ReadToEnd() } finally { $ocvProjectionReadmeReader.Dispose() }
                $ocvProjectionLegalBlock = [regex]::Match($ocvProjectionReadme, '(?ms)^#{1,6}\s+[^\r\n]*Licen[cs]e[^\r\n]*\r?\n(?<notice>.*?)(?=^#{1,6}\s+|\z)')
                if ($ocvProjectionLegalBlock.Success) { $ocvProjectionReadmeNotice = $ocvProjectionLegalBlock.Groups['notice'].Value.Trim() + "`n" }
            }
            if ($ocvProjectionEntry.DataStream -and $ocvProjectionEntry.Name -match '(?i)(^|/)(LICENSE|LICENCE|COPYING|NOTICE)([._-][^/]*)?$') {
                $ocvProjectionLeaf = ($ocvProjectionEntry.Name -replace '[/\\]', '_')
                $ocvProjectionNoticeName = "$ocvProjectionStem-$ocvProjectionLeaf"
                $ocvProjectionNoticeFile = Join-Path $ocvProjectionNoticeFolder $ocvProjectionNoticeName
                $ocvProjectionTarget = [IO.File]::Create($ocvProjectionNoticeFile)
                try { $ocvProjectionEntry.DataStream.CopyTo($ocvProjectionTarget) } finally { $ocvProjectionTarget.Dispose() }
                $ocvProjectionWritten.Add($ocvProjectionNoticeName)
            }
        }
    } finally { $ocvProjectionInnerReader.Dispose(); $ocvProjectionGzip.Dispose(); $ocvProjectionInner.Dispose() }
    if ($ocvProjectionWritten.Count -eq 0 -and $ocvProjectionReadmeNotice) {
        $ocvProjectionReadmeNoticeName = "$ocvProjectionStem-README_LICENSE.txt"
        [IO.File]::WriteAllText((Join-Path $ocvProjectionNoticeFolder $ocvProjectionReadmeNoticeName), $ocvProjectionReadmeNotice, [Text.UTF8Encoding]::new($false))
        $ocvProjectionWritten.Add($ocvProjectionReadmeNoticeName)
    }
    if ($ocvProjectionWritten.Count -eq 0) { throw "No original package license notice found for $ocvProjectionStem" }
    $ocvProjectionNoticeIndex.Add([ordered]@{name=$ocvProjectionName; version=$ocvProjectionVersion; archiveSha256=$ocvProjectionArchiveSha;
        metadata="https://hex.pm/api/packages/$ocvProjectionName/releases/$ocvProjectionVersion"; files=$ocvProjectionWritten.ToArray()})
    Write-Output "Preserved original notices for $ocvProjectionStem"
}
$ocvProjectionApacheCache = Join-Path $ocvProjectionLicenseCache 'APACHE-2.0.txt'
if (-not (Test-Path -LiteralPath $ocvProjectionApacheCache)) {
    Invoke-WebRequest -Uri 'https://www.apache.org/licenses/LICENSE-2.0.txt' -OutFile $ocvProjectionApacheCache -TimeoutSec 30
}
Copy-Item -LiteralPath $ocvProjectionApacheCache -Destination (Join-Path $ocvProjectionNoticeFolder 'APACHE-2.0.txt') -Force
$ocvProjectionManifest = [ordered]@{schema='ocv.web2.notices/1'; source='Actual Hex resolution in phase13-projection-retry-build.log'; packages=$ocvProjectionNoticeIndex.ToArray()}
$ocvProjectionManifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $ocvProjectionNoticeFolder 'manifest.json') -Encoding utf8NoBOM
$ocvProjectionNoticeText = [Collections.Generic.List[string]]::new()
$ocvProjectionNoticeText.Add('# WEB2 dependency notices')
$ocvProjectionNoticeText.Add('')
$ocvProjectionNoticeText.Add('The linked files preserve the original copyright and license text from the exact Hex packages actually fetched for this service. Project code remains covered by the repository license; these dependencies retain their own terms.')
$ocvProjectionNoticeText.Add('')
$ocvProjectionNoticeText.Add('The [Apache License 2.0 full text](notices/APACHE-2.0.txt) accompanies Apache-licensed packages whose original archive provides a copyright notice and license reference in its README. Those README license sections are preserved separately below.')
$ocvProjectionNoticeText.Add('')
foreach ($ocvProjectionPackage in $ocvProjectionNoticeIndex) {
    foreach ($ocvProjectionNoticeName in $ocvProjectionPackage.files) {
        $ocvProjectionNoticeText.Add('- [' + $ocvProjectionPackage.name + ' ' + $ocvProjectionPackage.version + ' / ' + $ocvProjectionNoticeName + '](notices/' + $ocvProjectionNoticeName + ')')
    }
}
$ocvProjectionNoticeText.Add('')
$ocvProjectionNoticeText.Add('Package provenance and archive hashes are recorded in [manifest.json](notices/manifest.json). Downloads and extracted third-party archives remain in the configured external dependency cache; only notices are delivered here.')
$ocvProjectionNoticeText | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'THIRD_PARTY_NOTICES.md') -Encoding utf8NoBOM
