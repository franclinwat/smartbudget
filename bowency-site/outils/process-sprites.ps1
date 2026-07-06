param([string[]]$Pairs)
# $Pairs : "cheminSource|nomStyle" — decoupe 4 cases + chroma key vert -> PNG transparents
Add-Type -AssemblyName System.Drawing

$outDir = "C:\Users\franc\AppData\Local\Temp\claude\C--Users-franc-Desktop\91ee0052-c0dc-4a09-b11d-3fcc92c56ea8\scratchpad\sprites"
New-Item -ItemType Directory -Force $outDir | Out-Null

foreach ($pair in $Pairs) {
    $parts = $pair.Split('|')
    $src = $parts[0]; $style = $parts[1]
    $sheet = New-Object System.Drawing.Bitmap($src)
    $cw = [int]($sheet.Width / 4); $ch = $sheet.Height
    for ($c = 0; $c -lt 4; $c++) {
        $w = $cw; $x0 = $c * $cw
        $tile = New-Object System.Drawing.Bitmap($w, $ch, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        for ($y = 0; $y -lt $ch; $y++) {
            for ($x = 0; $x -lt $w; $x++) {
                $p = $sheet.GetPixel($x0 + $x, $y)
                # chroma key : vert dominant -> transparent (tolerant)
                $isGreen = ($p.G -gt 90) -and ($p.G -gt ($p.R * 1.35)) -and ($p.G -gt ($p.B * 1.35))
                if ($isGreen) {
                    $tile.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
                } else {
                    # despill : reduit la frange verte sur les bords
                    $g = $p.G
                    if (($p.G -gt $p.R) -and ($p.G -gt $p.B)) { $g = [int](([int]$p.R + [int]$p.B) / 2 * 0.4 + $p.G * 0.6) }
                    $tile.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($p.A, $p.R, $g, $p.B))
                }
            }
        }
        $out = Join-Path $outDir ("$style-" + ($c + 1) + ".png")
        if (Test-Path $out) { Remove-Item $out -Force }
        $tile.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
        $tile.Dispose()
        "$style-$($c+1).png : $([int]((Get-Item $out).Length/1KB)) Ko"
    }
    $sheet.Dispose()
}
"TERMINE"
