# Genere les icones PNG de l'extension avec System.Drawing (16, 32, 48, 128 px + versions grises).
# Dessin : une barre de fraction au-dessus de « 20 », sur un carre arrondi.
# Usage : powershell -ExecutionPolicy Bypass -File icons\generer-icones.ps1
Add-Type -AssemblyName System.Drawing
$dossier = Split-Path -Parent $MyInvocation.MyCommand.Path
$echelle = 8   # dessin en 8x puis reduction : contours nets meme en 16 px

# Proportions (fraction du cote). En 16 px, le dessin est elargi pour rester lisible.
$formats = @{
    16  = @{ Rayon = 0.20; Gauche = 0.125; Droite = 0.875; Barre = 0.1875; Epais = 0.11; Haut = 0.385; Bas = 0.84 }
    32  = @{ Rayon = 0.21; Gauche = 0.170; Droite = 0.830; Barre = 0.2300; Epais = 0.085; Haut = 0.400; Bas = 0.80 }
    48  = @{ Rayon = 0.22; Gauche = 0.195; Droite = 0.805; Barre = 0.2500; Epais = 0.075; Haut = 0.405; Bas = 0.78 }
    128 = @{ Rayon = 0.22; Gauche = 0.205; Droite = 0.795; Barre = 0.2600; Epais = 0.070; Haut = 0.410; Bas = 0.77 }
}

function New-CheminArrondi([float]$x, [float]$y, [float]$l, [float]$h, [float]$r) {
    $d = 2 * $r
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddArc($x, $y, $d, $d, 180, 90)
    $p.AddArc($x + $l - $d, $y, $d, $d, 270, 90)
    $p.AddArc($x + $l - $d, $y + $h - $d, $d, $d, 0, 90)
    $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $p.CloseFigure()
    return , $p
}

function Export-Icone([int]$taille, [System.Drawing.Color]$fond, [string]$suffixe) {
    $f = $formats[$taille]
    $c = $taille * $echelle
    $grand = New-Object System.Drawing.Bitmap $c, $c
    $g = [System.Drawing.Graphics]::FromImage($grand)
    $g.SmoothingMode = 'AntiAlias'
    $g.Clear([System.Drawing.Color]::Transparent)
    $blanc = [System.Drawing.Brushes]::White

    # Fond
    $g.FillPath((New-Object System.Drawing.SolidBrush $fond), (New-CheminArrondi 0 0 $c $c ($c * $f.Rayon)))

    # Barre de fraction
    $largeur = ($f.Droite - $f.Gauche) * $c
    $epais = $f.Epais * $c
    $g.FillPath($blanc, (New-CheminArrondi ($f.Gauche * $c) ($f.Barre * $c) $largeur $epais ($epais * 0.3)))

    # « 20 », ajuste exactement au cadre voulu
    $texte = New-Object System.Drawing.Drawing2D.GraphicsPath
    $famille = New-Object System.Drawing.FontFamily 'Segoe UI Semibold'
    $texte.AddString('20', $famille, 0, 100.0, (New-Object System.Drawing.PointF 0, 0), [System.Drawing.StringFormat]::GenericTypographic)
    $b = $texte.GetBounds()
    $cible = New-Object System.Drawing.RectangleF ($f.Gauche * $c), ($f.Haut * $c), $largeur, (($f.Bas - $f.Haut) * $c)
    $m = New-Object System.Drawing.Drawing2D.Matrix
    $m.Translate($cible.X, $cible.Y)
    $m.Scale($cible.Width / $b.Width, $cible.Height / $b.Height)
    $m.Translate(-$b.X, -$b.Y)
    $texte.Transform($m)
    $g.FillPath($blanc, $texte)
    $g.Dispose()

    # Reduction
    $bmp = New-Object System.Drawing.Bitmap $taille, $taille
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = 'HighQualityBicubic'
    $g.PixelOffsetMode = 'HighQuality'
    $g.CompositingMode = 'SourceCopy'
    $attr = New-Object System.Drawing.Imaging.ImageAttributes
    $attr.SetWrapMode('TileFlipXY')
    $g.DrawImage($grand, (New-Object System.Drawing.Rectangle 0, 0, $taille, $taille), 0, 0, $c, $c, 'Pixel', $attr)
    $bmp.Save((Join-Path $dossier "icon$taille$suffixe.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose(); $grand.Dispose()
}

$vert = [System.Drawing.Color]::FromArgb(14, 106, 74)
$gris = [System.Drawing.Color]::FromArgb(125, 133, 129)

foreach ($taille in 16, 32, 48, 128) { Export-Icone $taille $vert '' }
foreach ($taille in 16, 32) { Export-Icone $taille $gris '-off' }
Write-Output 'Icones generees.'
