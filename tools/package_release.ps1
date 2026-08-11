param(
    [Parameter(Mandatory = $false)]
    [ValidatePattern('^\d{8}T\d{6}Z$')]
    [string]$TimestampUtc
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Add-Type -AssemblyName System.IO.Compression

function Get-Sha256HexFromBytes {
    param([Parameter(Mandatory = $true)][byte[]]$Bytes)

    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hash = $sha.ComputeHash($Bytes)
        return (($hash | ForEach-Object { $_.ToString('x2') }) -join '')
    }
    finally {
        $sha.Dispose()
    }
}

function Add-ZipFileEntry {
    param(
        [Parameter(Mandatory = $true)]$Archive,
        [Parameter(Mandatory = $true)][string]$EntryName,
        [Parameter(Mandatory = $true)][string]$SourcePath,
        [Parameter(Mandatory = $true)][System.DateTimeOffset]$EntryTime
    )

    $entry = $Archive.CreateEntry($EntryName, [System.IO.Compression.CompressionLevel]::Optimal)
    $entry.LastWriteTime = $EntryTime
    $entryStream = $entry.Open()
    $sourceStream = [System.IO.File]::OpenRead($SourcePath)
    try {
        $sourceStream.CopyTo($entryStream)
    }
    finally {
        $sourceStream.Dispose()
        $entryStream.Dispose()
    }
}

function Add-ZipByteEntry {
    param(
        [Parameter(Mandatory = $true)]$Archive,
        [Parameter(Mandatory = $true)][string]$EntryName,
        [Parameter(Mandatory = $true)][byte[]]$Bytes,
        [Parameter(Mandatory = $true)][System.DateTimeOffset]$EntryTime
    )

    $entry = $Archive.CreateEntry($EntryName, [System.IO.Compression.CompressionLevel]::Optimal)
    $entry.LastWriteTime = $EntryTime
    $entryStream = $entry.Open()
    try {
        $entryStream.Write($Bytes, 0, $Bytes.Length)
    }
    finally {
        $entryStream.Dispose()
    }
}

function Get-ZipEntrySha256 {
    param([Parameter(Mandatory = $true)]$Entry)

    $stream = $Entry.Open()
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hash = $sha.ComputeHash($stream)
        return (($hash | ForEach-Object { $_.ToString('x2') }) -join '')
    }
    finally {
        $sha.Dispose()
        $stream.Dispose()
    }
}

function Get-GitSourceMetadata {
    param([Parameter(Mandatory = $true)][string]$Root)

    $fallback = [ordered]@{
        commit = $null
        identity = 'unversioned-verified-dist'
        branch = $null
        tag = $null
        dirty = $null
    }
    if ($null -eq (Get-Command git -ErrorAction SilentlyContinue)) {
        return $fallback
    }

    $inside = @(& git -C $Root rev-parse --is-inside-work-tree 2>$null)
    if ($LASTEXITCODE -ne 0 -or $inside.Count -eq 0 -or $inside[0].Trim() -ne 'true') {
        return $fallback
    }

    $commit = @(& git -C $Root rev-parse HEAD 2>$null)
    if ($LASTEXITCODE -ne 0 -or $commit.Count -eq 0) {
        return $fallback
    }

    $branch = @(& git -C $Root branch --show-current 2>$null)
    $status = @(& git -C $Root status --porcelain --untracked-files=no 2>$null)
    $tag = @(& git -C $Root describe --tags --exact-match HEAD 2>$null)
    $isDirty = $status.Count -gt 0
    $exactTag = if ($LASTEXITCODE -eq 0 -and $tag.Count -gt 0) { $tag[0].Trim() } else { $null }
    $identity = if ($isDirty) {
        'git-dirty-verified-dist'
    }
    elseif ($null -ne $exactTag) {
        'git-tagged-verified-dist'
    }
    else {
        'git-commit-verified-dist'
    }

    return [ordered]@{
        commit = $commit[0].Trim()
        identity = $identity
        branch = if ($branch.Count -gt 0) { $branch[0].Trim() } else { $null }
        tag = $exactTag
        dirty = $isDirty
    }
}

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$distRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'dist'))
$releaseRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'release'))
$packageJsonPath = Join-Path $projectRoot 'package.json'

