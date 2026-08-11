param(
  [string]$InputDir = "public\assets\models",
  [string]$OutputDir = ".tmp\ktx2-models",
  [string]$KtxBin = ".tools\ktx\bin",
  [int]$Jobs = 4
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$inputPath = (Resolve-Path (Join-Path $projectRoot $InputDir)).Path
$outputPath = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputDir))
$ktxPath = (Resolve-Path (Join-Path $projectRoot $KtxBin)).Path
$gltfTransform = Join-Path $projectRoot "node_modules\.bin\gltf-transform.cmd"
$toktx = Join-Path $ktxPath "toktx.exe"

if (-not (Test-Path -LiteralPath $gltfTransform)) {
  throw "Missing glTF Transform CLI at $gltfTransform"
}
if (-not (Test-Path -LiteralPath $toktx)) {
  throw "Missing Khronos toktx at $toktx"
}
if ($inputPath -eq $outputPath) {
  throw "OutputDir must differ from InputDir; compression is validated before runtime assets are replaced."
}

New-Item -ItemType Directory -Force -Path $outputPath | Out-Null
$env:Path = "$ktxPath;$env:Path"
$sources = @(Get-ChildItem -LiteralPath $inputPath -Filter "*.glb" -File | Sort-Object Name)
if ($sources.Count -eq 0) {
  throw "No GLB assets found in $inputPath"
}

$sourceBytes = 0L
$outputBytes = 0L
foreach ($source in $sources) {
  $sourceBytes += $source.Length
  $intermediate = Join-Path $outputPath ($source.BaseName + ".normal-uastc.glb")
  $destination = Join-Path $outputPath $source.Name

  & $gltfTransform uastc $source.FullName $intermediate `
    --slots normalTexture --level 2 --rdo --rdo-lambda 0.5 --zstd 18 --jobs $Jobs
  if ($LASTEXITCODE -ne 0) { throw "UASTC compression failed for $($source.Name)" }

  & $gltfTransform etc1s $intermediate $destination `
    --slots "{baseColorTexture,metallicRoughnessTexture}" --quality 180 --compression 2 --jobs $Jobs
  if ($LASTEXITCODE -ne 0) { throw "ETC1S compression failed for $($source.Name)" }

  Remove-Item -LiteralPath $intermediate -Force
  $outputBytes += (Get-Item -LiteralPath $destination).Length
}

$savedBytes = $sourceBytes - $outputBytes
$savedPercent = if ($sourceBytes -gt 0) { [Math]::Round($savedBytes / $sourceBytes * 100, 1) } else { 0 }
[pscustomobject]@{
  Assets = $sources.Count
  SourceBytes = $sourceBytes
  OutputBytes = $outputBytes
  SavedBytes = $savedBytes
  SavedPercent = $savedPercent
  OutputDirectory = $outputPath
} | Format-List
