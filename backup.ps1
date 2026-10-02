#requires -Version 5.1
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'backend\.venv\Scripts\python.exe') (Join-Path $PSScriptRoot 'scripts\backup_database.py')
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível criar o backup. O banco original foi preservado.' }