if (-not (Test-Path -LiteralPath $packageJsonPath -PathType Leaf)) {
    throw "package.json not found: $packageJsonPath"
}
if (-not (Test-Path -LiteralPath $distRoot -PathType Container)) {
    throw "Verified dist directory not found. Run and verify 'npm run build' first: $distRoot"
}
if (-not (Test-Path -LiteralPath (Join-Path $distRoot 'index.html') -PathType Leaf)) {
    throw "dist/index.html is missing; refusing to package an incomplete build."
}
if ([System.IO.Path]::GetPathRoot($projectRoot) -ne [System.IO.Path]::GetPathRoot($releaseRoot)) {
    throw "Release output must remain on the project drive."
}

$package = Get-Content -LiteralPath $packageJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
$packageName = [string]$package.name
$packageVersion = [string]$package.version
if ([string]::IsNullOrWhiteSpace($packageName) -or [string]::IsNullOrWhiteSpace($packageVersion)) {
    throw 'package.json must provide non-empty name and version fields.'
}
if ($packageName -notmatch '^[A-Za-z0-9._-]+$' -or $packageVersion -notmatch '^[A-Za-z0-9._-]+$') {
    throw 'Package name or version contains characters that are unsafe for a release filename.'
}

$invariantCulture = [System.Globalization.CultureInfo]::InvariantCulture
if ([string]::IsNullOrWhiteSpace($TimestampUtc)) {
    $releaseTime = [System.DateTime]::UtcNow
    $TimestampUtc = $releaseTime.ToString("yyyyMMdd'T'HHmmss'Z'", $invariantCulture)
}
else {
    $dateStyles = [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal
    $releaseTime = [System.DateTime]::ParseExact($TimestampUtc, "yyyyMMdd'T'HHmmss'Z'", $invariantCulture, $dateStyles)
}
$releaseTime = [System.DateTime]::SpecifyKind($releaseTime, [System.DateTimeKind]::Utc)
if ($releaseTime.Year -lt 1980) {
    throw 'ZIP entry timestamps must be 1980 or later.'
}
$entryTime = [System.DateTimeOffset]::new($releaseTime)

$excludedSegments = @('.git', '.tmp', 'tmp', 'temp', 'node_modules', 'release', '__pycache__')
$distPrefix = $distRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$sourceFiles = @(Get-ChildItem -LiteralPath $distRoot -Recurse -File | Sort-Object FullName)
if ($sourceFiles.Count -eq 0) {
    throw 'dist contains no files; refusing to create an empty release.'
}

$fileRecords = @()
foreach ($file in $sourceFiles) {
    $fullPath = [System.IO.Path]::GetFullPath($file.FullName)
    if (-not $fullPath.StartsWith($distPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "A dist file resolves outside dist: $fullPath"
    }
    if (($file.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Symbolic links/reparse points are not allowed in the release: $fullPath"
    }

    $relativePath = $fullPath.Substring($distPrefix.Length).Replace('\', '/')
    $segments = $relativePath.Split('/')
    foreach ($segment in $segments) {
        if ($excludedSegments -contains $segment.ToLowerInvariant()) {
            throw "Excluded temporary/dependency path found in dist: $relativePath"
        }
    }

    $fileRecords += [pscustomobject][ordered]@{
        path = $relativePath
        bytes = [int64]$file.Length
        sha256 = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash.ToLowerInvariant()
        sourcePath = $fullPath
    }
}

$manifestFiles = @($fileRecords | ForEach-Object {
    [pscustomobject][ordered]@{
        path = $_.path
        bytes = $_.bytes
        sha256 = $_.sha256
    }
})
$totalBytes = [int64](($fileRecords | Measure-Object -Property bytes -Sum).Sum)
$sourceMetadata = Get-GitSourceMetadata -Root $projectRoot
$manifest = [ordered]@{
    schemaVersion = 1
    product = $packageName
    version = $packageVersion
    createdAtUtc = $releaseTime.ToString('yyyy-MM-ddTHH:mm:ssZ', $invariantCulture)
    entryPoint = 'index.html'
    source = [ordered]@{
        directory = 'dist'
        commit = $sourceMetadata.commit
        identity = $sourceMetadata.identity
        branch = $sourceMetadata.branch
        tag = $sourceMetadata.tag
        dirty = $sourceMetadata.dirty
    }
    deployment = [ordered]@{
        performed = $false
        target = $null
    }
    exclusions = $excludedSegments
    fileCount = $manifestFiles.Count
    totalBytes = $totalBytes
    files = $manifestFiles
}

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$manifestText = ($manifest | ConvertTo-Json -Depth 8) + "`n"
$manifestBytes = $utf8NoBom.GetBytes($manifestText)
$manifestHash = Get-Sha256HexFromBytes -Bytes $manifestBytes

$checksumLines = @($fileRecords | ForEach-Object { "$($_.sha256)  $($_.path)" })
$checksumLines += "$manifestHash  RELEASE-MANIFEST.json"
$checksumText = ($checksumLines -join "`n") + "`n"
$checksumBytes = $utf8NoBom.GetBytes($checksumText)

[System.IO.Directory]::CreateDirectory($releaseRoot) | Out-Null
$artifactBase = "$packageName-v$packageVersion-$TimestampUtc"
$zipPath = Join-Path $releaseRoot "$artifactBase.zip"
$zipHashPath = "$zipPath.sha256"

if (Test-Path -LiteralPath $zipPath) {
    [System.IO.File]::Delete($zipPath)
}
if (Test-Path -LiteralPath $zipHashPath) {
    [System.IO.File]::Delete($zipHashPath)
}

$zipStream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
$archive = [System.IO.Compression.ZipArchive]::new($zipStream, [System.IO.Compression.ZipArchiveMode]::Create, $false, $utf8NoBom)
try {
    foreach ($record in $fileRecords) {
        Add-ZipFileEntry -Archive $archive -EntryName $record.path -SourcePath $record.sourcePath -EntryTime $entryTime
    }
    Add-ZipByteEntry -Archive $archive -EntryName 'RELEASE-MANIFEST.json' -Bytes $manifestBytes -EntryTime $entryTime
    Add-ZipByteEntry -Archive $archive -EntryName 'SHA256SUMS.txt' -Bytes $checksumBytes -EntryTime $entryTime
}
finally {
    $archive.Dispose()
    $zipStream.Dispose()
}

$expectedHashes = @{}
foreach ($record in $fileRecords) {
    $expectedHashes[$record.path] = $record.sha256
}
$expectedHashes['RELEASE-MANIFEST.json'] = $manifestHash

$verifyStream = [System.IO.File]::OpenRead($zipPath)
$verifyArchive = [System.IO.Compression.ZipArchive]::new($verifyStream, [System.IO.Compression.ZipArchiveMode]::Read, $false, $utf8NoBom)
try {
    $entryNames = @($verifyArchive.Entries | ForEach-Object { $_.FullName })
    $expectedEntryCount = $fileRecords.Count + 2
    if ($entryNames.Count -ne $expectedEntryCount) {
        throw "ZIP verification failed: expected $expectedEntryCount entries, found $($entryNames.Count)."
    }
    if (($entryNames | Sort-Object -Unique).Count -ne $entryNames.Count) {
        throw 'ZIP verification failed: duplicate entry names found.'
    }
    foreach ($entry in $verifyArchive.Entries) {
        $entrySegments = $entry.FullName.Split('/')
        foreach ($segment in $entrySegments) {
            if ($excludedSegments -contains $segment.ToLowerInvariant()) {
                throw "ZIP verification failed: excluded path was packaged: $($entry.FullName)"
            }
        }
        if ($expectedHashes.ContainsKey($entry.FullName)) {
            $actualHash = Get-ZipEntrySha256 -Entry $entry
            if ($actualHash -ne $expectedHashes[$entry.FullName]) {
                throw "ZIP verification failed: hash mismatch for $($entry.FullName)."
            }
        }
    }
    if ($entryNames -notcontains 'index.html' -or $entryNames -notcontains 'RELEASE-MANIFEST.json' -or $entryNames -notcontains 'SHA256SUMS.txt') {
        throw 'ZIP verification failed: required release entries are missing.'
    }
}
finally {
    $verifyArchive.Dispose()
    $verifyStream.Dispose()
}

$zipInfo = Get-Item -LiteralPath $zipPath
$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
[System.IO.File]::WriteAllText($zipHashPath, "$zipHash  $($zipInfo.Name)`n", $utf8NoBom)

$result = [ordered]@{
    status = 'verified'
    package = $zipPath
    packageSha256 = $zipHash
    sha256Sidecar = $zipHashPath
    version = $packageVersion
    createdAtUtc = $manifest.createdAtUtc
    gameFileCount = $fileRecords.Count
    zipEntryCount = $fileRecords.Count + 2
    uncompressedGameBytes = $totalBytes
    zipBytes = [int64]$zipInfo.Length
}
$result | ConvertTo-Json -Depth 4
