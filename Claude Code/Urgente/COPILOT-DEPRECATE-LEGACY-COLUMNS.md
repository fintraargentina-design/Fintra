# Instrucciones para GitHub Copilot: Deprecar Columnas Legacy

## 🎯 TAREA 2: Deprecar Columnas Legacy (NO ELIMINAR)

Esta es la segunda corrección después del fix de sector_performance.

---

## 📋 TAREA COMPLETA PARA COPILOT

Copia y pega esto en GitHub Copilot Chat:

```
TAREA: Deprecar columnas legacy del schema de fintra_snapshots

CONTEXTO:
- Las columnas flat (sector_rank, relative_vs_*) ya NO se escriben
- El código migró a usar JSONB (performance_windows)
- Pero queries legacy todavía leen estas columnas flat
- Estrategia: Deprecar → Migrar lecturas → Eliminar (3 fases)

OBJETIVO:
Fase 1 de 3 - DEPRECACIÓN (esta tarea)
- Marcar columnas como DEPRECATED en schema
- NO eliminar columnas
- Documentar plan de migración
- Crear tracking de uso

NO HACER:
- ❌ NO eliminar columnas
- ❌ NO modificar datos existentes
- ❌ NO cambiar queries aún (eso es Fase 2)

REQUISITOS:

1. Crear migration SQL que:
   - Agregue comments DEPRECATED a columnas legacy
   - Documente fecha de deprecación
   - Incluya fecha estimada de eliminación
   - Referencie nueva ubicación en JSONB

2. Crear script de auditoría que:
   - Busque uso de columnas legacy en código
   - Genere reporte de queries a migrar
   - Liste componentes UI que usan columnas flat

3. Actualizar CHANGELOG.md con aviso de deprecación

MIGRATION SQL REQUERIDA:

Crear archivo: supabase/migrations/20260202_deprecate_legacy_columns.sql

```sql
-- Migration: Deprecate legacy flat columns
-- Date: 2026-02-02
-- Phase: 1 of 3 (Deprecation → Migration → Removal)

-- Document deprecation in table comment
COMMENT ON TABLE fintra_snapshots IS 
  'Core snapshot table for Fintra financial data.
   
   DEPRECATED COLUMNS (as of Feb 2026):
   - sector_rank, sector_rank_total → Use performance_windows->1M
   - relative_vs_sector_* → Use performance_windows->*->vs_sector
   - relative_vs_market_* → Use performance_windows->*->vs_market
   
   Removal planned: Q2 2026 (after UI/query migration)';

-- Deprecate sector_rank columns
COMMENT ON COLUMN fintra_snapshots.sector_rank IS 
  'DEPRECATED (Feb 2026): Use performance_windows->''1M''->''sector_rank'' instead.
   This column is no longer written by cron jobs.
   Reads will be supported until Q2 2026.
   Migration guide: See docs/migrations/performance_windows.md';

COMMENT ON COLUMN fintra_snapshots.sector_rank_total IS 
  'DEPRECATED (Feb 2026): Use performance_windows->''1M''->''sector_total'' instead.
   This column is no longer written by cron jobs.
   Reads will be supported until Q2 2026.
   Migration guide: See docs/migrations/performance_windows.md';

-- Deprecate relative_vs_sector columns
DO $$ 
DECLARE 
    col_name text;
    windows text[] := ARRAY['1w', '1m', '3m', '6m', 'ytd', '1y', '2y', '3y', '5y'];
    window_key text;
BEGIN
    FOREACH window_key IN ARRAY windows
    LOOP
        col_name := 'relative_vs_sector_' || window_key;
        
        -- Check if column exists
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'fintra_snapshots' 
            AND column_name = col_name
        ) THEN
            EXECUTE format(
                'COMMENT ON COLUMN fintra_snapshots.%I IS %L',
                col_name,
                format(
                    'DEPRECATED (Feb 2026): Use performance_windows->''%s''->''vs_sector'' instead. ' ||
                    'This column is no longer written by cron jobs. ' ||
                    'Reads will be supported until Q2 2026. ' ||
                    'Migration guide: See docs/migrations/performance_windows.md',
                    UPPER(window_key)
                )
            );
            
            RAISE NOTICE 'Deprecated column: %', col_name;
        END IF;
    END LOOP;
END $$;

-- Deprecate relative_vs_market columns
DO $$ 
DECLARE 
    col_name text;
    windows text[] := ARRAY['1w', '1m', '3m', '6m', 'ytd', '1y', '2y', '3y', '5y'];
    window_key text;
