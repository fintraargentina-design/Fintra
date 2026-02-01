#!/bin/bash
# Script para ejecutar actualización diaria completa de Fintra (LOCAL)
# Uso: bash scripts/run-daily-update.sh

set -e  # Exit on error

BASE_URL="http://localhost:3000"
LOG_DIR="logs"
LOG_FILE="$LOG_DIR/cron-$(date +%Y%m%d-%H%M%S).log"

# Crear directorio de logs si no existe
mkdir -p $LOG_DIR

echo "╔═══════════════════════════════════════════════════════════╗" | tee -a $LOG_FILE
echo "║  🚀 FINTRA - ACTUALIZACIÓN DIARIA                         ║" | tee -a $LOG_FILE
echo "║  Fecha: $(date +'%Y-%m-%d %H:%M:%S')                         ║" | tee -a $LOG_FILE
echo "╚═══════════════════════════════════════════════════════════╝" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

# Verificar que el servidor esté corriendo
echo "🔍 Verificando servidor..." | tee -a $LOG_FILE
if ! curl -s --max-time 5 "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo "❌ ERROR: Servidor no está corriendo en $BASE_URL" | tee -a $LOG_FILE
  echo "   Ejecuta: npm run dev" | tee -a $LOG_FILE
  exit 1
fi
echo "✅ Servidor OK" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

# Función para ejecutar job con logging y manejo de errores
run_job() {
  local level=$1
  local name=$2
  local endpoint=$3
  local max_duration=${4:-600}  # Default 10 min
  local critical=${5:-false}

  echo "┌─────────────────────────────────────────────────────────┐" | tee -a $LOG_FILE
  echo "│ [$level] $name" | tee -a $LOG_FILE
  echo "└─────────────────────────────────────────────────────────┘" | tee -a $LOG_FILE

  START=$(date +%s)

  # Ejecutar con timeout
  HTTP_CODE=$(timeout $max_duration curl -s -o /tmp/response.json -w "%{http_code}" "$BASE_URL$endpoint" 2>&1)
  EXIT_CODE=$?

  END=$(date +%s)
  DURATION=$((END - START))

  # Verificar resultado
  if [ $EXIT_CODE -eq 0 ] && [ "$HTTP_CODE" == "200" ]; then
    echo "✅ Completado en ${DURATION}s (HTTP $HTTP_CODE)" | tee -a $LOG_FILE

    # Mostrar resumen si existe
    if jq -e '.processed' /tmp/response.json > /dev/null 2>&1; then
      PROCESSED=$(jq -r '.processed // 0' /tmp/response.json)
      echo "   📊 Procesados: $PROCESSED" | tee -a $LOG_FILE
    fi
  else
    echo "❌ FALLO en ${DURATION}s (exit: $EXIT_CODE, HTTP: $HTTP_CODE)" | tee -a $LOG_FILE

    # Mostrar error si existe
    if [ -f /tmp/response.json ]; then
      echo "   Error:" | tee -a $LOG_FILE
      cat /tmp/response.json | jq -r '.error // .message // .' 2>/dev/null | head -5 | tee -a $LOG_FILE
    fi

    # Si es crítico, abortar
    if [ "$critical" == "true" ]; then
      echo "" | tee -a $LOG_FILE
      echo "💥 Job crítico falló. Abortando ejecución." | tee -a $LOG_FILE
      exit 1
    fi
  fi

  echo "" | tee -a $LOG_FILE
  sleep 5
}

# ═══════════════════════════════════════════════════════════
# NIVEL 1: DATOS BASE (CRÍTICO)
# ═══════════════════════════════════════════════════════════
echo "╔═══════════════════════════════════════════════════════════╗" | tee -a $LOG_FILE
echo "║  NIVEL 1: INGESTA DE DATOS                                ║" | tee -a $LOG_FILE
echo "╚═══════════════════════════════════════════════════════════╝" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

