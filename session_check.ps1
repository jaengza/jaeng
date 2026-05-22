# kesineTrader Hub - Session Start Check Script v4
# Run: powershell -ExecutionPolicy Bypass -File session_check.ps1

$base = "G:\My Drive\jaeng"
$sep  = "=" * 60

Write-Host $sep
Write-Host "  kesineTrader Hub --- SESSION START CHECK v4.0"
Write-Host $sep

# [1] Machine & Time
$machine = [System.Environment]::MachineName
$now     = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Host "[1] Computer : $machine"
Write-Host "[2] DateTime : $now"
Write-Host ""

# [2] Google Drive
$gdOK = Test-Path $base
if ($gdOK) {
    Write-Host "[3] Google Drive : CONNECTED - $base"
} else {
    Write-Host "[3] Google Drive : NOT FOUND - $base"
    Write-Host "    >>> Please start Google Drive Desktop first <<<"
}
Write-Host ""

# [3] File Integrity Check
$fileList = @(
    "index.html","css/style.css","js/app.js","js/market.js",
    "js/indicators.js","js/analysis.js","js/calculator.js",
    "MEMORY_LOG.md","WORKFLOW.md","SESSION_START.md","session_state.json"
)
Write-Host "[4] File Integrity Check ($($fileList.Count) files):"
$okCount   = 0
$failCount = 0
foreach ($f in $fileList) {
    $p = [System.IO.Path]::Combine($base, $f.Replace("/", "\"))
    if (Test-Path $p) {
        $okCount++
        Write-Host "    [OK]   $f"
    } else {
        $failCount++
        Write-Host "    [MISS] $f  <-- NOT FOUND!"
    }
}
Write-Host ""
Write-Host "[5] Result : $okCount / $($okCount + $failCount) files OK"
Write-Host ""

# [4] Session State Update
$statePath = [System.IO.Path]::Combine($base, "session_state.json")
if (Test-Path $statePath) {
    try {
        $raw   = [System.IO.File]::ReadAllText($statePath, [System.Text.Encoding]::UTF8)
        $state = $raw | ConvertFrom-Json

        $lastMachine = $state.last_session.machine
        $lastTime    = $state.last_session.timestamp

        Write-Host "[6] Last Session:"
        Write-Host "    Machine : $lastMachine"
        Write-Host "    Time    : $lastTime"
        Write-Host "    Version : $($state.version)"

        # Update fields
        $state.last_session.machine   = $machine
        $state.last_session.timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz")

        $updated = $state | ConvertTo-Json -Depth 10
        [System.IO.File]::WriteAllText($statePath, $updated, [System.Text.Encoding]::UTF8)
        Write-Host "    Status  : Updated OK"
    } catch {
        Write-Host "[6] ERROR reading session_state.json: $_"
    }
} else {
    Write-Host "[6] session_state.json not found - skipping"
}

Write-Host ""
Write-Host $sep
if ($okCount -eq $fileList.Count -and $gdOK) {
    Write-Host "  [PASS] ALL CHECKS PASSED - Ready to work!"
} else {
    Write-Host "  [WARN] Some checks failed - see above"
}
Write-Host "  Machine : $machine"
Write-Host "  Files   : $okCount/$($okCount + $failCount)"
Write-Host $sep
Write-Host ""
