param([string]$Source, [string]$Nom)
# Detoure le fond vert d'une video et produit un WebM VP9 avec canal alpha
# + une premiere frame PNG detouree (poster / fallback).
$ErrorActionPreference = "Stop"

$ff = Get-Command ffmpeg -ErrorAction SilentlyContinue
if (-not $ff) {
    $cand = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cand) { $ff = $cand.FullName } else { throw "ffmpeg introuvable" }
} else { $ff = $ff.Source }

$outDir = "C:\Users\franc\smartbudget\bowency-site\src\main\resources\static\video"
New-Item -ItemType Directory -Force $outDir | Out-Null
$webm = Join-Path $outDir "$Nom.webm"
$poster = Join-Path $outDir "$Nom.png"

# chromakey : tolerance 0.30, lissage 0.10 ; despill pour tuer la frange verte.
# VP9 + yuva420p = canal alpha lu par Chrome/Edge/Firefox.
& $ff -y -i $Source -vf "chromakey=0x00FF00:0.30:0.10,despill=type=green" `
  -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 30 -auto-alt-ref 0 -an $webm

# Poster : premiere frame detouree en PNG (fallback et affichage initial)
& $ff -y -i $Source -vf "chromakey=0x00FF00:0.30:0.10,despill=type=green" -frames:v 1 $poster

"WEBM : $webm ($([int]((Get-Item $webm).Length/1KB)) Ko)"
"POSTER : $poster ($([int]((Get-Item $poster).Length/1KB)) Ko)"
