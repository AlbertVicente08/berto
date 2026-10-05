$app = Get-Process -Id 6580 -ErrorAction SilentlyContinue
if ($app) {
    Write-Host "Found app PID: $($app.Id)"
    $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq 6580 }
    foreach ($c in $children) {
        Write-Host "  Child: $($c.ProcessId) $($c.Name)"
        $sub = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $c.ProcessId }
        foreach ($sc in $sub) {
            Write-Host "    Grandchild: $($sc.ProcessId) $($sc.Name)"
        }
    }
} else {
    Write-Host "No process 6580"
}

$pyProcs = Get-Process python -ErrorAction SilentlyContinue
foreach ($p in $pyProcs) {
    Write-Host "Python PID: $($p.Id)"
}
