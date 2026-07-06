# Recale les 4 phases de chaque style : bbox des pixels opaques -> echelle commune
# (par largeur, stable pour un velo) -> ancrage bas-centre identique. Supprime le tressautement.
Add-Type -AssemblyName System.Drawing

$dir = "C:\Users\franc\smartbudget\bowency-site\src\main\resources\static\img\sprites"
$styles = @("cycliste-cartoon", "cycliste-silhouette", "cycliste-realiste")

function Get-Bbox($bmp) {
    $minX = $bmp.Width; $minY = $bmp.Height; $maxX = -1; $maxY = -1
    for ($y = 0; $y -lt $bmp.Height; $y += 2) {          # pas de 2 : suffisant et 4x plus rapide
        for ($x = 0; $x -lt $bmp.Width; $x += 2) {
            if ($bmp.GetPixel($x, $y).A -gt 20) {
                if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
    return @{X=$minX; Y=$minY; W=($maxX-$minX+1); H=($maxY-$minY+1)}
}

foreach ($style in $styles) {
    $frames = 1..4 | ForEach-Object { New-Object System.Drawing.Bitmap((Join-Path $dir "$style-$_.png")) }
    $boxes = $frames | ForEach-Object { Get-Bbox $_ }
    $targetW = 640                                        # largeur utile commune
    # hauteur max apres mise a l echelle par largeur
    $scaledHs = 0..3 | ForEach-Object { [int]($boxes[$_].H * ($targetW / $boxes[$_].W)) }
    $maxH = ($scaledHs | Measure-Object -Maximum).Maximum
    $margin = 20
    $cw = $targetW + 2*$margin; $ch = $maxH + 2*$margin
    for ($i = 0; $i -lt 4; $i++) {
        $b = $boxes[$i]; $scale = $targetW / $b.W
        $sw = [int]($b.W * $scale); $sh = [int]($b.H * $scale)
        $out = New-Object System.Drawing.Bitmap($cw, $ch, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($out)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        # ancrage bas-centre : meme ligne de sol, meme axe pour toutes les phases
        $dx = [int](($cw - $sw) / 2); $dy = $ch - $margin - $sh
        $destRect = New-Object System.Drawing.Rectangle($dx, $dy, $sw, $sh)
        $srcRect  = New-Object System.Drawing.Rectangle($b.X, $b.Y, $b.W, $b.H)
        $g.DrawImage($frames[$i], $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
        $g.Dispose()
        $path = Join-Path $dir "$style-$($i+1).png"
        $frames[$i].Dispose()
        if (Test-Path $path) { Remove-Item $path -Force }
        $out.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
        $out.Dispose()
        "$style-$($i+1) : bbox $($b.W)x$($b.H) -> $($cw)x$($ch) (echelle $([math]::Round($scale,3)))"
    }
}
"ALIGNEMENT TERMINE"
