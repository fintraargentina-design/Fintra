# ═══════════════════════════════════════════════════════════════
# CLEANUP WORKTREES - Eliminar directorios temporales
# ═══════════════════════════════════════════════════════════════
# Este script debe ejecutarse DESPUÉS de cerrar Claude Code
# ═══════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════╗"
Write-Host "║           CLEANUP WORKTREES - Limpieza de Temporales         ║"
Write-Host "╚═══════════════════════════════════════════════════════════════╝"
Write-Host ""

# Detener cualquier proceso Node/TSX que pueda estar usando los archivos
Write-Host "🔍 Verificando procesos Node/TSX..."
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "tsx" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Verificar qué worktrees existen
$worktreePath = "C:\Users\Paulo\.claude-worktrees\Fintra"
Write-Host ""
Write-Host "📋 Worktrees encontrados:"

if (Test-Path $worktreePath) {
    $items = Get-ChildItem $worktreePath
    foreach ($item in $items) {
        Write-Host "   - $($item.Name)"
    }
    Write-Host ""

    # Intentar eliminar cada worktree
    Write-Host "🗑️  Eliminando worktrees..."
    Write-Host ""

    foreach ($item in $items) {
        $fullPath = $item.FullName
        try {
            Remove-Item -Path $fullPath -Recurse -Force -ErrorAction Stop
            Write-Host "   ✅ Eliminado: $($item.Name)"
        } catch {
            Write-Host "   ❌ No se pudo eliminar: $($item.Name)"
            Write-Host "      Error: $($_.Exception.Message)"
            Write-Host "      Posible causa: Archivos aún en uso o permisos insuficientes"
            Write-Host ""
            Write-Host "      SOLUCIÓN:"
            Write-Host "      1. Cierra todas las ventanas de Claude Code"
            Write-Host "      2. Cierra todas las terminales PowerShell/CMD"
            Write-Host "      3. Reinicia este script"
        }
    }

    # Verificar si quedó el directorio padre vacío
    Start-Sleep -Seconds 1
    $remaining = Get-ChildItem $worktreePath -ErrorAction SilentlyContinue

    if (-not $remaining) {
        Write-Host ""
        Write-Host "🧹 Eliminando directorio padre vacío..."
        Remove-Item -Path $worktreePath -Force -ErrorAction SilentlyContinue
    }

} else {
    Write-Host "   ⚠️  No se encontró el directorio: $worktreePath"
}

# Limpiar referencias de git
Write-Host ""
Write-Host "🔧 Limpiando referencias de git..."
Set-Location "D:\FintraDeploy\Fintra"
git worktree prune

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════╗"
Write-Host "║                    ✅ LIMPIEZA COMPLETADA                     ║"
Write-Host "╚═══════════════════════════════════════════════════════════════╝"
Write-Host ""

# Verificar resultado final
$finalCheck = Test-Path "C:\Users\Paulo\.claude-worktrees\Fintra"
if (-not $finalCheck) {
    Write-Host "✅ Todos los worktrees temporales han sido eliminados"
} else {
    Write-Host "⚠️  Algunos archivos aún existen en:"
    Write-Host "   C:\Users\Paulo\.claude-worktrees\Fintra"
    Write-Host ""
    Write-Host "   Si persiste el problema, puedes eliminarlos manualmente desde el Explorador de Windows"
    Write-Host "   (Asegúrate de que Claude Code esté completamente cerrado)"
}

Write-Host ""
Write-Host "📍 Directorio de trabajo actual: D:\FintraDeploy\Fintra"
Write-Host ""

# Mantener ventana abierta
Write-Host "Presiona cualquier tecla para continuar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