BEGIN
    FOREACH window_key IN ARRAY windows
    LOOP
        col_name := 'relative_vs_market_' || window_key;
        
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'fintra_snapshots' 
            AND column_name = col_name
        ) THEN
            EXECUTE format(
                'COMMENT ON COLUMN fintra_snapshots.%I IS %L',
                col_name,
                format(
                    'DEPRECATED (Feb 2026): Use performance_windows->''%s''->''vs_market'' instead. ' ||
                    'This column is no longer written by cron jobs. ' ||
                    'Reads will be supported until Q2 2026. ' ||
                    'Migration guide: See docs/migrations/performance_windows.md',
                    UPPER(window_key)
                )
            );
            
            RAISE NOTICE 'Deprecated column: %', col_name;
        END IF;
    END LOOP;
END $$;

-- Create view to track deprecated column usage
CREATE OR REPLACE VIEW deprecated_columns_usage AS
SELECT 
    'sector_rank' as column_name,
    COUNT(*) FILTER (WHERE sector_rank IS NOT NULL) as rows_with_data,
    COUNT(*) as total_rows,
    ROUND(100.0 * COUNT(*) FILTER (WHERE sector_rank IS NOT NULL) / COUNT(*), 2) as usage_percent,
    MAX(snapshot_date) FILTER (WHERE sector_rank IS NOT NULL) as last_written_date
FROM fintra_snapshots

UNION ALL

SELECT 
    'sector_rank_total',
    COUNT(*) FILTER (WHERE sector_rank_total IS NOT NULL),
    COUNT(*),
    ROUND(100.0 * COUNT(*) FILTER (WHERE sector_rank_total IS NOT NULL) / COUNT(*), 2),
    MAX(snapshot_date) FILTER (WHERE sector_rank_total IS NOT NULL)
FROM fintra_snapshots;

COMMENT ON VIEW deprecated_columns_usage IS 
  'Tracks usage of deprecated columns to monitor when safe to delete.
   Query this view periodically to check if columns can be removed.
   Removal criteria: usage_percent = 0 AND last_written_date > 90 days ago';