run_job "1.1" "FMP Bulk" "/api/cron/fmp-bulk" 3600 true
run_job "1.2" "Dividends Bulk" "/api/cron/dividends-bulk-v2" 600 false

# ═══════════════════════════════════════════════════════════
# NIVEL 2: CLASIFICACIÓN Y BENCHMARKS
# ═══════════════════════════════════════════════════════════
echo "╔═══════════════════════════════════════════════════════════╗" | tee -a $LOG_FILE
echo "║  NIVEL 2: CLASIFICACIÓN                                   ║" | tee -a $LOG_FILE
echo "╚═══════════════════════════════════════════════════════════╝" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

run_job "2.1" "Industry Classification" "/api/cron/industry-classification-sync" 600 false
run_job "2.2" "Sector Benchmarks" "/api/cron/master-benchmark" 900 true

# ═══════════════════════════════════════════════════════════
# NIVEL 3: PERFORMANCE
# ═══════════════════════════════════════════════════════════
echo "╔═══════════════════════════════════════════════════════════╗" | tee -a $LOG_FILE
echo "║  NIVEL 3: PERFORMANCE                                     ║" | tee -a $LOG_FILE
echo "╚═══════════════════════════════════════════════════════════╝" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

run_job "3.1" "Industry Performance" "/api/cron/industry-performance-aggregator" 1200 false
run_job "3.2" "Industry Windows" "/api/cron/industry-performance-windows-aggregator" 900 false
run_job "3.3" "Industry Benchmarks" "/api/cron/industry-benchmarks-aggregator" 900 false

# ═══════════════════════════════════════════════════════════
# NIVEL 4: SNAPSHOTS (CRÍTICO)
# ═══════════════════════════════════════════════════════════
echo "╔═══════════════════════════════════════════════════════════╗" | tee -a $LOG_FILE
echo "║  NIVEL 4: MOTOR FGOS (CRÍTICO)                            ║" | tee -a $LOG_FILE
echo "╚═══════════════════════════════════════════════════════════╝" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

run_job "4.1" "Bulk Update (Snapshots)" "/api/cron/bulk-update" 7200 true

# ═══════════════════════════════════════════════════════════
# NIVEL 5: RANKINGS
# ═══════════════════════════════════════════════════════════
echo "╔═══════════════════════════════════════════════════════════╗" | tee -a $LOG_FILE
echo "║  NIVEL 5: RANKINGS Y MARKET STATE                         ║" | tee -a $LOG_FILE
echo "╚═══════════════════════════════════════════════════════════╝" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

run_job "5.1" "Compute Ranks" "/api/cron/compute-ranks" 900 false
run_job "5.2" "Market State" "/api/cron/market-state-bulk" 600 false

# ═══════════════════════════════════════════════════════════
# RESUMEN FINAL
# ═══════════════════════════════════════════════════════════
TOTAL_END=$(date +%s)
TOTAL_START=$(head -1 $LOG_FILE | grep -oP '\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}' | xargs -I {} date -d {} +%s 2>/dev/null || echo $TOTAL_END)
TOTAL_DURATION=$((TOTAL_END - TOTAL_START))
TOTAL_HOURS=$((TOTAL_DURATION / 3600))
TOTAL_MINS=$(((TOTAL_DURATION % 3600) / 60))

echo "╔═══════════════════════════════════════════════════════════╗" | tee -a $LOG_FILE
echo "║  ✅ ACTUALIZACIÓN COMPLETADA                              ║" | tee -a $LOG_FILE
echo "║  Duración total: ${TOTAL_HOURS}h ${TOTAL_MINS}m                              ║" | tee -a $LOG_FILE
echo "║  Log guardado en: $LOG_FILE" | tee -a $LOG_FILE
echo "╚═══════════════════════════════════════════════════════════╝" | tee -a $LOG_FILE

# Limpiar archivos temporales
rm -f /tmp/response.json

echo ""
echo "📄 Ver log completo: cat $LOG_FILE"
echo "📊 Ver últimas líneas: tail -f $LOG_FILE"
