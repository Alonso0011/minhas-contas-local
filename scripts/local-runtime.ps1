#requires -Version 5.1
# PID, criação e executável identificam os serviços para não encerrar outros programas.
function Get-AppProcess($Record) {
    if (!$Record) { return $null }
    $candidate = Get-Process -Id $Record.id -ErrorAction SilentlyContinue
    if (!$candidate) { return $null }
    try {
        if ($candidate.StartTime.ToUniversalTime().Ticks.ToString() -eq $Record.started -and $candidate.Path -eq $Record.path) { return $candidate }
    } catch { return $null }
    return $null
}

function Get-ProcessRecord([System.Diagnostics.Process]$Process) {
    return @{ id = $Process.Id; started = $Process.StartTime.ToUniversalTime().Ticks.ToString(); path = $Process.Path }
}

function Stop-AppProcess($Record) {
    $ownedProcess = Get-AppProcess $Record
    if ($ownedProcess) {
        & taskkill.exe /PID $ownedProcess.Id /T /F | Out-Null
        if ($LASTEXITCODE -ne 0 -and (Get-AppProcess $Record)) { throw 'Não foi possível encerrar um dos serviços do aplicativo.' }
        $ownedProcess.WaitForExit(5000) | Out-Null
    }
}

function Enter-AppLock([string]$Root) {
    $hasher = [System.Security.Cryptography.SHA256]::Create()
    try { $key = [BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($Root.ToLowerInvariant()))).Replace('-', '') }
    finally { $hasher.Dispose() }
    $mutex = New-Object System.Threading.Mutex($false, "Local\MinhasContas-$key")
    try { $acquired = $mutex.WaitOne(60000) }
    catch [System.Threading.AbandonedMutexException] { $acquired = $true }
    if (!$acquired) { $mutex.Dispose(); throw 'Outra abertura está em andamento. Aguarde um momento e tente novamente.' }
    return $mutex
}

function Show-AppError([string]$Message, [bool]$Dialog) {
    Write-Host "Minhas Contas: $Message" -ForegroundColor Red
    if ($Dialog) {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show($Message, 'Minhas Contas', 'OK', 'Error') | Out-Null
    }
}
