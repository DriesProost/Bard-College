@echo off
setlocal
cd /d "%~dp0"
echo Assembling Bard's College 1.3.0 Windows installer...
if not exist "Bards-College-Setup-1.3.0-x64.exe.part01" (echo Missing Bards-College-Setup-1.3.0-x64.exe.part01. Extract the complete ZIP first. & pause & exit /b 1)
if not exist "Bards-College-Setup-1.3.0-x64.exe.part02" (echo Missing Bards-College-Setup-1.3.0-x64.exe.part02. Extract the complete ZIP first. & pause & exit /b 1)
if not exist "Bards-College-Setup-1.3.0-x64.exe.part03" (echo Missing Bards-College-Setup-1.3.0-x64.exe.part03. Extract the complete ZIP first. & pause & exit /b 1)
copy /b "Bards-College-Setup-1.3.0-x64.exe.part01"+"Bards-College-Setup-1.3.0-x64.exe.part02"+"Bards-College-Setup-1.3.0-x64.exe.part03" "Bards-College-Setup-1.3.0-x64.exe" >nul
if errorlevel 1 (echo Could not create installer. Check disk space. & pause & exit /b 1)
powershell.exe -NoProfile -Command "$actual = (Get-FileHash -LiteralPath 'Bards-College-Setup-1.3.0-x64.exe' -Algorithm SHA256).Hash; if ($actual -ne '36cb60a39ceaba213b59a1a82edd4cfc0602c4d14058e6d16bc29159ceb1ba98') { Write-Error 'Checksum mismatch. Do not run the installer. Download and extract the ZIP again.'; exit 1 }; Write-Host 'Checksum verified.'"
if errorlevel 1 (echo Verification failed. Do not run the installer. & pause & exit /b 1)
echo Ready: Bards-College-Setup-1.3.0-x64.exe
echo Open that EXE to install. This helper does not run it automatically.
pause
