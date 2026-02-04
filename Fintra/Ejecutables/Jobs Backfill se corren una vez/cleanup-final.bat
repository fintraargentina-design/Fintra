@echo off
echo.
echo ════════════════════════════════════════════════════════════
echo   LIMPIEZA FINAL DE WORKTREES
echo ════════════════════════════════════════════════════════════
echo.
echo Cerrando procesos...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM tsx.exe 2>nul
timeout /t 3 /nobreak >nul

echo.
echo Eliminando worktree: focused-shockley...
rd /s /q "C:\Users\Paulo\.claude-worktrees\Fintra\focused-shockley" 2>nul

echo.
echo Verificando limpieza...
if exist "C:\Users\Paulo\.claude-worktrees\Fintra\focused-shockley" (
    echo [ERROR] No se pudo eliminar focused-shockley
    echo El directorio aun esta en uso.
    echo.
    echo SOLUCION:
    echo 1. Cierra TODAS las ventanas de Claude Code
    echo 2. Cierra TODAS las terminales PowerShell/CMD
    echo 3. Ejecuta este script nuevamente
    pause
    exit /b 1
) else (
    echo [OK] focused-shockley eliminado
)

echo.
echo Eliminando directorio padre si esta vacio...
rd "C:\Users\Paulo\.claude-worktrees\Fintra" 2>nul

echo.
echo Limpiando referencias de git...
cd /d "D:\FintraDeploy\Fintra"
git worktree prune

echo.
echo ════════════════════════════════════════════════════════════
echo   LIMPIEZA COMPLETADA
echo ════════════════════════════════════════════════════════════
echo.

if exist "C:\Users\Paulo\.claude-worktrees\Fintra" (
    echo [ADVERTENCIA] Algunos archivos aun existen
    echo Ubicacion: C:\Users\Paulo\.claude-worktrees\Fintra
    echo.
    dir "C:\Users\Paulo\.claude-worktrees\Fintra" /b
) else (
    echo [OK] Todos los worktrees han sido eliminados
)

echo.
pause
