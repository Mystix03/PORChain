# start_cluster.ps1 — Start a 4-node POR-Chain cluster automatically on Windows

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = (Resolve-Path "$ScriptDir\..").Path

Write-Host "Starting 4-node POR-Chain Cluster..." -ForegroundColor Cyan

# 1. Cleanup old data
Write-Host "Cleaning up old blockchain data..." -ForegroundColor Gray
$Ports = 5000, 5001, 5002, 5003
foreach ($p in $Ports) {
    $path = Join-Path $Root "backend\data_$p"
    if (Test-Path $path) {
        Remove-Item -Recurse -Force $path
    }
}

# 2. Launch Nodes in separate windows
Write-Host "Starting Node A (5000)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root'; . .\scripts\start_node.ps1 5000"

Start-Sleep -Seconds 2

Write-Host "Starting Node B (5001)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root'; . .\scripts\start_node.ps1 5001"

Start-Sleep -Seconds 1

Write-Host "Starting Node C (5002)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root'; . .\scripts\start_node.ps1 5002"

Start-Sleep -Seconds 1

Write-Host "Starting Node D (5003)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root'; . .\scripts\start_node.ps1 5003"

Write-Host "`nCluster started! All 4 windows are open and venv-activated." -ForegroundColor Green
Write-Host "Open your browser to:"
Write-Host " - http://127.0.0.1:5000 (Node A)" -ForegroundColor Yellow
Write-Host " - http://127.0.0.1:5003 (Node D - Gateway)" -ForegroundColor Yellow
