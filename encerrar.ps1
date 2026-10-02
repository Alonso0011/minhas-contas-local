#requires -Version 5.1
param([switch]$ShowErrors)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'scripts\local-runtime.ps1')
$mutex = $null
try {
    $mutex = Enter-AppLock $PSScriptRoot
    $statePath = Join-Path $PSScriptRoot '.local\runtime.json'
    if (!(Test-Path -LiteralPath $statePath)) { Write-Host 'O aplicativo já está encerrado.'; return }
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    Stop-AppProcess $state.web
    Stop-AppProcess $state.api
    Remove-Item -LiteralPath $statePath
    Write-Host 'Serviços do Minhas Contas encerrados. Suas contas foram preservadas.'
} catch {
    Show-AppError $_.Exception.Message $ShowErrors.IsPresent
    exit 1
} finally {
    if ($mutex) { $mutex.ReleaseMutex(); $mutex.Dispose() }
}
