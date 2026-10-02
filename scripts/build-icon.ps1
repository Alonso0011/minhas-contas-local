#requires -Version 5.1
# Desenha o símbolo existente em resoluções próprias para atalhos do Windows.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$outputPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'assets\minhas-contas.ico'
New-Item -ItemType Directory -Path (Split-Path $outputPath -Parent) -Force | Out-Null
$images = @()
foreach ($size in @(16, 32, 48, 256)) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = 'AntiAlias'
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#101A2E'))
    $graphics.ScaleTransform($size / 40.0, $size / 40.0)
    $pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#22D3EE'), 2)
    $pen.StartCap = 'Round'
    $pen.EndCap = 'Round'
    $graphics.DrawRectangle($pen, 11, 10, 18, 20)
    $graphics.DrawLine($pen, 15, 15, 25, 15)
    $graphics.DrawLine($pen, 15, 20, 25, 20)
    $graphics.DrawLine($pen, 15, 25, 18, 27)
    $graphics.DrawLine($pen, 18, 27, 24, 22)
    $memory = New-Object System.IO.MemoryStream
    $bitmap.Save($memory, [System.Drawing.Imaging.ImageFormat]::Png)
    $images += @{ size = $size; bytes = $memory.ToArray() }
    $memory.Dispose(); $pen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
$stream = [System.IO.File]::Create($outputPath)
$writer = New-Object System.IO.BinaryWriter($stream)
try {
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$images.Count)
    $offset = 6 + 16 * $images.Count
    foreach ($image in $images) {
        $dimension = if ($image.size -eq 256) { 0 } else { $image.size }
        $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
        $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]32)
        $writer.Write([uint32]$image.bytes.Length); $writer.Write([uint32]$offset)
        $offset += $image.bytes.Length
    }
    foreach ($image in $images) { $writer.Write([byte[]]$image.bytes) }
} finally { $writer.Dispose(); $stream.Dispose() }
Write-Host "Ícone gerado: $outputPath"
