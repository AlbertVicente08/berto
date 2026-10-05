$ErrorActionPreference = "Continue"

# Collect all Berto processes
$appProcs = Get-Process -Name "app" -ErrorAction SilentlyContinue
$edgeProcs = Get-Process -Name "msedgewebview2" -ErrorAction SilentlyContinue
$pyConn = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
$pyProc = if ($pyConn) { Get-Process -Id $pyConn.OwningProcess -ErrorAction SilentlyContinue } else { $null }

# Filter webview2 that belong to app or are active
$allProcs = @()
if ($appProcs) { $allProcs += $appProcs }

foreach ($ep in $edgeProcs) {
    # Check if parent is app or one of the webviews
    $wmi = Get-CimInstance Win32_Process -Filter "ProcessId = $($ep.Id)"
    if ($wmi -and ($wmi.CommandLine -like "*1420*" -or $wmi.CommandLine -like "*tauri*" -or $wmi.CommandLine -like "*berto*")) {
        $allProcs += $ep
    } elseif ($wmi -and ($appProcs.Id -contains $wmi.ParentProcessId)) {
        $allProcs += $ep
    }
}

if ($pyProc) { $allProcs += $pyProc }

# Deduplicate
$allProcs = $allProcs | Sort-Object Id -Unique

Write-Host ("Identificados {0} procesos activos de Berto para la medición:" -f $allProcs.Count)
foreach ($p in $allProcs) {
    Write-Host ("  - [{0}] {1} (RAM: {2:N1} MB)" -f $p.Id, $p.ProcessName, ($p.WorkingSet64 / 1MB))
}

$startWall = [System.Diagnostics.Stopwatch]::StartNew()
$initialCpu = @{}
foreach ($p in $allProcs) {
    try { $initialCpu[$p.Id] = $p.TotalProcessorTime.TotalSeconds } catch { $initialCpu[$p.Id] = 0 }
}

$ramHistory = @()
$gpuHistory = @()

Write-Host "`nIniciando medición de 30 segundos continuos con la isla oculta..."
for ($sec = 1; $sec -le 30; $sec++) {
    Start-Sleep -Seconds 1
    
    # RAM
    $totalRam = 0
    foreach ($p in $allProcs) {
        try {
            $p.Refresh()
            $totalRam += $p.WorkingSet64
        } catch {}
    }
    $ramHistory += ($totalRam / 1MB)

    # GPU
    try {
        $samples = (Get-Counter "\GPU Engine(*)\Utilization Percentage" -ErrorAction SilentlyContinue).CounterSamples
        $gpuVal = 0.0
        foreach ($s in $samples) {
            foreach ($p in $allProcs) {
                if ($s.InstanceName -like ("*pid_{0}_*" -f $p.Id)) {
                    $gpuVal += $s.CookedValue
                }
            }
        }
        $gpuHistory += $gpuVal
    } catch {
        $gpuHistory += 0.0
    }

    if ($sec % 5 -eq 0) {
        Write-Host ("  {0}/30 segundos transcurridos..." -f $sec)
    }
}

$startWall.Stop()
$elapsed = $startWall.Elapsed.TotalSeconds

$totalCpuDelta = 0.0
$tableData = @()
foreach ($p in $allProcs) {
    try {
        $p.Refresh()
        $final = $p.TotalProcessorTime.TotalSeconds
        $delta = [Math]::Max(0.0, $final - $initialCpu[$p.Id])
        $totalCpuDelta += $delta
        $tableData += [PSCustomObject]@{
            PID = $p.Id
            Proceso = $p.ProcessName
            "CPU Usada (s)" = [Math]::Round($delta, 3)
            "CPU Media (%)" = [Math]::Round(($delta / $elapsed) * 100, 2)
            "Memoria (MB)" = [Math]::Round($p.WorkingSet64 / 1MB, 2)
        }
    } catch {}
}

$avgCpuPercent = ($totalCpuDelta / $elapsed) * 100
$avgRam = ($ramHistory | Measure-Object -Average).Average
$peakRam = ($ramHistory | Measure-Object -Maximum).Maximum
$avgGpu = ($gpuHistory | Measure-Object -Average).Average
$peakGpu = ($gpuHistory | Measure-Object -Maximum).Maximum

Write-Host "`n====================== RESULTADOS DEL BENCHMARK ======================"
Write-Host ("Duración exacta:         {0:N2} segundos" -f $elapsed)
Write-Host ("Procesos totales:        {0}" -f $allProcs.Count)
Write-Host ("CPU total consumida:     {0:N3} segundos (Media global: {1:N2}%)" -f $totalCpuDelta, $avgCpuPercent)
Write-Host ("Memoria RAM:             Media: {0:N2} MB | Pico: {1:N2} MB" -f $avgRam, $peakRam)
Write-Host ("GPU Real (contadores OS): Media: {0:N2}% | Pico: {1:N2}%" -f $avgGpu, $peakGpu)
Write-Host "======================================================================`n"
$tableData | Format-Table -AutoSize | Out-String | Write-Host
