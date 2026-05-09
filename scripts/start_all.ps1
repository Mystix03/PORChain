# start_all.ps1 — Start the 4-node cluster AND the React Frontend automatically
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = (Resolve-Path "$ScriptDir\..").Path

# 1. Detect Local IP Address
$IP = (
    Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
        $_.IPAddress -notlike "127.*" -and
        $_.InterfaceAlias -notmatch "vEthernet|Loopback|WSL|Bluetooth|Virtual"
    } |
    Select-Object -First 1 -ExpandProperty IPAddress
)

if (!$IP) {
    $IP = "127.0.0.1"
}

Write-Host "------------------------------------------------" -ForegroundColor Cyan
Write-Host "       🚀 POR-CHAIN FULL STACK LAUNCHER" -ForegroundColor Cyan
Write-Host "------------------------------------------------" -ForegroundColor Cyan
Write-Host "  Detected IP : $IP" -ForegroundColor Gray
Write-Host "------------------------------------------------" -ForegroundColor Cyan

# 2. Cleanup Port 4000 and 5000-5003
Write-Host "Cleaning up old processes and data..." -ForegroundColor Gray
$Ports = 4000, 5000, 5001, 5002, 5003
foreach ($p in $Ports) {
    # Kill process on port
    $procId = (Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue).OwningProcess
    if ($procId) { 
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue 
    }
    
    # Cleanup data folders
    if ($p -ge 5000) {
        $path = Join-Path $Root "backend\data_$p"
        if (Test-Path $path) { Remove-Item -Recurse -Force $path }
    }
}

# 3. Start the 4-node Backend Cluster
Write-Host "Starting Backend Cluster..." -ForegroundColor Yellow
& "$Root\scripts\start_cluster.ps1"

Start-Sleep -Seconds 5

# 4. Start the React Frontend in a 5th window (Node 22)
Write-Host "Starting React Frontend Dashboard (Node 22)..." -ForegroundColor Green

$WebDir = Join-Path $Root "apps\web"
$NodeBin = "C:\Users\Mystix\AppData\Roaming\nvm\v22.10.0"

# Complex command to ensure PATH is set correctly and stays in the window
$CmdLine = "cd '$WebDir'; `$env:PATH = '$NodeBin;' + `$env:PATH; npm run dev"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "$CmdLine"

Write-Host "`n✅ ALL SYSTEMS GO!" -ForegroundColor Green
Write-Host "Laptop (Static): http://$($IP):5000" -ForegroundColor Cyan
Write-Host "Phone (React):   http://$($IP):5000" -ForegroundColor Cyan
Write-Host "------------------------------------------------" -ForegroundColor Cyan
