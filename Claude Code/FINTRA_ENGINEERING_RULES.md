# Fintra Engines - Technical Backlog (Para Claude Code)

## 🎯 Instrucciones para Claude Code

Este documento contiene **tickets técnicos específicos** con:
- ✅ Checkbox para tracking
- 📝 Descripción técnica clara
- 📁 Archivos involucrados
- ✔️ Criterios de aceptación
- ⏱️ Estimación de tiempo

**Cómo usar este documento:**
1. Selecciona items marcados como `[ ]`
2. Implementa siguiendo las especificaciones
3. Marca como `[x]` cuando completes
4. Mueve a "Done" section al final

---

## 🚀 SPRINT 1: Transparencia y Documentación (Semana 1-2)

### Versioning y Tracking

#### [ ] Item 9: Sistema de Versioning de Benchmarks
**Prioridad:** ALTA  
**Complejidad:** Baja  
**Tiempo estimado:** 4-6 horas

**Descripción:**
Crear sistema para versionar benchmarks sectoriales y permitir auditoría histórica.

**Archivos involucrados:**
- `/lib/engine/sector-benchmarks.ts` (leer estructura actual)
- Nueva tabla: `benchmark_versions` (crear migration)
- `/lib/engine/fintra-brain.ts` (modificar para usar versioned benchmarks)

**Implementación:**
```typescript
// 1. Crear migration en Supabase
CREATE TABLE benchmark_versions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_id text NOT NULL, -- e.g. "2025-02-v1"
  sector text NOT NULL,
  metric text NOT NULL, -- e.g. "roic", "operating_margin"
  p10 numeric,
  p25 numeric,
  p50 numeric,
  p75 numeric,
  p90 numeric,
  calculated_at timestamptz NOT NULL,
  universe_size integer, -- cuántas empresas en el benchmark
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_benchmark_versions_lookup 
ON benchmark_versions(sector, metric, version_id);

// 2. Modificar función de cálculo de benchmarks
async function saveBenchmarkVersion(
  sector: string,
  metric: string,
  stats: BenchmarkStats,
  universeSize: number
) {
  const versionId = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-v1`;
  
  await supabase.from('benchmark_versions').insert({
    version_id: versionId,
    sector,
    metric,
    p10: stats.p10,
    p25: stats.p25,
    p50: stats.p50,
    p75: stats.p75,
    p90: stats.p90,
    calculated_at: new Date(),
    universe_size: universeSize
  });
}

// 3. Modificar queries para usar versioned benchmarks
async function getBenchmark(sector: string, metric: string, asOfDate?: Date) {
  const query = supabase
    .from('benchmark_versions')
    .select('*')
    .eq('sector', sector)
    .eq('metric', metric);
  
  if (asOfDate) {
    query.lte('calculated_at', asOfDate.toISOString());
  }
  
  return query
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single();
}
```

**Criterios de aceptación:**
- ✔️ Tabla `benchmark_versions` creada en Supabase
- ✔️ Benchmarks se guardan con timestamp en cada recálculo
- ✔️ Queries pueden recuperar benchmarks históricos por fecha
- ✔️ Universe size se trackea para cada versión
- ✔️ Version ID sigue formato: YYYY-MM-vN

**Tests:**
- Calcular benchmark hoy → debe crear versión con fecha actual
- Query benchmark del pasado → debe retornar versión correcta
- Verificar universe_size > 0 para todos los sectores

---

#### [ ] Item 51: Benchmark Update Log (Changelog Público)
**Prioridad:** ALTA  
**Complejidad:** Media  
**Tiempo estimado:** 6-8 horas

**Descripción:**
Crear log público de cambios en benchmarks para transparencia.

**Archivos involucrados:**
- Nueva tabla: `benchmark_changelog`
- Nueva ruta: `/app/benchmarks/changelog/page.tsx`
- `/lib/engine/sector-benchmarks.ts` (trigger automático)

**Implementación:**
```typescript
// 1. Crear tabla
CREATE TABLE benchmark_changelog (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  change_date timestamptz NOT NULL,
  sector text NOT NULL,
  metric text NOT NULL,
  old_p50 numeric,
  new_p50 numeric,
  delta_percent numeric, -- (new - old) / old * 100
  reason text, -- "Monthly recalc", "Universe expansion", etc.
  created_at timestamptz DEFAULT now()
);

