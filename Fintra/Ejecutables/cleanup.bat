@echo off
echo 🧹 Iniciando Limpieza de Datos Parciales (Hoy)...
echo.
cd /d "%~dp0"
call npx tsx scripts/utils/cleanup-partial-data.ts
echo.
echo ✅ Limpieza Finalizada.
pause
