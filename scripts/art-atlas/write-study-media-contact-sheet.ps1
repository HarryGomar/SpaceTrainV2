$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$sheetRepo = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$sheetSite = Join-Path $sheetRepo 'public/art-atlas'
$sheetEvidence = Join-Path $sheetRepo 'qa-output/study-media'
$sheetWorks = Get-Content -LiteralPath (Join-Path $sheetEvidence 'original-99.json') -Raw | ConvertFrom-Json
$sheetManifest = Get-Content -LiteralPath (Join-Path $sheetSite 'study-image-sources.json') -Raw | ConvertFrom-Json
$sheetIds = @('opening-cma-141639','study-kandinsky-composition-eight','study-gericault-raft','study-matisse-dance','study-van-gogh-self-portrait','study-monet-japanese-footbridge','study-posada-catrina','study-tanner-banjo-lesson')
$sheetBitmap = New-Object System.Drawing.Bitmap(1600, 1320)
$sheetGraphics = [System.Drawing.Graphics]::FromImage($sheetBitmap)
$sheetFont = New-Object System.Drawing.Font('Segoe UI', 14)
$sheetSmallFont = New-Object System.Drawing.Font('Segoe UI', 11)
try {
  $sheetGraphics.Clear([System.Drawing.Color]::White)
  $sheetGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  for ($sheetIndex = 0; $sheetIndex -lt $sheetIds.Count; $sheetIndex++) {
    $sheetId = $sheetIds[$sheetIndex]
    $sheetWork = $sheetWorks | Where-Object id -eq $sheetId
    $sheetEntry = $sheetManifest.entries.$sheetId
    $sheetX = ($sheetIndex % 2) * 800
    $sheetY = [int][Math]::Floor($sheetIndex / 2) * 330
    $sheetGraphics.DrawString($sheetWork.title, $sheetFont, [System.Drawing.Brushes]::Black, $sheetX + 12, $sheetY + 8)
    $sheetImages = @($sheetWork.image, $(if ($sheetEntry) { $sheetEntry.imageLarge } else { $sheetWork.image }))
    for ($sheetSide = 0; $sheetSide -lt 2; $sheetSide++) {
      $sheetImage = [System.Drawing.Image]::FromFile((Join-Path $sheetSite $sheetImages[$sheetSide]))
      try {
        $sheetRatio = [Math]::Min(370.0 / $sheetImage.Width, 260.0 / $sheetImage.Height)
        $sheetDrawWidth = [int][Math]::Round($sheetImage.Width * $sheetRatio)
        $sheetDrawHeight = [int][Math]::Round($sheetImage.Height * $sheetRatio)
        $sheetGraphics.DrawImage($sheetImage, $sheetX + $sheetSide * 400 + 12 + [int]((370 - $sheetDrawWidth) / 2), $sheetY + 39, $sheetDrawWidth, $sheetDrawHeight)
        $sheetLabel = $(if ($sheetSide -eq 0) { 'Original small ' } elseif ($sheetEntry) { 'Verified larger ' } else { 'Native only ' }) + $sheetImage.Width + ' x ' + $sheetImage.Height
        $sheetGraphics.DrawString($sheetLabel, $sheetSmallFont, [System.Drawing.Brushes]::Black, $sheetX + $sheetSide * 400 + 12, $sheetY + 305)
      } finally { $sheetImage.Dispose() }
    }
  }
  $sheetOutput = Join-Path $sheetEvidence 'study-media-comparisons.jpg'
  $sheetBitmap.Save($sheetOutput, [System.Drawing.Imaging.ImageFormat]::Jpeg)
  Write-Output $sheetOutput
} finally { $sheetGraphics.Dispose(); $sheetBitmap.Dispose(); $sheetFont.Dispose(); $sheetSmallFont.Dispose() }
