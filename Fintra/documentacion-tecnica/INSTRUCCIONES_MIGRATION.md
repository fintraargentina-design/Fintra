# Instrucciones: Aplicar Migration de Deprecación

## ✅ Archivos Listos

Todos los archivos están commiteados:

- ✅ Migration SQL: `supabase/migrations/20260202_deprecate_legacy_columns.sql`
- ✅ Script de auditoría: `scripts/audit-deprecated-columns.ts`
- ✅ Guía de migración: `docs/migrations/performance_windows.md`
- ✅ CHANGELOG actualizado

---

## 🚀 Cómo Aplicar la Migration

Como no tenemos psql ni Supabase CLI instalados, usa el **Supabase Dashboard**:

### Paso 1: Abrir Supabase Dashboard

1. Ve a: https://supabase.com/dashboard
2. Selecciona tu proyecto Fintra
3. Ve a: **SQL Editor** (en el menú izquierdo)

### Paso 2: Copiar Migration SQL

Abre el archivo:

```
D:\FintraDeploy\Fintra\supabase\migrations\20260202_deprecate_legacy_columns.sql
```

Copia TODO el contenido (142 líneas).

### Paso 3: Pegar y Ejecutar

1. En el SQL Editor, pega el contenido completo
2. Click en **Run** (o Ctrl+Enter)
3. Deberías ver mensajes como:
   ```
   NOTICE: Deprecated column: relative_vs_sector_1m
   NOTICE: Deprecated column: relative_vs_sector_3m
   ...
   ```

### Paso 4: Verificar

Ejecuta en el SQL Editor:

```sql
-- Ver columnas deprecadas con comments
SELECT
  column_name,
  col_description('fintra_snapshots'::regclass, ordinal_position) as description
FROM information_schema.columns
WHERE table_name = 'fintra_snapshots'
  AND column_name IN ('sector_rank', 'sector_rank_total')
ORDER BY column_name;

-- Debe mostrar "DEPRECATED (Feb 2026):" en description
```

Luego:

```sql
-- Ver tracking de uso
SELECT * FROM deprecated_columns_usage;

-- Debe retornar 4 filas con stats de cada columna deprecated
```

---

## 🎯 Después de Aplicar

Una vez aplicada la migration, ejecuta localmente:

```bash
# Verificar estado de migración
pnpm tsx scripts/apply-deprecation-migration.ts

# Auditar uso de columnas (debe mostrar 0 usage)
pnpm audit:deprecated-columns
```

---

## 📊 Resultado Esperado

Después de aplicar la migration:

### Comments en DB:

```
fintra_snapshots.sector_rank → DEPRECATED (Feb 2026)
fintra_snapshots.sector_rank_total → DEPRECATED (Feb 2026)
fintra_snapshots.relative_vs_sector_1m → DEPRECATED (Feb 2026)
...
```

### View Creada:

```sql
SELECT * FROM deprecated_columns_usage;

column_name              | rows_with_data | total_rows | usage_percent | last_written_date
-------------------------+----------------+------------+---------------+-------------------
sector_rank              | 0              | 486        | 0.00          | NULL
sector_rank_total        | 0              | 486        | 0.00          | NULL
relative_vs_sector_1m    | 486            | 486        | 100.00        | 2026-02-01
relative_vs_market_1m    | 486            | 486        | 100.00        | 2026-02-01
```

**Nota:** Las columnas `relative_vs_*` todavía tienen datos porque el código sigue escribiéndolas temporalmente para compatibilidad.

---

## ✅ Checklist Post-Migration

- [ ] Migration aplicada en Supabase Dashboard
- [ ] Comments verificados en DB
- [ ] View `deprecated_columns_usage` existe
- [ ] Script de verificación ejecutado localmente
- [ ] Auditoría muestra 0 usage en código
- [ ] Git push realizado

---

## 🔄 Timeline del Proyecto

| Fase       | Fecha    | Estado       | Descripción                    |
| ---------- | -------- | ------------ | ------------------------------ |
| **Fase 1** | Feb 2026 | ✅ EN CURSO  | Deprecación (migration + docs) |
| **Fase 2** | Mar 2026 | ⏳ Siguiente | Migrar queries a JSONB         |
| **Fase 3** | Q2 2026  | ⏳ Futuro    | Eliminar columnas deprecated   |

**Estamos en Fase 1.** La migration está lista, solo falta aplicarla en Dashboard.

---

## 🆘 Troubleshooting

### Error: "relation fintra_snapshots does not exist"

- Verifica que estás conectado al proyecto correcto en Supabase Dashboard

### Error: "column sector_rank does not exist"

- Normal si las columnas ya fueron eliminadas
- Comenta esas líneas del SQL

### View no se crea

- Ejecuta manualmente en SQL Editor:
  ```sql
  CREATE OR REPLACE VIEW deprecated_columns_usage AS ...
  ```

---

**¿Listo para aplicar?** 🚀

1. Abre Supabase Dashboard
2. SQL Editor
3. Copia `supabase/migrations/20260202_deprecate_legacy_columns.sql`
4. Run!
