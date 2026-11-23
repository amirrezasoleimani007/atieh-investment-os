@echo off
setlocal
set "REPORT_PORT=4177"
set "REPORT_HOME=%~dp0"
powershell -NoProfile -Command "$ErrorActionPreference='Stop'; try { $taskRoot=$env:REPORT_HOME; $nodeCmd=Get-Command node -ErrorAction SilentlyContinue; if(-not $nodeCmd){throw 'Node.js 22.13 or newer is required. Install from https://nodejs.org/ then run this file again.'}; $ready=$false; try{$s=Invoke-RestMethod 'http://127.0.0.1:4177/api/status' -TimeoutSec 2; $ready=$s.applicationVersion -eq '57.0.0'}catch{}; if(-not $ready){$entry=Join-Path $taskRoot 'server\local-report-server.mjs'; Start-Process -FilePath $nodeCmd.Source -ArgumentList ([char]34+$entry+[char]34) -WorkingDirectory $taskRoot -WindowStyle Hidden; for($i=0;$i -lt 15;$i++){Start-Sleep -Milliseconds 300; try{$s=Invoke-RestMethod 'http://127.0.0.1:4177/api/status' -TimeoutSec 2; if($s.applicationVersion -eq '57.0.0'){$ready=$true;break}}catch{}}}; if(-not $ready){throw 'Could not start version 57. Port 4177 may be used by an older report server.'}; Start-Process 'http://127.0.0.1:4177/#report'; Write-Host 'Report 57 is ready. Keep Ollama running.' }catch{Write-Host $_.Exception.Message; exit 1}"
if errorlevel 1 pause
endlocal