-- Log deprecation
INSERT INTO schema_migrations_log (migration_name, description, applied_at)
VALUES (
    '20260202_deprecate_legacy_columns',
    'Deprecated sector_rank and relative_vs_* columns. Migrating to performance_windows JSONB.',
    NOW()
);
```

SCRIPT DE AUDITORÍA REQUERIDO:

Crear archivo: scripts/audit-deprecated-columns.ts

```typescript
/**
 * Audit script to find usage of deprecated columns
 * 
 * Run: pnpm tsx scripts/audit-deprecated-columns.ts
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface DeprecatedColumn {
  name: string;
  replacement: string;
  patterns: string[];
}

const DEPRECATED_COLUMNS: DeprecatedColumn[] = [
  {
    name: 'sector_rank',
    replacement: "performance_windows['1M']?.sector_rank",
    patterns: [
      'sector_rank[^_]',  // Match sector_rank but not sector_rank_total
      '\\.sector_rank',
      'sector_rank:',
      'sector_rank,',
    ]
  },
  {
    name: 'sector_rank_total',
    replacement: "performance_windows['1M']?.sector_total",
    patterns: [
      'sector_rank_total',
    ]
  },
  {
    name: 'relative_vs_sector_*',
    replacement: "performance_windows['WINDOW']?.vs_sector",
    patterns: [
      'relative_vs_sector_',
    ]
  },
  {
    name: 'relative_vs_market_*',
    replacement: "performance_windows['WINDOW']?.vs_market",
    patterns: [
      'relative_vs_market_',
    ]
  },
];

interface Finding {
  file: string;
  line: number;
  content: string;
  column: string;
}

async function auditDeprecatedColumns() {
  console.log('🔍 Auditing deprecated columns usage...\n');
  
  const findings: Finding[] = [];
  
  // Directories to search
  const searchDirs = ['app', 'lib', 'components'];
  
  for (const column of DEPRECATED_COLUMNS) {
    console.log(`Searching for: ${column.name}`);
    
    for (const pattern of column.patterns) {
      for (const dir of searchDirs) {
        try {
          // Use grep to find matches
          const cmd = `grep -rn "${pattern}" ${dir} --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" || true`;
          const output = execSync(cmd, { encoding: 'utf-8' });
          
          if (output.trim()) {
            const lines = output.split('\n').filter(l => l.trim());
            
            for (const line of lines) {
              const [file, lineNum, ...content] = line.split(':');
              
              findings.push({
                file,
                line: parseInt(lineNum),
                content: content.join(':').trim(),
                column: column.name
              });
            }
          }
        } catch (error) {
          // grep returns non-zero if no matches, that's OK
        }
      }
    }
  }
  
  // Generate report
  console.log('\n📊 AUDIT REPORT\n');
  console.log('=' .repeat(80));
  
  if (findings.length === 0) {
    console.log('✅ No usage of deprecated columns found!');
    console.log('Safe to proceed with removal.');
  } else {
    console.log(`⚠️  Found ${findings.length} usage(s) of deprecated columns:\n`);
    
    // Group by column
    const grouped = findings.reduce((acc, f) => {
      if (!acc[f.column]) acc[f.column] = [];
      acc[f.column].push(f);
      return acc;
    }, {} as Record<string, Finding[]>);
    
    for (const [column, items] of Object.entries(grouped)) {
      const columnInfo = DEPRECATED_COLUMNS.find(c => c.name === column);
      
      console.log(`\n${column} (${items.length} usage(s))`);
      console.log(`Replacement: ${columnInfo?.replacement}`);
      console.log('-'.repeat(80));
      
      for (const item of items) {
        console.log(`  ${item.file}:${item.line}`);
        console.log(`    ${item.content}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n📝 NEXT STEPS:\n');
    console.log('1. Review each usage above');
    console.log('2. Update to use performance_windows JSONB');
    console.log('3. Re-run this audit to verify');
    console.log('4. Once audit shows 0 usage, safe to remove columns\n');
  }
  
  // Write report to file
  const reportPath = path.join(process.cwd(), 'deprecated-columns-audit.json');
  fs.writeFileSync(reportPath, JSON.stringify({ findings, timestamp: new Date().toISOString() }, null, 2));
  
  console.log(`Full report saved to: ${reportPath}\n`);
  
  return findings.length;
}

// Run audit
auditDeprecatedColumns()
  .then(count => {
    process.exit(count > 0 ? 1 : 0);  // Exit with error if usage found
  })
  .catch(error => {
    console.error('Audit failed:', error);
    process.exit(1);
  });
```

ACTUALIZAR CHANGELOG:

Agregar a CHANGELOG.md:

```markdown
## [Unreleased]

### Deprecated

- **Database Schema Changes (2026-02-02)**
  - Deprecated flat performance columns in favor of JSONB `performance_windows`:
    - `sector_rank` → Use `performance_windows['1M'].sector_rank`
    - `sector_rank_total` → Use `performance_windows['1M'].sector_total`
    - `relative_vs_sector_*` → Use `performance_windows['WINDOW'].vs_sector`
    - `relative_vs_market_*` → Use `performance_windows['WINDOW'].vs_market`
  
  - **Timeline:**
    - Feb 2026: Columns marked as DEPRECATED (Phase 1) ✅
    - Mar 2026: Migrate all queries to use JSONB (Phase 2)
    - Q2 2026: Remove deprecated columns (Phase 3)
  
  - **Migration Guide:** See `docs/migrations/performance_windows.md`
  - **Audit Tool:** Run `pnpm audit:deprecated-columns` to check usage
  
  - **Action Required:**
    - Update queries reading `sector_rank` to use JSONB
    - Update UI components reading `relative_vs_*` columns
    - No changes needed for data writes (already migrated)

### Fixed

- Fixed `ifs` and `ifs_memory` being NULL on weekends
  - Added fallback lookup for `sector_performance` (3-day window)
  - Weekend snapshots now use Friday's sector data
  - Improves IFS coverage from 0% to >95% on weekends
```

CREAR GUÍA DE MIGRACIÓN:

Crear archivo: docs/migrations/performance_windows.md

```markdown
# Migration Guide: Flat Columns → performance_windows JSONB

## Overview

Fintra is migrating from flat performance columns to a JSONB structure for better flexibility and maintainability.

## Timeline

| Phase | Date | Status | Description |
|-------|------|--------|-------------|
| Phase 1 | Feb 2026 | ✅ Complete | Deprecate columns, stop writes |
| Phase 2 | Mar 2026 | 🚧 In Progress | Migrate all reads to JSONB |
| Phase 3 | Q2 2026 | ⏳ Planned | Remove deprecated columns |

## Migration Mapping

### sector_rank → performance_windows

**Before (Flat):**
```typescript
const rank = snapshot.sector_rank;
const total = snapshot.sector_rank_total;
```

**After (JSONB):**
```typescript
const rank = snapshot.performance_windows?.['1M']?.sector_rank;
const total = snapshot.performance_windows?.['1M']?.sector_total;
```

**SQL Before:**
```sql
SELECT ticker, sector_rank
FROM fintra_snapshots
WHERE sector_rank <= 10;
```

**SQL After:**
```sql
SELECT 
  ticker,
  (performance_windows->'1M'->>'sector_rank')::int as sector_rank
FROM fintra_snapshots
WHERE (performance_windows->'1M'->>'sector_rank')::int <= 10;
```

### relative_vs_sector_* → performance_windows

**Before (Flat):**
```typescript
const rel1m = snapshot.relative_vs_sector_1m;
const rel3m = snapshot.relative_vs_sector_3m;
```

**After (JSONB):**
```typescript
const rel1m = snapshot.performance_windows?.['1M']?.vs_sector;
const rel3m = snapshot.performance_windows?.['3M']?.vs_sector;
```

**SQL Before:**
```sql
SELECT ticker, relative_vs_sector_1m
FROM fintra_snapshots
WHERE relative_vs_sector_1m > 0.05;
```

**SQL After:**
```sql
SELECT 
  ticker,
  (performance_windows->'1M'->>'vs_sector')::numeric as rel_sector_1m
FROM fintra_snapshots
WHERE (performance_windows->'1M'->>'vs_sector')::numeric > 0.05;
```

## Helper Functions

### TypeScript Helper

```typescript
/**
 * Safely get performance metric from JSONB
 */
