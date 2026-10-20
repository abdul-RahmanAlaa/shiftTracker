@echo off
setlocal

cd /d "%~dp0"
if errorlevel 1 goto failed

if not exist "node_modules\" (
  echo node_modules was not found. Installing dependencies...
  call npm install
  if errorlevel 1 goto failed
)

echo Building the Windows installer...
call npm run build:win
if errorlevel 1 goto failed

if not exist "dist\" goto missing_output
start "" explorer.exe "%CD%\dist"
if errorlevel 1 goto failed

echo Installer build completed. Output folder: "%CD%\dist"
pause
exit /b 0

:missing_output
echo Build completed, but the expected output folder "%CD%\dist" was not found.
set "BUILD_EXIT_CODE=1"
goto failed

:failed
if not defined BUILD_EXIT_CODE set "BUILD_EXIT_CODE=%ERRORLEVEL%"
if "%BUILD_EXIT_CODE%"=="0" set "BUILD_EXIT_CODE=1"
echo Build failed with exit code %BUILD_EXIT_CODE%.
pause
exit /b %BUILD_EXIT_CODE%
