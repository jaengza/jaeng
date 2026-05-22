# kesineTrader Hub - Backup Script v4
# Run: powershell -ExecutionPolicy Bypass -File backup_now.ps1

$base  = "G:\My Drive\jaeng"
$broot = "G:\My Drive\jaeng_backups"
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$bdir  = [System.IO.Path]::Combine($broot, "backup_" + $stamp)
$sep   = "=" * 60

Write-Host $sep
Write-Host "  kesineTrader Hub --- BACKUP TO GOOGLE DRIVE"
Write-Host $sep
Write-Host ""
Write-Host "[1] Source : $base"
Write-Host "[2] Target : $bdir"
Write-Host ""

# Create backup dir
if (-not (Test-Path $broot)) { 
    New-Item -ItemType Directory -Path $broot | Out-Null 
}
New-Item -ItemType Directory -Path $bdir | Out-Null

# Copy files
Write-Host "[3] Copying files..."

$items = @("index.html")
foreach ($item in $items) {
    $src = [System.IO.Path]::Combine($base, $item)
    if (Test-Path $src) {
        Copy-Item $src $bdir -Force
        Write-Host "    OK  $item"
    }
}

# Copy by extension
foreach ($ext in @("*.md","*.json","*.bat","*.ps1","*.js")) {
    $found = Get-ChildItem $base -Filter $ext -File -ErrorAction SilentlyContinue
    foreach ($f in $found) {
        Copy-Item $f.FullName $bdir -Force
        Write-Host "    OK  $($f.Name)"
    }
}

# Copy folders
foreach ($folder in @("css","js")) {
    $src = [System.IO.Path]::Combine($base, $folder)
    $dst = [System.IO.Path]::Combine($bdir, $folder)
    if (Test-Path $src) {
        Copy-Item $src $dst -Recurse -Force
        Write-Host "    OK  $folder/"
    }
}

Write-Host ""

# Count backup files
$count = (Get-ChildItem $bdir -Recurse -File).Count
Write-Host "[4] Backup complete: $count files copied"
Write-Host ""

# Keep only last 10 backups
$allBackups = Get-ChildItem $broot -Directory | Sort-Object Name
$total = $allBackups.Count
Write-Host "[5] Total backups: $total (max 10 kept)"
if ($total -gt 10) {
    $keep = $total - 10
    $toDelete = $allBackups | Select-Object -First $keep
    foreach ($d in $toDelete) {
        Remove-Item $d.FullName -Recurse -Force
        Write-Host "    Removed: $($d.Name)"
    }
}

Write-Host ""
Write-Host "[6] Current backups:"
Get-ChildItem $broot -Directory | Sort-Object Name | ForEach-Object {
    Write-Host "    - $($_.Name)"
}

Write-Host ""
Write-Host $sep
Write-Host "  [DONE] Backup saved! Google Drive will sync automatically."
Write-Host "  Path: $bdir"
Write-Host $sep
Write-Host ""
