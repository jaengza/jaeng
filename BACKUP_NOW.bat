@echo off
chcp 65001 >nul
title ApexTrader Hub — Backup Now
echo.
echo Starting ApexTrader Hub Backup...
echo.
powershell -ExecutionPolicy Bypass -File "G:\My Drive\jaeng\backup_now.ps1"
echo.
echo Press any key to close...
pause >nul
