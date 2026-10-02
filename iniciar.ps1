#requires -Version 5.1
[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)][int]$ApiPort = 8000,
    [ValidateRange(1024, 65535)][int]$FrontendPort = 5173,
    [string]$NodePath,
    [switch]$NoBrowser,
    [switch]$ShowErrors,
    [switch]$CheckOnly,
    [switch]$SmokeTest
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'scripts\local-runtime.ps1')
$projectRoot = $PSScriptRoot
$backendPath = Join-Path $projectRoot 'backend'
$frontendPath = Join-Path $projectRoot 'frontend'
$pythonPath = Join-Path $backendPath '.venv\Scripts\python.exe'
$runtimePath = Join-Path $projectRoot '.local'
$statePath = Join-Path $runtimePath 'runtime.json'
$ownedRecords = @()
$mutex = $null
$previousProxy = $env:API_PROXY_TARGET
$previousLocation = Get-Location
$completed = $false

function Assert-FreePort([int]$Port) {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    try { $listener.Start() }
    catch { throw "A porta $Port está ocupada por outro serviço. Feche-o ou escolha portas diferentes. Nenhum processo desconhecido será encerrado." }
    finally { $listener.Stop() }
}

function Wait-LocalServer([string]$Url, [System.Diagnostics.Process]$Process) {
    $deadline = (Get-Date).AddSeconds(45)
    while ((Get-Date) -lt $deadline) {
        if ($Process.HasExited) { throw 'Um serviço encerrou durante a inicialização. Consulte os logs em .local.' }
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { return }
        } catch { Start-Sleep -Milliseconds 300 }
    }
    throw "O serviço não respondeu em $Url. Consulte os logs em .local."
}

try {
    $mutex = Enter-AppLock $projectRoot
    if ($ApiPort -eq $FrontendPort) { throw 'Backend e frontend precisam de portas diferentes.' }
    if (Test-Path -LiteralPath $statePath) {
        try { $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json }
        catch { throw 'O registro dos serviços está ilegível. Consulte .local/runtime.json antes de iniciar novamente.' }
        $runningApi = Get-AppProcess $state.api
        $runningWeb = Get-AppProcess $state.web
        if ($runningApi -and $runningWeb) {
            if ($state.apiPort -ne $ApiPort -or $state.frontendPort -ne $FrontendPort) { throw 'O aplicativo já está aberto com outras portas. Use encerrar.ps1 antes de trocar as portas.' }
            Wait-LocalServer "http://127.0.0.1:$FrontendPort/api/v1/health" $runningWeb
            if (!$NoBrowser -and !$CheckOnly -and !$SmokeTest) { Start-Process "http://127.0.0.1:$FrontendPort" }
            Write-Host "Aplicativo já disponível em http://127.0.0.1:$FrontendPort. Nenhum serviço duplicado."
            $completed = $true
            return
        }
        if ($CheckOnly) { throw 'Há um registro antigo ou incompleto. Execute iniciar.ps1 para recuperar os serviços.' }
        Stop-AppProcess $state.api
        Stop-AppProcess $state.web
        Remove-Item -LiteralPath $statePath
    }
    if (!(Test-Path -LiteralPath $pythonPath)) { throw 'Ambiente Python ausente. Siga a instalação no README.' }
    if (!(Test-Path -LiteralPath (Join-Path $frontendPath 'node_modules\vite\bin\vite.js'))) { throw 'Dependências ausentes. Execute pnpm install --frozen-lockfile na pasta frontend.' }
    if (!(Test-Path -LiteralPath (Join-Path $frontendPath 'dist\index.html'))) { throw 'Interface ainda não preparada. Execute npm run build na pasta frontend.' }
    if (!$NodePath) {
        $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
        if (!$nodeCommand) { throw 'Node.js não encontrado. Instale Node.js 22.12 ou superior e recrie o atalho.' }
        $NodePath = $nodeCommand.Source
    }
    $nodeVersion = [version]((& $NodePath --version).TrimStart('v'))
    if ($nodeVersion -lt [version]'22.12.0') { throw 'Use Node.js 22.12 ou superior.' }
    & $pythonPath -c 'import sys, fastapi, uvicorn, sqlalchemy, pydantic, alembic; assert sys.version_info >= (3, 11)'
    if ($LASTEXITCODE -ne 0) { throw 'Python ou dependências incompatíveis. Refaça a instalação do backend indicada no README.' }
    Assert-FreePort $ApiPort
    Assert-FreePort $FrontendPort
    Set-Location -LiteralPath $backendPath
    'from sqlalchemy import inspect; from app.db.session import engine; assert inspect(engine).has_table("monthly_bills")' | & $pythonPath -
    if ($LASTEXITCODE -ne 0) { throw 'Banco não preparado. Execute as migrations indicadas no README.' }
    if ($CheckOnly) { Write-Host 'Pré-requisitos, banco, build e portas verificados.'; $completed = $true; return }
    New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
    $apiProcess = Start-Process -FilePath $pythonPath -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', "$ApiPort") -WorkingDirectory $backendPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimePath 'api.log') -RedirectStandardError (Join-Path $runtimePath 'api-error.log') -PassThru
    $ownedRecords += Get-ProcessRecord $apiProcess
    Wait-LocalServer "http://127.0.0.1:$ApiPort/api/v1/health" $apiProcess
    $env:API_PROXY_TARGET = "http://127.0.0.1:$ApiPort"
    $webProcess = Start-Process -FilePath $NodePath -ArgumentList @('node_modules/vite/bin/vite.js', 'preview', '--mode', 'personal', '--host', '127.0.0.1', '--port', "$FrontendPort", '--strictPort') -WorkingDirectory $frontendPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimePath 'frontend.log') -RedirectStandardError (Join-Path $runtimePath 'frontend-error.log') -PassThru
    $ownedRecords += Get-ProcessRecord $webProcess
    $env:API_PROXY_TARGET = $previousProxy
    Wait-LocalServer "http://127.0.0.1:$FrontendPort" $webProcess
    $health = Invoke-RestMethod "http://127.0.0.1:$FrontendPort/api/v1/health" -TimeoutSec 5
    if ($health.status -ne 'ok') { throw 'Frontend e backend não estão se comunicando corretamente.' }
    if ($SmokeTest) { Write-Host 'Smoke aprovado: API, interface e proxy responderam; os serviços de teste serão encerrados.'; return }
    @{ api = $ownedRecords[0]; web = $ownedRecords[1]; apiPort = $ApiPort; frontendPort = $FrontendPort } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
    if (!$NoBrowser) { Start-Process "http://127.0.0.1:$FrontendPort" }
    $completed = $true
    Write-Host "Minhas Contas disponível em http://127.0.0.1:$FrontendPort. Para encerrar, use encerrar.ps1."
} catch {
    Show-AppError $_.Exception.Message $ShowErrors.IsPresent
    exit 1
} finally {
    $env:API_PROXY_TARGET = $previousProxy
    if (!$completed) {
        foreach ($record in $ownedRecords) { Stop-AppProcess $record }
        if ($ownedRecords.Count -gt 0 -and (Test-Path -LiteralPath $statePath)) { Remove-Item -LiteralPath $statePath }
    }
    Set-Location -LiteralPath $previousLocation.Path
    if ($mutex) { $mutex.ReleaseMutex(); $mutex.Dispose() }
}