// 2. Función para detectar cambios significativos
async function logBenchmarkChange(
  sector: string,
  metric: string,
  oldStats: BenchmarkStats,
  newStats: BenchmarkStats,
  reason: string
) {
  const deltaPercent = ((newStats.p50 - oldStats.p50) / oldStats.p50) * 100;
  
  // Solo log si cambio > 2%
  if (Math.abs(deltaPercent) > 2) {
    await supabase.from('benchmark_changelog').insert({
      change_date: new Date(),
      sector,
      metric,
      old_p50: oldStats.p50,
      new_p50: newStats.p50,
      delta_percent: deltaPercent,
      reason
    });
  }
}

// 3. Vista pública (Next.js page)
// /app/benchmarks/changelog/page.tsx
export default async function ChangelogPage() {
  const { data: changes } = await supabase
    .from('benchmark_changelog')
    .select('*')
    .order('change_date', { ascending: false })
    .limit(100);
  
  return (
    <div>
      <h1>Benchmark Update History</h1>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Sector</th>
            <th>Metric</th>
            <th>Old Median</th>
            <th>New Median</th>
            <th>Change</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {changes?.map(change => (
            <tr key={change.id}>
              <td>{formatDate(change.change_date)}</td>
              <td>{change.sector}</td>
              <td>{change.metric}</td>
              <td>{change.old_p50?.toFixed(2)}</td>
              <td>{change.new_p50?.toFixed(2)}</td>
              <td className={change.delta_percent > 0 ? 'text-green' : 'text-red'}>
                {change.delta_percent.toFixed(1)}%
              </td>
              <td>{change.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Criterios de aceptación:**
- ✔️ Changelog se genera automáticamente en cada recalc de benchmarks
- ✔️ Solo se loggean cambios >2% en mediana
- ✔️ Vista pública accesible en /benchmarks/changelog
- ✔️ Muestra últimos 100 cambios
- ✔️ Incluye fecha, sector, métrica, delta % y razón

---

### Documentación Técnica

#### [ ] Item 13: Documentar Construcción de Mediana Sectorial (IFS)
**Prioridad:** ALTA  
**Complejidad:** Baja  
**Tiempo estimado:** 2-4 horas

**Descripción:**
Generar documento técnico explicando cómo se construye la mediana sectorial para IFS.

**Archivos involucrados:**
- Leer: `/lib/engine/ifs-calculator.ts`
- Crear: `/docs/methodology/ifs-sector-median.md`

**Implementación:**
```markdown
# IFS Sector Median Construction

## Universe Definition

**Geography:** US-listed securities
- Exchanges: NYSE, NASDAQ, AMEX
- Exclusions: OTC, Pink Sheets, Foreign Ordinaries

**Filters Applied:**
- Market Cap: >= $100M USD
- Average Daily Volume: >= $500K USD (30-day avg)
- Listing Status: Active (not delisted)

## Calculation Method

**Type:** Equal-weighted median (not cap-weighted)

**Rationale:** 
- Reflects "typical" company in sector
- Avoids dominance by mega-caps (e.g., AAPL skewing Tech)

**Formula:**
```typescript
const sectorReturns = await fetchReturnsForSector(sector, window);
const median = calculateMedian(sectorReturns); // 50th percentile
```

## Update Frequency

**Current:** Daily
- Recalculated with each snapshot cron job
- Uses most recent EOD prices from FMP

**Historical:** 
- Backfilled using point-in-time universe
- No survivorship bias (includes delisted if existed at date)

## Example

**Sector:** Technology  
**Window:** 1M  
**Date:** 2025-02-01  

**Universe:** 487 companies met filters  
**Returns distribution:**
- p10: -8.2%
- p25: -2.1%
- **p50 (median): +3.4%** ← This is the sector benchmark
- p75: +9.7%
- p90: +18.3%

**Stock AAPL:** +5.6% in 1M  
**Delta:** +5.6% - 3.4% = **+2.2%** (beats sector) ✅

## Data Source

**Provider:** Financial Modeling Prep (FMP)
- Endpoint: `/stable/eod-bulk`
- Adjusted for splits/dividends: Yes

## Known Limitations

1. **Small sectors:** Some sectors (e.g., "Uranium") may have <30 companies
   - IFS applies "low confidence" adjustment automatically
   
2. **Illiquid stocks:** Stocks with low volume may have stale prices
   - Filter of $500K avg volume mitigates this

3. **Sector classification:** Uses FMP's sector taxonomy
   - May differ from GICS or other standards
```

**Criterios de aceptación:**
- ✔️ Documento markdown creado en `/docs/methodology/`
- ✔️ Explica filtros de universo claramente
- ✔️ Incluye ejemplo numérico
- ✔️ Documenta limitaciones conocidas
- ✔️ Referencias data sources (FMP)

---

#### [ ] Item 24: Documentar Construcción de Benchmarks Sectoriales (Valuation)
**Prioridad:** ALTA  
**Complejidad:** Baja  
**Tiempo estimado:** 2-4 horas

**Descripción:**
Similar a Item 13 pero para Valuation Engine.

**Archivos involucrados:**
- Leer: `/lib/engine/valuation-calculator.ts`
- Crear: `/docs/methodology/valuation-benchmarks.md`

**Implementación:**
(Similar estructura a Item 13, pero enfocado en P/E, EV/EBITDA, P/FCF)

**Criterios de aceptación:**
- ✔️ Documento explica cómo se calculan percentiles de valuación
- ✔️ Menciona tratamiento de valores negativos (se excluyen)
- ✔️ Documenta outlier treatment (winsorization si aplica)
- ✔️ Ejemplo con sector real

---

#### [ ] Item 36: Documentar Definición de Volatility Factor (Life Cycle)
**Prioridad:** MEDIA  
**Complejidad:** Baja  
**Tiempo estimado:** 2-3 horas

**Descripción:**
Clarificar qué tipo de volatilidad se usa en Life Cycle confidence scoring.

**Archivos involucrados:**
- Leer: `/lib/engine/life-cycle-calculator.ts`
- Actualizar: Agregar JSDoc comments
- Crear: `/docs/methodology/life-cycle-volatility.md`

**Implementación:**
```typescript
/**
 * Calculates earnings volatility for Life Cycle confidence scoring
 * 
 * @method Revenue Coefficient of Variation (CoV)
 * @formula CoV = std_dev(revenue_4Q) / mean(revenue_4Q)
 * 
 * @thresholds
 * - Low volatility: CoV < 0.15 (consistent revenue)
 * - Medium volatility: CoV 0.15 - 0.40 (normal cyclicality)
 * - High volatility: CoV > 0.40 (erratic business model)
 * 
 * @rationale
 * Revenue volatility chosen over:
 * - Earnings volatility: More susceptible to accounting choices
 * - Stock price volatility: Reflects market sentiment, not operations
 * - FCF volatility: Too influenced by CapEx timing
 * 
 * @example
 * Company with quarterly revenue: [100, 105, 98, 102]
 * Mean = 101.25
 * Std Dev = 2.99
 * CoV = 2.99 / 101.25 = 0.0295 → Low volatility ✅
 */
function calculateVolatility(quarterlyRevenue: number[]): VolatilityLevel {
  const mean = calculateMean(quarterlyRevenue);
  const stdDev = calculateStdDev(quarterlyRevenue);
  const cov = stdDev / mean;
  
  if (cov < 0.15) return 'Low';
  if (cov < 0.40) return 'Medium';
  return 'High';
}
```

**Criterios de aceptación:**
- ✔️ Código tiene JSDoc completo
- ✔️ Documento markdown explica rationale
- ✔️ Thresholds justificados
- ✔️ Ejemplo numérico incluido

---

### Dashboards de Transparencia

#### [ ] Item 29: Dashboard de Transparencia (Valuation)
**Prioridad:** ALTA  
**Complejidad:** Media  
**Tiempo estimado:** 1 día

**Descripción:**
Crear dashboard público mostrando distribución de valuations y calidad de datos.

**Archivos involucrados:**
- Nueva ruta: `/app/transparency/valuation/page.tsx`
- Query helper: `/lib/queries/transparency.ts`

**Implementación:**
```typescript
// /lib/queries/transparency.ts
export async function getValuationTransparencyData() {
  // 1. Distribución de veredictos
  const { data: distribution } = await supabase
    .from('fintra_snapshots')
    .select('valuation_relative')
    .not('valuation_relative', 'is', null);
  
  const histogram = {
    'Very Cheap': 0,
    'Cheap': 0,
    'Fair': 0,
    'Expensive': 0,
    'Very Expensive': 0
  };
  
  distribution?.forEach(row => {
    const verdict = row.valuation_relative?.verdict;
    if (verdict) histogram[verdict]++;
  });
  
  // 2. Cobertura por sector
  const { data: coverage } = await supabase
    .rpc('get_valuation_coverage_by_sector');
  
  // 3. Métricas disponibles
  const { data: metrics } = await supabase
    .from('fintra_snapshots')
    .select('ticker, valuation_relative')
    .not('valuation_relative', 'is', null);
  
  const metricsAvailability = {
    'All 3 metrics': 0,
    'Only 2 metrics': 0,
    'Only 1 metric': 0
  };
  
  metrics?.forEach(row => {
    const count = row.valuation_relative?.metrics_used?.length || 0;
    if (count === 3) metricsAvailability['All 3 metrics']++;
    else if (count === 2) metricsAvailability['Only 2 metrics']++;
    else metricsAvailability['Only 1 metric']++;
  });
  
  return { histogram, coverage, metricsAvailability };
}

// /app/transparency/valuation/page.tsx
export default async function ValuationTransparency() {
  const data = await getValuationTransparencyData();
  
  return (
    <div className="p-8">
      <h1>Valuation Transparency Dashboard</h1>
      
      <section>
        <h2>Distribution of Verdicts</h2>
        <BarChart data={Object.entries(data.histogram)} />
        <p>Total companies analyzed: {Object.values(data.histogram).reduce((a,b) => a+b, 0)}</p>
      </section>
      
      <section>
        <h2>Coverage by Sector</h2>
        <table>
          <thead>
            <tr>
              <th>Sector</th>
              <th>Total Companies</th>
              <th>With Valuation</th>
              <th>Coverage %</th>
            </tr>
          </thead>
          <tbody>
            {data.coverage.map(row => (
              <tr key={row.sector}>
                <td>{row.sector}</td>
                <td>{row.total}</td>
                <td>{row.with_valuation}</td>
                <td>{((row.with_valuation / row.total) * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      
      <section>
        <h2>Metrics Availability</h2>
        <PieChart data={data.metricsAvailability} />
        <p className="text-sm text-gray-600">
          Higher confidence when all 3 metrics (P/E, EV/EBITDA, P/FCF) are available
        </p>
      </section>
    </div>
  );
}
```

**Criterios de aceptación:**
- ✔️ Dashboard accesible en /transparency/valuation
- ✔️ Muestra distribución de verdicts (histogram)
- ✔️ Muestra cobertura por sector (table)
- ✔️ Muestra disponibilidad de métricas (pie chart)
- ✔️ Actualizado automáticamente con datos más recientes

---

#### [ ] Item 39: Dashboard de Stage Composition por Sector
**Prioridad:** MEDIA  
**Complejidad:** Baja-Media  
**Tiempo estimado:** 4-6 horas

**Descripción:**
Mostrar distribución de Life Cycle stages por sector.

**Archivos involucrados:**
- Nueva ruta: `/app/transparency/life-cycle/page.tsx`

**Implementación:**
```typescript
// Query SQL (puede ser RPC function en Supabase)
CREATE OR REPLACE FUNCTION get_stage_distribution_by_sector()
RETURNS TABLE (
  sector text,
  total_count bigint,
  mature_count bigint,
  developing_count bigint,
  early_stage_count bigint,
  incomplete_count bigint,
  mature_pct numeric,
  developing_pct numeric,
  early_stage_pct numeric,
  avg_confidence numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    profile_structural->>'sector' as sector,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE life_cycle->>'stage' = 'Mature') as mature_count,
    COUNT(*) FILTER (WHERE life_cycle->>'stage' = 'Developing') as developing_count,
    COUNT(*) FILTER (WHERE life_cycle->>'stage' = 'Early-Stage') as early_stage_count,
    COUNT(*) FILTER (WHERE life_cycle->>'stage' = 'Incomplete') as incomplete_count,
    ROUND((COUNT(*) FILTER (WHERE life_cycle->>'stage' = 'Mature')::numeric / COUNT(*)) * 100, 1) as mature_pct,
    ROUND((COUNT(*) FILTER (WHERE life_cycle->>'stage' = 'Developing')::numeric / COUNT(*)) * 100, 1) as developing_pct,
    ROUND((COUNT(*) FILTER (WHERE life_cycle->>'stage' = 'Early-Stage')::numeric / COUNT(*) * 100, 1) as early_stage_pct,
    ROUND(AVG((life_cycle->>'confidence')::numeric), 1) as avg_confidence
  FROM fintra_snapshots
  WHERE profile_structural->>'sector' IS NOT NULL
  GROUP BY profile_structural->>'sector'
  ORDER BY total_count DESC;
END;
$$ LANGUAGE plpgsql;

// Component
export default async function LifeCycleTransparency() {
  const { data } = await supabase.rpc('get_stage_distribution_by_sector');
  
  return (
    <div>
      <h1>Life Cycle Stage Distribution by Sector</h1>
      <table>
        <thead>
          <tr>
            <th>Sector</th>
            <th>Total</th>
            <th>Mature</th>
            <th>Developing</th>
            <th>Early-Stage</th>
            <th>Avg Confidence</th>
          </tr>
        </thead>
        <tbody>
          {data?.map(row => (
            <tr key={row.sector}>
              <td>{row.sector}</td>
              <td>{row.total_count}</td>
              <td>{row.mature_pct}%</td>
              <td>{row.developing_pct}%</td>
              <td>{row.early_stage_pct}%</td>
              <td>{row.avg_confidence}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <section>
        <h2>Insights</h2>
        {data?.map(row => (
          <div key={row.sector} className="mb-2">
            {row.sector}: 
            {row.mature_pct > 80 && ' Highly established sector'}
            {row.early_stage_pct > 30 && ' Young/emerging sector'}
            {row.avg_confidence < 60 && ' Lower average confidence'}
          </div>
        ))}
      </section>
    </div>
  );
}
```

**Criterios de aceptación:**
- ✔️ Muestra % de Mature/Developing/Early-Stage por sector
- ✔️ Incluye avg confidence por sector
- ✔️ Ordenado por total count (sectores grandes primero)
- ✔️ Insights automáticos (ej: "Highly established sector")

---

#### [ ] Item 49: Health Dashboard de Datos (General)
**Prioridad:** ALTA  
**Complejidad:** Media  
**Tiempo estimado:** 1 día

**Descripción:**
Dashboard centralizado mostrando calidad de datos en todos los engines.

**Archivos involucrados:**
- Nueva ruta: `/app/admin/data-health/page.tsx`
- Queries: `/lib/queries/data-health.ts`

**Implementación:**
```typescript
// /lib/queries/data-health.ts
export async function getDataHealthMetrics() {
  // 1. FGOS Coverage
  const { data: fgosStats } = await supabase
    .from('fintra_snapshots')
    .select('ticker, fgos_status')
    .not('fgos_status', 'is', null);
  
  const fgosCoverage = {
    computed: fgosStats?.filter(s => s.fgos_status === 'computed').length || 0,
    pending: fgosStats?.filter(s => s.fgos_status === 'pending').length || 0,
    total: fgosStats?.length || 0
  };
  
  // 2. IFS Coverage
  const { data: ifsStats } = await supabase
    .from('fintra_snapshots')
    .select('ticker, ifs')
    .not('ifs', 'is', null);
  
  const ifsCoverage = {
    computed: ifsStats?.filter(s => s.ifs?.status === 'computed').length || 0,
    pending: ifsStats?.filter(s => s.ifs?.status === 'pending').length || 0,
    total: ifsStats?.length || 0
  };
  
  // 3. Valuation Coverage
  const { data: valStats } = await supabase
    .from('fintra_snapshots')
    .select('ticker, valuation_relative')
    .not('valuation_relative', 'is', null);
  
  const valuationCoverage = {
    computed: valStats?.filter(s => s.valuation_relative?.status === 'computed').length || 0,
    pending: valStats?.filter(s => s.valuation_relative?.status === 'pending').length || 0,
    total: valStats?.length || 0
  };
  
  // 4. Confidence Distribution
  const { data: confidenceData } = await supabase
    .from('fintra_snapshots')
    .select('fgos_confidence, ifs, valuation_relative')
    .not('fgos_confidence', 'is', null);
  
  const confidenceHistogram = {
    'High (80-100)': 0,
    'Medium (60-79)': 0,
    'Low (<60)': 0
  };
  
  confidenceData?.forEach(row => {
    const conf = row.fgos_confidence;
    if (conf >= 80) confidenceHistogram['High (80-100)']++;
    else if (conf >= 60) confidenceHistogram['Medium (60-79)']++;
    else confidenceHistogram['Low (<60)']++;
  });
  
  return {
    fgosCoverage,
    ifsCoverage,
    valuationCoverage,
    confidenceHistogram
  };
}

// Component
export default async function DataHealthDashboard() {
  const metrics = await getDataHealthMetrics();
  
  return (
    <div className="p-8">
      <h1>Data Health Dashboard</h1>
      
      <div className="grid grid-cols-3 gap-4">
        <Card title="FGOS Coverage">
          <DonutChart 
            data={[
              { name: 'Computed', value: metrics.fgosCoverage.computed },
              { name: 'Pending', value: metrics.fgosCoverage.pending }
            ]}
          />
          <p>{((metrics.fgosCoverage.computed / metrics.fgosCoverage.total) * 100).toFixed(1)}% coverage</p>
        </Card>
        
        <Card title="IFS Coverage">
          <DonutChart 
            data={[
              { name: 'Computed', value: metrics.ifsCoverage.computed },
              { name: 'Pending', value: metrics.ifsCoverage.pending }
            ]}
          />
          <p>{((metrics.ifsCoverage.computed / metrics.ifsCoverage.total) * 100).toFixed(1)}% coverage</p>
        </Card>
        
        <Card title="Valuation Coverage">
          <DonutChart 
            data={[
              { name: 'Computed', value: metrics.valuationCoverage.computed },
              { name: 'Pending', value: metrics.valuationCoverage.pending }
            ]}
          />
          <p>{((metrics.valuationCoverage.computed / metrics.valuationCoverage.total) * 100).toFixed(1)}% coverage</p>
        </Card>
      </div>
      
      <section className="mt-8">
        <h2>Confidence Score Distribution (FGOS)</h2>
        <BarChart data={Object.entries(metrics.confidenceHistogram)} />
      </section>
      
      <section className="mt-8">
        <h2>Data Quality Alerts</h2>
        <DataQualityAlerts />
      </section>
    </div>
  );
}
```

**Criterios de aceptación:**
- ✔️ Muestra coverage % de FGOS, IFS, Valuation
- ✔️ Distribución de confidence scores
- ✔️ Alertas de calidad de datos (próximo item)
- ✔️ Actualización automática diaria

---

### Alertas y Monitoring

#### [ ] Item 50: Alertas de Discrepancias FMP
**Prioridad:** MEDIA  
**Complejidad:** Media  
**Tiempo estimado:** 6-8 horas

**Descripción:**
Sistema para detectar discrepancias entre TTM calculado y FMP key-metrics-ttm.

**Archivos involucrados:**
- Nueva tabla: `data_quality_alerts`
- Nueva función: `/lib/validation/fmp-cross-check.ts`
- Integrar en cron: `/app/api/cron/snapshot/route.ts`

**Implementación:**
```typescript
// 1. Crear tabla
CREATE TABLE data_quality_alerts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticker text NOT NULL,
  alert_type text NOT NULL, -- 'FMP_DISCREPANCY', 'MISSING_METRIC', etc.
  severity text NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH'
  metric text,
  fintra_value numeric,
  fmp_value numeric,
  discrepancy_percent numeric,
  detected_at timestamptz DEFAULT now(),
  resolved boolean DEFAULT false
);

CREATE INDEX idx_alerts_unresolved ON data_quality_alerts(ticker, resolved) WHERE NOT resolved;

// 2. Función de validación
async function crossCheckWithFMP(ticker: string, fintraData: any) {
  // Fetch FMP key-metrics-ttm
  const fmpMetrics = await fetchFMPKeyMetricsTTM(ticker);
  
  const alerts: DataQualityAlert[] = [];
  
  // Compare ROIC
  if (fintraData.roic && fmpMetrics.roic) {
    const discrepancy = Math.abs((fintraData.roic - fmpMetrics.roic) / fmpMetrics.roic) * 100;
    
    if (discrepancy > 5) {
      alerts.push({
        ticker,
        alert_type: 'FMP_DISCREPANCY',
        severity: discrepancy > 15 ? 'HIGH' : 'MEDIUM',
        metric: 'roic',
        fintra_value: fintraData.roic,
        fmp_value: fmpMetrics.roic,
        discrepancy_percent: discrepancy
      });
    }
  }
  
  // Compare Revenue
  if (fintraData.revenue && fmpMetrics.revenue) {
    const discrepancy = Math.abs((fintraData.revenue - fmpMetrics.revenue) / fmpMetrics.revenue) * 100;
    
    if (discrepancy > 5) {
      alerts.push({
        ticker,
        alert_type: 'FMP_DISCREPANCY',
        severity: discrepancy > 15 ? 'HIGH' : 'MEDIUM',
        metric: 'revenue',
        fintra_value: fintraData.revenue,
        fmp_value: fmpMetrics.revenue,
        discrepancy_percent: discrepancy
      });
    }
  }
  
  // Save alerts if any
  if (alerts.length > 0) {
    await supabase.from('data_quality_alerts').insert(alerts);
  }
  
  return alerts;
}

// 3. Integrar en snapshot cron
// En /app/api/cron/snapshot/route.ts
async function processTickerSnapshot(ticker: string) {
  // ... existing logic ...
  
  // Cross-check después de calcular
  const alerts = await crossCheckWithFMP(ticker, calculatedData);
  
  if (alerts.length > 0) {
    console.warn(`[${ticker}] Data quality alerts:`, alerts);
  }
  
  // ... continue ...
}

// 4. Vista en Health Dashboard
async function DataQualityAlerts() {
  const { data: alerts } = await supabase
    .from('data_quality_alerts')
    .select('*')
    .eq('resolved', false)
    .order('severity', { ascending: false })
    .limit(50);
  
  return (
    <table>
      <thead>
        <tr>
          <th>Ticker</th>
          <th>Metric</th>
          <th>Fintra Value</th>
          <th>FMP Value</th>
          <th>Discrepancy</th>
          <th>Severity</th>
        </tr>
      </thead>
      <tbody>
        {alerts?.map(alert => (
          <tr key={alert.id} className={getSeverityClass(alert.severity)}>
            <td>{alert.ticker}</td>
            <td>{alert.metric}</td>
            <td>{alert.fintra_value?.toFixed(2)}</td>
            <td>{alert.fmp_value?.toFixed(2)}</td>
            <td>{alert.discrepancy_percent.toFixed(1)}%</td>
            <td>{alert.severity}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Criterios de aceptación:**
- ✔️ Detecta discrepancias >5% entre Fintra TTM y FMP
- ✔️ Clasifica severidad (LOW/MEDIUM/HIGH)
- ✔️ Guarda en tabla `data_quality_alerts`
- ✔️ Visible en Health Dashboard
- ✔️ Se ejecuta automáticamente en cada snapshot

---

(Continuará en siguiente archivo debido a límite de longitud...)

**NOTA: Este archivo tiene 57 items totales. Por brevedad, muestro estructura completa de primeros 10 items. ¿Quieres que genere el archivo completo con los 57 items, o prefieres que me enfoque en un Sprint específico?**

