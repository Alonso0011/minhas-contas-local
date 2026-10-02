#requires -Version 5.1
# Exercita o lançador com SQLite temporário; nunca altera o banco pessoal.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$launcherPath = Join-Path $projectRoot 'iniciar.ps1'
$stopPath = Join-Path $projectRoot 'encerrar.ps1'
$statePath = Join-Path $projectRoot '.local\runtime.json'
if (Test-Path -LiteralPath $statePath) { throw 'Encerre o aplicativo antes de executar este teste.' }
$previousDatabase = $env:DATABASE_URL
$previousLocation = Get-Location
$testDatabase = Join-Path $projectRoot ('.local\test-' + [guid]::NewGuid().ToString('N') + '.db')
$apiPort = 18000
$webPort = 15173
$baseUrl = "http://127.0.0.1:$webPort/api/v1"
function Start-TestApp {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $launcherPath -ApiPort $apiPort -FrontendPort $webPort -NoBrowser
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar o aplicativo de teste.' }
}
try {
    New-Item -ItemType Directory -Path (Split-Path $testDatabase -Parent) -Force | Out-Null
    $env:DATABASE_URL = 'sqlite:///' + $testDatabase.Replace('\', '/')
    Set-Location -LiteralPath (Join-Path $projectRoot 'backend')
    & .\.venv\Scripts\python.exe -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) { throw 'Falha na preparação do banco temporário.' }
    Set-Location -LiteralPath $env:TEMP
    Start-TestApp
    $bill = Invoke-RestMethod "$baseUrl/bills" -Method Post -ContentType 'application/json' -Body '{"name":"Teste ficticio do lancador","reference_month":"2040-01-01","due_date":"2040-01-15","amount_cents":12345,"status":"PAID"}'
    $before = Get-Content -LiteralPath $statePath -Raw
    Start-TestApp
    if ((Get-Content -LiteralPath $statePath -Raw) -ne $before) { throw 'A segunda abertura duplicou os serviços.' }
    $listeners = Get-NetTCPConnection -State Listen -LocalPort $apiPort,$webPort
    if ($listeners.Count -ne 2 -or @($listeners | Where-Object LocalAddress -ne '127.0.0.1').Count) { throw 'Serviços fora de 127.0.0.1.' }
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $stopPath
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao encerrar.' }
    if (Get-NetTCPConnection -State Listen -LocalPort $apiPort,$webPort -ErrorAction SilentlyContinue) { throw 'Portas não liberadas.' }
    Start-TestApp
    $restored = Invoke-RestMethod "$baseUrl/bills/$($bill.id)"
    if ($restored.amount_cents -ne 12345 -or $restored.status -ne 'PAID' -or $restored.paid_at -ne $bill.paid_at) { throw 'Dados não persistiram após reiniciar.' }
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $stopPath
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao encerrar após reiniciar.' }
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $webPort)
    try {
        $listener.Start()
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $launcherPath -ApiPort $apiPort -FrontendPort $webPort -NoBrowser
        if ($LASTEXITCODE -eq 0) { throw 'Conflito de porta não detectado.' }
        if (!(Get-NetTCPConnection -State Listen -LocalPort $webPort -ErrorAction SilentlyContinue)) { throw 'O iniciador encerrou o serviço alheio.' }
    } finally { $listener.Stop() }
    if (Test-Path -LiteralPath $statePath) { throw 'Sobrou um registro de serviço após encerrar.' }
    Write-Host 'APROVADO: início fora do projeto, reabertura sem duplicatas, loopback, persistência de valor/pagamento após reinício, encerramento e preservação de porta alheia.'
} finally {
    if (Test-Path -LiteralPath $statePath) { & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $stopPath }
    $env:DATABASE_URL = $previousDatabase
    Set-Location -LiteralPath $previousLocation.Path
    if (Test-Path -LiteralPath $testDatabase) { Remove-Item -LiteralPath $testDatabase }
}
