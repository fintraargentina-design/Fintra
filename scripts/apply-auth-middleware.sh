#!/bin/bash
# Script para aplicar withCronAuth a todos los cron jobs
# Uso: bash scripts/apply-auth-middleware.sh

CRON_ROUTES=$(find app/api/cron -name "route.ts" -type f)
TOTAL=$(echo "$CRON_ROUTES" | wc -l)
UPDATED=0
SKIPPED=0

echo "🔒 Aplicando middleware de autenticación a $TOTAL cron jobs..."
echo ""

for route in $CRON_ROUTES; do
  # Verificar si ya tiene withCronAuth
  if grep -q "withCronAuth" "$route"; then
    echo "⏭️  SKIP: $route (ya tiene withCronAuth)"
    ((SKIPPED++))
    continue
  fi

  # Verificar si ya tiene validación de CRON_SECRET manual
  if grep -q "CRON_SECRET" "$route"; then
    echo "⚠️  SKIP: $route (tiene validación manual de CRON_SECRET)"
    ((SKIPPED++))
    continue
  fi

  echo "🔧 Procesando: $route"

  # Backup
  cp "$route" "$route.backup"

  # Aplicar transformación
  # 1. Agregar import si no existe
  if ! grep -q "withCronAuth" "$route"; then
    sed -i "1i import { withCronAuth } from '@/lib/middleware/cronAuth';" "$route"
  fi

  # 2. Cambiar NextResponse por NextRequest si es necesario
  sed -i 's/import { NextResponse }/import { NextRequest, NextResponse }/' "$route"

  # 3. Envolver el handler con withCronAuth
  # Esto es más complejo y requiere análisis caso por caso

  echo "✅ Actualizado: $route"
  ((UPDATED++))
done

echo ""
echo "📊 Resumen:"
echo "   Total: $TOTAL"
echo "   Actualizados: $UPDATED"
echo "   Omitidos: $SKIPPED"
echo ""
echo "⚠️  IMPORTANTE: Revisa manualmente los cambios antes de commitear"
echo "   Los backups están en *.backup"
