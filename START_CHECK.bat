@echo off
chcp 65001 >nul
title kesineTrader Hub — Session Start Check
echo.
echo Starting kesineTrader Hub Session Check...
echo.
powershell -ExecutionPolicy Bypass -File "G:\My Drive\jaeng\session_check.ps1"
echo.
echo Press any key to open project folder...
pause >nul
start explorer "G:\My Drive\jaeng"