function getPerformanceMetric(
  snapshot: FintraSnapshot,
  window: string,
  metric: 'sector_rank' | 'sector_total' | 'vs_sector' | 'vs_market'
): number | null {
  return snapshot.performance_windows?.[window]?.[metric] ?? null;
}

// Usage:
const rank = getPerformanceMetric(snapshot, '1M', 'sector_rank');
```

### SQL Function

```sql
CREATE OR REPLACE FUNCTION get_performance_metric(
  perf_windows JSONB,
  window_key TEXT,
  metric_key TEXT
) RETURNS NUMERIC AS $$
BEGIN
  RETURN (perf_windows->window_key->>metric_key)::NUMERIC;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Usage:
SELECT 
  ticker,
  get_performance_metric(performance_windows, '1M', 'sector_rank') as rank
FROM fintra_snapshots;
```

## Audit Your Code

Run the audit script to find all usages:

```bash
pnpm audit:deprecated-columns
```

This will generate a report showing all files that need updating.

## Questions?

See `docs/architecture/performance_windows.md` for full JSONB schema.
```

PACKAGE.JSON SCRIPT:

Agregar a package.json:

```json
{
  "scripts": {
    "audit:deprecated-columns": "tsx scripts/audit-deprecated-columns.ts"
  }
}
```

VALIDACIÓN:

Después de aplicar migration:

1. Verificar comments en DB:
```sql
SELECT 
  column_name,
  col_description('fintra_snapshots'::regclass, ordinal_position) as description
FROM information_schema.columns
WHERE table_name = 'fintra_snapshots'
  AND column_name IN ('sector_rank', 'sector_rank_total')
ORDER BY column_name;

-- Debe mostrar DEPRECATED en description
```

2. Ejecutar audit script:
```bash
pnpm audit:deprecated-columns
```

3. Verificar view de tracking:
```sql
SELECT * FROM deprecated_columns_usage;

-- Debe mostrar cuántos rows tienen datos
```

COMMIT MESSAGE:

```
refactor(schema): deprecate legacy flat performance columns

Phase 1 of 3: Deprecation
- Mark sector_rank, relative_vs_* as DEPRECATED in schema
- Add migration guide for JSONB performance_windows
- Create audit script to track usage
- Update CHANGELOG with deprecation notice

These columns are no longer written by cron jobs (migrated to JSONB).
Reads still supported until Q2 2026 to allow gradual migration.

Next steps:
- Phase 2 (Mar 2026): Migrate all queries to use JSONB
- Phase 3 (Q2 2026): Remove deprecated columns

Tools:
- Run `pnpm audit:deprecated-columns` to find usage
- See `docs/migrations/performance_windows.md` for migration guide

Breaking changes: None (backward compatible)
```

PRINCIPIOS A SEGUIR:

