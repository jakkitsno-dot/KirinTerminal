@echo off
title KirinTerminal Launcher
if exist "C:\Users\IW076-Jakkit\.nodejs" set "PATH=C:\Users\IW076-Jakkit\.nodejs;%PATH%"
cd /d "%~dp0"

echo ====================================================
echo Starting KirinTerminal...
echo ====================================================

if not exist "dist\index.html" (
    echo [INFO] Production build not found. Building application bundle...
    call npm run build
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] Build failed. Please check the errors above.
        pause
        exit /b %ERRORLEVEL%
    )
)

call npm start

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Application failed to launch or exited with error code %ERRORLEVEL%.
    pause
)

