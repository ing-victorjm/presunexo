@echo off
title PRESUNEXO - servidor local
cd /d "%~dp0"
echo.
echo   PRESUNEXO - http://localhost:8765
echo   Cierra esta ventana para detener el servidor.
echo.
start "" http://localhost:8765
python servidor.py
