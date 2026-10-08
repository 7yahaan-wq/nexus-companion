param(
  [string]$SourceDir = 'art/nia-source',
  [string]$OutputDir = '.test-data/nia-keyframes'
)

Add-Type -AssemblyName System.Drawing

$states = @('idle', 'working', 'thinking', 'happy', 'warning', 'error', 'sleepy', 'celebrate')
$cell = 362
$scale = 0.80
$targetX = 181
$targetY = 300
$trimX = 12
$trimY = 8

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

foreach ($state in $states) {
  $sourcePath = Join-Path $SourceDir "$state.png"
  $outputPath = Join-Path $OutputDir "$state.png"
  $source = [System.Drawing.Bitmap]::new((Resolve-Path -LiteralPath $sourcePath).Path)
  try {
    if ($source.Width -ne 1254 -or $source.Height -ne 1254) {
      throw "$state source must be 1254x1254"
    }
    $atlas = [System.Drawing.Bitmap]::new($cell * 4, $cell * 3, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($atlas)
      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

        for ($frame = 0; $frame -lt 12; $frame++) {
          $col = $frame % 4
          $row = [int][Math]::Floor($frame / 4)
          $left = [int][Math]::Round($col * $source.Width / 4)
          $right = [int][Math]::Round(($col + 1) * $source.Width / 4)
          $top = [int][Math]::Round($row * $source.Height / 3)
          $bottom = [int][Math]::Round(($row + 1) * $source.Height / 3)

          # The laptop triangle is common to every pose and stays still in the UI.
          $sumX = 0
          $sumY = 0
          $pixels = 0
          for ($y = 338; $y -lt 405; $y += 2) {
            for ($x = 90; $x -lt 220; $x += 2) {
              $pixel = $source.GetPixel($left + $x, $top + $y)
              if ($pixel.A -gt 180 -and $pixel.B -gt 195 -and $pixel.G -gt 160 -and
                  $pixel.R -gt 110 -and $pixel.B -gt ($pixel.R + 20)) {
                $sumX += $x
                $sumY += $y
                $pixels++
              }
            }
          }
          if ($pixels -lt 12) { throw "$state frame $frame has no reliable laptop anchor" }
          $anchorX = $sumX / $pixels
          $anchorY = $sumY / $pixels

          # Remove the edge where adjacent generated cells can bleed into this one.
          # The inset is made transparent again by placing the crop inside a 362px cell.
          $cropX = $trimX
          $cropY = $trimY
          $cropW = $right - $left - (2 * $trimX)
          $cropH = $bottom - $top - (2 * $trimY)
          $src = [System.Drawing.Rectangle]::new($left + $cropX, $top + $cropY, $cropW, $cropH)
          $dst = [System.Drawing.RectangleF]::new(
            [single]($col * $cell + $targetX + ($cropX - $anchorX) * $scale),
            [single]($row * $cell + $targetY + ($cropY - $anchorY) * $scale),
            [single]($cropW * $scale),
            [single]($cropH * $scale)
          )
          $graphics.DrawImage($source, $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
          Write-Output ("$state frame $frame anchor {0:N1},{1:N1}" -f $anchorX, $anchorY)
        }
      } finally { $graphics.Dispose() }
      $atlas.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $atlas.Dispose() }
  } finally { $source.Dispose() }
}