1. ✅ NO eliminar columnas (solo deprecar)
2. ✅ Mantener compatibilidad (backward compatible)
3. ✅ Documentar plan de migración
4. ✅ Crear tooling para auditoría
5. ✅ Comunicar timeline claramente

ARCHIVOS A CREAR/MODIFICAR:

1. supabase/migrations/20260202_deprecate_legacy_columns.sql (NUEVO)
2. scripts/audit-deprecated-columns.ts (NUEVO)
3. docs/migrations/performance_windows.md (NUEVO)
4. CHANGELOG.md (ACTUALIZAR)
5. package.json (AGREGAR script)

NO MODIFICAR:
- Queries existentes (eso es Fase 2)
- UI components (eso es Fase 2)
- Datos en DB (solo schema comments)
```

---

## 🚀 Cómo Usar

### Paso 1: Abrir Copilot Chat

```bash
Cmd+I (Mac) o Ctrl+I (Windows)
```

---

### Paso 2: Pegar Tarea

Copiar TODO el bloque de arriba y pegar en Copilot.

---

### Paso 3: Copilot Generará

1. ✅ Migration SQL completa
2. ✅ Script de auditoría TypeScript
3. ✅ Guía de migración Markdown
4. ✅ Actualización de CHANGELOG
5. ✅ Script en package.json

---

### Paso 4: Aplicar Migration

```bash
# Aplicar en DB
supabase db push

# O manualmente:
psql $DATABASE_URL -f supabase/migrations/20260202_deprecate_legacy_columns.sql
```

---

### Paso 5: Ejecutar Audit

```bash
# Ejecutar audit script
pnpm audit:deprecated-columns

# Debe mostrar todos los lugares donde se usan columnas deprecated
```

---

### Paso 6: Verificar

```sql
-- Ver comments DEPRECATED
SELECT 
  column_name,
  col_description('fintra_snapshots'::regclass, ordinal_position)
FROM information_schema.columns
WHERE table_name = 'fintra_snapshots'
  AND column_name LIKE '%sector_rank%'
  OR column_name LIKE 'relative_vs_%';

-- Ver tracking de uso
SELECT * FROM deprecated_columns_usage;
```

---

### Paso 7: Commit

```bash
git add supabase/migrations/20260202_deprecate_legacy_columns.sql
git add scripts/audit-deprecated-columns.ts
git add docs/migrations/performance_windows.md
git add CHANGELOG.md
git add package.json

git commit -m "refactor(schema): deprecate legacy flat performance columns"
git push
```

---

## ✅ Resultado Esperado

### Migration Aplicada

```sql
-- Comments agregados
COMMENT ON COLUMN fintra_snapshots.sector_rank IS 'DEPRECATED (Feb 2026)...';

-- View creada
SELECT * FROM deprecated_columns_usage;
```

### Audit Report Generado

```
🔍 Auditing deprecated columns usage...

⚠️  Found 23 usage(s) of deprecated columns:

sector_rank (15 usage(s))
Replacement: performance_windows['1M']?.sector_rank
--------------------------------------------------------------------------------
  app/components/SectorRank.tsx:15
    const rank = snapshot.sector_rank;
  
  app/api/rankings/route.ts:42
    .lte('sector_rank', 10)
  
  [... 13 more]

relative_vs_sector_1m (8 usage(s))
Replacement: performance_windows['1M']?.vs_sector
--------------------------------------------------------------------------------
  [... list of files]

📝 NEXT STEPS:

1. Review each usage above
2. Update to use performance_windows JSONB
3. Re-run this audit to verify
4. Once audit shows 0 usage, safe to remove columns
```

### CHANGELOG Actualizado

```markdown
## [Unreleased]

### Deprecated

- Database schema: sector_rank, relative_vs_* columns
- Timeline: Removal in Q2 2026
- Migration guide: docs/migrations/performance_windows.md
```

---

## 🎯 Próximos Pasos (Fase 2)

Después de completar esta tarea:

1. Usar el audit report para identificar queries
2. Actualizar queries una por una
3. Re-ejecutar audit hasta que muestre 0 usage
4. Entonces (y solo entonces) proceder a Fase 3: Eliminar columnas

**Timing:** Fase 2 toma ~2 semanas dependiendo de cuántas queries hay.

---

**Tiempo:** 2-3 horas  
**Riesgo:** NINGUNO (solo deprecación, no breaking changes)  
**Impacto:** Prepara el camino para eliminar columnas legacy en Q2 2026
