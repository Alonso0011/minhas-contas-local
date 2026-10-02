#requires -Version 5.1
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'scripts\local-runtime.ps1')
try {
    $desktopPath = [Environment]::GetFolderPath('DesktopDirectory')
    if (!$desktopPath -or !(Test-Path -LiteralPath $desktopPath)) { throw 'Não foi possível localizar a área de trabalho do usuário.' }
    $nodeCommand = Get-Command node -ErrorAction Stop
    $iconPath = Join-Path $PSScriptRoot 'assets\minhas-contas.ico'
    if (!(Test-Path -LiteralPath $iconPath)) { throw 'Ícone do aplicativo ausente. Restaure a pasta assets.' }
    $shell = New-Object -ComObject WScript.Shell
    foreach ($item in @(@{ name = 'Minhas Contas'; script = 'iniciar.ps1' }, @{ name = 'Encerrar Minhas Contas'; script = 'encerrar.ps1' })) {
        $shortcutPath = Join-Path $desktopPath ($item.name + '.lnk')
        if (Test-Path -LiteralPath $shortcutPath) {
            $existing = $shell.CreateShortcut($shortcutPath)
            if (!$existing.Arguments.Contains($PSScriptRoot)) { throw "Já existe outro atalho chamado $($item.name). Renomeie-o antes de continuar." }
        }
        $shortcut = $shell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
        $shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $PSScriptRoot $item.script) + '" -ShowErrors'
        if ($item.script -eq 'iniciar.ps1') { $shortcut.Arguments += ' -NodePath "' + $nodeCommand.Source + '"' }
        $shortcut.WorkingDirectory = $PSScriptRoot
        $shortcut.IconLocation = "$iconPath,0"
        $shortcut.Description = $item.name
        $shortcut.WindowStyle = 7
        $shortcut.Save()
        Write-Host "Atalho criado: $shortcutPath"
    }
} catch {
    Show-AppError $_.Exception.Message $true
    exit 1
}
