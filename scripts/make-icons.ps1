Add-Type -AssemblyName System.Drawing

$src = "C:\Users\IW076-Jakkit\.gemini\antigravity-ide\brain\683ba36d-f6d4-4ed7-a4ab-2c98fa6403ad\mobaxterm_app_icon_1791525933482.jpg"
$img = [System.Drawing.Image]::FromFile($src)
$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, 0, 0, 256, 256)
$g.Dispose()
$img.Dispose()

if (!(Test-Path "assets")) {
    New-Item -ItemType Directory -Path "assets" | Out-Null
}

$bmp.Save("assets\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Save ICO
$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = New-Object System.IO.FileStream "assets\icon.ico", ([System.IO.FileMode]::Create)
$icon.Save($fs)
$fs.Close()
$bmp.Dispose()

Write-Host "Icons generated successfully in assets folder!"
