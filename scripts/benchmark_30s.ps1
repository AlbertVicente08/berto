$ErrorActionPreference = "Continue"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$appExe = Join-Path $root "app\src-tauri\target\debug\app.exe"

if (-not (Test-Path $appExe)) {
    Write-Host "Building debug executable first..."
    Push-Location (Join-Path $root "app\src-tauri")
    cargo build
    Pop-Location
}

Write-Host "Starting Berto in --hidden mode..."
$bertoProc = Start-Process -FilePath $appExe -ArgumentList "--hidden" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 3

# Discover all related processes: app.exe, msedgewebview2 children, python
$appId = $bertoProc.Id
$allProcs = @($bertoProc)

# WebView2 children of app
$wmiChildren = Get-CimInstance Win32_Process -Filter "ParentProcessId = $appId"
foreach ($c in $wmiChildren) {
    $p = Get-Process -Id $c.ProcessId -ErrorAction SilentlyContinue
    if ($p) { $allProcs += $p }
    # Also grandchild processes (WebView2 utility/gpu workers)
    $subChildren = Get-CimInstance Win32_Process -Filter "ParentProcessId = $($c.ProcessId)"
    foreach ($sc in $subChildren) {
        $sp = Get-Process -Id $sc.ProcessId -ErrorAction SilentlyContinue
        if ($sp) { $allProcs += $sp }
    }
}

# Python backend (listening on 8765 or child of app)
$pyConn = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pyConn) {
    $pyProc = Get-Process -Id $pyConn.OwningProcess -ErrorAction SilentlyContinue
    if ($pyProc -and ($allProcs.Id -notcontains $pyProc.Id)) {
        $allProcs += $pyProc
    }
}

Write-Host ("Discovered {0} processes related to Berto:" -f $allProcs.Count)
foreach ($p in $allProcs) {
    Write-Host ("  - [{0}] {1}" -f $p.Id, $p.ProcessName)
}

# Initial measurements
$startWall = [System.Diagnostics.Stopwatch]::StartNew()
$initialCpu = @{}
foreach ($p in $allProcs) {
    try {
        $initialCpu[$p.Id] = $p.TotalProcessorTime.TotalSeconds
    } catch {
        $initialCpu[$p.Id] = 0
    }
}

Write-Host "`nMeasuring resource consumption during 30 seconds with island hidden..."
$sampleInterval = 1 # every second
$ramSamples = @()
$gpuSamples = @()

for ($i = 1; $i -le 30; $i++) {
    Start-Sleep -Seconds $sampleInterval
    $currentRam = 0
    foreach ($p in $allProcs) {
        try {
            $p.Refresh()
            $currentRam += $p.WorkingSet64
        } catch {}
    }
    $ramSamples += ($currentRam / 1MB)

    # Windows Performance Counter for GPU utilization across all engines
    try {
        $gpuCounter = (Get-Counter "\GPU Engine(*)\Utilization Percentage" -ErrorAction SilentlyContinue).CounterSamples
        $bertoGpu = 0.0
        foreach ($sample in $gpuCounter) {
            foreach ($p in $allProcs) {
                if ($sample.InstanceName -like ("*pid_{0}_*" -f $p.Id)) {
                    $bertoGpu += $sample.CookedValue
                }
            }
        }
        $gpuSamples += $bertoGpu
    } catch {
        $gpuSamples += 0.0
    }

    if ($i % 5 -eq 0) {
        Write-Host ("  {0}/30 seconds elapsed..." -f $i)
    }
}

$startWall.Stop()
$elapsedWall = $startWall.Elapsed.TotalSeconds

# Final CPU measurements
$totalCpuTime = 0.0
$breakdown = @()
foreach ($p in $allProcs) {
    try {
        $p.Refresh()
        $final = $p.TotalProcessorTime.TotalSeconds
        $delta = [Math]::Max(0.0, $final - $initialCpu[$p.Id])
        $totalCpuTime += $delta
        $breakdown += [PSCustomObject]@{
            PID = $p.Id
            Process = $p.ProcessName
            CpuSeconds = [Math]::Round($delta, 3)
            AvgCpuPercent = [Math]::Round(($delta / $elapsedWall) * 100, 2)
            MemoryMB = [Math]::Round($p.WorkingSet64 / 1MB, 2)
        }
    } catch {}
}

$avgCpuTotalPercent = ($totalCpuTime / $elapsedWall) * 100
$avgRamMB = ($ramSamples | Measure-Object -Average).Average
$peakRamMB = ($ramSamples | Measure-Object -Maximum).Maximum
$avgGpuPercent = ($gpuSamples | Measure-Object -Average).Average
$maxGpuPercent = ($gpuSamples | Measure-Object -Maximum).Maximum

Write-Host "`n================ BENCHMARK RESULTS (30s HIDDEN) ================"
Write-Host ("Duración de medición:    {0:N2} segundos" -f $elapsedWall)
Write-Host ("Total procesos medidos:  {0}" -f $allProcs.Count)
Write-Host ("CPU Total consumida:     {0:N3} s (Media: {1:N2}%)" -f $totalCpuTime, $avgCpuTotalPercent)
Write-Host ("Memoria RAM Media:       {0:N2} MB (Pico: {1:N2} MB)" -f $avgRamMB, $peakRamMB)
Write-Host ("GPU Real (Windows perf): Media: {0:N2}% | Pico: {1:N2}%" -f $avgGpuPercent, $maxGpuPercent)
Write-Host "----------------------------------------------------------------"
$breakdown | Format-Table -AutoSize | Out-String | Write-Host

# Clean shutdown
Write-Host "Closing Berto cleanly..."
$tokenFile = Join-Path $root "data\shutdown_token.txt"
if (Test-Path $tokenFile) {
    $tok = (Get-Content $tokenFile).Trim()
    try {
        Invoke-RestMethod -Uri "http://127.0.0.1:8765/shutdown" -Method Post -Headers @{ "X-Shutdown-Token" = $tok } -TimeoutSec 2 | Out-Null
    } catch {}
}

if (-not $bertoProc.HasExited) {
    $bertoProc.Kill()
    $bertoProc.WaitForExit(3000)
}

foreach ($p in $allProcs) {
    if (-not $p.HasExited) {
        try { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
}
Write-Host "Benchmark completed and all processes cleaned up successfully."
