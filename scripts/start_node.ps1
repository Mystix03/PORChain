# start_node.ps1 — Launch a POR-Chain node on Windows
# Usage:   .\scripts\start_node.ps1 [PORT] [PEERS]

param (
    [int]$Port = 5000,
    [string]$Peers = ""
)

$ErrorActionPreference = "Stop"

# Setup Paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = (Resolve-Path "$ScriptDir\..").Path
$Backend = Join-Path $Root "backend"
$Venv = Join-Path $Root "venv"
$DataDir = Join-Path $Backend "data_$Port"

Write-Host "------------------------------------------------" -ForegroundColor Cyan
Write-Host "        POR-Chain Node Starting Up            " -ForegroundColor Cyan
Write-Host "------------------------------------------------" -ForegroundColor Cyan
Write-Host "  Port  : $Port" -ForegroundColor Cyan
if ($Peers) {
    Write-Host "  Peers : $Peers" -ForegroundColor Cyan
} else {
    Write-Host "  Peers : none" -ForegroundColor Cyan
}
Write-Host "------------------------------------------------" -ForegroundColor Cyan

# 1. Virtual Environment Activation
$ActivateScript = Join-Path $Venv "Scripts\Activate.ps1"
if (Test-Path $ActivateScript) {
    Write-Host "Activating Virtual Environment..." -ForegroundColor Gray
    Write-Host "Venv Path: $Venv" -ForegroundColor Gray
    . $ActivateScript
} else {
    Write-Host "Warning: venv activation script not found at $ActivateScript" -ForegroundColor Yellow
}

# 2. Setup Data Directory
if (!(Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
}

Write-Host "Data dir : $DataDir" -ForegroundColor Gray

# 3. Set Environment Variables
$env:NODE_PORT = $Port
$env:PEERS = $Peers
$env:DATA_DIR = $DataDir
$env:PYTHONPATH = $Backend

# 4. Launch Node
# We use Push-Location / Pop-Location so you return to your original dir after Ctrl+C
Push-Location $Backend
try {
    Write-Host "Starting node on port $Port..." -ForegroundColor Green
    python main.py
}
finally {
    Pop-Location
    Write-Host "Returned to: $(Get-Location)" -ForegroundColor Gray
}
