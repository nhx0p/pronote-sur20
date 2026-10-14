# Génère les icônes PNG de l'extension (16, 32, 48, 128 px) avec System.Drawing.
# Usage : powershell -ExecutionPolicy Bypass -File icons\generer-icones.ps1
Add-Type -AssemblyName System.Drawing
$dossier = Split-Path -Parent $MyInvocation.MyCommand.Path

foreach ($taille in 16, 32, 48, 128) {
    $bmp = New-Object System.Drawing.Bitmap $taille, $taille
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.TextRenderingHint = 'AntiAliasGridFit'
    $g.Clear([System.Drawing.Color]::Transparent)

    # Carré arrondi vert
    $r = [Math]::Max(3, [int]($taille * 0.22))
    $chemin = New-Object System.Drawing.Drawing2D.GraphicsPath
    $chemin.AddArc(0, 0, $r, $r, 180, 90)
    $chemin.AddArc($taille - $r - 1, 0, $r, $r, 270, 90)
    $chemin.AddArc($taille - $r - 1, $taille - $r - 1, $r, $r, 0, 90)
    $chemin.AddArc(0, $taille - $r - 1, $r, $r, 90, 90)
    $chemin.CloseFigure()
    $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(19, 115, 51))), $chemin)

    # Texte « 20 » (« /20 » à partir de 48 px)
    $texte = if ($taille -ge 48) { '/20' } else { '20' }
    $police = New-Object System.Drawing.Font 'Segoe UI', ($taille * 0.42), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = 'Center'
    $format.LineAlignment = 'Center'
    $rect = New-Object System.Drawing.RectangleF 0, 0, $taille, $taille
    $g.DrawString($texte, $police, [System.Drawing.Brushes]::White, $rect, $format)

    $bmp.Save((Join-Path $dossier "icon$taille.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
}
Write-Output 'Icônes générées.'
