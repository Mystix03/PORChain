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
Write-Host "       🚀 POR-CHAIN " -ForegroundColor Cyan
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
    
}

# Cleanup ALL data_* folders
Get-ChildItem "$Root\backend\data_*" -Directory -ErrorAction SilentlyContinue |
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue




# 3. Start the 4-node Backend Cluster
Write-Host "Starting Backend Cluster..." -ForegroundColor Yellow
& "$Root\scripts\start_cluster.ps1"

Start-Sleep -Seconds 5

# 4. Start the React Frontend in a 5th window 
Write-Host "Starting React Frontend Dashboard ..." -ForegroundColor Green

$WebDir = Join-Path $Root "apps\web"
$NpmExe = (Get-Command npm).Source

$NodeVersion = node -v
Write-Host "Using Node Version: $NodeVersion" -ForegroundColor Cyan

# Complex command to ensure PATH is set correctly and stays in the window
$CmdLine = "cd '$WebDir'; & '$NpmExe' run dev"

Start-Process powershell `
    -WindowStyle Minimized `
    -ArgumentList "-NoExit", "-Command", "$CmdLine"

Write-Host "------------------------------------------------" -ForegroundColor Cyan

# 5. Start the ML Oracle Sidecar
Write-Host "Starting ML Misbehavior Oracle..." -ForegroundColor Magenta

# Locate Virtual Environment path
$VenvFound = ""
if (Test-Path (Join-Path $Root ".venv")) {
    $VenvFound = Join-Path $Root ".venv"
}
elseif (Test-Path (Join-Path $Root "venv")) {
    $VenvFound = Join-Path $Root "venv"
}

$OracleDir = Join-Path $Root "scripts\ml-oracle"
$ActivateScript = if ($VenvFound) { Join-Path $VenvFound "Scripts\Activate.ps1" } else { "" }

# Build the final chained command for the sub-shell
if ($ActivateScript -and (Test-Path $ActivateScript)) {
    $OracleCmd = "cd '$OracleDir'; . '$ActivateScript'; python oracle.py"
} else {
    $OracleCmd = "cd '$OracleDir'; python oracle.py"
}

Start-Process powershell `
    -WindowStyle Minimized `
    -ArgumentList "-NoExit", "-Command", "$OracleCmd"

# 6. Start the Attack Simulator (Interactive)
Write-Host "Starting Attack Simulator (Interactive)..." -ForegroundColor Red
$SimulatorCmd = "cd '$Root'; . '$ActivateScript'; python scripts/attack_simulator.py"

Start-Process powershell `
    -ArgumentList "-NoExit", "-Command", "$SimulatorCmd"

Write-Host "`n✅ ALL SYSTEMS GO!" -ForegroundColor Green
Write-Host "Laptop (Static): http://$($IP):4000" -ForegroundColor Cyan
Write-Host "Phone (React):   http://$($IP):4000" -ForegroundColor Cyan
Write-Host "------------------------------------------------" -ForegroundColor Cyan