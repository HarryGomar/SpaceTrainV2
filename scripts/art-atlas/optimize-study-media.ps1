$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$mediaRepo = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$mediaSite = Join-Path $mediaRepo 'public/art-atlas'
$mediaManifestPath = Join-Path $mediaSite 'study-image-sources.json'
$mediaManifest = Get-Content -LiteralPath $mediaManifestPath -Raw | ConvertFrom-Json
$mediaOriginalRoot = [System.IO.Path]::GetFullPath((Join-Path $mediaRepo 'qa-output/study-media/originals'))
$mediaLargeRoot = [System.IO.Path]::GetFullPath((Join-Path $mediaSite 'assets/study-large'))
New-Item -ItemType Directory -Path $mediaOriginalRoot -Force | Out-Null
$mediaEncoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$mediaQuality = New-Object System.Drawing.Imaging.EncoderParameters(1)
$mediaQuality.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]90)
$mediaBytesTotal = 0
foreach ($mediaProperty in $mediaManifest.entries.PSObject.Properties) {
  $mediaEntry = $mediaProperty.Value
  $mediaSource = [System.IO.Path]::GetFullPath((Join-Path $mediaSite $mediaEntry.imageLarge))
  if (-not $mediaSource.StartsWith($mediaLargeRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Asset escaped owned study-large directory.' }
  if ($mediaEntry.provenance.transformation -match '1MB image budget' -and [Math]::Max($mediaEntry.largeWidth, $mediaEntry.largeHeight) -le 3200 -and ((Get-FileHash -LiteralPath $mediaSource -Algorithm SHA256).Hash.ToLower()) -eq $mediaEntry.provenance.sha256) {
    $mediaBytesTotal += (Get-Item -LiteralPath $mediaSource).Length
    continue
  }
  $mediaOriginal = [System.IO.Path]::GetFullPath((Join-Path $mediaOriginalRoot ([System.IO.Path]::GetFileName($mediaSource))))
  if (-not $mediaOriginal.StartsWith($mediaOriginalRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Source cache escaped the repository evidence directory.' }
  if (-not (Test-Path -LiteralPath $mediaOriginal)) { Copy-Item -LiteralPath $mediaSource -Destination $mediaOriginal }
  $mediaImage = [System.Drawing.Image]::FromFile($mediaOriginal)
  try {
    $mediaSourceWidth = $mediaImage.Width
    $mediaSourceHeight = $mediaImage.Height
    $mediaLongEdge = 3200.0
    $mediaTemporary = $mediaSource + '.optimized.jpg'
    do {
      $mediaRatio = [Math]::Min(1.0, $mediaLongEdge / [double][Math]::Max($mediaSourceWidth, $mediaSourceHeight))
      $mediaWidth = [int][Math]::Round($mediaSourceWidth * $mediaRatio)
      $mediaHeight = [int][Math]::Round($mediaSourceHeight * $mediaRatio)
      $mediaBitmap = New-Object System.Drawing.Bitmap($mediaWidth, $mediaHeight)
      $mediaGraphics = [System.Drawing.Graphics]::FromImage($mediaBitmap)
      try {
        $mediaGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $mediaGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $mediaGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $mediaGraphics.DrawImage($mediaImage, 0, 0, $mediaWidth, $mediaHeight)
        $mediaBitmap.Save($mediaTemporary, $mediaEncoder, $mediaQuality)
      } finally { $mediaGraphics.Dispose(); $mediaBitmap.Dispose() }
      $mediaTooHeavy = (Get-Item -LiteralPath $mediaTemporary).Length -gt 1000000 -and [Math]::Max($mediaWidth, $mediaHeight) -gt 2000
      if ($mediaTooHeavy) { $mediaLongEdge = if ($mediaLongEdge -gt 2400) { 2400.0 } else { 2000.0 } }
    } while ($mediaTooHeavy)
  } finally { $mediaImage.Dispose() }
  Move-Item -LiteralPath $mediaTemporary -Destination $mediaSource -Force
  $mediaFinal = Get-Item -LiteralPath $mediaSource
  $mediaEntry.provenance | Add-Member -NotePropertyName sourceImageSha256 -NotePropertyValue ((Get-FileHash -LiteralPath $mediaOriginal -Algorithm SHA256).Hash.ToLower()) -Force
  $mediaEntry.provenance | Add-Member -NotePropertyName sourceImageBytes -NotePropertyValue ((Get-Item -LiteralPath $mediaOriginal).Length) -Force
  $mediaEntry.provenance | Add-Member -NotePropertyName downloadedWidth -NotePropertyValue $mediaSourceWidth -Force
  $mediaEntry.provenance | Add-Member -NotePropertyName downloadedHeight -NotePropertyValue $mediaSourceHeight -Force
  $mediaEntry.provenance.sha256 = (Get-FileHash -LiteralPath $mediaSource -Algorithm SHA256).Hash.ToLower()
  $mediaEntry.provenance.bytes = $mediaFinal.Length
  $mediaEntry.provenance.transformation = 'Whole reproduction, aspect ratio preserved; maximum3200px long edge, reduced to2400/2000px when needed for a1MB image budget; JPEG quality90; no upscaling or invented pixels. Download URL and original pixel dimensions retained.'
  $mediaEntry.provenance.verifiedMime = 'image/jpeg'
  $mediaEntry.largeWidth = $mediaWidth
  $mediaEntry.largeHeight = $mediaHeight
  $mediaBytesTotal += $mediaFinal.Length
}
$mediaQuality.Dispose()
$mediaManifest.summary.totalBytes = $mediaBytesTotal
$mediaManifest.generatedAt = [DateTime]::UtcNow.ToString('o')
$mediaManifest | Add-Member -NotePropertyName hostedDerivativePolicy -NotePropertyValue 'Maximum3200px long edge; downsample to2400/2000px for a1MB image budget when needed; JPEG quality90, no upscaling; original downloaded bytes cached only in ignored qa-output/study-media/originals.' -Force
$mediaManifest | ConvertTo-Json -Depth 35 | Set-Content -LiteralPath $mediaManifestPath -Encoding utf8NoBOM
Write-Output ('Hosted assets: ' + @($mediaManifest.entries.PSObject.Properties).Count + '; bytes: ' + $mediaBytesTotal)
