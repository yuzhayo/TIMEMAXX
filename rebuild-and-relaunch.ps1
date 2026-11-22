$ErrorActionPreference = 'Stop'
$root = $env:TIMEMAXX_FRAME_DIR
if (-not $root) { throw 'TIMEMAXX_FRAME_DIR is not set' }
$exe = Join-Path $root 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path $exe)) { throw "Electron executable not found: $exe" }

$all = @(Get-CimInstance Win32_Process -Filter "Name = 'electron.exe'" | Where-Object {
  $_.ExecutablePath -eq $exe -and $_.CommandLine -like ('*' + $root + '*')
})
$main = @($all | Where-Object { $_.CommandLine -notmatch '--type=' })
if ($main.Count -gt 1) { throw 'More than one Frame main process; refusing to close' }

if ($main.Count -eq 1) {
  $process = Get-Process -Id $main[0].ProcessId -ErrorAction SilentlyContinue
  if ($process) {
    if (-not $process.CloseMainWindow()) { throw 'Frame did not accept normal close' }
    if (-not $process.WaitForExit(15000)) { throw 'Frame did not exit within 15 seconds' }
  }
}

Start-Sleep -Milliseconds 500
$left = @(Get-CimInstance Win32_Process -Filter "Name = 'electron.exe'" | Where-Object {
  $_.ExecutablePath -eq $exe -and $_.CommandLine -like ('*' + $root + '*')
})
if ($left.Count) { throw ('Frame children still alive: ' + ($left.ProcessId -join ',')) }

$workerPath = Join-Path $root 'image-worker\target\release\frame-image-worker.exe'
$workers = @(Get-CimInstance Win32_Process -Filter "Name = 'frame-image-worker.exe'" | Where-Object {
  $_.ExecutablePath -eq $workerPath
})
if ($workers.Count) { throw 'Image worker still alive' }

Write-Output 'Frame closed cleanly'
